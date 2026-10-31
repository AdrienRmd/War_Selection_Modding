/** Analyse de replay « à la warselection.vercel.app » — verdict, équilibre de
 *  puissance, probabilité de victoire, événements décisifs, impact par joueur
 *  et par phase (early/mid/late).
 *
 *  ⚠️ MODÈLES APPROXIMATIFS, versions documentées (v1, 31/10/2026) :
 *  - power(t) par équipe = moyenne de trois parts égales — armée vivante
 *    (points créés cumulés − 0,7 × points tués par l'adversaire), revenu
 *    (ressources récoltées, moyenne glissante ~5 min) et territoire (points
 *    de terre courants). Chaque part = valeur équipe / (équipe + adversaire).
 *  - winChance(t) = sigmoïde(k·(EMA(power) − 0,5)) — EMA ~10 min, k = 20 ;
 *    calibrage qualitatif sur la capture wsva rep-Jd894wx6so9 (31/10).
 *  - Événements décisifs : éliminations (attribution aux 2 plus gros
 *    « tueurs d'unités » de la victime, par nombre d'unités), bascules de
 *    power (runs monotones lissés ≥ 3 points), chutes de travailleurs
 *    (baisse ≥ 8 % en ≤ 3 min), première merveille.
 *  - Impact joueur = score MVP existant (scoreCalculator) normalisé par
 *    équipe ; sa répartition temporelle dérive d'un taux d'activité
 *    (combats, production, économie, territoire), remis à l'échelle pour que
 *    Σ taux = score MVP. Le « cleanup » (fin de partie déjà décidée, au plus
 *    5 min) retire l'éco/production/territoire, les combats et éliminations
 *    continuent de compter.
 *  - « Last age reached » : instant de mort si le joueur est mort, sinon
 *    l'heure de sa première merveille, sinon rien (convention observée sur
 *    la capture wsva, 16/16 joueurs).
 *  Les écarts restants vs wsva sont listés dans le rapport du 31/10.
 * Données d'entrée : ReplayParseSuccess (parser local, aucune donnée externe). */
import getAgeNation from "./age-nation";
import type { BaseDataset } from "./dataset";
import { TimeLineDataset, TimeLineMultiRowDataset } from "./dataset";
import type { Player, ReplayParseSuccess } from "./structure";

/** Périodes couvertes par la timeline (N tranches + point initial t=0). */
const periodsOf = (result: ReplayParseSuccess): number =>
  Math.max(1, teamSeries(result, "replayDatasetUnitCreatePoints", 0)?.length ?? 1) - 1;

/* ------------------------------------------------------------------ */
/* Accès aux jeux de données (alignement garanti, cf. parser)          */
/* ------------------------------------------------------------------ */

function container(result: ReplayParseSuccess, name: string) {
  return result.charts.find((c) => c.containerName === `${name}Name`);
}

function teamGroup(result: ReplayParseSuccess, name: string): BaseDataset[] {
  const c = container(result, name);
  const group = c?.datasetGroups.find((g) => g.dataGroupIdentifier === "teams");
  return group ? group.datasets : [];
}

/** Série scalaire d'une équipe (index = tranche de timeline ; teams i↔ordre). */
function teamSeries(result: ReplayParseSuccess, name: string, side: number): number[] | null {
  const datasets = teamGroup(result, name);
  const ds = datasets[side];
  if (!(ds instanceof TimeLineDataset)) return null;
  return (ds.values as number[]).map((v) => (Number.isFinite(v) ? v : 0));
}

/** Série multi-lignes d'une équipe (trou d'index 0 normalisé). */
function teamMultiRow(result: ReplayParseSuccess, name: string, side: number): number[][] | null {
  const datasets = teamGroup(result, name);
  const ds = datasets[side];
  if (!(ds instanceof TimeLineMultiRowDataset)) return null;
  const rows = ds.values as number[][];
  return rows.map((row) => row.map((v) => (Number.isFinite(v) ? v : 0)));
}

/** Série scalaire d'un joueur (index 0 = t0 ; les joueurs morts tôt ont des
 *  séries plus courtes — alignement temporel préservé par construction). */
function playerSeries(result: ReplayParseSuccess, name: string, player: Player): number[] | null {
  const c = container(result, name);
  const group = c?.datasetGroups.find((g) => g.dataGroupIdentifier === "players");
  if (!group) return null;
  const datasets = group.datasets;
  let ds: BaseDataset | undefined;
  if (datasets.length === result.players.length) {
    ds = datasets[player.id];
  } else {
    // Repli défensif si le filtre « jeux vides » a retiré un joueur.
    const byName = datasets.filter((d) => d.datasetName === player.nickname);
    if (byName.length === 1) ds = byName[0];
  }
  if (!ds || !(ds instanceof TimeLineDataset)) return null;
  return (ds.values as number[]).map((v) => (Number.isFinite(v) ? v : 0));
}

