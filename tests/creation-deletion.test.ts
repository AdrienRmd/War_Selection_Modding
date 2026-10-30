import { beforeEach, describe, expect, it, vi } from "vitest";

// V2-P3 — SB4a : suppression définitive d'une de SES créations (carte via
// DELETE /api/atlas/submissions/{id}, mod via DELETE /api/mods/submissions/{id}).
// D4 ADOPTÉE : purge de la ligne + reviews + objets R2. Critère n°1 de la
// revue dev-secu : ces endpoints ne doivent JAMAIS permettre de supprimer les
// données d'autrui (tiers → 403, anonyme → 401, IDOR impossible).

const { envStub, getChatGPTUser } = vi.hoisted(() => ({
  envStub: {} as Record<string, unknown>,
  getChatGPTUser: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({ env: envStub }));
vi.mock("@/app/chatgpt-auth", () => ({ getChatGPTUser }));

import { DELETE as atlasDelete } from "@/app/api/atlas/[[...path]]/route";
import { DELETE as modsDelete } from "@/app/api/mods/[[...path]]/route";
import type { MapRecord } from "@/lib/atlas-server";
import type { ModRecord } from "@/lib/mod-types";

const ORIGIN = "http://localhost:8787";
const AUTHOR_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ID = "33333333-3333-4333-8333-333333333333";
const ADMIN_ID = "44444444-4444-4444-8444-444444444444";

function mapRecord(overrides: Partial<MapRecord> = {}): MapRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    owner_id: AUTHOR_ID,
    author: "Ada Code",
    title: "Carte QA",
    summary: "résumé",
    description: "description",
    game_version: "v42",
    players: 8,
    category: "历史战役",
    mods: "无",
    map_code: "map-1c54042c",
    status: "approved",
    file_name: "carte.zip",
    file_key: "submissions/11111111/a/map.zip",
    file_size: 1024,
    sha256: "a".repeat(64),
    cover_key: "submissions/11111111/a/cover",
    cover_type: "image/png",
    created_at: "2026-10-01T00:00:00Z",
    reviewed_at: "2026-10-02T00:00:00Z",
    feedback: "",
    revision: 3,
    test_status: "untested",
    test_updated_at: null,
    test_set_by: null,
    test_notes: "",
    author_verified: 1,
    ...overrides,
  };
}

