/** Inférence des transferts de ressources entre joueurs d'une même équipe
 *  (v2, 02/11/2026 — réétalonnage + garde-fous, référence ws-stats.pl sur le
 *  replay Q5azZc3Uv61), reproduction documentée de la section « Sent by » de
 *  ws-stats, ADAPTÉE à nos buckets d'âges réels (Stone/Bronze/Iron/IR1/IR2 —
 *  le médiéval, indistinguable dans nos données publiques, est fusionné dans
 *  la colonne Iron).
 *
 *  ⚠️ LES REPLAYS NE CONTIENNENT PAS D'ÉVÉNEMENTS DE TRANSFERT DIRECTS (les
 *  conteneurs extraData 0-4/6-7 n'ont jamais de clé 5 — vérifié sur 5 replays
 *  réels) : la donnée brute est un dump de timeline par tranche de 30 s
 *  (stock courant, revenu moteur, cumul récolté). Les dons sont donc INFÉRÉS :
 *
 *  1. Réception (signal exact, côté receveur) — par tranche de 30 s le
 *     parser calcule resSpent = (stock précédent + revenu moteur) − stock
 *     courant. On le RECONSTRUIT exactement depuis les conteneurs publics
 *     ResourcesCollected et ResourcesNow : resSpent_p = ΔcumulRécolté_p −
 *     Δstock_p (vérifié sur fixtures : 0 écart sur 5 712 points). Un joueur
 *     qui reçoit un don X voit son stock monter de X SANS revenu
 *     correspondant : resSpent devient NÉGATIF de X. Le gain inexpliqué vaut
 *     exactement −resSpent. La 1re tranche (j=0, stock initial) est ignorée :
 *     sa baseline [0,0,0] fabrique des faux gains (stock de départ).
 *
 *  ÉCHELLE (v2, preuve — cf. tests) : le replay brut stocke les ressources
 *  en MILLIÈMES (faction HkvVncU3mq9, tranche 1 : Δnourriture brut 100 000 →
 *  100 nourriture ; le catalogue d'unités affiche raw 50 000 / scale 1000 →
 *  50). calcResourceMetrics divise déjà par 1000 : les conteneurs tiennent
 *  des UNITÉS DE JEU. La v1 affichait ces valeurs comme des « k-unités »
 *  puis les remultipliait ×1000 côté UI → totaux gonflés d'un facteur 1000
 *  (« 18,8 M » pour 18 875 ressources réelles). Référence ws-stats (replay
 *  Q5azZc3Uv61) : « Collected food: 36 379 » — mêmes unités de jeu.
 *
 *  2. Attribution du donneur (v2 : SAUT de dépense, pas dépense brute) —
 *  la v1 retenait le coéquipier le plus dépensier de la tranche (≥ 50 % du
 *  gain) : les gros producteurs, qui dépensent massivement en continu,
 *  captaient tous les dons (faux positifs d'attribution — sur la référence
 *  ws-stats, DISTURBED crédité de 11,4 k unités par nos calculs, absent des
 *  donneurs ws-stats). La v2 exige que la dépense du donneur SAUTE au-dessus
 *  de sa baseline locale (médiane des fenêtres ±3, fenêtre courante
 *  exclue) : donner X, c'est dépenser sa production courante PLUS X.
 *  Transaction retenue si :
 *    - couverture physique : dépense du donneur ≥ ATTRIBUTION_COVER × gain
 *      (on ne peut pas donner plus qu'on ne dépense) ;
 *    - saut : dépense − baseline ≥ ATTRIBUTION_JUMP × gain ;
 *    - garde-fou structurel (v2) : gain ≤ (stock max du donneur sur la
 *      fenêtre + revenu du donneur sur la fenêtre) — un « don » plus gros
 *      que ce que le donneur possède physiquement est un artefact : il est
 *      REJETÉ et compté (rejectedByGuard) pour l'observabilité interne.
 *
 *  3. Certitude — « Very likely » si le saut couvre ~ tout le don
 *  (≥ VERY_LIKELY_COVER × gain) ET domine nettement (≥ VERY_LIKELY_DOMINANCE
 *  × le 2e saut de coéquipier) ; sinon « Likely ».
 *
 *  4. Âge de la transaction = âge du DONNEUR à cet instant (timeline de ses
 *  recherches via getAgeNation) ; âges 0..6 mappés sur nos 5 buckets
 *  (0→Stone, 1→Bronze, 2/3→Iron [médiéval fusionné], 4/5→IR1, 6→IR2).
 *
 *  5. Générosité (badge) — sur le TOTAL envoyé attribué au joueur, en
 *  unités de jeu : ≥ 10 000 « Very generous », ≥ 1 000 « Fair », sinon
 *  « Small ». Calibré sur la référence ws-stats (meilleur donneur du replay
 *  8v8 de référence : 5 359) et nos fixtures 8v8/7v7/6v6 (totaux 55 k à
 *  160 k unités après réétalonnage, cf. tests).
 *
 *  Limites documentées (v2) :
 *  - une même tranche de 30 s agrège plusieurs dons successifs en une
 *    transaction (l'heure affichée est le milieu de la tranche) ;
 *  - le montant affiché est le gain mesuré côté RECEVEUR (quantifié), la
 *    part du donneur n'étant pas séparable de ses dépenses réelles ;
 *  - l'héritage éventuel des ressources d'un joueur éliminé vers ses
 *    alliés (si le moteur le fait) apparaît comme un don ;
 *  - un don noyé dans une fenêtre où le donneur dépense déjà massivement
 *    peut manquer (baseline élevée) — à l'inverse la v1 créditait ces
 *    fenêtres à tort.
 *  Entrée : ReplayParseSuccess (aucune donnée externe, aucun I/O). */