/** Série multi-lignes d'un joueur — SANS point initial : index j ↔ (j+1)·T. */
function playerMultiRow(
  result: ReplayParseSuccess,
  name: string,
  player: Player,
): number[][] | null {
  const c = container(result, name);
  const group = c?.datasetGroups.find((g) => g.dataGroupIdentifier === "players");
  if (!group) return null;
  const datasets = group.datasets;
  let ds: BaseDataset | undefined;
  if (datasets.length === result.players.length) {
    ds = datasets[player.id];
  } else {
    const byName = datasets.filter((d) => d.datasetName === player.nickname);
    if (byName.length === 1) ds = byName[0];
  }
  if (!ds || !(ds instanceof TimeLineMultiRowDataset)) return null;
  const rows = ds.values as number[][];
  return rows.map((row) => row.map((v) => (Number.isFinite(v) ? v : 0)));
}

/* ------------------------------------------------------------------ */
/* Types de sortie                                                     */
/* ------------------------------------------------------------------ */

export type Side = 0 | 1; // 0 = Bleue (1re équipe), 1 = Rouge (2e équipe)

export interface VerdictInfo {
  winnerSide: Side | null;
  reason: "elimination" | "wonder" | "survivors" | "undecided";
  teamSize: number;
  modeKey: string;
}

export interface EliminationDetail {
  victim: string;
  killers: string[];
  /** La victime avait encore une armée conséquente → départ/abandon. */
  leftGame: boolean;
  downTo: number;
}

export interface SwingDetail {
  fromPct: number;
  toPct: number;
  minutes: number;
  topKillers: Array<{ name: string; value: number }>;
}

export interface WorkersDetail {
  lostPct: number;
  minutes: number;
  topKillers: Array<{ name: string; value: number }>;
}

export interface DecisiveEvent {
  timeMs: number;
  kind: "elimination" | "swing" | "workers" | "wonder";
  /** Équipe concernée : victime (élimination, workers), bénéficiaire (swing, merveille). */
  side: Side;
  /** Win chance annotée = celle de l'équipe bénéficiaire de l'événement. */
  winBefore: number;
  winAfter: number;
  elimination?: EliminationDetail;
  swing?: SwingDetail;
  workers?: WorkersDetail;
  wonder?: { builder: string };
}

export interface PlayerImpact {
  player: Player;
  /** Part de l'impact de l'équipe (0..1). */
  share: number;
  role: "frontline" | "backline";
  /** Numéro de peloton affiché (groupe + 1), undefined si sans peloton. */
  squad?: number;
  /** Mort → instant de mort ; merveille → instant de la première merveille. */
  lastAgeTimeMs?: number;
  lastAge?: number;
  resTotal: number;
  resFood: number;
  resWood: number;
  resIron: number;
  /** Efficacité de récolte moyenne en pourcentage (≈100 = optimal). */
  efficiencyPct?: number;
  killed: number;
  created: number;
  lost: number;
  /** K/D brut (tués/perdus, nombre d'unités), undefined si aucune perte. */
  kd?: number;
  /** Taux d'impact par tranche de timeline (cleanup appliqué), à l'échelle
   *  du score MVP : Σ impactRate = mvpScore. */
  impactRate: number[];
}

export interface TeamImpact {
  id: number;
  side: Side;
  isWinner: boolean;
  avgRating?: number;
  aliveCount: number;
  total: number;
  /** Poids des phases dans l'impact total de l'équipe (early/mid/late). */
  weights: { early: number; mid: number; late: number };
  players: PlayerImpact[];
}

export interface StagesInfo {
  earlyEndMs: number;
  midEndMs: number;
  decidedMs?: number;
  cleanupFromMs: number;
}

export interface ReplayAnalysis {
  verdict: VerdictInfo;
  teams: TeamImpact[];
  /** Équilibre de puissance — parts par équipe (blue + red = 1 par tranche).
   *  Null si le match n'oppose pas exactement 2 équipes. */
  power: { timeMs: number[]; blue: number[]; red: number[] } | null;
  /** Probabilité de victoire de l'équipe bleue (0..1, sigmoïde d'EMA). */
  winChanceBlue: number[] | null;
  events: DecisiveEvent[];
  stages: StagesInfo | null;
}

/* ------------------------------------------------------------------ */
/* Petits utilitaires                                                  */
/* ------------------------------------------------------------------ */

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const share = (a: number, b: number) => (a + b > 0 ? a / (a + b) : 0.5);
const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const s = [...values].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/* ------------------------------------------------------------------ */
/* Construction                                                        */
/* ------------------------------------------------------------------ */

