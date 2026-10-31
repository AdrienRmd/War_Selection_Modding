import type { Locale } from "./i18n";

// Logique pure du bloc vitrine « Explorer le jeu » de l'accueil (V3-P1) :
// compteurs réels des 4 sections de données et mini-vignettes d'unités
// déterministes. Aucun compteur n'est codé en dur ici — la page serveur
// dérive tout des index embarqués (lib/units-index.json,
// lib/researches-index.json, lib/modding-meta.json, régénérés par la synchro
// nightly), puis le composant client préfère les comptes frais du manifeste
// /wus-data/updated-at.json (même pattern que les badges de /units,
// /researches et /modding).
//
// Ce module ne doit JAMAIS importer un index lourd (lib/units, lib/researches,
// lib/modding) : il est aussi consommé par le composant client de l'accueil.

/** URL du manifeste de fraîcheur du dataset (servi par Apache, alias /wus-data). */
export const EXPLORE_UPDATED_AT_URL = "/wus-data/updated-at.json";

/** Image du dataset public (mini-vignettes d'unités de l'accueil). */
export const datasetImageUrl = (image: string): string => `/wus-data/content/images/${image}`;

/** Noms officiels localisés du jeu (sous-ensemble structurel des index). */
export interface ExploreLocalizedNames {
  en?: string;
  fr?: string;
  cn?: string;
  tw?: string;
}

/** Entrée d'unité minimale attendue par la sélection de vignettes. */
export interface ExploreUnitSource {
  id: string;
  image?: string;
  faction: string;
  nationId?: number;
  names?: ExploreLocalizedNames;
}

/** Vignette d'unité sérialisable vers le composant client (nom pré-localisé). */
export interface ExploreSampleUnit {
  id: string;
  image: string;
  /** Nom officiel localisé pour la locale de la requête (repli : id). */
  name: string;
}

/** Compteurs des sections, tous dérivés d'une source de données. */
export interface ExploreStats {
  unitsCount: number;
  researchesCount: number;
  parameterNodes: number;
}

/** Résolution officielle du jeu : fr→fr, en→en, zh→cn puis tw, repli en. */
export function localizedExploreName(
  names: ExploreLocalizedNames | undefined,
  locale: Locale,
): string | undefined {
  if (!names) return undefined;
  if (locale === "fr" && names.fr) return names.fr;
  if (locale === "en" && names.en) return names.en;
  if (locale === "zh" && (names.cn || names.tw)) return names.cn ?? names.tw;
  return names.en;
}

/** Date de publication localisée (badge « mis à jour le », pattern /units). */
export function formatExploreDate(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/** Groupe de vignette : nation officielle si présente, sinon faction. */
const sampleGroupKey = (unit: ExploreUnitSource): string =>
  typeof unit.nationId === "number" ? `n${unit.nationId}` : `f${unit.faction}`;

/**
 * Mini-vignettes déterministes : la première unité AVEC image de chaque
 * groupe (nation officielle, sinon faction), jusqu'à `limit` groupes
 * distincts. Aucun identifiant d'unité codé en dur — l'ordre du dataset
 * tranche, la sélection est donc stable entre deux rendus d'un même index.
 */
export function pickSampleUnits(
  units: readonly ExploreUnitSource[],
  locale: Locale,
  limit = 3,
): ExploreSampleUnit[] {
  const seen = new Set<string>();
  const samples: ExploreSampleUnit[] = [];
  for (const unit of units) {
    if (!unit.image) continue;
    const key = sampleGroupKey(unit);
    if (seen.has(key)) continue;
    seen.add(key);
    samples.push({
      id: unit.id,
      image: unit.image,
      name: localizedExploreName(unit.names, locale) ?? unit.id,
    });
    if (samples.length >= limit) break;
  }
  return samples;
}

/**
 * Compteurs des sections vitrine, dérivés des longueurs réelles des index —
 * jamais de littéral. Le paramètre parameterNodes vient de
 * modding-meta.json (pathCount), régénéré par la synchro nightly.
 */
export function exploreStats(input: {
  units: readonly unknown[];
  researches: readonly unknown[];
  parameterNodes: number;
}): ExploreStats {
  return {
    unitsCount: input.units.length,
    researchesCount: input.researches.length,
    parameterNodes: input.parameterNodes,
  };
}
