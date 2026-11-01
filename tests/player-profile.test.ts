import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mémoïsation du classement toutes périodes (fix post-revue 01/11) : le rang
// (#N) exige un GROUP BY complet de replay_player_games — coûteux en D1 et
// amplifiable par crawl (une vue de profil = un scan agrégé de toute la
// table). Le cache 60 s doit garantir UN relevé par fenêtre, quel que soit
// le nombre de vues, et recalculer après expiration.

const { envStub } = vi.hoisted(() => ({ envStub: {} as Record<string, unknown> }));

vi.mock("cloudflare:workers", () => ({ env: envStub }));

import {
  playerProfile,
  resetLeaderboardCacheForTests,
  type LedgerRow,
} from "@/lib/player-profile";

/* ---- Stub D1 : registre + classement en mémoire ---------------------- */

let ledger: LedgerRow[] = [];
let leaderboard: { player_name: string; total: number }[] = [];
let leaderboardCalls = 0;

function installDb() {
  envStub.DB = {
    prepare(sql: string) {
      const stmt = {
        bound: [] as unknown[],
        bind(...values: unknown[]) {
          stmt.bound = values;
          return stmt;
        },
        async all<T>() {
          if (sql.includes("GROUP BY player_name")) {
            leaderboardCalls += 1;
            return { results: leaderboard as unknown as T[] };
          }
          const name = String(stmt.bound[0] ?? "");
          return { results: ledger.filter((r) => r.player_name === name) as unknown as T[] };
        },
      };
      return stmt;
    },
  };
  envStub.BUCKET = {};
}

const row = (o: Partial<LedgerRow> = {}): LedgerRow => ({
  code: "ABC123",
  season: "2026-11",
  category: "1v1",
  player_name: "dbat",
  won: 1,
  mvp: 1,
  impact_pct: 42,
  mmr: 1500,
  kills: 10,
  units_lost: 5,
  points: 100,
  region: "europe",
  bronze_nation: null,
  last_nation: null,
  last_age_research: null,
  medals: "[]",
  units_by_age: "[]",
  age_reach: "[]",
  started_at: "2026-11-01T10:00:00.000Z",
  duration_s: 600,
  team_size: 1,
  mode_key: "1v1",
  ...o,
});

beforeEach(() => {
  vi.useRealTimers();
  resetLeaderboardCacheForTests();
  leaderboardCalls = 0;
  ledger = [row({ player_name: "dbat", points: 300 }), row({ player_name: "rival", points: 100 })];
  leaderboard = [
    { player_name: "dbat", total: 300 },
    { player_name: "rival", total: 100 },
  ];
  installDb();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("classement toutes périodes : mémoïsation 60 s", () => {
  it("un seul GROUP BY par fenêtre de 60 s, quel que soit le nombre de vues", async () => {
    const first = await playerProfile("dbat", "fr");
    expect(leaderboardCalls).toBe(1);
    expect(first.rankAllTime).toBe(1);

    // Crawl simulé : 5 vues de profils différents dans la même fenêtre.
    await playerProfile("dbat", "fr");
    await playerProfile("rival", "en");
    await playerProfile("dbat", "zh");
    await playerProfile("rival", "fr");
    await playerProfile("dbat", "fr");
    expect(leaderboardCalls).toBe(1);

    // Le rang reste exact pendant toute la fenêtre (lecture du cache).
    const rival = await playerProfile("rival", "fr");
    expect(rival.rankAllTime).toBe(2);
  });

  it("recalcule le classement après expiration du TTL (60 s)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
    await playerProfile("dbat", "fr");
    expect(leaderboardCalls).toBe(1);

    // À 59 s : cache encore valide.
    vi.setSystemTime(new Date("2026-11-01T12:00:59Z"));
    await playerProfile("dbat", "fr");
    expect(leaderboardCalls).toBe(1);

    // À 61 s : nouveau relevé (le classement peut avoir changé entre-temps).
    leaderboard = [
      { player_name: "rival", total: 500 },
      { player_name: "dbat", total: 300 },
    ];
    vi.setSystemTime(new Date("2026-11-01T12:01:01Z"));
    const refreshed = await playerProfile("dbat", "fr");
    expect(leaderboardCalls).toBe(2);
    expect(refreshed.rankAllTime).toBe(2);
  });

  it("joueur sans parties : aucune requête de classement", async () => {
    const profile = await playerProfile("Inconnu", "fr");
    expect(profile.found).toBe(false);
    expect(profile.rankAllTime).toBeNull();
    expect(leaderboardCalls).toBe(0);
  });
});