function modRecord(overrides: Partial<ModRecord> = {}): ModRecord {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    owner_id: AUTHOR_ID,
    origin: "community",
    body: "{}",
    status: "approved",
    revision: 2,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    feedback: "",
    file_key: "mods/55555555/a/mod.zip",
    file_name: "mod.zip",
    file_size: 2048,
    sha256: "b".repeat(64),
    review_token: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------- fake D1/R2

interface State {
  maps: MapRecord[];
  reviews: { id: string; map_id: string }[];
  community_mods: ModRecord[];
  mod_reviews: { id: string; mod_id: string }[];
}

interface Log {
  sql: string[];
  bindings: unknown[][];
}

function makeDb(state: State, log: Log) {
  const norm = (sql: string) => sql.replace(/\s+/g, " ").trim();
  const exec = (rawSql: string, args: unknown[]) => {
    const sql = norm(rawSql);
    return {
      first: async () => {
        if (sql === "SELECT * FROM maps WHERE id = ?")
          return state.maps.find((m) => m.id === args[0]) ?? null;
        if (sql === "SELECT * FROM community_mods WHERE id = ?")
          return state.community_mods.find((m) => m.id === args[0]) ?? null;
        return null;
      },
      all: async () => {
        // Contrôle de références R2 (purgeObjects) : renvoie les clés des
        // lignes qui référencent l'une des clés liées.
        if (sql.includes("FROM maps WHERE file_key IN")) {
          const keys = new Set(args as string[]);
          const k = [
            ...new Set(
              state.maps.flatMap((m) => [m.file_key, m.cover_key]).filter((key): key is string => !!key && keys.has(key)),
            ),
          ];
          return { results: k.map((key) => ({ k: key })) };
        }
        if (sql.includes("FROM community_mods WHERE file_key IN")) {
          const keys = new Set(args as string[]);
          const k = [
            ...new Set(
              state.community_mods
                .map((m) => m.file_key)
                .filter((key): key is string => !!key && keys.has(key)),
            ),
          ];
          return { results: k.map((key) => ({ k: key })) };
        }
        return { results: [] };
      },
      run: async () => {
        log.bindings.push(args);
        let changes = 0;
        if (
          sql ===
          "DELETE FROM reviews WHERE map_id = ? AND (SELECT revision FROM maps WHERE id = ?) = ?"
        ) {
          // Garde transactionnel : purge seulement si la révision courante
          // de la carte correspond (sinon zéro écriture).
          const guard = state.maps.find((m) => m.id === args[0] && m.revision === args[2]);
          if (guard) {
            const before = state.reviews.length;
            state.reviews = state.reviews.filter((r) => r.map_id !== args[0]);
            changes = before - state.reviews.length;
          }
        } else if (sql === "DELETE FROM maps WHERE id = ? AND revision = ?") {
          const idx = state.maps.findIndex((m) => m.id === args[0] && m.revision === args[1]);
          if (idx !== -1) {
            state.maps.splice(idx, 1);
            changes = 1;
          }
        } else if (
          sql ===
          "DELETE FROM mod_reviews WHERE mod_id = ? AND (SELECT revision FROM community_mods WHERE id = ?) = ?"
        ) {
          const guard = state.community_mods.find(
            (m) => m.id === args[0] && m.revision === args[2],
          );
          if (guard) {
            const before = state.mod_reviews.length;
            state.mod_reviews = state.mod_reviews.filter((r) => r.mod_id !== args[0]);
            changes = before - state.mod_reviews.length;
          }
        } else if (
          sql ===
          "DELETE FROM community_mods WHERE id = ? AND revision = ? AND origin = 'community'"
        ) {
          const idx = state.community_mods.findIndex(
            (m) => m.id === args[0] && m.revision === args[1] && m.origin === "community",
          );
          if (idx !== -1) {
            state.community_mods.splice(idx, 1);
            changes = 1;
          }
        }
        return { meta: { changes } };
      },
    };
  };
  return {
    prepare(sql: string) {
      log.sql.push(norm(sql));
      return {
        bind(...args: unknown[]) {
          return exec(sql, args);
        },
      };
    },
    async batch(statements: { run: () => Promise<{ meta: { changes: number } }> }[]) {
      const results = [];
      for (const s of statements) results.push(await s.run());
      return results;
    },
  };
}

function makeBucket() {
  return {
    deletes: [] as (string | string[])[],
    async put() {},
    async delete(keys: string | string[]) {
      this.deletes.push(keys);
    },
    async get() {
      return null;
    },
  };
}

let state: State;
let bucket: ReturnType<typeof makeBucket>;
let log: Log;

beforeEach(() => {
  vi.clearAllMocks();
  envStub.ADMIN_EMAILS = "";
  state = { maps: [], reviews: [], community_mods: [], mod_reviews: [] };
  log = { sql: [], bindings: [] };
  envStub.DB = makeDb(state, log);
  bucket = makeBucket();
  envStub.BUCKET = bucket;
});

const authorUser = () => ({
  userId: AUTHOR_ID,
  displayName: "Ada Code",
  email: "ada@example.test",
});
const otherUser = () => ({
  userId: OTHER_ID,
  displayName: "Mallory",
  email: "mallory@example.test",
});

const deleteMap = (id: string, revision: number, user = authorUser()) => {
  getChatGPTUser.mockResolvedValue(user);
  return atlasDelete(
    new Request(`${ORIGIN}/api/atlas/submissions/${id}`, {
      method: "DELETE",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ revision }),
    }),
    { params: Promise.resolve({ path: ["submissions", id] }) },
  );
};

const deleteMod = (id: string, revision: number, user = authorUser()) => {
  getChatGPTUser.mockResolvedValue(user);
  return modsDelete(
    new Request(`${ORIGIN}/api/mods/submissions/${id}`, {
      method: "DELETE",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ revision }),
    }),
    { params: Promise.resolve({ path: ["submissions", id] }) },
  );
};

const flatDeletes = () =>
  bucket.deletes.flatMap((entry) => (Array.isArray(entry) ? entry : [entry]));