import getAgeNation from "./age-nation";
import { playerMultiRow } from "./analysis";
import type { ReplayParseSuccess } from "./structure";

/** Seuil de détection : gain inexpliqué ≥ 150 ressources par tranche de 30 s.
 *  Aligné sur la plus petite transaction affichée par ws-stats sur le replay
 *  de référence Q5azZc3Uv61 (150) ; les micro-remboursements d'annulation de
 *  construction restent sous ce seuil (observé < 1 unité sur les fixtures). */
export const MIN_TRANSFER = 150;

/** Attribution : la dépense du donneur pressenti doit couvrir au moins 90 %
 *  du gain mesuré côté receveur (contrainte physique : on ne donne pas plus
 *  qu'on ne dépense sur la fenêtre). */
export const ATTRIBUTION_COVER = 0.9;

/** Attribution : le SAUT de dépense au-dessus de la baseline locale doit
 *  couvrir au moins 80 % du gain (donner X = dépenser sa production + X). */
export const ATTRIBUTION_JUMP = 0.8;

/** Baseline locale : médiane des dépenses des fenêtres ±BASELINE_WINDOWS
 *  autour de la fenêtre courante (courante exclue). */
export const BASELINE_WINDOWS = 3;

/** Garde-fou structurel : marge d'arrondi tolérée (ressources) sur le
 *  plafond « stock + revenu » du donneur. */
export const GUARD_EPSILON = 0.5;

/** Certitude « Very likely » : le saut du donneur couvre ≥ 90 % du gain. */
export const VERY_LIKELY_COVER = 0.9;

/** Certitude « Very likely » : saut ≥ 2 × celui du 2e coéquipier. */
export const VERY_LIKELY_DOMINANCE = 2;

/** Badge « Very generous » : total envoyé ≥ 10 000 ressources. */
export const GENEROUS_THRESHOLD = 10000;

/** Badge « Fair » : total envoyé ≥ 1 000 ressources. */
export const FAIR_THRESHOLD = 1000;

/** Colonnes du tableau « Sent by » — NOS buckets d'âges réels (5 dossiers
 *  d'unités du jeu) ; « iron » inclut le médiéval (dossier 3 unique). */
export const TRANSFER_AGE_BUCKETS = ["stone", "bronze", "iron", "ir1", "ir2"] as const;

export type TransferAgeBucket = (typeof TRANSFER_AGE_BUCKETS)[number];

/** getAgeNation → bucket de colonne (0→stone, 1→bronze, 2/3→iron, 4/5→ir1, 6→ir2). */
export function transferAgeBucket(age: number): TransferAgeBucket {
  if (age <= 0) return "stone";
  if (age === 1) return "bronze";
  if (age <= 3) return "iron";
  if (age <= 5) return "ir1";
  return "ir2";
}

export type TransferCertainty = "veryLikely" | "likely";

