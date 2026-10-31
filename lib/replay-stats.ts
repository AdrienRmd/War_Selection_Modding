/** Couche « statistiques joueurs & saison » (Replay phase 2, 31/10/2026).
 *
 *  Modèle documenté :
 *  - Saison : AUCUN champ saison n'existe dans les données replay de
 *    games-api (initData/extraData examinés sur les fixtures wsva-* : ni
 *    season, ni numéro de ladder ; « version » = build technique). FALLBACK
 *    DOCUMENTÉ : saison calendaire mensuelle « YYYY-MM » en UTC, dérivée de
 *    `match.startTime` (horodatage unix du début de partie, présent dans
 *    `data.start`). Repli final : mois de la soumission (created_at).
 *  - Digest public : le client (qui a parsé le replay côté navigateur) joint
 *    à la soumission un résumé borné — joueurs (pseudo, victoire, MVP,
 *    unités tuées/perdues) et top unités produites. Le serveur le valide
 *    strictement (bornes, assainissement) puis le stocke dans
 *    `replay_results` ; l'agrégation ne JAMAIS re-fetcher games-api côté
 *    serveur (aucune nouvelle origine réseau).
 *  - Catégorie : teamSize ≥ 3 → « big » (Big team), sinon « solo »
 *    (Solo-Duo) — seules deux catégories affichées façon wsva.
 *  - Points (formule simple, déterministe, recalculable) :
 *        points = participations×1 + victoires×2 + MVP×2 + ⌊unités tuées/100⌋
 *    La participation compte, vainqueurs et MVP pèsent double, l'agressivité
 *    soutenue apporte un petit bonus (1 pt par 100 unités tuées).
 *  - Agrégation INCRÉMENTALE À LA PUBLICATION (décision orchestrateur : pas
 *    de cron) : upsert par (saison, catégorie, joueur) ; garde-fou
 *    `aggregated_at` sur replay_results → application/retrait idempotents.
 *  - Recalcul défensif : `rebuildPlayerStats` reconstruit TOUT depuis
 *    replays (statut published) + replay_results — idempotent, exposé via
 *    POST /api/replay/stats-rebuild (admin). */
import { bindings, HttpError } from "@/lib/atlas-server";
import type { DigestPlayer, ReplayDigest } from "@/lib/replay/digest";

export const REPLAY_CATEGORIES = ["big", "solo"] as const;
export type ReplayCategory = (typeof REPLAY_CATEGORIES)[number];
export type { DigestPlayer, ReplayDigest };

/** Bornes de la validation serveur (bornes constructeur côté digest.ts). */
const MAX_PLAYERS = 32;
const MAX_UNITS = 12;
const MAX_NAME = 40;
const MAX_COUNT = 1_000_000;

export interface ReplayResultRow {
  code: string;
  season: string;
  category: ReplayCategory;
  started_at: string;
  duration_s: number;
  mode_key: string;
  team_size: number;
  region: string | null;
  map_code: string | null;
  data: string;
  updated_at: string;
  aggregated_at: string | null;
}

export interface PlayerStatsRow {
  season: string;
  category: ReplayCategory;
  player_name: string;
  games: number;
  wins: number;
  mvps: number;
  kills: number;
  losses: number;
  points: number;
  last_played: string;
}

/* ------------------------------------------------------------------ */
/* Saison & catégories (pures, testées)                                */
/* ------------------------------------------------------------------ */

/** Saison calendaire mensuelle UTC « YYYY-MM » d'un instant (ms ou ISO). */
export function seasonOf(when: number | string): string {
  const date = typeof when === "number" ? new Date(when) : new Date(when);
  if (Number.isNaN(date.getTime())) throw new Error("invalid date for season");
  return date.toISOString().slice(0, 7);
}

/** Saison du replay : horodatage de partie sinon mois de la soumission. */
export function replaySeason(startedAtUnixSeconds: number | null, fallbackIso: string): string {
  if (typeof startedAtUnixSeconds === "number" && startedAtUnixSeconds > 0)
    return seasonOf(startedAtUnixSeconds * 1000);
  return seasonOf(fallbackIso);
}

