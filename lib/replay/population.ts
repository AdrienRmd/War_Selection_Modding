/** Population par joueur — estimation documentée (mission du 06/11 :
 *  « Replays — données joueurs », livrable 1).
 *
 *  La série « population » réelle par tick (Σ unités vivantes × coût
 *  supply, comme ws-stats.pl) n'est PAS mesurée par l'API officielle des
 *  replays : extraData['2'] ne porte par faction et par tranche de 30 s que
 *  [points d'armée courants, points tués cumulés, territoire, travailleurs
 *  (travailleurs/bateaux/tracteurs en UNITÉS), ressources]. ws-stats.pl la
 *  calcule en parsant le FICHIER replay complet côté serveur — inaccessible
 *  depuis l'API publique.
 *
 *  Méthode (validée par l'orchestrateur, conditions 1-3) :
 *  - partie EXACTE à chaque tick : population économique = travailleurs×1 +
 *    bateaux de pêche×2 + tracteurs×3 (coûts supply médians du dataset
 *    public ; les variantes par âge diffèrent d'au plus 1) ;
 *  - partie ESTIMÉE : armée(t) = R_joueur × points d'armée courants(t), où
 *    R_joueur = Σ(créations d'unités d'armée × supply) / Σ points d'armée
 *    créés, calibré sur les créations RÉELLES du joueur (extraData['3']) et
 *    le total de points créés lu sur la timeline. La forme de la courbe est
 *  celle des données réelles du jeu ; seule l'échelle de la partie armée
 *  est un rapport constant (erreur bornée par l'évolution de la composition
 *  de l'armée) ;
 *  - élimination : les deux composantes retombent à 0 (données brutes) ;
 *  - joueur sans création d'armée → R = 0 (jamais de division par zéro).
 *
 *  Le libellé UI porte « estimation » (titre, légende, infobulle) et le
 *  panneau du graphe expose la note de méthode. */
import type { PlayerUnitStat } from "./structure";
import unitSupplyTable from "./unit-supply.json";

/** Nom du conteneur de série par joueur (cf. parser.ts → playerSeries). */
export const REPLAY_DATASET_POPULATION = "replayDatasetPopulation";

/** Cadrage Y par défaut (population maximale usuelle d'une partie longue),
 *  extensible si une série réelle dépasse (cf. population-chart.tsx). */
export const POPULATION_Y_MAX = 600;

/** Graduation de l'axe X : une marque toutes les 90 s (1:30). */
export const POPULATION_TICK_SECONDS = 90;

/** Coûts supply médians des unités économiques (comptées exactement par
 *  tick) — WarSelection/{âge}/worker = 1, fisher = 2 (2-3 selon l'âge),
 *  tractor = 3. */
export const ECO_SUPPLY = { worker: 1, boat: 2, tractor: 3 } as const;

const SUPPLY: Readonly<Record<string, number>> = unitSupplyTable.units;

/** Coût de population (supply.consume) d'une unité ; 0 si absent du dataset
 *  (bâtiments, décor, faune sans coût). */
export function unitSupplyConsume(gameId: string): number {
  return SUPPLY[gameId] ?? 0;
}

/** Population économique EXACTE d'un tick : travailleurs, bateaux de pêche
 *  et tracteurs sont comptés en unités par le jeu (workerInfo[1..3]). */
export function ecoPopulation(
  workers: number | undefined,
  boats: number | undefined,
  tractors: number | undefined,
): number {
  return (
    (workers ?? 0) * ECO_SUPPLY.worker +
    (boats ?? 0) * ECO_SUPPLY.boat +
    (tractors ?? 0) * ECO_SUPPLY.tractor
  );
}

/** Population d'armée totale créée par un joueur : Σ (créations × supply)
 *  sur les catégories NON-worker (les travailleurs/bateaux/tracteurs sont
 *  déjà comptés exactement à chaque tick ; les bâtiments ont supply 0). */
export function armyPopulationCreated(
  unitsCreated: Map<string, PlayerUnitStat[]> | undefined,
): number {
  let total = 0;
  for (const [category, stats] of unitsCreated ?? []) {
    if (category === "unitCategoryWorker") continue;
    for (const stat of stats) total += stat.number * unitSupplyConsume(stat.id);
  }
  return total;
}

/** Total de points d'armée créés sur la partie : la timeline porte les
 *  points d'armée COURANTS (t) et les points tués CUMULÉS (t) ; leur somme
 *  au dernier relevé non nul = tout ce qui a été créé (monotone — on prend
 *  le max par robustesse). */
export function armyPointsCreatedTotal(
  armyPoints: readonly number[],
  killedPoints: readonly number[],
): number {
  let total = 0;
  for (let i = 0; i < armyPoints.length; i++) {
    const sum = (armyPoints[i] ?? 0) + (killedPoints[i] ?? 0);
    if (sum > total) total = sum;
  }
  return total;
}

/** Calibration R = population d'armée créée / points d'armée créés.
 *  Garde-fou : aucun point mesuré → 0 (jamais de NaN ni de division par 0). */
export function armyPopulationRatio(
  armyPopCreated: number,
  armyPointsTotal: number,
): number {
  if (!Number.isFinite(armyPointsTotal) || armyPointsTotal <= 0) return 0;
  if (!Number.isFinite(armyPopCreated) || armyPopCreated <= 0) return 0;
  return armyPopCreated / armyPointsTotal;
}

/** Population estimée d'un tick : éco exacte + R × points d'armée courants. */
export function populationAtTick(
  eco: number,
  armyPoints: number,
  ratio: number,
): number {
  const army = armyPoints > 0 && ratio > 0 ? ratio * armyPoints : 0;
  const value = eco + army;
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

/** Cadrage Y : 600 par défaut, étendu au multiple de 100 supérieur si une
 *  série réelle dépasse (600 reste la référence du jeu). */
export function populationYMax(maxValue: number): number {
  if (!Number.isFinite(maxValue) || maxValue <= POPULATION_Y_MAX) return POPULATION_Y_MAX;
  return Math.ceil(maxValue / 100) * 100;
}

/** Horloge MM:SS (secondes → « 03:30 » ; heures repliées en H:MM:SS). */
export function formatMinutesSeconds(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