export type Generosity = "veryGenerous" | "fair" | "small";

export interface TransferEvent {
  /** Milieu de la tranche 30 s porteuse (ms depuis le début du match). */
  timeMs: number;
  /** 0 = nourriture, 1 = bois, 2 = fer. */
  resourceIndex: number;
  /** Montant en RESSOURCES DU JEU (unités réelles, pas de ×1000) — mesuré
   *  côté receveur. */
  amount: number;
  fromPlayerId: number;
  toPlayerId: number;
  certainty: TransferCertainty;
  /** Dépense brute du donneur sur la tranche (preuve, ressources). */
  donorSpend: number;
  /** Saut de dépense du donneur au-dessus de sa baseline locale (ressources). */
  donorJump: number;
}

export interface SentByRow {
  playerId: number;
  /** Total envoyé par bucket d'âge du donneur (ressources). */
  byAge: Record<TransferAgeBucket, number>;
  /** Somme des byAge (ressources). */
  total: number;
  generosity: Generosity;
}

export interface TransfersAnalysis {
  /** Transactions attribuées, triées par heure croissante. */
  events: TransferEvent[];
  /** Lignes « Sent by », triées par total décroissant. */
  sentBy: SentByRow[];
  /** Transactions rejetées par le garde-fou structurel (don > capacité
   *  physique du donneur) — compteur d'observabilité interne, non affiché. */
  rejectedByGuard: number;
}

export function generosityOf(total: number): Generosity {
  if (total >= GENEROUS_THRESHOLD) return "veryGenerous";
  if (total >= FAIR_THRESHOLD) return "fair";
  return "small";
}

/** Médiane d'une série (fenêtre de baseline locale). */
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

interface PlayerSeries {
  /** resSpent par fenêtre (ressources) : ΔcumulRécolté − Δstock. */
  spent: number[][];
  /** Cumul récolté par ressource (ressources), index brut 0..len. */
  collected: number[][];
  /** Stock courant par ressource (ressources), index brut 0..len. */
  now: number[][];
}

/** Analyse les transferts d'un replay. Renvoie null si aucun contexte
 *  d'équipe (FFA/1v1 : aucune transaction possible) ou aucune transaction
 *  détectée — les sections UI sont alors omises proprement. */
