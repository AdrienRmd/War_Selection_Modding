import { beforeEach, describe, expect, it, vi } from "vitest";

// Replay phase 2 (B1) — agrégation stats joueurs : saison (fallback
// calendaire mensuel, aucun champ saison dans les données), formule de
// points, validation du digest, application/retrait idempotents à la
// publication, rebuild idempotent, quotas soumission inchangés.

const { envStub, getChatGPTUser } = vi.hoisted(() => ({
  envStub: {} as Record<string, unknown>,
  getChatGPTUser: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({ env: envStub }));
vi.mock("@/app/chatgpt-auth", () => ({ getChatGPTUser }));

import {
  GET as replayGet,
  POST as replayPost,
  PATCH as replayPatch,
} from "@/app/api/replay/[[...path]]/route";
import {
  aggregateSeasonStats,
  applyReplayStats,
  categoryOf,
  cleanDigest,
  playerPoints,
  rebuildPlayerStats,
  removeReplayStats,
  replaySeason,
  seasonOf,
} from "@/lib/replay-stats";
import type { PlayerStatsRow, ReplayResultRow } from "@/lib/replay-stats";
import type { ReplayDigest } from "@/lib/replay/digest";

const ORIGIN = "http://localhost:8787";
const AUTHOR = "33333333-3333-4333-8333-333333333333";
const ADMIN = { userId: "admin", email: "admin@sites.test" };
const AUTHOR_USER = { userId: AUTHOR, email: "author@sites.test" };

interface ReplayRow {
  code: string;
  team_size: number;
  mvp_name: string | null;
  mode_key: string;
  owner_id: string;
  status: string;
  created_at: string;
  moderated_at: string | null;
  note: string | null;
}

const digestOf = (overrides: Partial<ReplayDigest> = {}): ReplayDigest => ({
  startedAt: 1793394040,
  durationS: 3356,
  region: "europe",
  mapCode: null,
  players: [
    { n: "Vzgo", w: 0, m: 0, k: 791, l: 477 },
    { n: "dbat", w: 1, m: 1, k: 490, l: 244 },
  ],
  units: [["WarSelection/1/worker", 493]],
  ...overrides,
});

/** Ligne du registre V3 (colonnes de replay_player_games, ordre du INSERT). */
interface LedgerRow {
  code: string;
  season: string;
  category: string;
  player_name: string;
  won: number;
  mvp: number;
  impact_pct: number;
  mmr: number | null;
  kills: number;
  units_lost: number;
  points: number;
  region: string | null;
  bronze_nation: number | null;
  last_nation: number | null;
  last_age_research: number | null;
  medals: string;
  units_by_age: string;
  age_reach: string;
  started_at: string;
  duration_s: number;
  team_size: number;
  mode_key: string;
}

interface State {
  replays: ReplayRow[];
  results: ReplayResultRow[];
  stats: PlayerStatsRow[];
  ledger: LedgerRow[];
}

function makeDb(state: State) {
  const stmtFor = (sql: string, args: unknown[]) => ({
    sql: sql.replace(/\s+/g, " ").trim(),
    args,
    async run() {
      const s = this.sql;
      const now = new Date().toISOString();
      if (s.startsWith("SELECT")) return { meta: { changes: 0 } };
      if (s.startsWith("UPDATE replays SET status='withdrawn', moderated_at=? WHERE code=? AND owner_id=?")) {
        const row = state.replays.find(
          (r) => r.code === args[1] && r.owner_id === args[2] && ["pending", "published"].includes(r.status),
        );
        if (!row) return { meta: { changes: 0 } };
        row.status = "withdrawn";
        row.moderated_at = now;
        return { meta: { changes: 1 } };
      }
      if (s.startsWith("UPDATE replays SET status='withdrawn', moderated_at=? WHERE code=?")) {
        const row = state.replays.find((r) => r.code === args[1]);
        if (!row) return { meta: { changes: 0 } };
        row.status = "withdrawn";
        row.moderated_at = now;
        return { meta: { changes: 1 } };
      }
      if (s.startsWith("UPDATE replays SET status=?, moderated_at=?, note=? WHERE code=?")) {
        const row = state.replays.find((r) => r.code === args[3]);
        if (!row) return { meta: { changes: 0 } };
        row.status = String(args[0]);
        row.moderated_at = now;
        row.note = args[2] as string | null;
        return { meta: { changes: 1 } };
      }
      if (s.startsWith("INSERT INTO replays")) {
        const [code, teamSize, mvpName, modeKey, , , ownerPending] = args;
        const pending = state.replays.filter(
          (r) => r.owner_id === ownerPending && r.status === "pending",
        ).length;
        const daily = state.replays.filter(
          (r) => r.owner_id === ownerPending && r.created_at > String(args[10] ?? ""),
        ).length;
        if (pending >= 3 || daily >= 5) return { meta: { changes: 0 } };
        state.replays.push({
          code: String(code),
          team_size: teamSize as number,
          mvp_name: (mvpName as string | null) ?? null,
          mode_key: modeKey as string,
          owner_id: ownerPending as string,
          status: "pending",
          created_at: now,
          moderated_at: null,
          note: null,
        });
        return { meta: { changes: 1 } };
      }
      if (s.startsWith("UPDATE replays SET team_size=?")) {
        const [teamSize, mvpName, modeKey, , code, ownerPending] = args;
        const row = state.replays.find((r) => r.code === code && r.owner_id === ownerPending);
        if (!row) return { meta: { changes: 0 } };
        row.team_size = teamSize as number;
        row.mvp_name = (mvpName as string | null) ?? null;
        row.mode_key = modeKey as string;
        row.status = "pending";
        row.created_at = now;
        row.moderated_at = null;
        row.note = null;
        return { meta: { changes: 1 } };
      }
      if (s.startsWith("INSERT INTO replay_results")) {
        const [code, season, category, startedAt, durationS, modeKey, teamSize, region, mapCode, data] = args;
        const existing = state.results.find((r) => r.code === code);
        if (existing) {
          Object.assign(existing, {
            season, category, started_at: startedAt, duration_s: durationS, mode_key: modeKey,
            team_size: teamSize, region, map_code: mapCode, data, updated_at: now,
          });
        } else {
          state.results.push({
            code: String(code),
            season: String(season),
            category: String(category) as ReplayResultRow["category"],
            started_at: String(startedAt), duration_s: durationS as number, mode_key: String(modeKey),
            team_size: teamSize as number, region: (region as string | null) ?? null,
            map_code: (mapCode as string | null) ?? null, data: String(data),
            updated_at: now, aggregated_at: null,
          });
        }
        return { meta: { changes: 1 } };
      }
      if (s.startsWith("INSERT INTO player_stats")) {
        // UPSERT incrémental : args = 10 valeurs + 6 deltas + 2 last_played.
        const [season, category, name, games, wins, mvps, kills, losses, points, last] =
          args.slice(0, 10);
        const [dg, dw, dm, dk, dl, dpts, , newLast] = args.slice(10);
        const row = state.stats.find(
          (s2) => s2.season === season && s2.category === category && s2.player_name === name,
        );
        if (row) {
          row.games = Math.max(row.games + Number(dg), 0);
          row.wins = Math.max(row.wins + Number(dw), 0);
          row.mvps = Math.max(row.mvps + Number(dm), 0);
          row.kills = Math.max(row.kills + Number(dk), 0);
          row.losses = Math.max(row.losses + Number(dl), 0);
          row.points = Math.max(row.points + Number(dpts), 0);
          if (String(args[16]) === "1" && String(newLast) > row.last_played) row.last_played = String(newLast);
        } else {
          state.stats.push({
            season: String(season),
            category: String(category) as PlayerStatsRow["category"],
            player_name: String(name),
            games: Number(games),
            wins: Number(wins),
            mvps: Number(mvps),
            kills: Number(kills),
            losses: Number(losses),
            points: Number(points),
            last_played: String(last),
          });
        }
        return { meta: { changes: 1 } };
      }
      if (s.startsWith("INSERT INTO replay_player_games")) {
        // args suivent l'ordre du INSERT de ledgerStatements.
        const row: LedgerRow = {
          code: String(args[0]),
          season: String(args[1]),
          category: String(args[2]),
          player_name: String(args[3]),
          won: Number(args[4]),
          mvp: Number(args[5]),
          impact_pct: Number(args[6]),
          mmr: (args[7] as number | null) ?? null,
          kills: Number(args[8]),
          units_lost: Number(args[9]),
          points: Number(args[10]),
          region: (args[11] as string | null) ?? null,
          bronze_nation: (args[12] as number | null) ?? null,
          last_nation: (args[13] as number | null) ?? null,
          last_age_research: (args[14] as number | null) ?? null,
          medals: String(args[15] ?? "[]"),
          units_by_age: String(args[16] ?? "[]"),
          age_reach: String(args[17] ?? "[]"),
          started_at: String(args[18]),
          duration_s: Number(args[19]),
          team_size: Number(args[20]),
          mode_key: String(args[21] ?? ""),
        };
        const idx = state.ledger.findIndex(
          (r) => r.code === row.code && r.player_name === row.player_name,
        );
        if (idx >= 0) state.ledger[idx] = row;
        else state.ledger.push(row);
        return { meta: { changes: 1 } };
      }
      if (s.startsWith("DELETE FROM replay_player_games WHERE code = ?")) {
        const before = state.ledger.length;
        state.ledger = state.ledger.filter((r) => r.code !== String(args[0]));
        return { meta: { changes: before - state.ledger.length } };
      }
      if (s.startsWith("DELETE FROM replay_player_games")) {
        state.ledger = [];
        return { meta: { changes: 1 } };
      }
      if (s.startsWith("UPDATE replay_results SET aggregated_at = ? WHERE code = ?")) {
        const row = state.results.find((r) => r.code === args[1]);
        if (row) row.aggregated_at = String(args[0]);
        return { meta: { changes: row ? 1 : 0 } };
      }
      if (s.startsWith("UPDATE replay_results SET aggregated_at = NULL WHERE code = ?")) {
        const row = state.results.find((r) => r.code === args[0]);
        if (row) row.aggregated_at = null;
        return { meta: { changes: row ? 1 : 0 } };
      }
      if (s.startsWith("DELETE FROM player_stats WHERE season = ? AND category = ? AND player_name IN")) {
        const [season, category, namesJson] = args as string[];
        const names = new Set(JSON.parse(namesJson) as string[]);
        state.stats = state.stats.filter(
          (s2) => !(s2.season === season && s2.category === category && names.has(s2.player_name) && s2.games === 0),
        );
        return { meta: { changes: 1 } };
      }
      if (s.startsWith("DELETE FROM player_stats")) {
        state.stats = [];
        return { meta: { changes: 1 } };
      }
      if (s.startsWith("UPDATE replay_results SET aggregated_at = NULL")) {
        for (const r of state.results) r.aggregated_at = null;
        return { meta: { changes: 1 } };
      }
      throw new Error("SQL non simulée (run) : " + s.slice(0, 90));
    },
    async first<T>() {
      const s = this.sql;
      if (s.startsWith("SELECT code, status FROM replays WHERE code = ?"))
        return (state.replays.find((r) => r.code === this.args[0]) ?? null) as T;
      if (s.startsWith("SELECT status FROM replays WHERE code = ? AND owner_id = ?"))
        return ((() => {
          const row = state.replays.find((r) => r.code === this.args[0] && r.owner_id === this.args[1]);
          return row ? { status: row.status } : null;
        })() as T);
      if (s.startsWith("SELECT status FROM replays WHERE code = ?"))
        return ((() => {
          const row = state.replays.find((r) => r.code === this.args[0]);
          return row ? { status: row.status } : null;
        })() as T);
      if (s.startsWith("SELECT * FROM replays WHERE code = ?"))
        return (state.replays.find((r) => r.code === this.args[0]) ?? null) as T;
      if (s.startsWith("SELECT * FROM replay_results WHERE code = ?"))
        return (state.results.find((r) => r.code === this.args[0]) ?? null) as T;
      return null as T;
    },
    async all<T>() {
      const s = this.sql;
      if (s.startsWith("SELECT * FROM replays WHERE status = 'published'"))
        return {
          results: state.replays
            .filter((r) => r.status === "published")
            .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
            .slice(0, Number(this.args[0] ?? 5)),
        } as T;
      if (s.startsWith("SELECT r.* FROM replay_results r JOIN replays p"))
        return {
          results: state.results
            .filter((r) => state.replays.find((p) => p.code === r.code && p.status === "published"))
            .sort((a, b) => (a.started_at < b.started_at ? -1 : 1)),
        } as T;
      if (s.startsWith("SELECT season FROM replay_results GROUP BY season"))
        return {
          results: [...new Set(state.results.map((r) => r.season))]
            .sort()
            .reverse()
            .map((season) => ({ season })),
        } as T;
      if (s.startsWith("SELECT * FROM player_stats WHERE season = ? AND category = ?")) {
        return {
          results: state.stats
            .filter((s2) => s2.season === this.args[0] && s2.category === this.args[1])
            .sort((a, b) => b.points - a.points || b.wins - a.wins || (a.player_name < b.player_name ? -1 : 1)),
        } as T;
      }
      return { results: [] } as T;
    },
  });
  return {
    prepare(sql: string) {
      const args: unknown[] = [];
      const stmt = {
        bind(...values: unknown[]) {
          args.length = 0;
          args.push(...values);
          return stmt;
        },
        run: () => stmtFor(sql, args).run(),
        first: <T,>() => stmtFor(sql, args).first<T>(),
        all: <T,>() => stmtFor(sql, args).all<T>(),
      };
      Object.defineProperty(stmt, "sql", { get: () => sql });
      Object.defineProperty(stmt, "args", { get: () => args });
      return stmt;
    },
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      const out = [];
      for (const st of statements) out.push(await st.run());
      return out;
    },
  };
}

let state: State;
let calls: Array<{ method: string; path: string; status: number; body: unknown }>;

function req(method: string, path: string, body: unknown, user: unknown = AUTHOR_USER) {
  getChatGPTUser.mockResolvedValue((user ?? null) as never);
  const url = new URL(path, ORIGIN);
  const init: RequestInit = { method, headers: { Origin: ORIGIN } };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  return new Request(url, init);
}

function ctx(segments: string[]) {
  return { params: Promise.resolve({ path: segments }) };
}

const call = async (method: string, path: string, body?: unknown, user: unknown = AUTHOR_USER) => {
  const segments = path.replace(/^\/api\/replay\/?/, "").split("/").filter(Boolean);
  const handler = method === "GET" ? replayGet : method === "POST" ? replayPost : replayPatch;
  const response = await handler(req(method, path, body, user), ctx(segments));
  const data = (await response.json()) as unknown;
  calls.push({ method, path, status: response.status, body: data });
  return { status: response.status, data };
};

const submitBody = (code: string, digest?: unknown) => ({
  code,
  teamSize: 8,
  mvpName: "dbat",
  modeKey: "replayMatchTypeTeamMatch",
  ...(digest === undefined ? {} : { digest }),
});

beforeEach(() => {
  state = { replays: [], results: [], stats: [], ledger: [] };
  calls = [];
  envStub.DB = makeDb(state);
  envStub.BUCKET = {};
  envStub.ADMIN_EMAILS = "admin@sites.test";
  getChatGPTUser.mockReset();
});

describe("saison & catégories (pures)", () => {
  it("saison calendaire mensuelle UTC depuis l'horodatage de partie", () => {
    expect(seasonOf(1793394040_000)).toBe("2026-10");
    expect(replaySeason(1793394040, "2026-11-01T00:00:00.000Z")).toBe("2026-10");
  });

  it("fallback documenté : sans horodatage, mois de la soumission", () => {
    expect(replaySeason(null, "2026-11-01T00:00:00.000Z")).toBe("2026-11");
    expect(replaySeason(0, "2026-11-01T00:00:00.000Z")).toBe("2026-11");
  });

  it("catégories : big team ≥ 3 par équipe, solo-duo sinon", () => {
    expect(categoryOf(8)).toBe("big");
    expect(categoryOf(3)).toBe("big");
    expect(categoryOf(2)).toBe("solo");
    expect(categoryOf(1)).toBe("solo");
  });

  it("formule de points : 1×participation + 2×victoire + 2×MVP + ⌊tués/100⌋", () => {
    expect(playerPoints(1, 0, 0, 0)).toBe(1);
    expect(playerPoints(1, 1, 0, 0)).toBe(3);
    expect(playerPoints(1, 1, 1, 0)).toBe(5);
    expect(playerPoints(1, 0, 0, 791)).toBe(8); // 1 + 7
    expect(playerPoints(2, 1, 1, 250)).toBe(8); // 2 + 2 + 2 + 2
  });
});

describe("validation du digest (cleanDigest)", () => {
  it("accepte un digest complet et le normalise", () => {
    const d = cleanDigest(digestOf());
    expect(d).not.toBeNull();
    expect(d!.players).toHaveLength(2);
    expect(d!.units[0]).toEqual(["WarSelection/1/worker", 493]);
  });

  it("null quand absent (compatibilité clients antérieurs)", () => {
    expect(cleanDigest(undefined)).toBeNull();
    expect(cleanDigest(null)).toBeNull();
  });

  it("400 (throw) quand malformé : durée, joueurs, bornes", () => {
    expect(() => cleanDigest({ ...digestOf(), durationS: -1 })).toThrow();
    expect(() => cleanDigest({ ...digestOf(), durationS: "x" })).toThrow();
    expect(() => cleanDigest({ ...digestOf(), players: "nope" })).toThrow();
    expect(() => cleanDigest({ ...digestOf(), players: [{ n: "a", w: 1, m: 0, k: -5, l: 0 }] })).toThrow();
    expect(() => cleanDigest({ startedAt: "demain" })).toThrow();
  });

  it("assainit les pseudos et filtre les unités invalides", () => {
    const d = cleanDigest({
      ...digestOf(),
      players: [{ n: "  bot\u0007name  ", w: 1, m: 0, k: 999_999, l: 0 }],
      units: [["WarSelection/1/worker", 10], ["bad id!", 5], ["WarSelection/1/house", "3"]],
    });
    expect(d!.players[0]).toEqual({ n: "botname", w: 1, m: 0, k: 999_999, l: 0 });
    expect(d!.units).toEqual([["WarSelection/1/worker", 10], ["WarSelection/1/house", 3]]);
    // pseudos vides ignorés, bornes de tués dépassées → rejet
    expect(cleanDigest({ ...digestOf(), players: [{ n: "   ", w: 0, m: 0, k: 1, l: 1 }] })!.players).toEqual([]);
    expect(() => cleanDigest({ ...digestOf(), players: [{ n: "a", w: 0, m: 0, k: 1_000_001, l: 0 }] })).toThrow();
  });
});

describe("soumission avec digest", () => {
  it("stocke replay_results (201) et reste compatible sans digest", async () => {
    const withDigest = await call("POST", "/api/replay/submit", submitBody("Abcdef12345", digestOf()));
    expect(withDigest.status).toBe(201);
    expect(state.results).toHaveLength(1);
    expect(state.results[0].season).toBe("2026-10");
    expect(state.results[0].category).toBe("big");
    expect(state.results[0].aggregated_at).toBeNull();

    const without = await call("POST", "/api/replay/submit", submitBody("Xbcdef12345"));
    expect(without.status).toBe(201);
    expect(state.results).toHaveLength(1); // pas de nouvelle ligne sans digest
  });

  it("400 si le digest est présent mais malformé (bug client visible)", async () => {
    const bad = await call("POST", "/api/replay/submit", submitBody("Abcdef12345", { durationS: -3 }));
    expect(bad.status).toBe(400);
    expect(state.replays).toHaveLength(0);
  });

  it("quotas inchangés : 3 en attente max, 5 par 24 h", async () => {
    const codes = ["Q1111111111", "Q2222222222", "Q3333333333", "Q4444444444"];
    for (const code of codes) {
      await call("POST", "/api/replay/submit", submitBody(code, digestOf()));
    }
    expect(state.replays.filter((r) => r.status === "pending")).toHaveLength(3);
  });
});

describe("registre profil joueur (V3, migration 0013)", () => {
  const digestV2: ReplayDigest = {
    ...digestOf(),
    players: [
      { n: "Vzgo", w: 0, m: 0, k: 791, l: 477, r: 138, s: 26, bn: 2, ln: 2, la: 1, md: ["deserter"] },
      { n: "dbat", w: 1, m: 1, k: 490, l: 244, r: 201, s: 84, bn: 3, ln: 13, la: 59, md: ["champion", "farmer"] },
    ],
    unitsByAge: [["Vzgo", [["stone", "WarSelection/1/pathfinder", 12]]]],
    ageReach: [["Vzgo", [[1, 794_000]]]],
  };

  /** Sème replays+results publiés (chaque test repart d'un état vierge). */
  const seedLedgerFixture = (aggregated: string | null) => {
    state.replays.push({
      code: "Ledger0001A",
      team_size: 6,
      mvp_name: "dbat",
      mode_key: "replayMatchTypeTeamMatch",
      owner_id: AUTHOR,
      status: "published",
      created_at: "2026-11-01T10:00:00.000Z",
      moderated_at: null,
      note: null,
    });
    state.results.push({
      code: "Ledger0001A",
      season: "2026-11",
      category: "big",
      started_at: "2026-11-01T09:00:00.000Z",
      duration_s: 907,
      mode_key: "replayMatchTypeTeamMatch",
      team_size: 6,
      region: "europe",
      map_code: null,
      data: JSON.stringify(digestV2),
      updated_at: "2026-11-01T10:00:00.000Z",
      aggregated_at: aggregated,
    });
  };

  it("applyReplayStats écrit une ligne registre par joueur (champs V2 inclus)", async () => {
    seedLedgerFixture(null);
    await applyReplayStats("Ledger0001A");
    expect(state.ledger).toHaveLength(2);
    const dbat = state.ledger.find((r) => r.player_name === "dbat")!;
    expect(dbat.won).toBe(1);
    expect(dbat.mvp).toBe(1);
    expect(dbat.impact_pct).toBe(84);
    expect(dbat.mmr).toBe(201);
    expect(dbat.bronze_nation).toBe(3);
    expect(dbat.last_nation).toBe(13);
    expect(dbat.last_age_research).toBe(59);
    expect(JSON.parse(dbat.medals)).toEqual(["champion", "farmer"]);
    const vzgo = state.ledger.find((r) => r.player_name === "Vzgo")!;
    expect(JSON.parse(vzgo.units_by_age)).toEqual([["stone", "WarSelection/1/pathfinder", 12]]);
    expect(JSON.parse(vzgo.age_reach)).toEqual([[1, 794_000]]);
    // Idempotent : re-appel sans effet (garde aggregated_at).
    await applyReplayStats("Ledger0001A");
    expect(state.ledger).toHaveLength(2);
  });

  it("removeReplayStats purge le registre du replay retiré", async () => {
    seedLedgerFixture(null);
    await applyReplayStats("Ledger0001A");
    expect(state.ledger).toHaveLength(2);
    await removeReplayStats("Ledger0001A");
    expect(state.ledger).toHaveLength(0);
  });

  it("rebuildPlayerStats reconstruit le registre depuis les digests stockés", async () => {
    seedLedgerFixture(null);
    const result = await rebuildPlayerStats();
    expect(result.replays).toBe(1);
    expect(state.ledger).toHaveLength(2);
    expect(state.ledger.every((r) => r.code === "Ledger0001A")).toBe(true);
  });

  it("cleanDigest valide les champs V2 (bornes, clés de médailles, buckets)", () => {
    const clean = cleanDigest(JSON.parse(JSON.stringify(digestV2)));
    expect(clean?.players[0].md).toEqual(["deserter"]);
    expect(clean?.unitsByAge?.[0][1][0]).toEqual(["stone", "WarSelection/1/pathfinder", 12]);
    // Médaille inconnue ignorée silencieusement, bucket inconnu rejeté.
    const dirty = JSON.parse(JSON.stringify(digestV2)) as Record<string, unknown>;
    (dirty.players as Array<Record<string, unknown>>)[0].md = ["champion", "nope"];
    (dirty.unitsByAge as Array<[string, Array<[string, string, number]>]>)[0][1] = [
      ["nope", "WarSelection/1/worker", 3],
    ];
    const cleaned = cleanDigest(dirty)!;
    expect(cleaned.players[0].md).toEqual(["champion"]);
    expect(cleaned.unitsByAge).toHaveLength(0); // bucket inconnu → entrée rejetée
  });
});

describe("agrégation à la publication (incrémentale, idempotente)", () => {
  const seed = async () => {
    await call("POST", "/api/replay/submit", submitBody("Abcdef12345", digestOf()));
    await call("POST", "/api/replay/submit", submitBody("Xbcdef12345", digestOf({ startedAt: 1793394041 })));
  };

  it("la publication agrège les stats par joueur (admin)", async () => {
    await seed();
    const res = await call("PATCH", "/api/replay/Abcdef12345", { status: "published" }, ADMIN);
    expect(res.status).toBe(200);
    const vzgo = state.stats.find((s) => s.player_name === "Vzgo")!;
    const dbat = state.stats.find((s) => s.player_name === "dbat")!;
    expect(vzgo).toMatchObject({ games: 1, wins: 0, mvps: 0, kills: 791, losses: 477, points: 8 });
    expect(dbat).toMatchObject({ games: 1, wins: 1, mvps: 1, kills: 490, losses: 244, points: 9 });
    expect(state.results.find((r) => r.code === "Abcdef12345")!.aggregated_at).not.toBeNull();
  });

  it("cumule sur plusieurs replays de la même saison", async () => {
    await seed();
    await call("PATCH", "/api/replay/Abcdef12345", { status: "published" }, ADMIN);
    await call("PATCH", "/api/replay/Xbcdef12345", { status: "published" }, ADMIN);
    const vzgo = state.stats.find((s) => s.player_name === "Vzgo")!;
    expect(vzgo.games).toBe(2);
    expect(vzgo.points).toBe(16);
  });

  it("publication répétée = idempotent (garde-fou aggregated_at)", async () => {
    await seed();
    await call("PATCH", "/api/replay/Abcdef12345", { status: "published" }, ADMIN);
    await applyReplayStats("Abcdef12345"); // re-appel direct
    await applyReplayStats("Abcdef12345");
    expect(state.stats.find((s) => s.player_name === "Vzgo")!.games).toBe(1);
  });

  it("le retrait d'un replay publié retire exactement sa contribution", async () => {
    await seed();
    await call("PATCH", "/api/replay/Abcdef12345", { status: "published" }, ADMIN);
    await call("PATCH", "/api/replay/Xbcdef12345", { status: "published" }, ADMIN);
    const withdrawn = await call("PATCH", "/api/replay/Abcdef12345", { status: "withdrawn" });
    expect(withdrawn.status).toBe(200);
    const vzgo = state.stats.find((s) => s.player_name === "Vzgo")!;
    expect(vzgo.games).toBe(1);
    expect(vzgo.points).toBe(8);
    expect(state.results.find((r) => r.code === "Abcdef12345")!.aggregated_at).toBeNull();
    // retrait répété : no-op (déjà retiré)
    await removeReplayStats("Abcdef12345");
    expect(state.stats.find((s) => s.player_name === "Vzgo")!.games).toBe(1);
  });

  it("rejet d'un replay déjà publié retire aussi sa contribution", async () => {
    await call("POST", "/api/replay/submit", submitBody("Abcdef12345", digestOf()));
    await call("PATCH", "/api/replay/Abcdef12345", { status: "published" }, ADMIN);
    await call("PATCH", "/api/replay/Abcdef12345", { status: "rejected", note: "test" }, ADMIN);
    expect(state.stats).toHaveLength(0);
  });

  it("rebuild : idempotent et égal à l'agrégation incrémentale", async () => {
    await seed();
    await call("PATCH", "/api/replay/Abcdef12345", { status: "published" }, ADMIN);
    await call("PATCH", "/api/replay/Xbcdef12345", { status: "published" }, ADMIN);
    const incremental = JSON.stringify([...state.stats].sort((a, b) => (a.player_name < b.player_name ? -1 : 1)));
    const first = await rebuildPlayerStats();
    const afterFirst = JSON.stringify([...state.stats].sort((a, b) => (a.player_name < b.player_name ? -1 : 1)));
    const second = await rebuildPlayerStats();
    const afterSecond = JSON.stringify([...state.stats].sort((a, b) => (a.player_name < b.player_name ? -1 : 1)));
    expect(first).toEqual({ players: 2, replays: 2 });
    expect(second).toEqual(first);
    expect(afterFirst).toBe(incremental);
    expect(afterSecond).toBe(afterFirst);
    // les replays retirés ne comptent plus après rebuild
    await call("PATCH", "/api/replay/Abcdef12345", { status: "withdrawn" });
    await rebuildPlayerStats();
    expect(state.stats.find((s) => s.player_name === "Vzgo")!.games).toBe(1);
  });
});

describe("agrégation stats saison (aggregateSeasonStats, pure)", () => {
  const resultRow = (code: string, startedAt: string, mode: string, region: string | null, data: object) => ({
    code,
    season: "2026-10",
    category: "big" as const,
    started_at: startedAt,
    duration_s: 3600,
    mode_key: mode,
    team_size: 8,
    region,
    map_code: null,
    data: JSON.stringify(data),
    updated_at: startedAt,
    aggregated_at: startedAt,
  });

  it("compte replays/joueurs, moyenne de durée, modes/regions triés, top unités fusionnées", () => {
    const stats = aggregateSeasonStats("2026-10", [
      resultRow("Aaaaaaaaa1", "2026-10-01T10:00:00.000Z", "replayMatchTypeTeamMatch", "europe", {
        players: [{ n: "Vzgo" }, { n: "dbat" }],
        units: [["WarSelection/1/worker", 100], ["WarSelection/1/house", 40]],
      }),
      resultRow("Bbbbbbbbbb2", "2026-10-02T10:00:00.000Z", "replayMatchTypeFFA", "asia", {
        players: [{ n: "Vzgo" }],
        units: [["WarSelection/1/worker", 50]],
      }),
    ]);
    expect(stats).toMatchObject({
      season: "2026-10",
      replays: 2,
      players: 2,
      avgDurationS: 3600,
      lastStarted: "2026-10-02T10:00:00.000Z",
    });
    expect(stats.modes).toEqual([
      { modeKey: "replayMatchTypeFFA", count: 1 },
      { modeKey: "replayMatchTypeTeamMatch", count: 1 },
    ]);
    expect(stats.regions).toEqual([
      { region: "asia", count: 1 },
      { region: "europe", count: 1 },
    ]);
    expect(stats.topUnits).toEqual([
      { unitId: "WarSelection/1/worker", count: 150 },
      { unitId: "WarSelection/1/house", count: 40 },
    ]);
  });

  it("saison vide → zéro partout, durée null, sans erreur", () => {
    const stats = aggregateSeasonStats("2026-12", []);
    expect(stats).toMatchObject({ replays: 0, players: 0, avgDurationS: null, lastStarted: null });
    expect(stats.topUnits).toEqual([]);
  });

  it("digest illisible ignoré sans casser l'agrégation", () => {
    const stats = aggregateSeasonStats(
      "2026-10",
      [resultRow("Cccccccccc3", "2026-10-03T10:00:00.000Z", "replayMatchTypeTeamMatch", null, {})].map(
        (r) => ({ ...r, data: "{{{" }),
      ),
    );
    expect(stats.replays).toBe(1);
    expect(stats.players).toBe(0);
  });
});

describe("POST /api/replay/stats-rebuild", () => {
  it("réservé aux admins (401/403), exécute le rebuild (200)", async () => {
    await call("POST", "/api/replay/submit", submitBody("Abcdef12345", digestOf()));
    await call("PATCH", "/api/replay/Abcdef12345", { status: "published" }, ADMIN);
    expect((await call("POST", "/api/replay/stats-rebuild", {}, null)).status).toBe(401);
    expect((await call("POST", "/api/replay/stats-rebuild", {})).status).toBe(403);
    const ok = await call("POST", "/api/replay/stats-rebuild", {}, ADMIN);
    expect(ok.status).toBe(200);
    expect(ok.data).toMatchObject({ ok: true, players: 2, replays: 1 });
  });
});

describe("GET /api/replay/recent — inchangé", () => {
  it("liste toujours les publiés seulement", async () => {
    await call("POST", "/api/replay/submit", submitBody("Abcdef12345", digestOf()));
    await call("PATCH", "/api/replay/Abcdef12345", { status: "published" }, ADMIN);
    const res = await call("GET", "/api/replay/recent", undefined, null);
    expect(res.status).toBe(200);
    expect((res.data as { items: unknown[] }).items).toHaveLength(1);
  });
});