const KILL_DAMPING = 0.7; // part des points tués retirés de l'armée vivante
const INCOME_WINDOW = 10; // périodes (~5 min) de moyenne glissante du revenu
const EMA_PERIODS = 20; // ~10 min de lissage de la power pour la win chance
const WIN_K = 20; // pente de la sigmoïde
const SWING_MIN = 0.03; // bascule de power minimale (3 points de %)
const SWING_MAX_MINUTES = 10;
const WORKERS_MIN_DROP = 0.1; // chute de travailleurs minimale (10 %)
const DECIDED_THRESHOLD = 0.95; // win chance « partie décidée »
const CLEANUP_MAX_MS = 5 * 60 * 1000;
const LEFT_MIN_ARMY = 200; // armée résiduelle mini pour parler d'abandon
const LEFT_MAX_DECLINE = 0.35; // baisse max sur 2 min pour un abandon

export function buildReplayAnalysis(result: ReplayParseSuccess): ReplayAnalysis {
  const duration = result.match.duration;
  const period = result.timeLinePeriod;
  // Équipes avec joueurs, ordre croissant d'id : 0 = Bleue, 1 = Rouge.
  const playerTeams = result.teams.filter((t) => t.players.length > 0);
  const isDuel = playerTeams.length === 2;
  const winnerTeamId = result.match.winnerTeams[0];
  const winnerSide: Side | null = isDuel
    ? (playerTeams.findIndex((t) => t.id === winnerTeamId) as Side)
    : null;

  const teamSize = isDuel ? Math.max(...playerTeams.map((t) => t.players.length)) : 0;
  const losersAllDead = isDuel
    ? playerTeams[(1 - (winnerSide ?? 0)) as Side].players.every((pid) => {
        const p = result.players[pid];
        return p?.isDead === true;
      })
    : false;
  const reason: VerdictInfo["reason"] = !result.match.isComplete
    ? "undecided"
    : result.match.isWonderWin
      ? "wonder"
      : losersAllDead
        ? "elimination"
        : "survivors";

  /* --- Équilibre de puissance + win chance ------------------------- */
  const n = periodsOf(result);
  let power: ReplayAnalysis["power"] = null;
  let winChanceBlue: number[] | null = null;
  if (isDuel) {
    const create = [0, 1].map((s) => teamSeries(result, "replayDatasetUnitCreatePoints", s) ?? []);
    const kills = [0, 1].map((s) => teamSeries(result, "replayDatasetUnitKillPoints", s) ?? []);
    const land = [0, 1].map((s) => teamSeries(result, "replayDatasetLandPoints", s) ?? []);
    const collected = [0, 1].map(
      (s) => teamSeriesTotal(teamMultiRow(result, "replayDatasetResourcesCollected", s)),
    );
    const cum = (a: number[]) => {
      let acc = 0;
      return a.map((v) => (acc = Math.max(0, acc + v)));
    };
    const cumCreate = create.map(cum);
    const cumKills = kills.map(cum);
    const income = collected.map((c) => windowedRate(c, INCOME_WINDOW));
    const len = Math.max(...create.map((a) => a.length));
    const blue: number[] = [];
    const red: number[] = [];
    for (let i = 0; i < len; i++) {
      const armyB = Math.max(0, v(cumCreate[0], i) - KILL_DAMPING * v(cumKills[1], i));
      const armyR = Math.max(0, v(cumCreate[1], i) - KILL_DAMPING * v(cumKills[0], i));
      const p = (share(armyB, armyR) + share(v(income[0], i), v(income[1], i)) + share(v(land[0], i), v(land[1], i))) / 3;
      blue.push(p);
      red.push(1 - p);
    }
    power = { timeMs: blue.map((_, i) => i * period), blue, red };
    let ema = blue[0] ?? 0.5;
    const alpha = 2 / (EMA_PERIODS + 1);
    winChanceBlue = blue.map((p) => {
      ema += (p - ema) * alpha;
      return 1 / (1 + Math.exp(-WIN_K * (ema - 0.5)));
    });
  }

  /* --- Phases (early/mid/late) + cleanup --------------------------- */
  let stages: StagesInfo | null = null;
  if (isDuel && n > 2) {
    const age3 = result.players.map((p) => firstAgeTime(p, 3)).filter((t): t is number => t !== null);
    const age5 = result.players.map((p) => firstAgeTime(p, 5)).filter((t): t is number => t !== null);
    const earlyEnd = clamp(median(age3) ?? duration * 0.3, 2 * period, duration - 4 * period);
    const midEnd = clamp(median(age5) ?? duration * 0.6, earlyEnd + period, duration - 2 * period);
    let decided: number | undefined;
    if (winChanceBlue && winnerSide !== null) {
      const target = winnerSide === 0 ? winChanceBlue : winChanceBlue.map((w) => 1 - w);
      const idx = target.findIndex((w) => w >= DECIDED_THRESHOLD);
      if (idx >= 0) decided = idx * period;
    }
    const cleanupFrom = decided !== undefined ? Math.max(decided, duration - CLEANUP_MAX_MS) : duration;
    stages = { earlyEndMs: earlyEnd, midEndMs: midEnd, decidedMs: decided, cleanupFromMs: cleanupFrom };
  }

  /* --- Impact par joueur ------------------------------------------- */  const teams = playerTeams.map((team, side): TeamImpact => {
    const players = team.players.map((pid) => result.players[pid]).filter(Boolean);
    const impact = players.map((p) => buildPlayerImpact(result, p, stages, period));
    // Tri : impact décroissant (score MVP), l'équipe garde son ordre bleu/rouge.
    impact.sort((a, b) => (b.player.mvpScore ?? 0) - (a.player.mvpScore ?? 0));
    const totalMvp = sum(impact.map((i) => i.player.mvpScore ?? 0));
    for (const i of impact) i.share = totalMvp > 0 ? (i.player.mvpScore ?? 0) / totalMvp : 1 / impact.length;
    const ratings = players.map((p) => p.rating).filter((r): r is number => typeof r === "number");
    return {
      id: team.id,
      side: side as Side,
      isWinner: team.isWinner,
      avgRating: ratings.length ? Math.round(sum(ratings) / ratings.length) : undefined,
      aliveCount: players.filter((p) => p.isDead !== true).length,
      total: players.length,
      weights: stageWeights(impact, stages, period),
      players: impact,
    };
  });

  // Efficacité de récolte : recalibrée sur la médiane du match (≈100 %).
  const effs = teams
    .flatMap((t) => t.players.map((p) => p.efficiencyPct))
    .filter((x): x is number => x !== undefined && x > 0);
  const medEff = median(effs);
  if (medEff && medEff > 0) {
    for (const t of teams)
      for (const p of t.players)
        if (p.efficiencyPct !== undefined) p.efficiencyPct = (p.efficiencyPct / medEff) * 100;
  }

  /* --- Événements décisifs ----------------------------------------- */
  const events = isDuel && power && winChanceBlue
    ? buildEvents(result, power, winChanceBlue, teams, stages, period, winnerSide)
    : [];

  return {
    verdict: { winnerSide, reason, teamSize, modeKey: result.match.mode },
    teams,
    power,
    winChanceBlue,
    events,
    stages,
  };
}

