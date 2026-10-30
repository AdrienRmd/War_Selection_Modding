import { beforeEach, describe, expect, it, vi } from "vitest";

// V2-P5 — SB5-e (IMPORTANT n°1 de la revue qualité vague 2) : les quotas de
// soumission 3 pending / 5-24 h sont vérifiés par des tests pour le cas
// code-only (sans ZIP). Le serveur verrouille doublement :
//   1. contrôle anticipé route.ts (SELECT SUM …) → 429 « 每人最多 3 份… » ;
//   2. INSERT…SELECT atomique (WHERE COUNT < 3 AND COUNT < 5) → 429
//      « 已达到投稿限额… » si une soumission concurrente s'est glissée entre
//      les deux.
// Le retrait (withdraw) libère un quota pending mais JAMAIS le quota
// journalier (created_at inchangé) — comportement verrouillé ici.

const { envStub, getChatGPTUser } = vi.hoisted(() => ({
  envStub: {} as Record<string, unknown>,
  getChatGPTUser: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({ env: envStub }));
vi.mock("@/app/chatgpt-auth", () => ({ getChatGPTUser }));

import { POST as atlasPost } from "@/app/api/atlas/[[...path]]/route";
import type { MapRecord } from "@/lib/atlas-server";

const ORIGIN = "http://localhost:8787";
const AUTHOR_ID = "22222222-2222-4222-8222-222222222222";

const RECENT = () => new Date(Date.now() - 3_600_000).toISOString(); // il y a 1 h
const OLD = () => new Date(Date.now() - 3 * 86_400_000).toISOString(); // il y a 3 j

let seq = 0;
// Graine « code-only » : aucune colonne fichier (SB5), pending par défaut.
function seed(overrides: Partial<MapRecord> = {}): MapRecord {
  seq += 1;
  return {
    id: `0000000a-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    owner_id: AUTHOR_ID,
    author: "Ada Code",
    title: "Carte quota",
    summary: "résumé de graine",
    description: "description de graine",
    game_version: "v42",
    players: 8,
    category: "历史战役",
    mods: "无",
    map_code: "map-1c54042c",
    status: "pending",
    file_name: "",
    file_key: "",
    file_size: 0,
    sha256: "",
    cover_key: null,
    cover_type: null,
    created_at: RECENT(),
    reviewed_at: null,
    feedback: "",
    revision: 1,
    test_status: "untested",
    test_updated_at: null,
    test_set_by: null,
    test_notes: "",
    author_verified: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------- fake D1/R2 avec état

interface State {
  maps: MapRecord[];
  // Déclenché au moment du contrôle anticipé de quota : simule une
  // soumission concurrente qui s'insère ENTRE le contrôle et l'INSERT
  // (seul le verrou atomique INSERT…SELECT peut encore la voir).
  onQuotaRead?: () => void;
}

function makeDb(state: State) {
  const norm = (sql: string) => sql.replace(/\s+/g, " ").trim();
  const ofOwner = (owner: string) => state.maps.filter((m) => m.owner_id === owner);
  const exec = (sql: string, args: unknown[]) => ({
    first: async () => {
      if (sql === "SELECT id, owner_id FROM maps WHERE id = ?")
        return state.maps.find((m) => m.id === args[0]) ?? null;
      if (sql.includes("SUM(CASE WHEN status = 'pending'")) {
        const rows = ofOwner(args[1] as string);
        const counts = {
          pending: rows.filter((m) => m.status === "pending").length,
          daily: rows.filter((m) => m.created_at > (args[0] as string)).length,
        };
        state.onQuotaRead?.(); // la course commence APRÈS la lecture
        return counts;
      }
      if (sql === "SELECT file_key FROM maps WHERE id = ? AND owner_id = ?")
        return state.maps.find((m) => m.id === args[0] && m.owner_id === args[1]) ?? null;
      return null;
    },
    all: async () => ({ results: [] }),
    run: async () => {
      // Miroir exact du WHERE atomique du serveur : le compte est relu à
      // l'écriture, pas réutilisé du contrôle anticipé.
      if (sql.startsWith("INSERT INTO maps")) {
        const owner = args[1] as string;
        const since = args[21] as string;
        const rows = ofOwner(owner);
        const pending = rows.filter((m) => m.status === "pending").length;
        const daily = rows.filter((m) => m.created_at > since).length;
        if (pending >= 3 || daily >= 5) return { meta: { changes: 0 } };
        state.maps.push({
          id: args[0] as string,
          owner_id: owner,
          author: args[2] as string,
          title: args[3] as string,
          summary: args[4] as string,
          description: args[5] as string,
          game_version: args[6] as string,
          players: args[7] as number,
          category: args[8] as string,
          mods: args[9] as string,
          map_code: args[10] as string,
          status: "pending",
          file_name: args[11] as string,
          file_key: args[12] as string,
          file_size: args[13] as number,
          sha256: args[14] as string,
          cover_key: args[15] as string | null,
          cover_type: args[16] as string | null,
          created_at: args[17] as string,
          reviewed_at: null,
          feedback: "",
          revision: 0,
          test_status: "untested",
          test_updated_at: null,
          test_set_by: null,
          test_notes: "",
          author_verified: args[18] as number,
        });
        return { meta: { changes: 1 } };
      }
      if (sql.startsWith("UPDATE maps SET status = 'withdrawn'")) {
        const m = state.maps.find(
          (x) => x.id === args[0] && x.owner_id === args[1] && x.status !== "withdrawn",
        );
        if (!m) return { meta: { changes: 0 } };
        m.status = "withdrawn";
        m.revision += 1;
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    },
  });
  return {
    prepare(rawSql: string) {
      const sql = norm(rawSql);
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

let state: State;
interface FakeBucket {
  puts: string[];
  deletes: (string | string[])[];
  put(key: string): Promise<void>;
  delete(keys: string | string[]): Promise<void>;
  get(): Promise<null>;
}
let bucket: FakeBucket;

beforeEach(() => {
  vi.clearAllMocks();
  envStub.ADMIN_EMAILS = "";
  state = { maps: [] };
  envStub.DB = makeDb(state);
  bucket = {
    puts: [],
    deletes: [],
    async put(key: string) {
      this.puts.push(key);
    },
    async delete(keys: string | string[]) {
      this.deletes.push(keys);
    },
    async get() {
      return null;
    },
  } satisfies FakeBucket;
  envStub.BUCKET = bucket;
});

const authorUser = () => ({
  userId: AUTHOR_ID,
  displayName: "Ada Code",
  email: "ada@example.test",
});

const baseFields = {
  title: "Carte code-only quota",
  author: "Ada Code",
  summary: "Soumission par code de partage uniquement, sans ZIP.",
  description: "Description suffisamment longue (30+ caractères) pour la validation du formulaire.",
  game_version: "v42",
  players: "8",
  category: "历史战役",
  mods: "无",
  rights: "true",
};

const postSubmission = (id = crypto.randomUUID()) => {
  getChatGPTUser.mockResolvedValue(authorUser());
  const f = new FormData();
  for (const [k, v] of Object.entries({ ...baseFields, map_code: "map-1c54042c" })) f.set(k, v);
  return atlasPost(
    new Request(`${ORIGIN}/api/atlas/submissions`, {
      method: "POST",
      headers: { origin: ORIGIN, "x-submission-id": id },
      body: f,
    }),
    { params: Promise.resolve({ path: ["submissions"] }) },
  );
};

const withdraw = (id: string) => {
  getChatGPTUser.mockResolvedValue(authorUser());
  return atlasPost(
    new Request(`${ORIGIN}/api/atlas/withdraw/${id}`, {
      method: "POST",
      headers: { origin: ORIGIN },
    }),
    { params: Promise.resolve({ path: ["withdraw", id] }) },
  );
};

// ---------------------------------------------------------------- SB5-e

describe("SB5-e — quotas de soumission (3 pending / 5-24 h), cas code-only", () => {
  it("3 pending → 429 contrôle anticipé : message exact, aucune ligne, aucun objet R2", async () => {
    state.maps = [seed(), seed(), seed()]; // 3 pending récents (daily = 3 < 5)
    const r = await postSubmission();
    expect(r.status).toBe(429);
    const body = (await r.json()) as { error: string };
    expect(body.error).toBe("每人最多 3 份待审核稿件，24 小时内最多 5 次投稿。请等待审核。");
    expect(state.maps).toHaveLength(3); // rien d'inséré
    expect(bucket.puts).toEqual([]); // code-only : jamais d'objet R2
  });

  it("5 créations sur 24 h (pending < 3) → 429 : le quota journalier borne aussi le code-only", async () => {
    state.maps = [
      seed({ status: "approved", reviewed_at: RECENT() }),
      seed({ status: "approved", reviewed_at: RECENT() }),
      seed({ status: "rejected", reviewed_at: RECENT() }),
      seed(),
      seed(),
    ]; // pending = 2, daily = 5
    const r = await postSubmission();
    expect(r.status).toBe(429);
    expect(((await r.json()) as { error: string }).error).toContain("24 小时内最多 5 次");
    expect(state.maps).toHaveLength(5);
  });

  it("anciennes créations (> 24 h) hors quota : 3 approved anciennes + 2 pending → 201", async () => {
    state.maps = [
      seed({ status: "approved", created_at: OLD(), reviewed_at: OLD() }),
      seed({ status: "approved", created_at: OLD(), reviewed_at: OLD() }),
      seed({ status: "approved", created_at: OLD(), reviewed_at: OLD() }),
      seed(),
      seed(),
    ]; // pending = 2, daily = 2 (les 3 anciennes sortent de la fenêtre)
    const r = await postSubmission();
    expect(r.status).toBe(201);
    expect(state.maps).toHaveLength(6);
  });

  it("retrait d'une pending → quota récupéré : nouvelle soumission acceptée, puis re-saturation → 429", async () => {
    state.maps = [seed(), seed(), seed()];
    expect((await postSubmission()).status).toBe(429); // saturé
    const w = await withdraw(state.maps[0]!.id);
    expect(w.status).toBe(200);
    expect(((await w.json()) as { status: string }).status).toBe("withdrawn");
    expect(state.maps[0]!.status).toBe("withdrawn");

    const r = await postSubmission();
    expect(r.status).toBe(201); // 2 pending + 1 retirée → place libérée
    const inserted = state.maps.at(-1)!;
    expect(inserted.status).toBe("pending");
    expect(inserted.file_key).toBe(""); // bien code-only
    expect(state.maps.filter((m) => m.status === "pending")).toHaveLength(3);

    expect((await postSubmission()).status).toBe(429); // re-saturé
    expect(state.maps).toHaveLength(4);
  });

  it("le retrait ne récupère PAS le quota journalier (created_at inchangé)", async () => {
    state.maps = [
      seed({ status: "approved", reviewed_at: RECENT() }),
      seed({ status: "approved", reviewed_at: RECENT() }),
      seed({ status: "approved", reviewed_at: RECENT() }),
      seed(),
      seed(),
    ]; // daily = 5
    expect((await postSubmission()).status).toBe(429);
    expect((await withdraw(state.maps[0]!.id)).status).toBe(200);
    // Le retrait sort la carte de l'affichage public mais ne rejoue pas
    // l'horloge : 5 créations dans les 24 h restent 5 créations.
    const r = await postSubmission();
    expect(r.status).toBe(429);
    expect(((await r.json()) as { error: string }).error).toContain("24 小时内最多 5 次");
  });

  it("verrou atomique : soumission concurrente entre contrôle et INSERT → 429 (deuxième verrou)", async () => {
    state.maps = [seed(), seed()]; // contrôle anticipé : pending = 2 → passe
    state.onQuotaRead = () => {
      state.maps.push(seed()); // concurrent : pending passe à 3 après la lecture
    };
    const r = await postSubmission();
    expect(r.status).toBe(429);
    expect(((await r.json()) as { error: string }).error).toBe("已达到投稿限额，请稍后再试。");
    expect(state.maps).toHaveLength(3); // le concurrent est là, nous non
  });

  it("idempotence : réenvoi du même X-Submission-Id ne consomme pas le quota (3 pending)", async () => {
    const id = crypto.randomUUID();
    state.maps = [seed({ id }), seed(), seed()];
    const r = await postSubmission(id);
    expect(r.status).toBe(200);
    expect(((await r.json()) as { status: string }).status).toBe("received");
    expect(state.maps).toHaveLength(3); // aucune nouvelle ligne malgré quota saturé
  });
});