export function categoryOf(teamSize: number): ReplayCategory {
  return teamSize >= 3 ? "big" : "solo";
}

/** Formule de points documentée (cf. en-tête du fichier). */
export function playerPoints(games: number, wins: number, mvps: number, kills: number): number {
  return games + 2 * wins + 2 * mvps + Math.floor(kills / 100);
}

/** Delta de points apporté par la participation à UN match. */
const matchPoints = (p: DigestPlayer): number => playerPoints(1, p.w, p.m, p.k);

/* ------------------------------------------------------------------ */
/* Validation du digest soumis (défense en profondeur côté serveur)    */
/* ------------------------------------------------------------------ */

const sanitize = (s: unknown, max: number): string | null =>
  typeof s === "string" ? s.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) || null : null;

const boundedInt = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === "number" ? v : Number.parseInt(String(v ?? ""), 10);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/** Normalise le digest d'une soumission. Null → digest absent/ignoré ;
 *  throws HttpError(400) → digest présent mais malformé (bug client visible). */
export function cleanDigest(value: unknown): ReplayDigest | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value))
    throw new HttpError(400, "回放统计摘要格式不正确。 / Replay stats digest is malformed.");
  const d = value as Record<string, unknown>;
  const startedAt = d.startedAt === null ? null : boundedInt(d.startedAt, 0, 4_102_444_800);
  if (startedAt === null && d.startedAt !== undefined && d.startedAt !== null)
    throw new HttpError(400, "回放统计摘要格式不正确。 / Replay stats digest is malformed.");
  const durationS = boundedInt(d.durationS, 0, 172_800);
  if (durationS === null)
    throw new HttpError(400, "回放统计摘要格式不正确。 / Replay stats digest is malformed.");
  if (d.players !== undefined && !Array.isArray(d.players))
    throw new HttpError(400, "回放统计摘要格式不正确。 / Replay stats digest is malformed.");
  const players: DigestPlayer[] = [];
  for (const raw of (d.players as unknown[]) ?? []) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw))
      throw new HttpError(400, "回放统计摘要格式不正确。 / Replay stats digest is malformed.");
    const p = raw as Record<string, unknown>;
    const name = sanitize(p.n, MAX_NAME);
    if (!name) continue; // pseudo vide : joueur ignoré
    const k = boundedInt(p.k, 0, MAX_COUNT);
    const l = boundedInt(p.l, 0, MAX_COUNT);
    if (k === null || l === null)
      throw new HttpError(400, "回放统计摘要格式不正确。 / Replay stats digest is malformed.");
    players.push({
      n: name,
      w: p.w ? 1 : 0,
      m: p.m ? 1 : 0,
      k,
      l,
    });
    if (players.length >= MAX_PLAYERS) break;
  }
  const units: Array<[string, number]> = [];
  if (d.units !== undefined) {
    if (!Array.isArray(d.units))
      throw new HttpError(400, "回放统计摘要格式不正确。 / Replay stats digest is malformed.");
    for (const raw of d.units) {
      if (!Array.isArray(raw) || raw.length !== 2) continue;
      const id = sanitize(raw[0], 80);
      const n = boundedInt(raw[1], 0, MAX_COUNT);
      if (id && n !== null && /^[\w/.-]+$/.test(id)) units.push([id, n]);
      if (units.length >= MAX_UNITS) break;
    }
  }
  return {
    startedAt,
    durationS,
    region: sanitize(d.region, 40),
    mapCode: sanitize(d.mapCode, 64),
    players,
    units,
  };
}

/* ------------------------------------------------------------------ */
/* Écritures D1 (upsert incrémental / retrait / rebuild)               */
/* ------------------------------------------------------------------ */

