/** Calculs de score (MVP, récolte, ressources) — port fidèle de
 *  scoreCalculator.js (IbubussI / wsunitstats-static). */
import { gatherEfficiencyLookupTable, EMPTY_NATION_ENTRY } from "./gather-table";
import { expDecay, calcArea } from "./math";

type Triple = readonly [number, number, number];

interface GatherSpeedEntry extends Array<number> {
  k?: Triple;
}

export interface GatherEntry {
  worker: GatherSpeedEntry;
  boat: GatherSpeedEntry;
  tractor: GatherSpeedEntry;
  whEff: number;
}

interface WorkersCount {
  worker: number;
  boat: number;
  tractor: number;
}

interface NormalizedNationEntry {
  worker: { value: Triple; upTime: number };
  boat: { value: Triple; upTime: number };
  tractor: { value: Triple; upTime: number };
  whEff: { value: number; upTime: number };
}

/** Vitesse de récolte théorique pour l'âge/nation et le temps écoulé depuis
 *  la transition (les améliorations mettent upTime secondes à s'activer). */
export function getGatherEntry(
  prevAgeNation: readonly [number, number],
  currAgeNation: readonly [number, number],
  timeSinceLastAgeUp: number,
  timeLinePeriod: number,
  time: number,
): GatherEntry {
  function getOrDefaultNationEntry(ageNation: readonly [number, number]): NormalizedNationEntry {
    const ageEntry = gatherEfficiencyLookupTable[String(ageNation[0])] ?? EMPTY_NATION_ENTRY;
    // La source écrit ageEntry[ageNation[1]] || ageEntry.default : une nation
    // absente sans default donnerait undefined → repli défensif sur zéros.
    const nationEntry = ageEntry?.[String(ageNation[1])] ?? ageEntry?.["default"] ?? EMPTY_NATION_ENTRY;
    return {
      worker: {
        value: nationEntry.worker?.value ?? ageEntry?.["default"]?.worker?.value ?? [0, 0, 0],
        upTime: nationEntry.worker?.upTime ?? ageEntry?.["default"]?.worker?.upTime ?? 0,
      },
      boat: {
        value: nationEntry.boat?.value ?? ageEntry?.["default"]?.boat?.value ?? [0, 0, 0],
        upTime: nationEntry.boat?.upTime ?? ageEntry?.["default"]?.boat?.upTime ?? 0,
      },
      tractor: {
        value: nationEntry.tractor?.value ?? ageEntry?.["default"]?.tractor?.value ?? [0, 0, 0],
        upTime: nationEntry.tractor?.upTime ?? ageEntry?.["default"]?.tractor?.upTime ?? 0,
      },
      whEff: {
        value: nationEntry.whEff?.value ?? 1,
        upTime: nationEntry.whEff?.upTime ?? ageEntry?.["default"]?.whEff?.upTime ?? 0,
      },
    };
  }

  const currNationEntry = getOrDefaultNationEntry(currAgeNation);
  const prevNationEntry = getOrDefaultNationEntry(prevAgeNation);
  const isInCurrentPeriod = time - timeSinceLastAgeUp <= timeLinePeriod;
  const currTimeK = (timeLinePeriod - timeSinceLastAgeUp) / timeLinePeriod;
  const prevTimeK = timeSinceLastAgeUp / timeLinePeriod;
  function getValueCountingTime(currUpTime: number, currVal: number, prevVal: number): number {
    // Amélioration passée (et passée dans la tranche courante ?) → mélange
    // proportionnel au temps, sinon valeur précédente.
    const isEnoughTimePassed = timeSinceLastAgeUp - currUpTime * 1000 >= 0;
    if (isEnoughTimePassed) {
      return isInCurrentPeriod ? currVal * currTimeK + prevVal * prevTimeK : currVal;
    }
    return prevVal;
  }

  const gatherEntry: GatherEntry = {
    worker: [
      getValueCountingTime(currNationEntry.worker.upTime, currNationEntry.worker.value[0], prevNationEntry.worker.value[0]),
      getValueCountingTime(currNationEntry.worker.upTime, currNationEntry.worker.value[1], prevNationEntry.worker.value[1]),
      getValueCountingTime(currNationEntry.worker.upTime, currNationEntry.worker.value[2], prevNationEntry.worker.value[2]),
    ],
    boat: [
      getValueCountingTime(currNationEntry.boat.upTime, currNationEntry.boat.value[0], prevNationEntry.boat.value[0]),
      getValueCountingTime(currNationEntry.boat.upTime, currNationEntry.boat.value[1], prevNationEntry.boat.value[1]),
      getValueCountingTime(currNationEntry.boat.upTime, currNationEntry.boat.value[2], prevNationEntry.boat.value[2]),
    ],
    tractor: [
      getValueCountingTime(currNationEntry.tractor.upTime, currNationEntry.tractor.value[0], prevNationEntry.tractor.value[0]),
      getValueCountingTime(currNationEntry.tractor.upTime, currNationEntry.tractor.value[1], prevNationEntry.tractor.value[1]),
      getValueCountingTime(currNationEntry.tractor.upTime, currNationEntry.tractor.value[2], prevNationEntry.tractor.value[2]),
    ],
    whEff: getValueCountingTime(currNationEntry.whEff.upTime, currNationEntry.whEff.value, prevNationEntry.whEff.value),
  };

  // Coefficients de « valeur » des ressources par type de récolteur.
  function calcK(speedEntry: readonly number[]): Triple {
    const values = [speedEntry[0], speedEntry[1], speedEntry[2]];
    const baseline = Math.max(...values);
    const foodK = baseline > 0 ? speedEntry[0] / baseline : 0;
    const woodK = baseline > 0 ? speedEntry[1] / baseline : 0;
    const ironK = baseline > 0 ? speedEntry[2] / baseline : 0;
    return [foodK, woodK, ironK];
  }
  gatherEntry.worker.k = calcK(gatherEntry.worker);
  gatherEntry.boat.k = calcK(gatherEntry.boat);
  gatherEntry.tractor.k = calcK(gatherEntry.tractor);

  return gatherEntry;
}

