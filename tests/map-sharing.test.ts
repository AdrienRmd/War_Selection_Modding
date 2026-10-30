import { beforeEach, describe, expect, it, vi } from "vitest";

// V2-P2 — SB5/SB6/SB7 : soumission par code de partage (ZIP optionnel),
// statut de test déclaré par l'auteur (surplomb admin), badge créateur
// vérifié. Tests purs (regex/vocabulaire) + tests de route avec D1/R2 moqués
// (même pattern que tests/account-profile-route.test.ts).

const { envStub, getChatGPTUser } = vi.hoisted(() => ({
  envStub: {} as Record<string, unknown>,
  getChatGPTUser: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({ env: envStub }));
vi.mock("@/app/chatgpt-auth", () => ({ getChatGPTUser }));

import { POST as atlasPost, PATCH as atlasPatch } from "@/app/api/atlas/[[...path]]/route";
import {
  MAP_CODE_MAX_LENGTH,
  MAP_CODE_PATTERN,
  mapCodeLooksPlausible,
  mapTestLabels,
  normalizeMapCode,
  mapTestStates,
} from "@/lib/map-code";
import { collectionTestStates } from "@/lib/collection";
import { translate } from "@/lib/i18n";
import type { MapRecord } from "@/lib/atlas-server";

const ORIGIN = "http://localhost:8787";
const AUTHOR_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ID = "33333333-3333-4333-8333-333333333333";

// ---------------------------------------------------------------- regex / vocabulaire

describe("SB5 — format du code de partage (regex stricte, 172 seeds = map-XXXXXXXX hexa minuscule)", () => {
  it("accepte le format natif constaté en base", () => {
    for (const code of ["map-1c54042c", "map-00000000", "map-ffffffff", "map-906080b0"])
      expect(MAP_CODE_PATTERN.test(code), code).toBe(true);
  });
  it("rejette les variantes hors format (avertissement, jamais blocage)", () => {
    for (const code of [
      "",
      "map-1C54042C",
      "map-1c54042",
      "map-1c54042cc",
      "MAP-1c54042c",
      "1c54042c",
      "map-1c54g42c",
    ])
      expect(mapCodeLooksPlausible(code), code).toBe(false);
  });
  it("nettoie sans durcir : trim + plafond 150 (le serveur reste tolérant)", () => {
    expect(normalizeMapCode("  map-1c54042c  ")).toBe("map-1c54042c");
    expect(normalizeMapCode("x".repeat(400)).length).toBe(MAP_CODE_MAX_LENGTH);
    expect(mapCodeLooksPlausible("  map-1c54042c  ")).toBe(true);
  });
});

describe("SB6 — vocabulaire du statut de test = vocabulaire collection", () => {
  it("mapTestStates est identique à collectionTestStates", () => {
    expect([...mapTestStates]).toEqual([...collectionTestStates]);
  });
  it("les 4 libellés existent en français (badge public localisé)", () => {
    for (const state of mapTestStates) {
      const [zh] = mapTestLabels[state];
      const fr = translate(zh, "fr");
      expect(fr, state).not.toBe(zh);
    }
  });
});

// ---------------------------------------------------------------- mocks D1/R2

function mapRecord(overrides: Partial<MapRecord> = {}): MapRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    owner_id: AUTHOR_ID,
    author: "Ada Code",
    title: "Carte QA",
    summary: "résumé de test",
    description: "description de test suffisamment longue pour la validation.",
    game_version: "v42",
    players: 8,
    category: "历史战役",
    mods: "无",
    map_code: "map-1c54042c",
    status: "approved",
    file_name: "carte.zip",
    file_key: "submissions/x/map.zip",
    file_size: 1024,
    sha256: "a".repeat(64),
    cover_key: null,
    cover_type: null,
    created_at: "2026-10-01T00:00:00Z",
    reviewed_at: "2026-10-02T00:00:00Z",
    feedback: "",
    revision: 1,
    test_status: "untested",
    test_updated_at: null,
    test_set_by: null,
    test_notes: "",
    author_verified: 1,
    ...overrides,
  };
}

interface Log {
  sql: string[];
  bindings: unknown[][];
  inserts: Record<string, unknown>[];
  updates: string[];
  row: MapRecord | null;
  quota: { pending: number; daily: number };
  changes: number;
}

