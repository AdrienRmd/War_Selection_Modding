import rawIndex from "./units-index.json";
import { translate, type Locale } from "./i18n";

// Logique pure de la page /units : compteurs, recherche, libellés de groupes
// (nations/âges OFFICIELS via la localisation du jeu), fiches enrichies
// (caractéristiques, construction, travaux, armes), formats localisés.
// Aucun compte d'unités n'est codé en dur ici — tout dérive de
// lib/units-index.json (généré depuis le dataset publié) ou du badge
// updated-at.json lu à l'exécution.

export interface UnitLocalizedNames {
  en?: string;
  fr?: string;
  cn?: string;
  tw?: string;
}

/** Coût d'une ressource : paire [resourceId, valeur] (valeur > 0). */
export type CostPair = [number, number];

/** Prérequis d'unité : [id d'unité, quantité, 1 si « au plus » (≤)]. */
export type UnitRequirement = [string, number, 1?];

/** Entité produite par un travail : recherche (gameId) ou unité. */
export type WorkEntity =
  | { kind: "research"; gameId: number }
  | { kind: "unit"; id: string };

export interface UnitSource {
  /** Unité qui construit/produit/transforme (id dataset, sans préfixe). */
  by: string;
  cost: CostPair[];
  reqU?: UnitRequirement[];
  reqR?: number[];
  type?: string;
}

export interface UnitBuild {
  init?: CostPair[];
  full?: CostPair[];
  heal?: CostPair[];
  reqU?: UnitRequirement[];
  reqR?: number[];
}

export interface UnitWork {
  cost: CostPair[];
  /** Durée de fabrication en secondes. */
  t?: number;
  reqU?: UnitRequirement[];
  reqR?: number[];
  entity: WorkEntity;
}

export interface UnitWeapon {
  type?: string;
  recharge?: number;
  attacks?: number;
  min?: number;
  max?: number;
  damage?: [string, number][];
}

/** Résumé embarqué d'une fiche (généré par scripts/gen-units-index.mjs). */
export interface UnitSummary {
  health?: number;
  size?: number;
  viewRange?: number;
  threat?: number;
  storageMultiplier?: number;
  killValue?: number;
  controllable?: boolean;
  category?: string;
  desc?: UnitLocalizedNames;
  /** Clés brutes des tags du jeu ( <*unitTag#N> ou enum), résolues via index.tags. */
  tags?: string[];
  armorZonal?: [number, number][];
  armorTyped?: [string, number][];
  sources?: UnitSource[];
  build?: UnitBuild;
  works?: UnitWork[];
  weapons?: UnitWeapon[];
  /** Recherches applicables à cette unité (champ officiel applicableResearches). */
  researchIds?: number[];
}

export interface UnitIndexEntry {
  id: string;
  faction: string;
  group: string;
  slug: string;
  name: string;
  image: string;
  /** Noms officiels localisés (clés <*unitNameWarSelection/...> du dataset). */
  names?: UnitLocalizedNames;
  /** Nation/âge officiel (clé <*nationNameN> du dataset). */
  nationId?: number;
  /** Résumé enrichi de la fiche. */
  s?: UnitSummary;
}

export interface UnitsIndex {
  datasetId: string;
  gameVersion: string;
  generatedAt: string;
  factions: string[];
  /** Étiquettes officielles de nations/âges, par nationId. */
  nations?: Record<string, UnitLocalizedNames>;
  /** Noms officiels de ressources, par resourceId (arrêtées à la 1re absente). */
  resources?: Record<string, UnitLocalizedNames>;
  /** Étiquettes officielles de tags du jeu (clés <*unitTag#N>), par clé brute. */
  tags?: Record<string, UnitLocalizedNames>;
  units: UnitIndexEntry[];
}

export const unitsIndex = rawIndex as UnitsIndex;

// Étiquettes des groupes non-nationaux : zh = source, en = littéral, fr via
// dictionnaire. Les factions numériques 1-5 n'ont PLUS d'étiquette générique :
// les groupes utilisent les noms officiels localisés (nations du jeu).
export const factionLabels: ReadonlyArray<{ id: string; zh: string; en: string }> = [
  { id: "animals", zh: "野生动物", en: "Wild animals" },
  { id: "decor", zh: "装饰单位", en: "Decorative units" },
  { id: "helpers", zh: "辅助单位", en: "Helper units" },
  { id: "horde", zh: "部落单位", en: "Horde units" },
];

export const factionLabel = (faction: string): { zh: string; en: string } =>
  factionLabels.find((f) => f.id === faction) ?? { zh: faction, en: faction };

/** Chaîne de repli d'un texte localisé du jeu : fr→fr, en→en, zh→cn puis tw, sinon en. */
export const localizedGameText = (
  text: UnitLocalizedNames | undefined,
  locale: Locale,
): string | undefined => {
  if (!text) return undefined;
  if (locale === "fr" && text.fr) return text.fr;
  if (locale === "en" && text.en) return text.en;
  if (locale === "zh" && (text.cn || text.tw)) return text.cn ?? text.tw;
  return text.en;
};

