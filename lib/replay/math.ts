/** Utilitaires mathématiques du calculateur de score — port fidèle de
 *  com.wsunitstats.ui/src/pages/ReplaysPage/ReplayInfo/mathUtils.ts
 *  (source : IbubussI / wsunitstats-static, domaine public revendiqué
 *  sans licence — voir THIRD_PARTY_NOTICES.md). */

/** Décroissance exponentielle : Q·e^(-rate·time). */
export function expDecay(Q: number, rate: number, time: number): number {
  return Q * Math.exp(-rate * time);
}

/** Aire sous la courbe d'un jeu de points (trapèzes), stepSize facultatif. */
export function calcArea(dataset: readonly number[], stepSize = 1): number {
  let area = 0;
  for (let i = 1; i < dataset.length; i++) {
    area += 0.5 * stepSize * (dataset[i] + dataset[i - 1]);
  }
  return area;
}

/** Moyenne des points d'un jeu de données (0 si vide). */
export function calcAvg(dataset: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < dataset.length; i++) {
    sum += dataset[i];
  }
  return dataset.length > 0 ? sum / dataset.length : 0;
}
