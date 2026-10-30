import rawIndex from "./researches-index.json";
import type { Locale } from "./i18n";

// Logique pure de la page /researches : compteurs, filtres par type, recherche,
// noms localisés, liens vers /units. Aucun compte de recherches n'est codé en
// dur ici — tout dérive de lib/researches-index.json (généré depuis le dataset
// publié : context.json + localization + arbre gameplay) ou du badge
// updated-at.json lu à l'exécution.

export interface LocalizedText {
  en?: string;
  fr?: string;
  cn?: string;
  tw?: string;
}

export interface ResearchEntry {
  gameId: number;
  type: string;
  image: string;
  names?: LocalizedText;
  descriptions?: LocalizedText;
  /** Unités affectées par les effets de la recherche (arbre gameplay). */
  affects?: string[];
  /** Unités dont la production exige cette recherche (requirements unitType). */
  unlocks?: string[];
}

export interface ResearchType {
  id: number;
  name: string;
}

export interface ResearchesIndex {
  datasetId: string;
  gameVersion: string;
  generatedAt: string;
  types: ResearchType[];
  researches: ResearchEntry[];
}

export const researchesIndex = rawIndex as ResearchesIndex;

const localizedFrom = (text: LocalizedText | undefined, locale: Locale): string | undefined => {
  if (!text) return undefined;
  if (locale === "fr" && text.fr) return text.fr;
  if (locale === "en" && text.en) return text.en;
  if (locale === "zh" && (text.cn || text.tw)) return text.cn ?? text.tw;
  return text.en;
};

/** Nom affiché selon la locale, repli en puis clé brute compressée. */
export const localizedResearchName = (research: ResearchEntry, locale: Locale): string =>
  localizedFrom(research.names, locale) ?? `<*upgrade${research.gameId}#0>`;

/** Description localisée selon la locale (absente si aucune langue disponible). */
export const localizedResearchDescription = (
  research: ResearchEntry,
  locale: Locale,
): string | undefined => localizedFrom(research.descriptions, locale);

export const countResearches = (researches: readonly ResearchEntry[]): number => researches.length;

/** Répartition par type (clés = noms de types présents dans les données). */
export function countByType(researches: readonly ResearchEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const research of researches) counts[research.type] = (counts[research.type] ?? 0) + 1;
  return counts;
}

/** Types effectivement présents dans le dataset, triés comme le sélecteur. */
export const typesInUse = (index: ResearchesIndex): ResearchType[] =>
  index.types.filter((type) => index.researches.some((r) => r.type === type.name));

/** Étiquettes de types : zh = source, en = littéral anglais, fr via dictionnaire. */
export const researchTypeLabels: ReadonlyArray<{ id: string; zh: string; en: string }> = [
  { id: "researchTypeAgeTransition", zh: "时代过渡", en: "Age transition" },
  { id: "researchTypeEco", zh: "经济", en: "Economy" },
  { id: "researchTypePop", zh: "人口", en: "Population" },
  { id: "researchTypeTerritory", zh: "领土", en: "Territory" },
  { id: "researchTypeCombat", zh: "战斗", en: "Combat" },
  { id: "researchTypeUnit", zh: "单位", en: "Units" },
  { id: "researchTypeBuff", zh: "增益", en: "Buffs" },
  { id: "researchTypeWonderTransition", zh: "奇观过渡", en: "Wonder transition" },
  { id: "researchTypeAura", zh: "光环", en: "Auras" },
  { id: "researchTypeOther", zh: "其他", en: "Other" },
];

export const researchTypeLabel = (type: string): { zh: string; en: string } =>
  researchTypeLabels.find((t) => t.id === type) ?? { zh: type, en: type };

const searchable = (research: ResearchEntry): string[] => {
  const names = research.names ?? {};
  const descriptions = research.descriptions ?? {};
  return [
    String(research.gameId),
    ...Object.values(names),
    ...Object.values(descriptions),
    research.type,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
};

/** Recherche par nom/description dans toutes les langues embarquées + id + type. */
export function searchResearches(
  researches: readonly ResearchEntry[],
  query: string,
): ResearchEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...researches];
  return researches.filter((research) =>
    searchable(research).some((value) => value.toLowerCase().includes(needle)),
  );
}

// URLs publiques du dataset (Apache sert /wus-data en statique).
export const researchImageUrl = (image: string): string => `/wus-data/content/images/${image}`;
/** Lien profond vers la fiche d'une unité sur /units (?unit=<id dataset>). */
export const unitDeepLink = (unitId: string): string => `/units?unit=${encodeURIComponent(unitId)}`;

export interface DatasetMeta {
  datasetId?: string;
  gameVersion?: string;
  publishedAt?: string;
  counts?: { researches?: number };
}
