/** Profil joueur (/player/[name], V3 01/11/2026) — lectures du registre
 *  replay_player_games (migration 0013) et construction du modèle de vue
 *  « façon wsva » : en-tête (rang toutes périodes, MMR, points, impact
 *  médian, win rate + W/L « Based on N games »), historique de saisons,
 *  onglets de période (Cette saison / Toutes périodes / Saison N), courbe
 *  cumulée de points, médailles, parties récentes, faits saillants
 *  (nations/pays préférés, plus longue série), records de vitesse par âge,
 *  unités favorites par âge.
 *
 *  Sources : registre écrit à la publication (applyReplayStats →
 *  ledgerStatements) et au rebuild. Les digests v1 (soumissions antérieures
 *  au 01/11) ne portent ni médailles ni unités par âge ni records : les
 *  sections correspondantes sont alors vides (dégradation documentée) — la
 *  courbe de points et le W/L restent exacts.
 *
 *  Module serveur pur : requêtes D1 bornées (index idx_replay_player_games_
 *  name), JSON parsé défensivement (jamais de throw sur données sales). */
import { localizedNationLabel, unitsIndex } from "@/lib/units";

import type { Locale } from "@/lib/i18n";
import { unitAgeBucket, type UnitAgeBucket } from "@/lib/replay/wsva-view";
import type { MedalKey } from "@/lib/replay/medals";

interface D1Statement {
  bind: (...values: unknown[]) => D1Statement;
  run: () => Promise<{ meta: { changes: number } }>;
  first: <T>() => Promise<T | null>;
  all: <T>() => Promise<{ results: T[] }>;
}
interface D1Like {
  prepare: (sql: string) => D1Statement;
}

import { bindings } from "@/lib/atlas-server";

function db(): D1Like {
  // Binding injecté (même couture que lib/replay-stats.ts).
  return bindings().DB as unknown as D1Like;
}

/* ------------------------------------------------------------------ */
/* Ligne de registre                                                   */
/* ------------------------------------------------------------------ */

