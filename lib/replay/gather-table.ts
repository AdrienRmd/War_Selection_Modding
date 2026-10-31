/** Table de vitesse de récolte par âge/nation (ressources par seconde :
 *  nourriture, bois, fer) et efficacité d'entrepôt — copie fidèle de
 *  gatherEfficiencyLookupTable.js (IbubussI / wsunitstats-static).
 *
 *  worker/boat/tractor : .value = [nourriture, bois, fer],
 *  .upTime = secondes après la transition d'âge avant que l'amélioration
 *  ne soit effective ; whEff : efficacité de l'entrepôt. */

export interface GatherUnitSpeed {
  value: readonly [number, number, number];
  upTime?: number;
}

export interface GatherNationEntry {
  worker?: GatherUnitSpeed;
  boat?: GatherUnitSpeed;
  tractor?: GatherUnitSpeed;
  whEff: { value: number; upTime?: number };
}

export type GatherAgeEntry = Record<string, GatherNationEntry>;

/** Entrée par défaut défensive (source : seuls les âges 0, 5 et 6 définissent
 *  une entrée default ; ailleurs, nation absente = pas de récolte estimée). */
export const EMPTY_NATION_ENTRY: GatherNationEntry = {
  worker: { value: [0, 0, 0] },
  whEff: { value: 1 },
};

export const gatherEfficiencyLookupTable: Record<string, GatherAgeEntry> = {
  "0": {
    // Âge de pierre
    "1": {
      worker: { value: [1.3, 1.3, 0], upTime: 30 },
      whEff: { value: 1 },
    },
    default: {
      // Apparition (avant les améliorations de l'âge de pierre)
      worker: { value: [1.1, 1.1, 0] },
      whEff: { value: 1 },
    },
  },
  "1": {
    // Âge de bronze
    "2": {
      // Europe
      worker: { value: [1.3, 1.4, 0.7], upTime: 10 },
      boat: { value: [5.4, 0, 0] },
      whEff: { value: 1.1, upTime: 10 },
    },
    "3": {
      // Asie
      worker: { value: [1.5, 1.2, 0.6], upTime: 10 },
      boat: { value: [4.4, 0, 0] },
      whEff: { value: 1.1, upTime: 10 },
    },
  },
  "2": {
    // Âge de fer
    "2": {
      // Europe
      worker: { value: [1.6, 1.6, 0.9], upTime: 60 },
      boat: { value: [5.4, 0, 0] },
      whEff: { value: 1.1 },
    },
    "3": {
      // Asie
      worker: { value: [1.5, 1.3, 0.8], upTime: 60 },
      boat: { value: [4.4, 0, 0] },
      whEff: { value: 1.1 },
    },
  },
  "3": {
    // Âge médiéval
    "4": {
      // Europe de l'Ouest
      worker: { value: [1.5, 1.6, 1.0], upTime: 60 },
      boat: { value: [9, 0, 0], upTime: 30 },
      whEff: { value: 1.3, upTime: 10 },
    },
    "5": {
      // Europe de l'Est
      worker: { value: [1.5, 1.5, 0.8], upTime: 60 },
      boat: { value: [9, 0, 0], upTime: 30 },
      whEff: { value: 1.3, upTime: 10 },
    },
    "6": {
      // Asie de l'Ouest
      worker: { value: [1.6, 1.4, 0.8], upTime: 10 },
      boat: { value: [6, 0, 0] },
      whEff: { value: 1.3, upTime: 15 },
    },
    "7": {
      // Asie de l'Est
      worker: { value: [1.6, 1.4, 0.8] },
      boat: { value: [7, 0, 0], upTime: 40 },
      whEff: { value: 1.3, upTime: 15 },
    },
  },
  "4": {
    // Bas Moyen Âge
    "4": {
      // Europe de l'Ouest
      worker: { value: [1.5, 1.6, 1.0] },
      boat: { value: [9, 0, 0] },
      whEff: { value: 1.4, upTime: 60 },
    },
    "5": {
      // Europe de l'Est
      worker: { value: [1.5, 1.5, 0.8] },
      boat: { value: [9, 0, 0] },
      whEff: { value: 1.4, upTime: 60 },
    },
    "6": {
      // Asie de l'Ouest
      worker: { value: [1.6, 1.4, 0.8] },
      boat: { value: [6, 0, 0] },
      whEff: { value: 1.4, upTime: 60 },
    },
    "7": {
      // Asie de l'Est
      worker: { value: [1.6, 1.4, 0.8] },
      boat: { value: [7, 0, 0] },
      whEff: { value: 1.4, upTime: 60 },
    },
  },
  "5": {
    // Industrie 1
    "15": {
      // Chine
      worker: { value: [1.8, 1.5, 0.8], upTime: 20 },
      boat: { value: [8, 0, 0], upTime: 40 },
      whEff: { value: 1.5, upTime: 30 },
    },
    default: {
      // Toutes nations
      worker: { value: [1.8, 1.8, 1.2], upTime: 60 },
      boat: { value: [10, 0, 0], upTime: 120 },
      tractor: { value: [9, 0, 0] },
      whEff: { value: 1.5, upTime: 30 },
    },
  },
  "6": {
    // Industrie 2
    "9": {
      // Grande-Bretagne
      boat: { value: [20, 0, 0], upTime: 120 },
      whEff: { value: 1.5 },
    },
    "15": {
      // Chine
      worker: { value: [1.8, 1.5, 0.8] },
      boat: { value: [8, 0, 0] },
      whEff: { value: 1.5 },
    },
    "16": {
      // Japon
      boat: { value: [20, 0, 0], upTime: 120 },
      whEff: { value: 1.5 },
    },
    default: {
      // Toutes nations
      worker: { value: [1.8, 1.8, 1.2] },
      boat: { value: [10, 0, 0] },
      tractor: { value: [9, 0, 0] },
      whEff: { value: 1.5 },
    },
  },
};
