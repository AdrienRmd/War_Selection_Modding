/** Digest statistique public d'un replay — construit CÔTÉ CLIENT (le
 *  navigateur a parsé le replay via l'API officielle) puis joint à la
 *  soumission /api/replay/submit. Module pur, sans binding serveur : le
 *  serveur re-valide ce digest dans lib/replay-stats.ts (cleanDigest).
 *  Saison/catégorie/points : calculés côté serveur (cf. replay-stats). */
import type { ReplayAnalysis } from "./analysis";
import { computeMedals, medalsOfPlayer } from "./medals";
import getAgeNation from "./age-nation";
import { unitAgeBucket } from "./wsva-view";
import { researchesIndex } from "@/lib/researches";
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
  /* --- V3 profil joueur (01/11/2026), bornes miroir cleanDigest --- */
  /** MMR (rating du replay), si présent. */
  r?: number;
  /** Part d'impact de l'équipe (0-100). */
  s?: number;
  /** Nation du bronze (2=Europe, 3=Asie). */
  bn?: number;
  /** Dernière nation/branche atteinte. */
  ln?: number;
  /** Dernière recherche d'âge (id). */
  la?: number;
  /** Médailles gagnées (clés lib/replay/medals.ts). */
  md?: string[];
}

/** Unités favorites par bucket d'âge (V3) : [bucket, gameId, total]. */
export type DigestUnitByAge = [string, string, number];
/** Record d'âge (V3) : [idRecherche, tempsMs du premier passage]. */
export type DigestAgeReach = [number, number];

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
  /* --- V3 --- */
  /** Par joueur (même ordre/keys que players) : unités top-3 par âge. */
  unitsByAge?: Array<[string, DigestUnitByAge[]]>;
  /** Par joueur : records d'âge (première transition atteinte). */
  ageReach?: Array<[string, DigestAgeReach[]]>;
}

/** Bornes miroir de la validation serveur (cleanDigest). */
export const DIGEST_MAX_PLAYERS = 32;
export const DIGEST_MAX_UNITS = 12;
/** V3 : top unités par bucket d'âge, et records d'âge par joueur. */
export const DIGEST_MAX_UNITS_PER_AGE = 3;
export const DIGEST_MAX_AGE_REACH = 12;

/** Préfixes exclus du top « unités produites » : faune et décor ne sont pas
 *  des productions de joueur. */
const EXCLUDED_UNIT_PREFIXES = ["WarSelection/animals/", "WarSelection/decor/"];

export function buildReplayDigest(
  result: ReplayParseSuccess,
  analysis: ReplayAnalysis,
): ReplayDigest {
  const players: DigestPlayer[] = [];
  const unitsByAge: Array<[string, DigestUnitByAge[]]> = [];
  const ageReach: Array<[string, DigestAgeReach[]]> = [];
  // Médailles du match (V3) — calque documenté lib/replay/medals.ts.
  const awards = computeMedals(result, analysis);
  for (const team of analysis.teams) {
    for (const p of team.players) {
      const nation = nationTrack(p.player.researches ?? []);
      players.push({
        n: p.player.nickname.slice(0, 40),
        w: p.player.isWinner ? 1 : 0,
        m: p.player.isMvp ? 1 : 0,
        k: Math.max(0, Math.round(p.killed)),
        l: Math.max(0, Math.round(p.lost)),
        r: typeof p.player.rating === "number" ? p.player.rating : undefined,
        s: Math.max(0, Math.min(100, Math.round(p.share * 100))),
        bn: nation.bronze,
        ln: nation.last,
        la: p.player.lastAgeResearch,
        md: medalsOfPlayer(awards, p.player.nickname).map((a) => a.key),
      });
      unitsByAge.push([p.player.nickname.slice(0, 40), topUnitsByAge(p.player)]);
      ageReach.push([p.player.nickname.slice(0, 40), ageReachTimes(p.player)]);
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
    unitsByAge,
    ageReach,
  };
}

/* ------------------------------------------------------------------ */
/* V3 — dérivations profil                                             */
/* ------------------------------------------------------------------ */

/** Ids des recherches de transition d'âge (researchTypeAgeTransition),
 *  depuis l'index officiel lib/researches-index.json. */
const AGE_ADVANCE_IDS = new Set(
  (researchesIndex.researches ?? [])
    .filter((r) => r.type === "researchTypeAgeTransition")
    .map((r) => r.gameId),
);

/** Nation du bronze (id 2/3) et dernière nation atteinte, déduites de la
 *  timeline de recherches (lib/replay/age-nation.ts, logique du jeu). */
function nationTrack(
  researches: Array<{ id: number; takenTime: number }>,
): { bronze: number | undefined; last: number | undefined } {
  if (researches.length === 0) return { bronze: undefined, last: undefined };
  const timeline = researches
    .slice()
    .sort((a, b) => a.takenTime - b.takenTime)
    .map((r) => [r.takenTime, r.id] as const);
  let bronze: number | undefined;
  let last: number | undefined;
  let lastAge = -1;
  for (let i = 0; i < timeline.length; i++) {
    const [age, nation] = getAgeNation(timeline[i][0], timeline);
    if (age === 1 && bronze === undefined) bronze = nation;
    if (age >= lastAge) {
      lastAge = age;
      last = nation;
    }
  }
  return { bronze, last };
}

/** Top-3 unités produites par bucket d'âge (dossier du gameId), faune/décor
 *  exclu — borné : 5 buckets × 3 unités. */
function topUnitsByAge(player: Player): DigestUnitByAge[] {
  const out: DigestUnitByAge[] = [];
  if (!player.unitsCreated) return out;
  const totals = new Map<string, Map<string, number>>();
  for (const [, list] of player.unitsCreated) {
    for (const unit of list) {
      if (EXCLUDED_UNIT_PREFIXES.some((prefix) => unit.id.startsWith(prefix))) continue;
      const bucket = unitAgeBucket(unit.id);
      if (!bucket) continue;
      const byUnit = totals.get(bucket) ?? new Map<string, number>();
      byUnit.set(unit.id, (byUnit.get(unit.id) ?? 0) + unit.number);
      totals.set(bucket, byUnit);
    }
  }
  for (const [bucket, byUnit] of totals) {
    const top = [...byUnit.entries()]
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .slice(0, DIGEST_MAX_UNITS_PER_AGE);
    for (const [id, count] of top) out.push([bucket, id, count]);
  }
  return out.slice(0, DIGEST_MAX_UNITS_PER_AGE * 5);
}

/** Premiers temps d'atteinte des transitions d'âge du joueur. */
function ageReachTimes(player: Player): DigestAgeReach[] {
  const out: DigestAgeReach[] = [];
  for (const r of player.researches ?? []) {
    if (!AGE_ADVANCE_IDS.has(r.id)) continue;
    out.push([r.id, Math.max(0, Math.round(r.takenTime))]);
    if (out.length >= DIGEST_MAX_AGE_REACH) break;
  }
  return out.sort((a, b) => a[1] - b[1]);
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