/* ------------------------------------------------------------------ */
/* Impact joueur                                                       */
/* ------------------------------------------------------------------ */

/** Somme des lignes d'une série multi-lignes équipe (cumulative). */
function teamSeriesTotal(rows: number[][] | null): number[] {
  if (!rows || rows.length === 0) return [];
  const len = Math.max(...rows.map((r) => r.length));
  return Array.from({ length: len }, (_, i) => sum(rows.map((r) => r[i] ?? 0)));
}

/** Revenu par tranche : dérivée de la série cumulative, fenêtre glissante. */
function windowedRate(cumulative: number[], window: number): number[] {
  return cumulative.map((_, i) => {
    let s = 0;
    let count = 0;
    for (let k = Math.max(0, i - window); k <= i; k++) {
      s += cumulative[k] - (k > 0 ? cumulative[k - 1] : 0);
      count++;
    }
    return count > 0 ? s / count : 0;
  });
}

const v = (a: number[], i: number) => a[i] ?? 0;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
/** Saturation douce : rendements décroissants sur les grosses valeurs. */
const sat = (x: number) => (x > 0 ? x / (x + 1) : 0);

/** Première heure (ms) à laquelle le joueur atteint l'âge donné. */
function firstAgeTime(player: Player, targetAge: number): number | null {
  const researches = [...(player.researches ?? [])].sort((a, b) => a.takenTime - b.takenTime);
  if (researches.length === 0) return null;
  // L'âge ne progresse qu'aux transitions d'âge : évaluer à chaque recherche
  // prise suffit (monotonie de getAgeNation).
  for (const r of researches) {
    if (ageAtTime(player, r.takenTime) >= targetAge) return r.takenTime;
  }
  return null;
}

/** Âge d'un joueur à l'instant donné (mémoïsé par recherche). */
const ageCache = new WeakMap<Player, Map<number, number>>();
function ageAtTime(player: Player, timeMs: number): number {
  let byTime = ageCache.get(player);
  if (!byTime) {
    byTime = new Map();
    ageCache.set(player, byTime);
  }
  const cached = byTime.get(timeMs);
  if (cached !== undefined) return cached;
  const age = computeAge(player, timeMs);
  byTime.set(timeMs, age);
  return age;
}

