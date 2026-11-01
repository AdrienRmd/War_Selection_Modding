/** Inférence des transferts de ressources entre joueurs d'une même équipe
 *  (v1, 01/11/2026) — reproduction documentée des sections « Sent by » et
 *  « Transactions » de ws-stats.pl, ADAPTÉE à nos buckets d'âges réels
 *  (Stone/Bronze/Iron/IR1/IR2 — le médiéval, indistinguable dans nos
 *  données publiques, est fusionné dans la colonne Iron).
 *
 *  ⚠️ LES REPLAYS NE CONTIENNENT PAS D'ÉVÉNEMENTS DE TRANSFERT DIRECTS : la
 *  donnée brute est un dump de timeline par tranche de 30 s (stock courant,
 *  revenu moteur, cumul récolté). Les dons sont donc INFÉRÉS :
 *
 *  1. Réception (signal exact, côté receveur) — par tranche de 30 s le
 *     parser calcule resSpent = (stock précédent + revenu moteur) − stock
 *     courant (cf. calcResourceMetrics, valeurs en k-unités ÷1000). Le
 *     conteneur ResourcesSpent n'est pas exporté dans les charts : on le
 *     RECONSTRUIT EXACTEMENT depuis les conteneurs publics ResourcesCollected
 *     et ResourcesNow — vérifié sur fixtures : revenu moteur ≡ différence du
 *     cumul récolté (0 écart sur 5 712 points), donc resSpent_p =
 *     ΔcumulRécolté_p − Δstock_p. Un joueur qui reçoit un don X voit son
 *     stock monter de X SANS revenu correspondant : resSpent devient
 *     NÉGATIF de X. Le gain inexpliqué vaut exactement −resSpent (filtré au
 *     seuil MIN_TRANSFER — les remboursements d'annulation de construction
 *     restent en dessous). La 1re tranche (j=0, stock initial) est ignorée :
 *     sa baseline [0,0,0] fabrique des faux gains (stock de départ).
 *  2. Attribution du donneur (heuristique) — le donneur, lui, mélange le don
 *     dans ses dépenses (resSpent gonflé de X) ; on ne peut pas isoler X
 *     côté donneur. Parmi les coéquipiers vivants dont resSpent > 0 sur la
 *     MÊME tranche et la MÊME ressource, le donneur retenu est le plus gros
 *     dépensier (S max). Transaction retenue si S ≥ ATTRIBUTION_MIN × gain.
 *  3. Certitude — « Very likely » si la dépense du donneur couvre ~ tout le
 *     don (S ≥ 0,9 × gain) ET domine nettement (S ≥ 2 × second meilleur
 *     coéquipier) ; sinon « Likely ».
 *  4. Âge de la transaction = âge du DONNEUR à cet instant (timeline de ses
 *     recherches via getAgeNation) ; âges 0..6 mappés sur nos 5 buckets
 *     (0→Stone, 1→Bronze, 2/3→Iron [médiéval fusionné], 4/5→IR1, 6→IR2).
 *  5. Générosité (badge) — sur le TOTAL envoyé attribué au joueur :
 *     ≥ 5 000 k (5 M de ressources) « Very generous », ≥ 500 k « Fair »,
 *     sinon « Small ». Seuils calibrés sur les fixtures wsva du 31/10
 *     (8v8/7v7/6v6 : totaux 46 k..72 M, cf. tests).
 *
 *  Limites documentées (v1) :
 *  - une même tranche de 30 s agrège plusieurs dons successifs en une
 *    transaction (l'heure affichée est le milieu de la tranche) ;
 *  - le montant affiché est le gain mesuré côté RECEVEUR (quantifié), la
 *    part du donneur n'étant pas séparable de ses dépenses réelles ;
 *  - un don très petit noyé dans les dépenses courantes du donneur peut
 *    manquer (seuil d'attribution) ;
 *  - l'héritage éventuel des ressources d'un joueur éliminé vers ses
 *    alliés (si le moteur le fait) apparaît comme un don — comportement
 *    cohérent avec l'affichage ws-stats.
 *  Entrée : ReplayParseSuccess (aucune donnée externe, aucun I/O). */
import getAgeNation from "./age-nation";
import { playerMultiRow } from "./analysis";
import type { ReplayParseSuccess } from "./structure";

/** Seuil de détection : gain inexpliqué ≥ 2 k (2 000 ressources) par tranche
 *  de 30 s. Les micro-remboursements d'annulation restent sous ce seuil
 *  (observé < 0,3 k sur les fixtures). */
