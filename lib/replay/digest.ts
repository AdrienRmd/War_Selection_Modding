/** Digest statistique public d'un replay — construit CÔTÉ CLIENT (le
 *  navigateur a parsé le replay via l'API officielle) puis joint à la
 *  soumission /api/replay/submit. Module pur, sans binding serveur : le
 *  serveur re-valide ce digest dans lib/replay-stats.ts (cleanDigest).
 *  Saison/catégorie/points : calculés côté serveur (cf. replay-stats). */
import type { ReplayAnalysis } from "./analysis";
import type { Player, ReplayParseSuccess } from "./structure";

export interface DigestPlayer {
  /** Pseudo (clé du ladder). */
  n: string;
  /** Victoire (0/1). */
  w: 0 | 1;
  /** MVP du match (0/1). */
  m: 0 | 1;
  /** Unités tuées (dénombrement). */
  k: number;
  /** Unités perdues (dénombrement). */
  l: number;
}

export interface ReplayDigest {
  /** Unix secondes du début de partie (data.start) ; null si absent. */
  startedAt: number | null;
  /** Durée en secondes. */
  durationS: number;
  /** Région serveur (ex. « europe ») si connue. */
  region: string | null;
  /** Code de carte personnalisée si la partie n'est pas matchmaking. */
  mapCode: string | null;
  players: DigestPlayer[];
  /** Top unités produites [gameId, total] — animaux/décor exclus. */
  units: Array<[string, number]>;
}

/** Bornes miroir de la validation serveur (cleanDigest). */
export const DIGEST_MAX_PLAYERS = 32;
export const DIGEST_MAX_UNITS = 12;

/** Préfixes exclus du top « unités produites » : faune et décor ne sont pas
 *  des productions de joueur. */
const EXCLUDED_UNIT_PREFIXES = ["WarSelection/animals/", "WarSelection/decor/"];

export function buildReplayDigest(
  result: ReplayParseSuccess,
  analysis: ReplayAnalysis,
): ReplayDigest {
  const players: DigestPlayer[] = [];
  for (const team of analysis.teams) {
    for (const p of team.players) {
      players.push({
        n: p.player.nickname.slice(0, 40),
        w: p.player.isWinner ? 1 : 0,
        m: p.player.isMvp ? 1 : 0,
        k: Math.max(0, Math.round(p.killed)),
        l: Math.max(0, Math.round(p.lost)),
      });
      if (players.length >= DIGEST_MAX_PLAYERS) break;
    }
    if (players.length >= DIGEST_MAX_PLAYERS) break;
  }
  return {
    startedAt: typeof result.match.startTime === "number" ? result.match.startTime : null,
    durationS: Math.max(0, Math.round(result.match.duration / 1000)),
    region: result.match.region ?? null,
    mapCode: result.match.mapCode ?? null,
    players,
    units: topProducedUnits(result.players),
  };
}

/** Top unités produites du match (toutes équipes), faune/décor exclu. */
export function topProducedUnits(players: Player[]): Array<[string, number]> {
  const totals = new Map<string, number>();
  for (const player of players) {
    if (!player.unitsCreated) continue;
    for (const [, list] of player.unitsCreated) {
      for (const unit of list) {
        if (EXCLUDED_UNIT_PREFIXES.some((prefix) => unit.id.startsWith(prefix))) continue;
        totals.set(unit.id, (totals.get(unit.id) ?? 0) + unit.number);
      }
    }
  }
  return [...totals.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, DIGEST_MAX_UNITS);
}