export interface LedgerRow {
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

const parseJsonArray = <T>(raw: string): T[] => {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

/* ------------------------------------------------------------------ */
/* Vue par période                                                     */
/* ------------------------------------------------------------------ */

export interface PointsStep {
  code: string;
  at: string;
  cumulative: number;
  won: number;
}

export interface MedalCount {
  key: MedalKey;
  count: number;
}

export interface RecentGame {
  code: string;
  won: number;
  impactPct: number;
  region: string | null;
  nationLabel: string; // déjà localisée
  medals: string[];
  at: string;
}

export interface ChoiceCount {
  id: number;
  label: string; // localisé
  count: number;
}

export interface FastestTime {
  researchId: number;
  ms: number;
  code: string;
}

export interface FavouriteUnit {
  gameId: string;
  games: number;
}

export interface PeriodView {
  key: string;
  games: number;
  wins: number;
  losses: number;
  winRatePct: number;
  points: number;
  pointsCurve: PointsStep[];
  medianImpactPct: number | null;
  mmr: number | null;
  topTeamCount: number;
  bestStreak: number;
  medals: MedalCount[];
  recentGames: RecentGame[];
  bronzeNations: ChoiceCount[];
  countries: ChoiceCount[];
  fastest: FastestTime[];
  favouriteUnits: Array<{ bucket: UnitAgeBucket; units: FavouriteUnit[] }>;
}

export interface PlayerProfile {
  name: string;
  found: boolean;
  currentSeason: string;
  seasons: string[]; // saisons ayant des données, desc
  views: PeriodView[];
  rankAllTime: number | null;
}

const currentSeasonKey = (): string => new Date().toISOString().slice(0, 7);

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function nationLabel(id: number, locale: Locale): string {
  return localizedNationLabel(unitsIndex, id, locale) ?? String(id);
}

function buildView(key: string, rows: LedgerRow[], locale: Locale): PeriodView {
  const ordered = [...rows].sort((a, b) => (a.started_at < b.started_at ? -1 : 1));
  const wins = ordered.filter((r) => r.won === 1).length;
  let cumulative = 0;
  const pointsCurve: PointsStep[] = ordered.map((r) => {
    cumulative += r.points;
    return { code: r.code, at: r.started_at, cumulative, won: r.won };
  });
  const medalCounts = new Map<string, number>();
  for (const r of ordered) {
    for (const key of parseJsonArray<string>(r.medals)) {
      if (typeof key === "string") medalCounts.set(key, (medalCounts.get(key) ?? 0) + 1);
    }
  }
  const bronzeTally = new Map<number, number>();
  const countryTally = new Map<number, number>();
  for (const r of ordered) {
    if (r.bronze_nation !== null) bronzeTally.set(r.bronze_nation, (bronzeTally.get(r.bronze_nation) ?? 0) + 1);
    if (r.last_nation !== null && r.last_nation >= 9)
      countryTally.set(r.last_nation, (countryTally.get(r.last_nation) ?? 0) + 1);
  }
  const fastestMap = new Map<number, FastestTime>();
  for (const r of ordered) {
    for (const [id, t] of parseJsonArray<[number, number]>(r.age_reach)) {
      if (typeof id !== "number" || typeof t !== "number") continue;
      const prev = fastestMap.get(id);
      if (!prev || t < prev.ms) fastestMap.set(id, { researchId: id, ms: t, code: r.code });
    }
  }
  // Unités favorites : nombre de PARTIES où l'unité figure dans le top-3 de
  // son âge (définition wsva : « N games »).
  const favTally = new Map<UnitAgeBucket, Map<string, number>>();
  for (const r of ordered) {
    const seen = new Set<string>();
    for (const entry of parseJsonArray<[string, string, number]>(r.units_by_age)) {
      if (!Array.isArray(entry) || entry.length !== 3) continue;
      const [bucket, gameId] = entry;
      if (typeof bucket !== "string" || typeof gameId !== "string") continue;
      const normalized = unitAgeBucket(gameId);
      if (!normalized || seen.has(gameId)) continue;
      seen.add(gameId);
      const byUnit = favTally.get(normalized) ?? new Map<string, number>();
      byUnit.set(gameId, (byUnit.get(gameId) ?? 0) + 1);
      favTally.set(normalized, byUnit);
    }
  }
  let bestStreak = 0;
  let streak = 0;
  for (const r of ordered) {
    if (r.won === 1) {
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
    } else streak = 0;
  }
  const latest = ordered[ordered.length - 1];
  return {
    key,
    games: ordered.length,
    wins,
    losses: ordered.length - wins,
    winRatePct: ordered.length > 0 ? Math.round((wins / ordered.length) * 100) : 0,
    points: cumulative,
    pointsCurve,
    medianImpactPct: median(ordered.map((r) => r.impact_pct)),
    mmr: latest?.mmr ?? null,
    topTeamCount: ordered.filter((r) => r.mvp === 1).length,
    bestStreak,
    medals: [...medalCounts.entries()]
      .map(([k, count]) => ({ key: k as MedalKey, count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
    recentGames: [...ordered]
      .reverse()
      .slice(0, 10)
      .map((r) => ({
        code: r.code,
        won: r.won,
        impactPct: r.impact_pct,
        region: r.region,
        nationLabel:
          r.last_nation !== null
            ? nationLabel(r.last_nation, locale)
            : r.bronze_nation !== null
              ? nationLabel(r.bronze_nation, locale)
              : "",
        medals: parseJsonArray<string>(r.medals).filter((k): k is string => typeof k === "string"),
        at: r.started_at,
      })),
    bronzeNations: [...bronzeTally.entries()]
      .map(([id, count]) => ({ id, label: nationLabel(id, locale), count }))
      .sort((a, b) => b.count - a.count),
    countries: [...countryTally.entries()]
      .map(([id, count]) => ({ id, label: nationLabel(id, locale), count }))
      .sort((a, b) => b.count - a.count),
    fastest: [...fastestMap.values()].sort((a, b) => a.ms - b.ms),
    favouriteUnits: (["stone", "bronze", "iron", "industrial1", "industrial2"] as UnitAgeBucket[]).map(
      (bucket) => ({
        bucket,
        units: [...(favTally.get(bucket) ?? new Map<string, number>()).entries()]
          .map(([gameId, games]) => ({ gameId, games }))
          .sort((a, b) => b.games - a.games || (a.gameId < b.gameId ? -1 : 1))
          .slice(0, 3),
      }),
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Lecture principale                                                  */
/* ------------------------------------------------------------------ */

export async function playerProfile(name: string, locale: Locale): Promise<PlayerProfile> {
  const trimmed = name.trim().slice(0, 40);
  const rows = await db()
    .prepare(
      "SELECT * FROM replay_player_games WHERE player_name = ? ORDER BY started_at DESC LIMIT 500",
    )
    .bind(trimmed)
    .all<LedgerRow>();
  const games = rows.results ?? [];
  const seasons = [...new Set(games.map((r) => r.season))].sort().reverse();
  const current = currentSeasonKey();
  const views: PeriodView[] = [];
  if (seasons.includes(current)) {
    views.push(buildView("current", games.filter((r) => r.season === current), locale));
  }
  views.push(buildView("all", games, locale));
  for (const season of seasons) {
    if (season !== current) {
      views.push(buildView(season, games.filter((r) => r.season === season), locale));
    }
  }
  let rankAllTime: number | null = null;
  if (games.length > 0) {
    const ranked = await db()
      .prepare(
        "SELECT player_name, SUM(points) AS total FROM replay_player_games GROUP BY player_name ORDER BY total DESC LIMIT 2000",
      )
      .all<{ player_name: string; total: number }>();
    const idx = (ranked.results ?? []).findIndex((r) => r.player_name === trimmed);
    rankAllTime = idx >= 0 ? idx + 1 : null;
  }
  return {
    name: trimmed,
    found: games.length > 0,
    currentSeason: current,
    seasons,
    views,
    rankAllTime,
  };
}

/** Métadonnées de nations pour la légende (exposées au rendu client). */
export function nationName(id: number, locale: Locale): string {
  return nationLabel(id, locale);
}

export { unitsIndex };