function makeDb(log: Log) {
  const db = {
    prepare(sql: string) {
      log.sql.push(sql);
      const step = {
        bind(...args: unknown[]) {
          log.bindings.push(args);
          return {
            first: async () => {
              if (sql.includes("SELECT id, owner_id FROM maps")) return null;
              if (sql.includes("SUM(CASE WHEN status = 'pending'")) return log.quota;
              return log.row;
            },
            all: async () => ({ results: log.row ? [log.row] : [] }),
            run: async () => {
              log.updates.push(sql);
              if (sql.startsWith("INSERT INTO maps")) {
                const [id, owner, author] = log.bindings.at(-1) as unknown[];
                log.inserts.push({ id, owner, author, args: log.bindings.at(-1) });
              }
              return { meta: { changes: log.changes } };
            },
          };
        },
      };
      return step;
    },
    // batch : chaque statement du lot est un prepare().bind() déjà construit —
    // on exécute leur run() dans l'ordre (miroir du D1.batch réel).
    async batch(statements: { run: () => Promise<{ meta: { changes: number } }> }[]) {
      const results = [];
      for (const s of statements) results.push(await s.run());
      return results;
    },
  };
  return db;
}

function makeBucket() {
  return {
    puts: [] as string[],
    async put(key: string) {
      this.puts.push(key);
    },
    async delete() {},
    async get() {
      return null;
    },
  };
}

const form = (fields: Record<string, string>, files: Record<string, File> = {}) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  for (const [k, v] of Object.entries(files)) f.set(k, v);
  return f;
};

const baseFields = {
  title: "Carte code-only",
  author: "Ada Code",
  summary: "Une carte soumise par code de partage uniquement.",
  description:
    "Description suffisamment longue (30+ caractères) pour passer la validation du formulaire de soumission.",
  game_version: "v42",
  players: "8",
  category: "历史战役",
  mods: "无",
  rights: "true",
};

let log: Log;
let bucket: ReturnType<typeof makeBucket>;

beforeEach(() => {
  vi.clearAllMocks();
  log = {
    sql: [],
    bindings: [],
    inserts: [],
    updates: [],
    row: null,
    quota: { pending: 0, daily: 0 },
    changes: 1,
  };
  envStub.DB = makeDb(log);
  bucket = makeBucket();
  envStub.BUCKET = bucket;
});

const postSubmission = (body: FormData, user = authorUser(), id = crypto.randomUUID()) => {
  getChatGPTUser.mockResolvedValue(user);
  return atlasPost(
    new Request(`${ORIGIN}/api/atlas/submissions`, {
      method: "POST",
      headers: { origin: ORIGIN, "x-submission-id": id },
      body,
    }),
    { params: Promise.resolve({ path: ["submissions"] }) },
  );
};

function authorUser() {
  return { userId: AUTHOR_ID, displayName: "Ada Code", email: "ada@example.test" };
}

const patchTestStatus = (
  id: string,
  body: unknown,
  user = authorUser(),
) => {
  getChatGPTUser.mockResolvedValue(user);
  return atlasPatch(
    new Request(`${ORIGIN}/api/atlas/test-status/${id}`, {
      method: "PATCH",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ path: ["test-status", id] }) },
  );
};

// ---------------------------------------------------------------- SB5 — POST soumission

describe("SB5 — soumission carte : code OU ZIP", () => {
  it("code seul (sans fichier, sans couverture) est accepté : pending, colonnes fichiers vides, aucun objet R2", async () => {
    const r = await postSubmission(form({ ...baseFields, map_code: "map-1c54042c" }));
    expect(r.status).toBe(201);
    const insert = log.bindings.at(-1) as unknown[];
    // id, owner, author, title, summary, description, game_version, players,
    // category, mods, map_code, file_name(11), file_key(12), file_size(13),
    // sha256(14), cover_key(15), cover_type(16), created_at(17), author_verified(18)
    expect(insert[11]).toBe("");
    expect(insert[12]).toBe("");
    expect(insert[13]).toBe(0);
    expect(insert[14]).toBe("");
    expect(bucket.puts).toEqual([]);
    // SB7 : badge créateur vérifié — match exact auteur ↔ displayName.
    expect(insert[18]).toBe(1);
  });

  it("ni code ni fichier → 400 (le contournement par requête directe est couvert ici)", async () => {
    const r = await postSubmission(form({ ...baseFields, map_code: "" }));
    expect(r.status).toBe(400);
    expect(log.inserts).toEqual([]);
  });

  it("ZIP invalide sans code → 400 (le fichier reste obligatoirement un ZIP lisible)", async () => {
    const bad = new File([new Uint8Array([1, 2, 3, 4, 5])], "map.zip", {
      type: "application/zip",
    });
    const r = await postSubmission(form({ ...baseFields, map_code: "" }, { file: bad }));
    expect(r.status).toBe(400);
  });

  it("author différent du pseudo → author_verified = 0 (pas de fuzzy)", async () => {
    const r = await postSubmission(
      form({ ...baseFields, map_code: "map-1c54042c", author: "Ada Code Team" }),
    );
    expect(r.status).toBe(201);
    const insert = log.bindings.at(-1) as unknown[];
    expect(insert[18]).toBe(0);
  });
});