/** Étiquette officielle d'une nation / d'un âge (ex. fr : « Age de Pierre »). */
export const localizedNationLabel = (
  index: UnitsIndex,
  nationId: number,
  locale: Locale,
): string | undefined => localizedGameText(index.nations?.[String(nationId)], locale);

/** Nom officiel d'une ressource (ex. fr : « Matériaux ») — absent du loc = non affiché. */
export const localizedResourceLabel = (
  index: UnitsIndex,
  resourceId: number,
  locale: Locale,
): string | undefined => localizedGameText(index.resources?.[String(resourceId)], locale);

/** Étiquette officielle d'un tag du jeu (clé <*unitTag#N>), repli clé compressée. */
export const localizedTagLabel = (
  index: UnitsIndex,
  key: string,
  locale: Locale,
): string => localizedGameText(index.tags?.[key], locale) ?? shortTag(key);

/** Description officielle localisée d'une unité (absente si aucune langue). */
export const localizedUnitDescription = (
  unit: UnitIndexEntry,
  locale: Locale,
): string | undefined => localizedGameText(unit.s?.desc, locale);

/** Nom affiché dérivé du chemin dataset (repli quand la clé localisée manque). */
export const unitDisplayName = (unit: UnitIndexEntry): string => {
  const humanize = (slug: string) => slug.replace(/[_-]+/g, " ").trim();
  const name = humanize(unit.slug);
  const group = humanize(unit.group);
  return group ? `${name} · ${group}` : name;
};

/**
 * Nom d'affichage selon la locale : fr → fr, en → en, zh → cn (repli tw),
 * puis repli en, puis nom dérivé du chemin. Jamais de chaîne vide.
 */
export const localizedUnitName = (unit: UnitIndexEntry, locale: Locale): string => {
  const name = localizedGameText(unit.names, locale);
  return name ?? unitDisplayName(unit);
};

export const countUnits = (units: readonly UnitIndexEntry[]): number => units.length;

export function countByFaction(units: readonly UnitIndexEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const unit of units) counts[unit.faction] = (counts[unit.faction] ?? 0) + 1;
  return counts;
}

// --- Groupes de la liste : nations officielles (âges), puis groupes spéciaux --
// Les factions 1-5 du dataset mélangent plusieurs nations officielles (ex. la
// faction 2 contient l'Europe ET l'Asie de l'Age de Bronze) : les groupes de
// /units suivent donc la nation officielle de chaque unité (nationId → clé
// <*nationNameN>), jamais une étiquette générique « Ère 1-5 ».
export interface UnitGroup {
  key: string;
  nationId?: number;
  faction?: string;
}

export const unitGroupKey = (unit: UnitIndexEntry): string => {
  if (typeof unit.nationId === "number") return `n:${unit.nationId}`;
  if (!/^\d+$/.test(unit.faction)) return `f:${unit.faction}`;
  return "other";
};

/** Groupes ordonnés : nations par id croissant, puis animaux/décor/aides/horde. */
export function unitGroups(index: UnitsIndex): UnitGroup[] {
  const nationIds = [
    ...new Set(
      index.units
        .map((u) => u.nationId)
        .filter((nationId): nationId is number => typeof nationId === "number"),
    ),
  ].sort((a, b) => a - b);
  const groups: UnitGroup[] = nationIds.map((nationId) => ({ key: `n:${nationId}`, nationId }));
  for (const faction of index.factions) {
    if (!/^\d+$/.test(faction) && index.units.some((u) => u.faction === faction)) {
      groups.push({ key: `f:${faction}`, faction });
    }
  }
  if (index.units.some((u) => unitGroupKey(u) === "other")) groups.push({ key: "other" });
  return groups;
}

export function countByGroup(units: readonly UnitIndexEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const unit of units) {
    const key = unitGroupKey(unit);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/** Libellé localisé d'un groupe : nation officielle (loc du jeu) ou faction spéciale (dictionnaire du site). */
export const localizedGroupLabel = (
  index: UnitsIndex,
  group: UnitGroup,
  locale: Locale,
): string | undefined => {
  if (group.nationId !== undefined) return localizedNationLabel(index, group.nationId, locale);
  if (group.faction !== undefined) {
    const label = factionLabel(group.faction);
    if (locale === "zh") return label.zh;
    const translated = translate(label.zh, locale);
    return translated === label.zh ? label.en : translated;
  }
  return undefined;
};

/** Texte recherché : insensible à la casse, sur l'id, le nom affiché et les noms localisés (en/fr/cn/tw). */
export function searchUnits(
  units: readonly UnitIndexEntry[],
  query: string,
): UnitIndexEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...units];
  return units.filter((unit) => {
    if (unit.id.toLowerCase().includes(needle)) return true;
    if (unitDisplayName(unit).toLowerCase().includes(needle)) return true;
    const names = unit.names;
    if (names) {
      for (const value of [names.en, names.fr, names.cn, names.tw]) {
        if (value && value.toLowerCase().includes(needle)) return true;
      }
    }
    return false;
  });
}