export function analyzeTransfers(result: ReplayParseSuccess): TransfersAnalysis | null {
  const teamsOfPlayers = new Map<number, number[]>();
  for (const team of result.teams) {
    if (team.players.length >= 2) teamsOfPlayers.set(team.id, team.players);
  }
  if (teamsOfPlayers.size === 0) return null;

  const period = result.timeLinePeriod;
  // Séries par joueur (ressources) — multi-lignes TRANSPOSÉES :
  // rows[ressource][période] (3 ressources × périodes, cf. dataset.ts).
  // Reconstruction exacte : resSpent_j = ΔcumulRécolté_j − Δstock_j.
  // rows[j] (0-based, période brute 0 ignorée) ↔ période brute j+1.
  const series = new Map<number, PlayerSeries>();
  for (const player of result.players) {
    const collected = playerMultiRow(result, "replayDatasetResourcesCollected", player);
    const now = playerMultiRow(result, "replayDatasetResourcesNow", player);
    if (!collected || !now || collected.length !== 3 || now.length !== 3) continue;
    const len = Math.min(collected[0].length, now[0].length);
    if (len < 2) continue;
    const spent: number[][] = [];
    for (let j = 1; j < len; j++) {
      spent.push([0, 1, 2].map((k) => collected[k][j] - collected[k][j - 1] - (now[k][j] - now[k][j - 1])));
    }
    series.set(player.id, {
      spent,
      collected: [0, 1, 2].map((k) => collected[k].slice(0, len)),
      now: [0, 1, 2].map((k) => now[k].slice(0, len)),
    });
  }

  // Timeline de recherches par joueur (pour l'âge du donneur).
  const researchLines = new Map<number, Array<[number, number]>>();
  for (const player of result.players) {
    if (!player.researches || player.researches.length === 0) continue;
    researchLines.set(
      player.id,
      player.researches.map((r) => [r.takenTime, r.id] as [number, number]),
    );
  }

  /** Baseline de dépense d'un joueur pour (fenêtre, ressource). */
  const spendBaseline = (s: PlayerSeries, j: number, k: number): number => {
    const ctx: number[] = [];
    for (let i = Math.max(0, j - BASELINE_WINDOWS); i <= Math.min(s.spent.length - 1, j + BASELINE_WINDOWS); i++) {
      if (i !== j) ctx.push(s.spent[i][k]);
    }
    return ctx.length > 0 ? median(ctx) : 0;
  };

  const events: TransferEvent[] = [];
  let rejectedByGuard = 0;
  for (const players of teamsOfPlayers.values()) {
    for (const receiverId of players) {
      const receiver = series.get(receiverId);
      if (!receiver) continue;
      for (let j = 0; j < receiver.spent.length; j++) {
        // rows[j] ↔ période brute j+1 → fin de tranche (j+2)·T.
        const timeMs = (j + 2) * period;
        for (let k = 0; k < 3; k++) {
          const gain = -receiver.spent[j][k];
          if (!(gain >= MIN_TRANSFER)) continue;
          // Donneurs pressentis : coéquipiers vivants (série assez longue)
          // dont le SAUT de dépense sur la tranche couvre le gain.
          let best = -1;
          let bestJump = 0;
          let bestSpend = 0;
          let secondJump = 0;
          for (const mateId of players) {
            if (mateId === receiverId) continue;
            const mate = series.get(mateId);
            if (!mate || mate.spent.length <= j) continue;
            const spend = mate.spent[j][k];
            const jump = spend - spendBaseline(mate, j, k);
            if (jump > bestJump) {
              secondJump = bestJump;
              bestJump = jump;
              bestSpend = spend;
              best = mateId;
            } else if (jump > secondJump) {
              secondJump = jump;
            }
          }
          if (best < 0) continue;
          // Couverture physique : la dépense du donneur porte le don.
          if (bestSpend < ATTRIBUTION_COVER * gain) continue;
          // Saut de dépense : le don est DANS le saut, pas dans la routine.
          if (bestJump < ATTRIBUTION_JUMP * gain) continue;
          // GARDE-FOU STRUCTUREL : un don ne peut pas excéder ce que le
          // donneur possède physiquement sur la fenêtre — stock en début de
          // fenêtre + revenu récolté pendant la fenêtre (le stock ne peut pas
          // passer sous zéro : S_fin = S_début + revenu − dépenses − don ≥ 0).
          // rows[j] ↔ période brute j+1 : début = index j, fin = index j+1.
          const donor = series.get(best)!;
          const stockStart = donor.now[k][j] ?? 0;
          const income = (donor.collected[k][j + 1] ?? donor.collected[k][j]) - (donor.collected[k][j] ?? 0);
          if (gain > stockStart + income + GUARD_EPSILON) {
            rejectedByGuard++;
            continue;
          }
          const certainty: TransferCertainty =
            bestJump >= VERY_LIKELY_COVER * gain && bestJump >= VERY_LIKELY_DOMINANCE * secondJump
              ? "veryLikely"
              : "likely";
          events.push({
            timeMs,
            resourceIndex: k,
            amount: gain,
            fromPlayerId: best,
            toPlayerId: receiverId,
            certainty,
            donorSpend: bestSpend,
            donorJump: bestJump,
          });
        }
      }
    }
  }

  if (events.length === 0) return null;
  events.sort((a, b) => a.timeMs - b.timeMs || a.fromPlayerId - b.fromPlayerId);

  // Agrégation « Sent by » : total par donneur et par âge du donneur.
  const rows = new Map<number, SentByRow>();
  for (const event of events) {
    let row = rows.get(event.fromPlayerId);
    if (!row) {
      row = {
        playerId: event.fromPlayerId,
        byAge: { stone: 0, bronze: 0, iron: 0, ir1: 0, ir2: 0 },
        total: 0,
        generosity: "small",
      };
      rows.set(event.fromPlayerId, row);
    }
    const researchLine = researchLines.get(event.fromPlayerId) ?? [];
    const bucket = transferAgeBucket(getAgeNation(event.timeMs, researchLine)[0]);
    row.byAge[bucket] += event.amount;
    row.total += event.amount;
  }
  const sentBy = [...rows.values()].map((row) => ({
    ...row,
    generosity: generosityOf(row.total),
  }));
  sentBy.sort((a, b) => b.total - a.total);

  return { events, sentBy, rejectedByGuard };
}