// ---------------------------------------------------------------- cartes

describe("SB4a — DELETE /api/atlas/submissions/{id}", () => {
  it("le propriétaire supprime : ligne + reviews + objets R2 purgés (D4)", async () => {
    const m = mapRecord();
    state.maps = [
      m,
      mapRecord({
        id: "99999999-9999-4999-8999-999999999999",
        owner_id: OTHER_ID,
        file_key: "submissions/99999999/b/map.zip",
        cover_key: null,
      }),
    ];
    state.reviews = [
      { id: "r1", map_id: m.id },
      { id: "r2", map_id: "99999999-9999-4999-8999-999999999999" },
    ];
    const r = await deleteMap(m.id, 3);
    expect(r.status).toBe(200);
    expect(state.maps.map((x) => x.id)).toEqual(["99999999-9999-4999-8999-999999999999"]);
    // Reviews de la carte purgées, celles d'autrui intactes.
    expect(state.reviews.map((x) => x.id)).toEqual(["r2"]);
    // Les DEUX objets R2 de la carte (ZIP + couverture) purgés — et rien d'autre.
    expect(flatDeletes().sort()).toEqual(
      ["submissions/11111111/a/cover", "submissions/11111111/a/map.zip"].sort(),
    );
    const body = (await r.json()) as { deleted: boolean; purged_objects: number };
    expect(body.deleted).toBe(true);
    expect(body.purged_objects).toBe(2);
  });

  it("404 après suppression : la carte n'existe plus (idempotence visible)", async () => {
    state.maps = [mapRecord()];
    await deleteMap(mapRecord().id, 3);
    const again = await deleteMap(mapRecord().id, 3);
    expect(again.status).toBe(404);
  });

  it("le fichier n'est plus servi : la ligne partie, l'objet purge (purge ligne+R2 vérifiée par fixture)", async () => {
    state.maps = [mapRecord()];
    const r = await deleteMap(mapRecord().id, 3);
    expect(r.status).toBe(200);
    // La requête de contrôle de références a bien été exécutée avant purge.
    expect(log.sql.some((s) => s.includes("FROM maps WHERE file_key IN"))).toBe(true);
  });

  it("carte code-only (SB5) : ligne purgée, AUCUN objet R2 visé", async () => {
    state.maps = [mapRecord({ file_key: "", file_name: "", file_size: 0, cover_key: null })];
    const r = await deleteMap(mapRecord().id, 3);
    expect(r.status).toBe(200);
    expect(flatDeletes()).toEqual([]);
  });

  it("NON-PROPRIÉTAIRE → 403 : la ligne d'autrui reste intacte, aucun objet purgé (IDOR impossible)", async () => {
    const m = mapRecord();
    state.maps = [m];
    state.reviews = [{ id: "r1", map_id: m.id }];
    const r = await deleteMap(m.id, 3, otherUser());
    expect(r.status).toBe(403);
    expect(state.maps).toHaveLength(1);
    expect(state.reviews).toHaveLength(1);
    expect(flatDeletes()).toEqual([]);
  });

  it("anonyme → 401 (garde commune des mutations authentifiées)", async () => {
    getChatGPTUser.mockResolvedValue(null);
    const r = await atlasDelete(
      new Request(`${ORIGIN}/api/atlas/submissions/${mapRecord().id}`, {
        method: "DELETE",
        headers: { origin: ORIGIN, "content-type": "application/json" },
        body: JSON.stringify({ revision: 3 }),
      }),
      { params: Promise.resolve({ path: ["submissions", mapRecord().id] }) },
    );
    expect(r.status).toBe(401);
    expect(state.maps).toHaveLength(0);
  });

  it("admin : peut supprimer la soumission d'un tiers (modération, comme /admin)", async () => {
    envStub.ADMIN_EMAILS = "admin@example.test";
    const m = mapRecord();
    state.maps = [m];
    const r = await deleteMap(m.id, 3, {
      userId: ADMIN_ID,
      displayName: "Admin",
      email: "admin@example.test",
    });
    expect(r.status).toBe(200);
    expect(state.maps).toHaveLength(0);
  });

  it("révision périmée → 409 : rien n'est supprimé (conflict-safe)", async () => {
    const m = mapRecord({ revision: 7 });
    state.maps = [m];
    state.reviews = [{ id: "r1", map_id: m.id }];
    const r = await deleteMap(m.id, 3);
    expect(r.status).toBe(409);
    expect(state.maps).toHaveLength(1);
    expect(state.reviews).toHaveLength(1);
    expect(flatDeletes()).toEqual([]);
  });

  it("un objet R2 encore référencé par une autre ligne n'est PAS purgé (garde du pattern fichiers)", async () => {
    const shared = "submissions/shared/key.zip";
    state.maps = [
      mapRecord({ file_key: shared, cover_key: null }),
      mapRecord({ id: "99999999-9999-4999-8999-999999999999", file_key: shared, cover_key: null }),
    ];
    // On supprime la première : l'autre référence encore la clé partagée.
    const r = await deleteMap(mapRecord().id, 3);
    expect(r.status).toBe(200);
    const body = (await r.json()) as { purged_objects: number };
    expect(body.purged_objects).toBe(0);
    expect(flatDeletes()).toEqual([]);
  });
});

