import rawIndex from "./units-index.json";

// Logique pure de la page /units : compteurs, recherche, libellés de factions,
// URLs du dataset wus-data. Aucun compte d'unités n'est codé en dur ici — tout
// dérive de lib/units-index.json (généré depuis le dataset publié) ou du badge
// updated-at.json lu à l'exécution.

export interface UnitIndexEntry {
  id: string;
  faction: string;
  group: string;
  slug: string;
  name: string;
  image: string;
}

export interface UnitsIndex {
  datasetId: string;
  gameVersion: string;
  generatedAt: string;
  factions: string[];
  units: UnitIndexEntry[];
}

export const unitsIndex = rawIndex as UnitsIndex;

// Étiquettes de factions : zh = source, en = littéral anglais, fr via dictionnaire.
export const factionLabels: ReadonlyArray<{ id: string; zh: string; en: string }> = [
  { id: "1", zh: "第 1 时代", en: "Age 1" },
  { id: "2", zh: "第 2 时代", en: "Age 2" },
  { id: "3", zh: "第 3 时代", en: "Age 3" },
  { id: "4", zh: "第 4 时代", en: "Age 4" },
  { id: "5", zh: "第 5 时代", en: "Age 5" },
  { id: "animals", zh: "野生动物", en: "Wild animals" },
  { id: "decor", zh: "装饰单位", en: "Decorative units" },
  { id: "helpers", zh: "辅助单位", en: "Helper units" },
  { id: "horde", zh: "部落单位", en: "Horde units" },
];

export const factionLabel = (faction: string): { zh: string; en: string } =>
  factionLabels.find((f) => f.id === faction) ?? { zh: faction, en: faction };

/** Nom affiché dérivé du chemin dataset (le dataset ne livre que des clés brutes). */
export const unitDisplayName = (unit: UnitIndexEntry): string => {
  const humanize = (slug: string) => slug.replace(/[_-]+/g, " ").trim();
  const name = humanize(unit.slug);
  const group = humanize(unit.group);
  return group ? `${name} · ${group}` : name;
};

export const countUnits = (units: readonly UnitIndexEntry[]): number => units.length;

export function countByFaction(units: readonly UnitIndexEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const unit of units) counts[unit.faction] = (counts[unit.faction] ?? 0) + 1;
  return counts;
}

/** Texte recherché : insensible à la casse, sur l'id et le nom affiché. */
export function searchUnits(
  units: readonly UnitIndexEntry[],
  query: string,
): UnitIndexEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...units];
  return units.filter(
    (unit) =>
      unit.id.toLowerCase().includes(needle) ||
      unitDisplayName(unit).toLowerCase().includes(needle),
  );
}

// URLs publiques du dataset (Apache sert /wus-data en statique).
export const UPDATED_AT_URL = "/wus-data/updated-at.json";
export const unitFicheUrl = (id: string): string =>
  `/wus-data/content/units/WarSelection/${id}.json`;
export const unitImageUrl = (image: string): string => `/wus-data/content/images/${image}`;

export interface DatasetMeta {
  datasetId?: string;
  gameVersion?: string;
  publishedAt?: string;
  counts?: { units?: number };
}

/** Date de publication localisée (zh-CN / en / fr) pour le badge « mis à jour le ». */
export function formatPublishedDate(iso: string, locale: "zh" | "en" | "fr"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/** Compresse les clés brutes du jeu pour l'affichage compact (<*unitTag#4> → unitTag 4). */
export const shortTag = (tag: string): string =>
  tag.replace(/^<\*(.+)>$/, "$1").replace(/#(\d+)$/, " $1");