function computeAge(player: Player, timeMs: number): number {
  const tl = (player.researches ?? [])
    .slice()
    .sort((a, b) => a.takenTime - b.takenTime)
    .map((r) => [r.takenTime, r.id] as [number, number]);
  return getAgeNation(timeMs, tl)[0];
}

function buildPlayerImpact(
  result: ReplayParseSuccess,
  player: Player,
  stages: StagesInfo | null,
  period: number,
): PlayerImpact {
  const kills = playerSeries(result, "replayDatasetUnitKillPoints", player) ?? [];
  const create = playerSeries(result, "replayDatasetUnitCreatePoints", player) ?? [];
  const land = playerSeries(result, "replayDatasetLandPoints", player) ?? [];
  const collectedRows = playerMultiRow(result, "replayDatasetResourcesCollected", player);
  const efficiency = playerSeries(result, "replayDatasetGatherEfficiency", player);

  // Ressources totales (fin de série) et taux d'impact par tranche.
  const resFinal = collectedRows?.map((row) => row[row.length - 1] ?? 0) ?? [0, 0, 0];
  const ecoRate: number[] = [];
  if (collectedRows) {
    const len = Math.max(...collectedRows.map((r) => r.length));
    for (let j = 0; j < len; j++) ecoRate.push(sum(collectedRows.map((r) => r[j] ?? 0)));
  }

  // Moyennes de normalisation (tous joueurs) pour équilibrer les composantes.
  const norm = impactNormalizers(result);
  const n = Math.max(kills.length, create.length, land.length, ecoRate.length + 1);
  const cleanupIdx = stages ? Math.floor(stages.cleanupFromMs / period) : Number.POSITIVE_INFINITY;
  const rate: number[] = [];
  for (let i = 0; i < n; i++) {
    // Séries scalaires joueur : index i ↔ i·T ; multi-lignes : j ↔ (j+1)·T.
    const eco = v(ecoRate, i - 1);
    const terr = Math.abs(v(land, i) - v(land, i - 1));
    const pastCleanup = i > cleanupIdx;
    let r = sat(v(kills, i) / norm.kills); // les combats comptent dans le cleanup
    if (!pastCleanup) {
      // Saturation (x/(x+1)) : les géants tardifs pèsent moins sur les parts.
      r += 0.4 * sat(v(create, i) / norm.create);
      r += 0.3 * sat(eco / norm.eco);
      r += 0.15 * sat(terr / norm.terr);
    }
    rate.push(Math.max(0, Math.log1p(r)));
  }

  // Remise à l'échelle : Σ rate = score MVP (répartition temporelle du proxy).
  const totalRate = sum(rate);
  const mvp = player.mvpScore ?? 0;
  const impactRate = totalRate > 0 ? rate.map((r) => (r * mvp) / totalRate) : rate.map(() => mvp / Math.max(1, rate.length));

  // Dénombrements d'unités (créées / tuées / perdues).
  const countUnits = (m?: Map<string, Array<{ number: number }>>) => {
    let c = 0;
    for (const units of m?.values() ?? []) for (const u of units) c += u.number;
    return c;
  };
  const created = countUnits(player.unitsCreated as never);
  const killed = countUnits(player.unitsKilledPlain as never);
  const lost = countUnits(player.unitsLostPlain as never);

  // « Last age reached » : mort → instant de mort ; sinon 1re merveille.
  const dead = player.isDead === true && player.survivalTime !== undefined;
  const lastAgeTimeMs = dead
    ? player.survivalTime
    : player.firstWonderTime && player.firstWonderTime > 0
      ? player.firstWonderTime
      : undefined;
  const lastAge = lastAgeTimeMs !== undefined ? computeAge(player, lastAgeTimeMs) : undefined;

  return {
    player,
    share: 0,
    role: "backline",
    squad: typeof player.group === "number" && player.group >= 0 ? player.group + 1 : undefined,
    lastAgeTimeMs,
    lastAge,
    resTotal: sum(resFinal),
    resFood: resFinal[0] ?? 0,
    resWood: resFinal[1] ?? 0,
    resIron: resFinal[2] ?? 0,
    efficiencyPct: efficiency && efficiency.length > 1 ? (sum(efficiency) / (efficiency.length - 1) / 3) * 100 : undefined,
    killed,
    created,
    lost,
    kd: lost > 0 ? killed / lost : undefined,
    impactRate,
  };
}

