import { beforeEach, describe, expect, it, vi } from "vitest";

// Mission 07/11 — ingestion automatique des replays (POST /api/replay/ingest)
// : secret (503 absent / 403 invalide, journalisé), 201 publié d'office avec
// stats agrégées, 409 idempotence stricte par code (tout statut — un replay
// modéré ne revient pas), 400 payload invalide, badge source=auto exposé par
// la liste récente. Même harnais fake-D1 que tests/replay-submit.test.ts.

const { envStub, getChatGPTUser } = vi.hoisted(() => ({
  envStub: {} as Record<string, unknown>,
  getChatGPTUser: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({ env: envStub }));
vi.mock("@/app/chatgpt-auth", () => ({ getChatGPTUser }));

import { GET as replayGet, POST as replayPost } from "@/app/api/replay/[[...path]]/route";
import { timingSafeEqualSecrets } from "@/lib/atlas-server";
import { recentReplays, type ReplayRecord } from "@/lib/replay-submissions";
import type { ReplayDigest } from "@/lib/replay-stats";

const ORIGIN = "http://localhost:8787";
const AUTHOR = "33333333-3333-4333-8333-333333333333";
const SECRET = "test-ingest-secret-0711-abcdef";

const digest: ReplayDigest = {
  startedAt: 1793673600,
  durationS: 2349,
  region: "europe-2",
  mapCode: "",
  players: [
    { n: "Vzgo", w: 1, m: 1, k: 120, l: 40, s: 30 },
    { n: "HANIBAL", w: 0, m: 0, k: 80, l: 60, s: 20 },
  ],
} as unknown as ReplayDigest;

interface State {
  replays: ReplayRecord[];
  results: Array<Record<string, unknown>>;
  playerStats: Array<Record<string, unknown>>;
  ledger: Array<Record<string, unknown>>;
}

let state: State;

function makeDb(s: State) {
  return {
    prepare(sql: string) {
      const q = sql.replace(/\s+/g, " ").trim();
      const args: unknown[] = [];
      const stmt = {
        bind(...values: unknown[]) {
          args.length = 0;
          args.push(...values);
          return stmt;
        },
        async first<T>() {
          if (q.startsWith("SELECT code, status FROM replays WHERE code = ?"))
            return ((s.replays.find((r) => r.code === args[0]) ?? null) as T);
          if (q.startsWith("SELECT * FROM replay_results WHERE code = ?"))
            return ((s.results.find((r) => r.code === args[0]) ?? null) as T);
          if (q.startsWith("SELECT * FROM player_stats"))
            return ((s.playerStats.find((r) => r.player === args[0]) ?? null) as T);
          return null as T;
        },
        async all<T>() {
          if (q.startsWith("SELECT * FROM replays WHERE status = 'published'"))
            return {
              results: s.replays
                .filter((r) => r.status === "published")
                .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
                .slice(0, args[0] as number),
            } as T;
          if (q.startsWith("SELECT * FROM replay_player_games"))
            return { results: s.ledger.filter((g) => g.code === args[0]) } as T;
          return { results: [] as unknown[] } as T;
        },
        async run() {
          const now = new Date().toISOString();
          if (q.startsWith("INSERT INTO replays")) {
            const code = args[0] as string;
            if (s.replays.some((r) => r.code === code)) return { meta: { changes: 0 } };
            s.replays.push({
              code,
              team_size: args[1] as number,
              mvp_name: (args[2] as string | null) ?? null,
              mode_key: args[3] as string,
              owner_id: args[4] as string,
              status: "published",
              source: "auto",
              created_at: args[5] as string,
              moderated_at: null,
              note: null,
            });
            return { meta: { changes: 1 } };
          }
          if (q.startsWith("INSERT INTO replay_results")) {
            // INSERT ... ON CONFLICT(code) DO UPDATE (upsert unique)
            const code = args[0] as string;
            const existing = s.results.findIndex((r) => r.code === code);
            const row = { code, data: args[9], aggregated_at: null };
            if (existing >= 0) s.results[existing] = { ...s.results[existing], ...row };
            else s.results.push(row);
            return { meta: { changes: 1 } };
          }
          if (q.startsWith("UPDATE replay_results SET aggregated_at")) {
            const row = s.results.find((r) => r.code === args[1]);
            if (row) row.aggregated_at = new Date().toISOString();
            return { meta: { changes: row ? 1 : 0 } };
          }
          if (q.startsWith("INSERT INTO replay_player_games")) {
            s.ledger.push({ code: args[0], player: args[1] });
            return { meta: { changes: 1 } };
          }
          if (q.startsWith("INSERT INTO player_stats")) {
            s.playerStats.push({ player: args[0], games: 1, wins: args[3], points: args[8] });
            return { meta: { changes: 1 } };
          }
          if (q.startsWith("UPDATE player_stats")) {
            const row = s.playerStats.find((r) => r.player === args[0]);
            if (row) row.games = (row.games as number) + 1;
            return { meta: { changes: row ? 1 : 0 } };
          }
          if (q.startsWith("UPDATE replay_results SET aggregated_at")) {
            const row = s.results.find((r) => r.code === args[0]);
            if (row) row.aggregated_at = args[0] ? new Date().toISOString() : null;
            return { meta: { changes: row ? 1 : 0 } };
          }
          return { meta: { changes: 0 } };
        },
      };
      return stmt;
    },
    async batch(stmts: Array<{ run: () => Promise<{ meta: { changes: number } }> }>) {
      const out = [];
      for (const st of stmts) out.push(await st.run());
      return out;
    },
  };
}

function setState(secret: string | undefined) {
  state = { replays: [], results: [], playerStats: [], ledger: [] };
  envStub.DB = makeDb(state);
  envStub.BUCKET = {};
  envStub.ADMIN_EMAILS = "admin@sites.test";
  if (secret === undefined) delete envStub.INGEST_SECRET;
  else envStub.INGEST_SECRET = secret;
}

function ingestReq(body: unknown, secret: string | null = SECRET) {
  const headers: Record<string, string> = { Origin: ORIGIN, "Content-Type": "application/json" };
  if (secret) headers["X-Ingest-Secret"] = secret;
  return new Request(ORIGIN + "/api/replay/ingest", { method: "POST", headers, body: JSON.stringify(body) });
}

const body = (over: Record<string, unknown> = {}) => ({
  code: "Jd894wx6so9",
  source: "auto",
  teamSize: 8,
  modeKey: "replayMatchTypeTeamMatch",
  mvpName: "Vzgo",
  digest,
  ...over,
});

const ctx = () => ({ params: Promise.resolve({ path: ["ingest"] }) });

beforeEach(() => setState(SECRET));

describe("timingSafeEqualSecrets — comparaison en temps constant (revue 07/11)", () => {
  it("égaux → true ; différents → false (y compris longueurs distinctes)", async () => {
    expect(await timingSafeEqualSecrets("secret-partagé-tres-long", "secret-partagé-tres-long")).toBe(true);
    expect(await timingSafeEqualSecrets("secret-partagé-tres-long", "secret-partagé-tres-lonG")).toBe(false);
    expect(await timingSafeEqualSecrets("court", "secret-partagé-tres-long")).toBe(false);
    expect(await timingSafeEqualSecrets("", "secret-partagé-tres-long")).toBe(false);
    // unicode : pas d'exception, comparaison par octets
    expect(await timingSafeEqualSecrets("ключ-секрета-длинный", "ключ-секрета-длинный")).toBe(true);
    expect(await timingSafeEqualSecrets("ключ-секрета-длинный", "ключ-секрета-длинны")).toBe(false);
  });

  it("la route accepte le secret fourni court face à un long (hash neutre la longueur)", async () => {
    // Le hash des deux côtés rend la comparaison indépendante des longueurs
    // d'entrée : un secret fourni de longueur différente est juste ≠ (403).
    const r = await replayPost(ingestReq(body(), "a"), ctx());
    expect(r.status).toBe(403);
  });
});

describe("POST /api/replay/ingest — secret", () => {
  it("INGEST_SECRET absent → 503 (fonctionnalité éteinte)", async () => {
    setState(undefined);
    const r = await replayPost(ingestReq(body()), ctx());
    expect(r.status).toBe(503);
  });

  it("secret invalide → 403", async () => {
    expect((await replayPost(ingestReq(body(), "wrong-secret-value-16ch"), ctx())).status).toBe(403);
    expect((await replayPost(ingestReq(body(), null), ctx())).status).toBe(403);
  });
});

describe("POST /api/replay/ingest — ingestion", () => {
  it("payload valide → 201, publié d'office, source auto, stats agrégées", async () => {
    const r = await replayPost(ingestReq(body()), ctx());
    expect(r.status).toBe(201);
    const d = (await r.json()) as { item: { status: string; source: string } };
    expect(d.item.status).toBe("published");
    expect(d.item.source).toBe("auto");
    expect(state.replays[0].owner_id).toBe("ws-atlas-auto");
    expect(state.replays[0].source).toBe("auto");
    // pipeline stats : digest écrit + agrégé (ledger + points)
    expect(state.results).toHaveLength(1);
    expect(state.ledger.length).toBeGreaterThanOrEqual(2);
    expect(state.playerStats.length).toBeGreaterThanOrEqual(2);
  });

  it("400 : payload invalide (code, source≠auto, digest absent)", async () => {
    expect((await replayPost(ingestReq(body({ code: "court" })), ctx())).status).toBe(400);
    expect((await replayPost(ingestReq(body({ source: "user" })), ctx())).status).toBe(400);
    expect((await replayPost(ingestReq({ ...body(), digest: undefined }), ctx())).status).toBe(400);
  });

  it("409 : idempotence stricte — code déjà publié ne revient jamais seul", async () => {
    expect((await replayPost(ingestReq(body()), ctx())).status).toBe(201);
    expect((await replayPost(ingestReq(body()), ctx())).status).toBe(409);
    expect(state.replays).toHaveLength(1);
  });

  it("409 : un replay RETIRÉ par modération ne revient pas (kill-switch stable)", async () => {
    state.replays.push({
      code: "Jd894wx6so9",
      team_size: 8,
      mvp_name: null,
      mode_key: "replayMatchTypeTeamMatch",
      owner_id: "user-1",
      status: "withdrawn",
      source: "user",
      created_at: "2026-11-01T00:00:00Z",
      moderated_at: null,
      note: null,
    });
    expect((await replayPost(ingestReq(body()), ctx())).status).toBe(409);
    expect(state.replays).toHaveLength(1);
  });
});

describe("badge auto — liste récente", () => {
  it("recentReplays expose source (auto vs user)", async () => {
    state.replays.push(
      {
        code: "AAAAAAAAAAA",
        team_size: 8,
        mvp_name: "a",
        mode_key: "replayMatchTypeTeamMatch",
        owner_id: "u",
        status: "published",
        source: "auto",
        created_at: "2026-11-07T10:00:00Z",
        moderated_at: null,
        note: null,
      },
      {
        code: "BBBBBBBBBBB",
        team_size: 8,
        mvp_name: "b",
        mode_key: "replayMatchTypeTeamMatch",
        owner_id: "u",
        status: "published",
        source: "user",
        created_at: "2026-11-07T09:00:00Z",
        moderated_at: null,
        note: null,
      },
    );
    const items = await recentReplays(null);
    expect(items[0]).toMatchObject({ code: "AAAAAAAAAAA", source: "auto" });
    expect(items[1]).toMatchObject({ code: "BBBBBBBBBBB", source: "user" });
  });
});