// ---------------------------------------------------------------- mods

describe("SB4a — DELETE /api/mods/submissions/{id}", () => {
  it("le propriétaire supprime un mod communautaire : ligne + mod_reviews + fichier R2 purgés", async () => {
    const m = modRecord();
    state.community_mods = [m];
    state.mod_reviews = [{ id: "mr1", mod_id: m.id }];
    const r = await deleteMod(m.id, 2);
    expect(r.status).toBe(200);
    expect(state.community_mods).toHaveLength(0);
    expect(state.mod_reviews).toHaveLength(0);
    expect(flatDeletes()).toEqual(["mods/55555555/a/mod.zip"]);
  });

  it("mod sans fichier : purgé sans aucun objet R2", async () => {
    state.community_mods = [modRecord({ file_key: null })];
    const r = await deleteMod(modRecord().id, 2);
    expect(r.status).toBe(200);
    expect(flatDeletes()).toEqual([]);
  });

  it("NON-PROPRIÉTAIRE → 403 : rien n'est supprimé", async () => {
    const m = modRecord();
    state.community_mods = [m];
    const r = await deleteMod(m.id, 2, otherUser());
    expect(r.status).toBe(403);
    expect(state.community_mods).toHaveLength(1);
    expect(flatDeletes()).toEqual([]);
  });

  it("anonyme → 401", async () => {
    getChatGPTUser.mockResolvedValue(null);
    const r = await modsDelete(
      new Request(`${ORIGIN}/api/mods/submissions/${modRecord().id}`, {
        method: "DELETE",
        headers: { origin: ORIGIN, "content-type": "application/json" },
        body: JSON.stringify({ revision: 2 }),
      }),
      { params: Promise.resolve({ path: ["submissions", modRecord().id] }) },
    );
    expect(r.status).toBe(401);
  });

  it("entrée éditoriale en base (origin != community) → 400 : contenu du site jamais supprimable ici", async () => {
    const m = modRecord({ origin: "editorial" });
    state.community_mods = [m];
    const r = await deleteMod(m.id, 2);
    expect(r.status).toBe(400);
    expect(state.community_mods).toHaveLength(1);
  });

  it("id d'un seed éditorial hors base → 400 (pas de suppression possible du contenu code)", async () => {
    const r = await deleteMod("github-diplomacy", 0);
    expect(r.status).toBe(400);
  });

  it("révision périmée → 409, ligne intacte", async () => {
    state.community_mods = [modRecord({ revision: 9 })];
    const r = await deleteMod(modRecord().id, 2);
    expect(r.status).toBe(409);
    expect(state.community_mods).toHaveLength(1);
  });

  it("admin : peut supprimer un mod communautaire d'un tiers", async () => {
    envStub.ADMIN_EMAILS = "admin@example.test";
    state.community_mods = [modRecord()];
    const r = await deleteMod(modRecord().id, 2, {
      userId: ADMIN_ID,
      displayName: "Admin",
      email: "admin@example.test",
    });
    expect(r.status).toBe(200);
    expect(state.community_mods).toHaveLength(0);
  });
});