let normalizersCache: WeakMap<ReplayParseSuccess, { kills: number; create: number; eco: number; terr: number }> | null = null;
function impactNormalizers(result: ReplayParseSuccess) {
  normalizersCache ??= new WeakMap();
  const cached = normalizersCache.get(result);
  if (cached) return cached;
  const collect = (name: string, multiRow = false) => {
    let s = 0;
    let n = 0;
    for (const p of result.players) {
      const series = multiRow
        ? playerMultiRow(result, name, p)?.[0]?.map((_, j) => sum((playerMultiRow(result, name, p) ?? []).map((r) => r[j] ?? 0))) ?? []
        : playerSeries(result, name, p) ?? [];
      for (let i = multiRow ? 0 : 1; i < series.length; i++) {
        s += series[i];
        n++;
      }
    }
    return n > 0 ? Math.max(1e-9, s / n) : 1;
  };
  const terr = (() => {
    let s = 0;
    let n = 0;
    for (const p of result.players) {
      const series = playerSeries(result, "replayDatasetLandPoints", p) ?? [];
      for (let i = 1; i < series.length; i++) {
        s += Math.abs(series[i] - series[i - 1]);
        n++;
      }
    }
    return n > 0 ? Math.max(1e-9, s / n) : 1;
  })();
  const value = {
    kills: collect("replayDatasetUnitKillPoints"),
    create: collect("replayDatasetUnitCreatePoints"),
    eco: collect("replayDatasetResourcesCollected", true),
    terr,
  };
  normalizersCache.set(result, value);
  return value;
}

/** Poids des phases (parts de l'impact total de l'équipe). */
function stageWeights(
  impact: PlayerImpact[],
  stages: StagesInfo | null,
  period: number,
): { early: number; mid: number; late: number } {
  if (!stages) return { early: 1 / 3, mid: 1 / 3, late: 1 / 3 };
  const bounds = [0, stages.earlyEndMs, stages.midEndMs, Number.POSITIVE_INFINITY];
  const sums = [0, 0, 0];
  let total = 0;
  for (const p of impact) {
    for (let i = 0; i < p.impactRate.length; i++) {
      const t = i * period;
      const stage = t < bounds[1] ? 0 : t < bounds[2] ? 1 : 2;
      sums[stage] += p.impactRate[i];
      total += p.impactRate[i];
    }
  }
  if (total <= 0) return { early: 1 / 3, mid: 1 / 3, late: 1 / 3 };
  return { early: sums[0] / total, mid: sums[1] / total, late: sums[2] / total };
}

/* ------------------------------------------------------------------ */
/* Événements décisifs                                                 */
/* ------------------------------------------------------------------ */