// URLs publiques du dataset (Apache sert /wus-data en statique).
export const UPDATED_AT_URL = "/wus-data/updated-at.json";
export const unitFicheUrl = (id: string): string =>
  `/wus-data/content/units/WarSelection/${id}.json`;
export const unitImageUrl = (image: string): string => `/wus-data/content/images/${image}`;
export const resourceImageUrl = (resourceId: number): string =>
  `/wus-data/content/images/resource/${resourceId}.png`;
export const upgradeImageUrl = (gameId: number): string =>
  `/wus-data/content/images/upgrade/${gameId}.png`;
/** Lien profond vers une fiche d'unité (/units?unit=<id dataset>). */
export const unitDeepLink = (unitId: string): string =>
  `/units?unit=${encodeURIComponent(unitId)}`;
/** Lien profond vers une recherche (/researches?research=<gameId>). */
export const researchDeepLink = (gameId: number): string => `/researches?research=${gameId}`;

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

const localeTag = (locale: Locale): string => (locale === "zh" ? "zh-CN" : locale);

/** Nombre localisé (séparateur décimal et des milliers par langue). */
export function formatStatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(localeTag(locale), { maximumFractionDigits: 3 }).format(value);
}

/** Durée localisée : fr « 90 s », en « 90 sec », zh « 90 秒 » (décimales selon la langue). */
export function formatDuration(seconds: number, locale: Locale): string {
  const number = new Intl.NumberFormat(localeTag(locale), { maximumFractionDigits: 2 }).format(
    seconds,
  );
  if (locale === "zh") return `${number} 秒`;
  if (locale === "en") return `${number} sec`;
  return `${number} s`;
}

/** Compresse les clés brutes du jeu pour l'affichage compact (<*unitTag#4> → unitTag 4). */
export const shortTag = (tag: string): string =>
  tag.replace(/^<\*(.+)>$/, "$1").replace(/#(\d+)$/, " $1");

// --- Enums du jeu traduits par les dictionnaires du site (zh source, en littéral) --
export const categoryLabels: ReadonlyArray<{ id: string; zh: string; en: string }> = [
  { id: "unitCategoryLand", zh: "地面单位", en: "Ground unit" },
  { id: "unitCategoryEcoBuild", zh: "经济建筑", en: "Economy building" },
  { id: "unitCategoryDefBuild", zh: "防御建筑", en: "Defensive building" },
  { id: "unitCategoryProdBuild", zh: "生产建筑", en: "Production building" },
  { id: "unitCategoryGameplayBuild", zh: "功能建筑", en: "Functional building" },
  { id: "unitCategoryTC", zh: "市政中心", en: "Town center" },
  { id: "unitCategoryWorker", zh: "工人单位", en: "Worker unit" },
  { id: "unitCategoryFleet", zh: "海军单位", en: "Naval unit" },
  { id: "unitCategoryAir", zh: "空军单位", en: "Air unit" },
  { id: "unitCategoryOther", zh: "其他类别单位", en: "Miscellaneous unit" },
];

export const categoryLabel = (id: string): { zh: string; en: string } | undefined =>
  categoryLabels.find((c) => c.id === id);

export const weaponTypeLabels: ReadonlyArray<{ id: string; zh: string; en: string }> = [
  { id: "weaponTypeMelee", zh: "近战武器", en: "Melee weapon" },
  { id: "weaponTypeRange", zh: "远程武器", en: "Ranged weapon" },
  { id: "weaponTypeAerialBomb", zh: "航空炸弹", en: "Aerial bomb" },
];

export const weaponTypeLabel = (id: string): { zh: string; en: string } | undefined =>
  weaponTypeLabels.find((w) => w.id === id);

export const damageTypeLabels: ReadonlyArray<{ id: string; zh: string; en: string }> = [
  { id: "damageTypeBase", zh: "基础伤害", en: "Base damage" },
];

export const damageTypeLabel = (id: string): { zh: string; en: string } | undefined =>
  damageTypeLabels.find((d) => d.id === id);

export const sourceTypeLabels: ReadonlyArray<{ id: string; zh: string; en: string }> = [
  { id: "unitCostSourceTypeBuilding", zh: "建造方", en: "Built by" },
  { id: "unitCostSourceTypeCreate", zh: "生产方", en: "Produced by" },
  { id: "unitCostSourceTypeTransform", zh: "变形自", en: "Transformed from" },
  { id: "unitCostSourceTypeWeapon", zh: "装备方", en: "Equipped from" },
  { id: "unitCostSourceTypeDeath", zh: "死亡产生", en: "Produced on death" },
];

export const sourceTypeLabel = (id: string | undefined): { zh: string; en: string } | undefined =>
  id ? sourceTypeLabels.find((s) => s.id === id) : undefined;