interface D1Statement {
  bind: (...values: unknown[]) => D1Statement;
  run: () => Promise<{ meta: { changes: number } }>;
  first: <T>() => Promise<T | null>;
  all: <T>() => Promise<{ results: T[] }>;
}

interface D1Like {
  prepare: (sql: string) => D1Statement;
  batch: (statements: D1Statement[]) => Promise<unknown>;
}

const upsertStatements = (
  row: { season: string; category: ReplayCategory; lastPlayed: string },
  players: DigestPlayer[],
  sign: 1 | -1,
  db: D1Like,
) =>
  players.map((p) =>
    db
      .prepare(
        `INSERT INTO player_stats (season, category, player_name, games, wins, mvps, kills, losses, points, last_played)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(season, category, player_name) DO UPDATE SET
           games = MAX(games + ?, 0), wins = MAX(wins + ?, 0), mvps = MAX(mvps + ?, 0),
           kills = MAX(kills + ?, 0), losses = MAX(losses + ?, 0), points = MAX(points + ?, 0),
           last_played = CASE WHEN ? = 1 THEN MAX(last_played, ?) ELSE last_played END`,
      )
      .bind(
        row.season,
        row.category,
        p.n,
        Math.max(sign, 0),
        sign > 0 ? p.w : 0,
        sign > 0 ? p.m : 0,
        sign > 0 ? p.k : 0,
        sign > 0 ? p.l : 0,
        sign > 0 ? matchPoints(p) : 0,
        sign > 0 ? row.lastPlayed : "1970-01-01T00:00:00.000Z",
        // Deltas du DO UPDATE : ±1 participation, ±victoire, ±MVP, ±tués,
        // ±perdus, ±points (les valeurs brutes ci-dessus ne servent qu'à
        // l'INSERT d'une nouvelle ligne).
        sign,
        sign * p.w,
        sign * p.m,
        sign * p.k,
        sign * p.l,
        sign * matchPoints(p),
        sign > 0 ? 1 : 0,
        row.lastPlayed,
      ),
  );

/** Applique les stats d'un replay publié (idempotent via aggregated_at).
 *  Sans ligne replay_results (soumissions antérieures au digest) : no-op
 *  documenté — la ligne rejoindra le classement au prochain rebuild. */
export async function applyReplayStats(code: string): Promise<void> {
  const db = bindings().DB as unknown as D1Like;
  const row = await db
    .prepare("SELECT * FROM replay_results WHERE code = ?")
    .bind(code)
    .first<ReplayResultRow>();
  if (!row || row.aggregated_at) return;
  const digest = parseStoredDigest(row.data);
  const now = new Date().toISOString();
  await db.batch([
    ...upsertStatements(
      { season: row.season, category: row.category, lastPlayed: row.started_at },
      digest.players,
      1,
      db,
    ),
    db.prepare("UPDATE replay_results SET aggregated_at = ? WHERE code = ?").bind(now, code),
  ]);
}

/** Retire la contribution d'un replay (retrait/refus après publication). */
export async function removeReplayStats(code: string): Promise<void> {
  const db = bindings().DB as unknown as D1Like;
  const row = await db
    .prepare("SELECT * FROM replay_results WHERE code = ?")
    .bind(code)
    .first<ReplayResultRow>();
  if (!row || !row.aggregated_at) return;
  const digest = parseStoredDigest(row.data);
  await db.batch([
    ...upsertStatements(
      { season: row.season, category: row.category, lastPlayed: row.started_at },
      digest.players,
      -1,
      db,
    ),
    db.prepare("UPDATE replay_results SET aggregated_at = NULL WHERE code = ?").bind(code),
    db.prepare(
      "DELETE FROM player_stats WHERE season = ? AND category = ? AND player_name IN (SELECT value FROM json_each(?)) AND games = 0",
    ).bind(row.season, row.category, JSON.stringify(digest.players.map((p) => p.n))),
  ]);
}