function buildEvents(
  result: ReplayParseSuccess,
  power: NonNullable<ReplayAnalysis["power"]>,
  winChanceBlue: number[],
  teams: TeamImpact[],
  stages: StagesInfo | null,
  period: number,
  winnerSide: Side | null,
): DecisiveEvent[] {
  const duration = result.match.duration;
  const durationP = power.blue.length;
  const winAt = (tMs: number) => {
    const i = clamp(Math.round(tMs / period), 0, durationP - 1);
    return winChanceBlue[clamp(i, 0, winChanceBlue.length - 1)] ?? 0.5;
  };
  const events: DecisiveEvent[] = [];

  /* Éliminations (par équipe, temps de survie). */
  for (const team of teams) {
    const deaths = team.players
      .map((p) => p.player)
      .filter((p) => p.isDead === true && p.survivalTime !== undefined && p.survivalTime > 0)
      .sort((a, b) => (a.survivalTime ?? 0) - (b.survivalTime ?? 0));
    let alive = team.total;
    for (const victim of deaths) {
      alive -= 1;
      const enemySide = (1 - team.side) as Side;
      const enemyTeam = teams[enemySide];
      // Top tueur : nombre d'unités de la victime tuées par chaque ennemi.
      const contributions = enemyTeam.players
        .map((pi) => {
          const rec = pi.player.unitsKilledByFaction?.find(
            (e) => e.factionId === victim.factionId,
          );
          let count = 0;
          if (rec) for (const units of rec.units.values()) for (const u of units) count += u.number;
          return { name: pi.player.nickname, count };
        })
        .filter((c) => c.count >= 3)
        .sort((a, b) => b.count - a.count)
        .slice(0, 2)
        .map((c) => c.name);
      // Abandon ou élimination : une armée encore fournie et stable sur les
      // 2 dernières minutes = départ volontaire ; une armée qui s'effondre
      // (ou résiduel négligeable) = élimination, avec ses bourreaux.
      const army = playerSeries(result, "replayDatasetUnitCreatePoints", victim) ?? [];
      const d = Math.min(army.length - 1, Math.floor((victim.survivalTime ?? 0) / period));
      const last4 = army.slice(Math.max(0, d - 3), d + 1);
      const decline = last4.length === 4 && last4[0] > 0 ? 1 - last4[3] / last4[0] : 1;
      const leftGame =
        contributions.length === 0 ||
        (last4.length === 4 && last4[3] >= LEFT_MIN_ARMY && decline < LEFT_MAX_DECLINE);
      const winBefore = winAt((victim.survivalTime ?? 0) - 60_000);
      const winAfter = winAt((victim.survivalTime ?? 0) + 120_000);
      events.push({
        timeMs: victim.survivalTime!,
        kind: "elimination",
        side: team.side,
        winBefore: enemySide === 0 ? winBefore : 1 - winBefore,
        winAfter: enemySide === 0 ? winAfter : 1 - winAfter,
        elimination: {
          victim: victim.nickname,
          killers: leftGame ? [] : contributions,
          leftGame,
          downTo: alive,
        },
      });
    }
  }

  /* Bascules de power (runs monotones lissés, avant la décision du match). */
  const untilMs = stages?.decidedMs ?? stages?.cleanupFromMs ?? duration;
  const smooth = ema(power.blue.map((b) => 1 - b), 4); // power rouge lissée
  const swings = findSwings(smooth, period, untilMs);
  for (const s of swings.slice(0, 2)) {
    const side: Side = s.delta > 0 ? 1 : 0; // rouge qui monte → bénéficiaire rouge
    const fromPct = s.from * 100;
    const toPct = s.to * 100;
    const topKillers = topKillersInWindow(result, teams, side === 1 ? 1 : 0, s.fromIdx, s.toIdx);
    const winBefore = winAt(s.fromMs);
    const winAfter = winAt(s.toMs);
    events.push({
      timeMs: s.toMs,
      kind: "swing",
      side,
      winBefore: side === 0 ? winBefore : 1 - winBefore,
      winAfter: side === 0 ? winAfter : 1 - winAfter,
      swing: {
        fromPct,
        toPct,
        minutes: Math.max(1, Math.round((s.toMs - s.fromMs) / 60_000)),
        topKillers,
      },
    });
  }

  /* Chutes de travailleurs (avant la décision du match). */
  for (const team of teams) {
    const workers = teamSeries(result, "replayDatasetWorkerPoints", team.side) ?? [];
    const crash = findWorkerCrash(workers, period, untilMs);
    if (crash) {
      const enemySide = (1 - team.side) as Side;
      const topKillers = topKillersInWindow(result, teams, enemySide, crash.fromIdx, crash.toIdx);
      const winBefore = winAt(crash.fromMs);
      const winAfter = winAt(crash.toMs);
      events.push({
        timeMs: crash.toMs,
        kind: "workers",
        side: team.side,
        winBefore: enemySide === 0 ? winBefore : 1 - winBefore,
        winAfter: enemySide === 0 ? winAfter : 1 - winAfter,
        workers: {
          lostPct: Math.round(crash.drop * 100),
          minutes: Math.max(1, Math.round((crash.toMs - crash.fromMs) / 60_000)),
          topKillers,
        },
      });
    }
  }

  /* Première merveille. */
  const wonder = result.players
    .filter((p) => (p.firstWonderTime ?? 0) > 0)
    .sort((a, b) => (a.firstWonderTime ?? 0) - (b.firstWonderTime ?? 0))[0];
  if (wonder) {
    const side = teamSideOf(teams, wonder) ?? winnerSide ?? 0;
    const winBefore = winAt(wonder.firstWonderTime! - 60_000);
    const winAfter = winAt(wonder.firstWonderTime! + 120_000);
    events.push({
      timeMs: wonder.firstWonderTime!,
      kind: "wonder",
      side,
      winBefore: side === 0 ? winBefore : 1 - winBefore,
      winAfter: side === 0 ? winAfter : 1 - winAfter,
      wonder: { builder: wonder.nickname },
    });
  }

  /* Sélection : les événements les plus marquants, affichés dans l'ordre. */
  const weight = (e: DecisiveEvent) => {
    if (e.kind === "wonder") return 1.5;
    if (e.kind === "elimination") return Math.abs(e.winAfter - e.winBefore) + 0.05;
    if (e.kind === "swing") return Math.abs(e.swing!.toPct - e.swing!.fromPct) / 100 + Math.abs(e.winAfter - e.winBefore);
    return Math.abs(e.winAfter - e.winBefore) + (e.workers?.lostPct ?? 0) / 100;
  };
  const deduped = dedupeEliminations(events);
  const kept = deduped
    .slice()
    .sort((a, b) => weight(b) - weight(a))
    .slice(0, 8)
    .sort((a, b) => a.timeMs - b.timeMs);
  return kept;
}