export interface GatherMetrics {
  /** Efficacité de récolte (0..3, somme des ratios par ressource). */
  gatherEfficiency: number;
  gatherEfficiencyScore: number;
  gatherValueScore: number;
}

/** Efficacité et valeur de récolte d'une tranche de timeline. */
export function calcGatherMetrics(
  gatherEntry: GatherEntry,
  prevWorkers: WorkersCount,
  currWorkers: WorkersCount,
  resDelta: readonly number[],
  timeLinePeriod: number,
): GatherMetrics {
  const avgWorkerNum = (prevWorkers.worker + currWorkers.worker) / 2;
  const avgBoatNum = (prevWorkers.boat + currWorkers.boat) / 2;
  const avgTractorNum = (prevWorkers.tractor + currWorkers.tractor) / 2;

  const actualYield = [
    resDelta[0] / timeLinePeriod,
    resDelta[1] / timeLinePeriod,
    resDelta[2] / timeLinePeriod,
  ];
  const maxEstimateYield = [
    (gatherEntry.worker[0] * avgWorkerNum + gatherEntry.boat[0] * avgBoatNum + gatherEntry.tractor[0] * avgTractorNum) * gatherEntry.whEff,
    (gatherEntry.worker[1] * avgWorkerNum + gatherEntry.boat[1] * avgBoatNum + gatherEntry.tractor[1] * avgTractorNum) * gatherEntry.whEff,
    (gatherEntry.worker[2] * avgWorkerNum + gatherEntry.boat[2] * avgBoatNum + gatherEntry.tractor[2] * avgTractorNum) * gatherEntry.whEff,
  ];
  const foodN = maxEstimateYield[0] > 0 ? actualYield[0] / maxEstimateYield[0] : 0;
  const woodN = maxEstimateYield[1] > 0 ? actualYield[1] / maxEstimateYield[1] : 0;
  const ironN = maxEstimateYield[2] > 0 ? actualYield[2] / maxEstimateYield[2] : 0;
  const gatherEff = foodN + woodN + ironN;

  const totalGatherers = avgWorkerNum + avgBoatNum * 2 + avgTractorNum * 3;

  // Points d'efficacité : plus de ressources avec moins de récolteurs.
  function calcEffScore(kEntry: Triple, refWhEfficiency: number): number {
    return totalGatherers > 0
      ? (resDelta[0] * kEntry[0] + resDelta[1] * kEntry[1] + resDelta[2] * kEntry[2]) /
        (totalGatherers * refWhEfficiency * 1000)
      : 0;
  }
  const gatherEffScore =
    calcEffScore(gatherEntry.worker.k!, gatherEntry.whEff) +
    calcEffScore(gatherEntry.boat.k!, gatherEntry.whEff) +
    calcEffScore(gatherEntry.tractor.k!, gatherEntry.whEff);

  // Points de valeur : volume récolté par seconde.
  function calcValScore(kEntry: Triple): number {
    return totalGatherers > 0
      ? (resDelta[0] * kEntry[0] + resDelta[1] * kEntry[1] + resDelta[2] * kEntry[2]) / timeLinePeriod
      : 0;
  }
  const gatherValScore =
    calcValScore(gatherEntry.worker.k!) +
    calcValScore(gatherEntry.boat.k!) +
    calcValScore(gatherEntry.tractor.k!);

  return {
    gatherEfficiency: gatherEff,
    gatherEfficiencyScore: gatherEffScore,
    gatherValueScore: gatherValScore,
  };
}