function parseStoredDigest(data: string): ReplayDigest {
  try {
    const parsed = cleanDigest(JSON.parse(data));
    if (!parsed) throw new Error("empty");
    return parsed;
  } catch {
    // Digest stocké invalide (ne devrait pas arriver : validé à l'écriture) :
    // traité comme vide pour ne jamais bloquer la modération.
    return { startedAt: null, durationS: 0, region: null, mapCode: null, players: [], units: [] };
  }
}

/** Rebuild complet idempotent : player_stats = f(replays publiés, digests). */
export async function rebuildPlayerStats(): Promise<{ players: number; replays: number }> {
  const db = bindings().DB as unknown as D1Like;
  const rows = await db
    .prepare(
      "SELECT r.* FROM replay_results r JOIN replays p ON p.code = r.code WHERE p.status = 'published' ORDER BY r.started_at",
    )
    .all<ReplayResultRow>();
  const now = new Date().toISOString();
  const statements: D1Statement[] = [
    db.prepare("DELETE FROM player_stats").bind(),
    db.prepare("UPDATE replay_results SET aggregated_at = NULL").bind(),
  ];
  const aggregated = new Map<string, { wins: number; mvps: number; games: number; kills: number; losses: number; points: number; last: string }>();
  for (const row of rows.results ?? []) {
    const digest = parseStoredDigest(row.data);
    for (const p of digest.players) {
      const key = `${row.season}\u0000${row.category}\u0000${p.n}`;
      const acc =
        aggregated.get(key) ??
        { wins: 0, mvps: 0, games: 0, kills: 0, losses: 0, points: 0, last: "" };
      acc.games += 1;
      acc.wins += p.w;
      acc.mvps += p.m;
      acc.kills += p.k;
      acc.losses += p.l;
      acc.points += matchPoints(p);
      if (row.started_at > acc.last) acc.last = row.started_at;
      aggregated.set(key, acc);
    }
    statements.push(
      db.prepare("UPDATE replay_results SET aggregated_at = ? WHERE code = ?").bind(now, row.code),
    );
  }
  for (const [key, acc] of aggregated) {
    const [season, category, name] = key.split("\u0000");
    statements.push(
      db
        .prepare(
          "INSERT INTO player_stats (season, category, player_name, games, wins, mvps, kills, losses, points, last_played) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(season, category, name, acc.games, acc.wins, acc.mvps, acc.kills, acc.losses, acc.points, acc.last),
    );
  }
  await db.batch(statements);
  return { players: aggregated.size, replays: (rows.results ?? []).length };
}

/** Écrit la ligne replay_results d'une soumission (UPSERT). */
export async function upsertReplayResult(
  code: string,
  teamSize: number,
  modeKey: string,
  digest: ReplayDigest,
  fallbackIso: string,
): Promise<void> {
  const db = bindings().DB as unknown as D1Like;
  const now = new Date().toISOString();
  const startedAt = digest.startedAt
    ? new Date(digest.startedAt * 1000).toISOString()
    : fallbackIso;
  await db
    .prepare(
      `INSERT INTO replay_results (code, season, category, started_at, duration_s, mode_key, team_size, region, map_code, data, updated_at, aggregated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
       ON CONFLICT(code) DO UPDATE SET
         season = excluded.season, category = excluded.category, started_at = excluded.started_at,
         duration_s = excluded.duration_s, mode_key = excluded.mode_key, team_size = excluded.team_size,
         region = excluded.region, map_code = excluded.map_code, data = excluded.data,
         updated_at = excluded.updated_at`,
    )
    .bind(
      code,
      replaySeason(digest.startedAt, fallbackIso),
      categoryOf(teamSize),
      startedAt,
      digest.durationS,
      modeKey,
      teamSize,
      digest.region,
      digest.mapCode,
      JSON.stringify(digest),
      now,
    )
    .run();
}

/* ------------------------------------------------------------------ */
/* Lectures (pages /players et /season-statistics)                     */
/* ------------------------------------------------------------------ */

export async function listSeasons(): Promise<string[]> {
  const db = bindings().DB as unknown as D1Like;
  const rows = await db
    .prepare(
      "SELECT season FROM replay_results GROUP BY season ORDER BY season DESC",
    )
    .all<{ season: string }>();
  const seasons = (rows.results ?? []).map((r) => r.season);
  if (seasons.length === 0) seasons.push(seasonOf(Date.now()));
  return seasons;
}

export async function playerStatsForSeason(
  season: string,
  category: ReplayCategory,
): Promise<PlayerStatsRow[]> {
  const db = bindings().DB as unknown as D1Like;
  const rows = await db
    .prepare(
      "SELECT * FROM player_stats WHERE season = ? AND category = ? ORDER BY points DESC, wins DESC, player_name ASC LIMIT 500",
    )
    .bind(season, category)
    .all<PlayerStatsRow>();
  return rows.results ?? [];
}

/* ------------------------------------------------------------------ */
/* Stats saison (page /season-statistics)                              */
/* ------------------------------------------------------------------ */

export interface SeasonStats {
  season: string;
  replays: number;
  players: number;
  avgDurationS: number | null;
  modes: Array<{ modeKey: string; count: number }>;
  regions: Array<{ region: string; count: number }>;
  maps: Array<{ mapCode: string; count: number }>;
  topUnits: Array<{ unitId: string; count: number }>;
  lastStarted: string | null;
}

/** Agrégation pure des stats d'une saison depuis les lignes replay_results
 *  (digests publiés) — testée unitairement, requêtes D1 en amont. */
export function aggregateSeasonStats(season: string, rows: ReplayResultRow[]): SeasonStats {
  const modes = new Map<string, number>();
  const regions = new Map<string, number>();
  const maps = new Map<string, number>();
  const units = new Map<string, number>();
  const players = new Set<string>();
  let durationTotal = 0;
  let lastStarted: string | null = null;
  for (const row of rows) {
    modes.set(row.mode_key, (modes.get(row.mode_key) ?? 0) + 1);
    if (row.region) regions.set(row.region, (regions.get(row.region) ?? 0) + 1);
    if (row.map_code) maps.set(row.map_code, (maps.get(row.map_code) ?? 0) + 1);
    durationTotal += row.duration_s;
    if (row.started_at > (lastStarted ?? "")) lastStarted = row.started_at;
    try {
      const digest = JSON.parse(row.data) as { players?: Array<{ n: string }>; units?: Array<[string, number]> };
      for (const p of digest.players ?? []) players.add(p.n);
      for (const [id, count] of digest.units ?? []) units.set(id, (units.get(id) ?? 0) + count);
    } catch {
      // digest illisible : ignoré (jamais bloquant pour l'affichage)
    }
  }
  const byCount = <T>(m: Map<T, number>): Array<{ key: T; count: number }> =>
    [...m.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)));
  return {
    season,
    replays: rows.length,
    players: players.size,
    avgDurationS: rows.length ? Math.round(durationTotal / rows.length) : null,
    modes: byCount(modes).map(({ key, count }) => ({ modeKey: key, count })),
    regions: byCount(regions).map(({ key, count }) => ({ region: key, count })),
    maps: byCount(maps).map(({ key, count }) => ({ mapCode: key, count })),
    topUnits: byCount(units)
      .slice(0, 8)
      .map(({ key, count }) => ({ unitId: key, count })),
    lastStarted,
  };
}

/** Lignes replay_results publiées d'une saison (ordre chronologique). */
export async function replayResultsForSeason(season: string): Promise<ReplayResultRow[]> {
  const db = bindings().DB as unknown as D1Like;
  const rows = await db
    .prepare(
      "SELECT r.* FROM replay_results r JOIN replays p ON p.code = r.code WHERE p.status = 'published' AND r.season = ? ORDER BY r.started_at",
    )
    .bind(season)
    .all<ReplayResultRow>();
  return rows.results ?? [];
}