/** Fusionne les éliminations consécutives d'une même équipe (< 2 min) :
 *  la première est affichée, avec le décompte final de la poussée. */
function dedupeEliminations(events: DecisiveEvent[]): DecisiveEvent[] {
  const out: DecisiveEvent[] = [];
  for (const e of events.slice().sort((a, b) => a.timeMs - b.timeMs)) {
    const prev = out[out.length - 1];
    if (
      e.kind === "elimination" &&
      prev?.kind === "elimination" &&
      prev.side === e.side &&
      e.timeMs - prev.timeMs < 120_000 &&
      prev.elimination &&
      e.elimination
    ) {
      prev.elimination.downTo = e.elimination.downTo;
      prev.winAfter = e.winAfter;
      continue;
    }
    out.push(e);
  }
  return out;
}

function teamSideOf(teams: TeamImpact[], player: Player): Side | null {
  for (const t of teams) if (t.players.some((p) => p.player.id === player.id)) return t.side;
  return null;
}

const ema = (a: number[], periods: number) => {
  const alpha = 2 / (periods + 1);
  let e = a[0] ?? 0;
  return a.map((x) => (e += (x - e) * alpha));
};

interface Swing {
  fromIdx: number;
  toIdx: number;
  fromMs: number;
  toMs: number;
  from: number;
  to: number;
  /** Variation de part de power de l'équipe rouge. */
  delta: number;
}

/** Runs monotones (creux→crête et crête→creux) de la power lissée,
 *  entièrement antérieurs à untilMs. */
function findSwings(smoothed: number[], period: number, untilMs: number): Swing[] {
  const swings: Swing[] = [];
  const maxLen = (SWING_MAX_MINUTES * 60_000) / period;
  const lastIdx = Math.min(smoothed.length - 1, Math.floor(untilMs / period));
  for (let i = 0; i < lastIdx; i++) {
    for (const dir of [1, -1] as const) {
      let best = i;
      for (let j = i + 1; j < Math.min(lastIdx + 1, i + maxLen + 1); j++) {
        if ((smoothed[j] - smoothed[best]) * dir > 0) best = j;
        const delta = (smoothed[best] - smoothed[i]) * dir;
        if (delta >= SWING_MIN) {
          swings.push({
            fromIdx: i,
            toIdx: best,
            fromMs: i * period,
            toMs: best * period,
            from: smoothed[i],
            to: smoothed[best],
            delta: (smoothed[best] - smoothed[i]) * dir,
          });
        }
      }
    }
  }
  // Les plus fortes bascules, sans chevauchement.
  swings.sort((a, b) => b.delta - a.delta);
  const kept: Swing[] = [];
  for (const s of swings) {
    if (kept.some((k) => !(s.toIdx <= k.fromIdx || s.fromIdx >= k.toIdx))) continue;
    kept.push(s);
    if (kept.length >= 4) break;
  }
  return kept;
}

/** Plus grosse chute de travailleurs d'une équipe (baisse ≥ seuil, ≤ 3 min). */
function findWorkerCrash(
  workers: number[],
  period: number,
  untilMs: number,
): { fromIdx: number; toIdx: number; fromMs: number; toMs: number; drop: number } | null {
  const limit = Math.floor(untilMs / period);
  let best: { fromIdx: number; toIdx: number; fromMs: number; toMs: number; drop: number } | null = null;
  for (let i = 1; i < Math.min(workers.length, limit); i++) {
    for (let back = 2; back <= 6; back++) {
      const j = i - back;
      if (j < 1) continue;
      const base = workers[j];
      if (base <= 0) continue;
      const drop = (base - workers[i]) / base;
      if (drop >= WORKERS_MIN_DROP && (!best || drop > best.drop)) {
        best = { fromIdx: j, toIdx: i, fromMs: j * period, toMs: i * period, drop };
      }
    }
  }
  return best;
}

/** Top tueur (points de combat) d'une équipe sur une fenêtre de tranches. */
function topKillersInWindow(
  result: ReplayParseSuccess,
  teams: TeamImpact[],
  side: Side,
  fromIdx: number,
  toIdx: number,
): Array<{ name: string; value: number }> {
  const team = teams.find((t) => t.side === side);
  if (!team) return [];
  const out: Array<{ name: string; value: number }> = [];
  for (const pi of team.players) {
    const kills = playerSeries(result, "replayDatasetUnitKillPoints", pi.player) ?? [];
    let s = 0;
    for (let i = Math.max(0, fromIdx); i <= Math.min(kills.length - 1, toIdx); i++) s += kills[i];
    out.push({ name: pi.player.nickname, value: Math.round(s) });
  }
  return out.sort((a, b) => b.value - a.value).slice(0, 2).filter((k) => k.value > 0);
}