export interface ResourceMetrics {
  resNow: number[];
  resSpent: number[];
  resDelta: number[];
  resCollected: number[];
}

/** Métriques de ressources d'une tranche (valeur en milliers → unités jeu). */
export function calcResourceMetrics(
  resNow: readonly number[],
  resWas: readonly number[],
  resDelta: readonly number[],
  resCollected: readonly number[],
): ResourceMetrics {
  const resExpected = [
    resWas[0] + resDelta[0],
    resWas[1] + resDelta[1],
    resWas[2] + resDelta[2],
  ];
  const resSpent = [
    resExpected[0] - resNow[0],
    resExpected[1] - resNow[1],
    resExpected[2] - resNow[2],
  ];
  return {
    resNow: resNow.map((r) => r / 1000),
    resSpent: resSpent.map((r) => r / 1000),
    resDelta: resDelta.map((r) => r / 1000),
    resCollected: resCollected.map((r) => r / 1000),
  };
}

export const MVP_CONST = {
  playerKillK: 400,
  combatK: 1.2,
  unitKillK: 0.8,
  territoryK: 0.000025,
  resourcesSpentK: 0.25,
  firstWonderPoints: 600,
  firstWonderPointsDecayRate: 1 / 2000000,
  winWonderPoints: 250,
  wonderPoints: 150,
  wonderRefTime: 1590000, // ms
  winTeamK: 1.07,
  looseTeamK: 1,
  armySizeK: 0.2,
  researchPointsK: 1,
  indirectGrowRate: 1 / 750000,
  armyScoreTimeFrames: 5,
  killScoreMinTime: 240000, // ms
};

interface PlayerKillEntry {
  victimMvpScore: number;
  playerInstantMvpScore: number;
  playerArmyScore: readonly number[];
  teamInstantMvpScore: Map<number, number>;
  teamArmyScore: Map<number, readonly number[]>;
  deathTime: number;
}

export interface MvpOptions {
  playerKillsData?: PlayerKillEntry[];
  /** Points de combat cumulés (timeline) — aire sous la courbe. */
  unitCombatPointsArray?: readonly number[];
  /** Points d'unités tuées (résultat final : points × nombre). */
  unitKillPointsArray?: Iterable<{ points?: number; number: number }>;
  territorySum: number;
  resourcesSpentAvg: number;
  armySizeAvg: number;
  researchPoints: number;
  isWonder?: boolean;
  isFirstWonder?: boolean;
  firstWonderTime?: number;
  isWinWonder?: boolean;
  isWinTeam?: boolean;
  survivalTime: number;
  matchTime?: number;
}