export const MIN_TRANSFER = 2;

/** Attribution : la dépense du donneur pressenti doit couvrir au moins 50 %
 *  du gain mesuré côté receveur. */
export const ATTRIBUTION_MIN = 0.5;

/** Certitude « Very likely » : dépense du donneur ≥ 90 % du gain. */
export const VERY_LIKELY_COVER = 0.9;

/** Certitude « Very likely » : dépense ≥ 2 × celle du 2e coéquipier. */
export const VERY_LIKELY_DOMINANCE = 2;

/** Badge « Very generous » : total envoyé ≥ 5 000 k (5 M de ressources). */
export const GENEROUS_THRESHOLD = 5000;

/** Badge « Fair » : total envoyé ≥ 500 k. */
export const FAIR_THRESHOLD = 500;

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
  /** Montant en k-unités (×1000 ressources) — mesuré côté receveur. */
  amount: number;
  fromPlayerId: number;
  toPlayerId: number;
  certainty: TransferCertainty;
  /** Dépense du donneur sur la tranche (preuve, k-unités). */
  donorSpend: number;
}

export interface SentByRow {
  playerId: number;
  /** Total envoyé par bucket d'âge du donneur (k-unités). */
  byAge: Record<TransferAgeBucket, number>;
  /** Somme des byAge (k-unités). */
  total: number;
  generosity: Generosity;
}

export interface TransfersAnalysis {
  /** Transactions attribuées, triées par heure croissante. */
  events: TransferEvent[];
  /** Lignes « Sent by », triées par total décroissant. */
  sentBy: SentByRow[];
}

export function generosityOf(total: number): Generosity {
  if (total >= GENEROUS_THRESHOLD) return "veryGenerous";
  if (total >= FAIR_THRESHOLD) return "fair";
  return "small";
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
  // Séries resSpent par joueur (k-unités) — multi-lignes TRANSPOSÉES :
  // rows[ressource][période] (3 ressources × périodes, cf. dataset.ts).
  // Reconstruction exacte : resSpent_j = ΔcumulRécolté_j − Δstock_j.
  // rows[j] (0-based, période brute 0 ignorée) ↔ période brute j+1.
  const spentSeries = new Map<number, number[][]>();
  for (const player of result.players) {
    const collected = playerMultiRow(result, "replayDatasetResourcesCollected", player);
    const now = playerMultiRow(result, "replayDatasetResourcesNow", player);
    if (!collected || !now || collected.length !== 3 || now.length !== 3) continue;
    const len = Math.min(collected[0].length, now[0].length);
    if (len < 2) continue;
    const rows: number[][] = [];
    for (let j = 1; j < len; j++) {
      rows.push([0, 1, 2].map((k) => collected[k][j] - collected[k][j - 1] - (now[k][j] - now[k][j - 1])));
    }
    if (rows.length > 0) spentSeries.set(player.id, rows);
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

  const events: TransferEvent[] = [];
  for (const players of teamsOfPlayers.values()) {
    for (const receiverId of players) {
      const receiverRows = spentSeries.get(receiverId);
      if (!receiverRows) continue;
      for (let j = 0; j < receiverRows.length; j++) {
        // rows[j] ↔ période brute j+1 → fin de tranche (j+2)·T.
        const timeMs = (j + 2) * period;
        for (let k = 0; k < 3; k++) {
          const gain = -receiverRows[j][k];
          if (!(gain >= MIN_TRANSFER)) continue;
          // Donneurs pressentis : coéquipiers vivants (série assez longue)
          // dépensant cette ressource sur la même tranche.
          let best = -1;
          let bestSpend = 0;
          let secondSpend = 0;
          for (const mateId of players) {
            if (mateId === receiverId) continue;
            const mateRows = spentSeries.get(mateId);
            if (!mateRows || mateRows.length <= j) continue;
            const spend = mateRows[j][k];
            if (spend > bestSpend) {
              secondSpend = bestSpend;
              bestSpend = spend;
              best = mateId;
            } else if (spend > secondSpend) {
              secondSpend = spend;
            }
          }
          if (best < 0 || bestSpend < ATTRIBUTION_MIN * gain) continue;
          const certainty: TransferCertainty =
            bestSpend >= VERY_LIKELY_COVER * gain && bestSpend >= VERY_LIKELY_DOMINANCE * secondSpend
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

  return { events, sentBy };
}