// ---------------------------------------------------------------- SB6 — statut de test

describe("SB6 — statut de test déclaré par l'auteur", () => {
  const today = new Date().toISOString().slice(0, 10);
  const mapId = mapRecord().id;

  it("l'auteur déclare « fonctionne » : statut + date + révision, sans re-modération (status reste approved)", async () => {
    log.row = mapRecord();
    const r = await patchTestStatus(mapId, {
      status: "working",
      tested_at: today,
      game_version: "v42.1",
      notes: "2 parties complètes, 8 joueurs, aucune erreur.",
      revision: 1,
    });
    expect(r.status).toBe(200);
    const body = (await r.json()) as { test_status: string; revision: number };
    expect(body.test_status).toBe("working");
    expect(body.revision).toBe(2);
    const update = log.updates.find((s) => s.includes("test_status = ?"))!;
    expect(update).toContain("revision = revision + 1");
    expect(update).not.toContain("status = 'pending'");
    const args = log.bindings.at(-1) as unknown[];
    expect(args[0]).toBe("working");
    expect(args[2]).toBe("author");
  });

  it("notes et date obligatoires dès que le statut ≠ untested", async () => {
    log.row = mapRecord();
    const r = await patchTestStatus(mapId, { status: "working", tested_at: "", notes: "", revision: 1 });
    expect(r.status).toBe(400);
  });

  it("date future refusée (garde-fou collectionBodySchema)", async () => {
    log.row = mapRecord();
    const r = await patchTestStatus(mapId, {
      status: "issues",
      tested_at: "2999-01-01",
      notes: "x",
      revision: 1,
    });
    expect(r.status).toBe(400);
  });

  it("un compte tiers ne peut pas déclarer (403)", async () => {
    log.row = mapRecord();
    const r = await patchTestStatus(
      mapId,
      { status: "working", tested_at: today, notes: "n", revision: 1 },
      { userId: OTHER_ID, displayName: "Mallory", email: "m@example.test" },
    );
    expect(r.status).toBe(403);
  });

  it("surplomb admin : autorisé et journalisé dans reviews (surpassement)", async () => {
    envStub.ADMIN_EMAILS = "admin@example.test";
    log.row = mapRecord({ test_set_by: "author", test_status: "working" });
    const r = await patchTestStatus(
      mapId,
      { status: "unavailable", tested_at: today, notes: "Code mort confirmé par l'équipe.", revision: 1 },
      { userId: OTHER_ID, displayName: "Admin", email: "admin@example.test" },
    );
    expect(r.status).toBe(200);
    const insertReview = log.updates.find((s) => s.includes("INSERT INTO reviews"));
    expect(insertReview, "journal du surpassement admin").toBeTruthy();
    expect(log.bindings.some((b) => b[0] === "unavailable")).toBe(true);
  });

  it("révision périmée → 409 (pas d'écrasement concurrent)", async () => {
    log.changes = 0; // le UPDATE WHERE revision=? ne matche pas la ligne
    log.row = mapRecord({ revision: 7 });
    const r = await patchTestStatus(mapId, { status: "working", tested_at: today, notes: "n", revision: 1 });
    expect(r.status).toBe(409);
  });

  it("carte non publiée → 404 (le statut de test n'existe qu'après publication)", async () => {
    log.row = mapRecord({ status: "pending" });
    const r = await patchTestStatus(mapId, { status: "working", tested_at: today, notes: "n", revision: 1 });
    expect(r.status).toBe(404);
  });
});