/** Score MVP d'un joueur (voir MVP_CONST pour la pondération). */
export function calcMVPScore(options: MvpOptions): number {
  const {
    playerKillsData,
    unitCombatPointsArray,
    unitKillPointsArray,
    territorySum,
    resourcesSpentAvg,
    armySizeAvg,
    researchPoints,
    isWonder = false,
    isFirstWonder = false,
    firstWonderTime = 0,
    isWinWonder = false,
    isWinTeam = false,
    survivalTime,
    matchTime = 1,
  } = options;

  const wonderK = isWonder ? 1 : 0;
  const firstWonderK = isFirstWonder ? 1 : 0;
  const winWonderK = isWinWonder ? 1 : 0;
  const winTeamWonderK = isWinTeam ? 1 : 0;

  const firstWonderTimeValue = expDecay(
    firstWonderK * MVP_CONST.firstWonderPoints,
    MVP_CONST.firstWonderPointsDecayRate,
    firstWonderTime - MVP_CONST.wonderRefTime,
  );
  const wdp =
    wonderK * MVP_CONST.wonderPoints +
    winTeamWonderK * (firstWonderTimeValue + winWonderK * MVP_CONST.winWonderPoints);
  // Les points de combat sont cumulatifs : les tués précoces comptent plus
  // (moyenne via l'aire sous la courbe).
  const ucp = Math.sqrt(calcArea(unitCombatPointsArray ?? [])) * MVP_CONST.combatK;
  const ukp = unitKillPointsArray ? calcUnitKillPoints(unitKillPointsArray) * MVP_CONST.unitKillK : 0;
  const playerKillK = ucp / 2;
  const pkp = playerKillsData ? calcPlayerKillValue(playerKillsData) * playerKillK : 0;
  const ter =
    territorySum *
    MVP_CONST.territoryK *
    (1 - expDecay(1, MVP_CONST.indirectGrowRate, survivalTime));
  const res =
    resourcesSpentAvg *
    MVP_CONST.resourcesSpentK *
    (1 - expDecay(1, MVP_CONST.indirectGrowRate, survivalTime)) ** 5;
  const arm = armySizeAvg * MVP_CONST.armySizeK;
  const tec = researchPoints * MVP_CONST.researchPointsK;

  const directPoints = pkp + ucp + ukp;
  const indirectPoints = ter + res;
  const bonusPoints = wdp + arm + tec;
  const winTeamK = isWinTeam ? MVP_CONST.winTeamK : MVP_CONST.looseTeamK;
  return (winTeamK * (directPoints + indirectPoints + bonusPoints) * 1000) / matchTime;
}

/** Impact d'une élimination (méthode indirecte). */
function calcPlayerKillValue(playerKillsData: readonly PlayerKillEntry[]): number {
  let playerValue = 0;
  playerKillsData.forEach((killEntry, killIndex) => {
    if (killEntry.deathTime <= MVP_CONST.killScoreMinTime) {
      // Ne pas compter les départs en début de match.
      return;
    }
    const playerArmyScore = findLatestArmyScore(killEntry.playerArmyScore);
    const teamArmyScore = Array.from(killEntry.teamArmyScore.values()).reduce(
      (acc, score) => acc + findLatestArmyScore(score),
      0,
    );
    const teamMvpScore = Array.from(killEntry.teamInstantMvpScore.values()).reduce(
      (acc, score) => acc + score,
      0,
    );
    const teamAvgMvpScore =
      killEntry.teamInstantMvpScore.size > 0 ? teamMvpScore / killEntry.teamInstantMvpScore.size : 1;

    // Plus l'élimination est tardive, moins elle rapporte.
    const killValue = killEntry.victimMvpScore / (teamAvgMvpScore * Math.sqrt(killIndex + 1));
    const playerArmyValue = teamArmyScore > 0 ? playerArmyScore / teamArmyScore : 0;
    const playerMvpValue = teamMvpScore > 0 ? 0.8 * (killEntry.playerInstantMvpScore / teamMvpScore) : 0;
    playerValue += (playerArmyValue + playerMvpValue) * 0.5 * killValue;
  });
  return playerValue;
}

function findLatestArmyScore(armyScore: readonly number[]): number {
  return armyScore
    .slice(-MVP_CONST.armyScoreTimeFrames)
    .reduce((acc, score) => acc + score, 0);
}

function calcUnitKillPoints(unitKillPointsArray: Iterable<{ points?: number; number: number }>): number {
  let acc = 0;
  for (const entry of unitKillPointsArray) {
    acc += (entry.points ?? 0) * entry.number;
  }
  return acc;
}
