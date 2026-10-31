/** Âge et nation d'un joueur à un instant donné, déduits de sa timeline de
 *  recherches — port fidèle de ageNationFinder.ts (logique extraite du mod
 *  de jeu 6gqH17D5rDl_3-66b5429af54002fc.lua par wsunitstats).
 *  Sortie : [âge, nation] — 0 = âge de pierre abstrait avant première
 *  transition. */

/** [temps, idRecherche] — entrées de timeline d'un joueur. */
export type ResearchTimeLine = ReadonlyArray<readonly [number, number]>;

interface ResearchesState {
  time: number;
  researchTimeLine: ResearchTimeLine;
}

function isResearchComplete(state: ResearchesState, research: number): boolean {
  return (
    state.researchTimeLine.filter(
      (entry) => entry[0] <= state.time && entry[1] === research,
    ).length > 0
  );
}

function getAgeFactionIndustrial(
  state: ResearchesState,
  default_: number,
): [number, number] {
  // Industriel : id de recherche de la nation choisie → [âge 6, nation].
  if (isResearchComplete(state, 93)) return [6, 8];
  if (isResearchComplete(state, 59)) return [5, 8];
  if (isResearchComplete(state, 114)) return [6, 9];
  if (isResearchComplete(state, 64)) return [5, 9];
  if (isResearchComplete(state, 115)) return [6, 10];
  if (isResearchComplete(state, 68)) return [5, 10];
  if (isResearchComplete(state, 116)) return [6, 11];
  if (isResearchComplete(state, 67)) return [5, 11];
  if (isResearchComplete(state, 118)) return [6, 12];
  if (isResearchComplete(state, 63)) return [5, 12];
  if (isResearchComplete(state, 121)) return [6, 13];
  if (isResearchComplete(state, 65)) return [5, 13];
  if (isResearchComplete(state, 125)) return [6, 14];
  if (isResearchComplete(state, 62)) return [5, 14];
  if (isResearchComplete(state, 126)) return [6, 15];
  if (isResearchComplete(state, 70)) return [5, 15];
  if (isResearchComplete(state, 131)) return [6, 16];
  if (isResearchComplete(state, 73)) return [5, 16];
  if (isResearchComplete(state, 135)) return [6, 17];
  if (isResearchComplete(state, 72)) return [5, 17];
  if (isResearchComplete(state, 136)) return [6, 18];
  if (isResearchComplete(state, 61)) return [5, 18];
  if (isResearchComplete(state, 145)) return [6, 19];
  if (isResearchComplete(state, 69)) return [5, 19];
  if (isResearchComplete(state, 146)) return [6, 20];
  if (isResearchComplete(state, 71)) return [5, 20];
  return [4, default_];
}

/** Âge + nation du joueur au temps donné (ms depuis le début du match). */
export default function getAgeNation(
  time: number,
  researchTimeLine: ResearchTimeLine,
): [number, number] {
  const state: ResearchesState = { time, researchTimeLine };
  if (isResearchComplete(state, 3)) {
    if (!isResearchComplete(state, 1)) return [1, 2];
    if (isResearchComplete(state, 5)) {
      if (!isResearchComplete(state, 15)) return [3, 4];
      return getAgeFactionIndustrial(state, 4);
    }
    if (isResearchComplete(state, 6)) {
      if (!isResearchComplete(state, 9)) return [3, 5];
      return getAgeFactionIndustrial(state, 5);
    }
    return [2, 2];
  }

  if (isResearchComplete(state, 4)) {
    if (!isResearchComplete(state, 2)) return [1, 3];
    if (isResearchComplete(state, 7)) {
      if (!isResearchComplete(state, 16)) return [3, 6];
      return getAgeFactionIndustrial(state, 6);
    }
    if (isResearchComplete(state, 8)) {
      if (!isResearchComplete(state, 17)) return [3, 7];
      return getAgeFactionIndustrial(state, 7);
    }
    return [2, 3];
  }

  return [0, 1];
}
