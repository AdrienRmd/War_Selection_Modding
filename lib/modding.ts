import type { Locale } from "./i18n";
import rawMeta from "./modding-meta.json";

// Logique pure de la page /modding : chemins de l'arbre des paramètres du jeu,
// résolution de liens profonds (deep-link) via chargeur injecté (fetch réseau
// en production, fixtures/mock ou lecture disque dans les tests), recherche
// par chemin sur l'index généré, fil d'Ariane. Aucun compte de nœuds n'est codé
// en dur ici — tout dérive de lib/modding-meta.json + public/modding-paths.json
// (générés par scripts/gen-modding-index.mjs depuis le dataset publié) ou du
// badge updated-at.json lu à l'exécution.

/** Nœud du dump arbre du jeu : k = clé, tp = type, v = valeur brute. */
export interface ModdingNode {
  k: string;
  tp?: string;
  v?: string;
  ch?: ModdingNode[];
  as?: boolean;
}

/** Racine home.json (rendue inline, jamais fetchée). */
export interface ModdingHome {
  k?: string;
  tp?: string;
  ex?: boolean;
  ch?: ModdingNode[];
}

export interface ModdingMeta {
  schema: number;
  datasetId: string;
  gameVersion: string;
  generatedAt: string;
  pathCount: number;
  largeCount: number;
}

/** Index des chemins servi par /modding-paths.json (chargé à la demande). */
export interface ModdingPathIndex extends ModdingMeta {
  paths: string[];
  /** Chemins des nœuds dont le fichier dépasse le seuil (octets sur disque). */
  large: Record<string, number>;
}

export const moddingMeta = rawMeta as ModdingMeta;

export const PATH_INDEX_URL = "/modding-paths.json";
export const TREE_BASE_URL = "/wus-data/content/docs/tree";
/** URL du fichier d'un nœud lazy (ex. gameplay.root.unitType.5.json). */
export const treeFileUrl = (path: string): string => `${TREE_BASE_URL}/${path}.json`;

/** Chargeur des enfants d'un nœud lazy (fetch / mock / fs selon le contexte). */
export type ChildrenLoader = (path: string) => Promise<ModdingNode[]>;

export const segmentsOf = (path: string): string[] => path.split(".").filter(Boolean);
export const childPath = (parent: string, key: string): string =>
  parent ? `${parent}.${key}` : key;

export const isLazyNode = (node: ModdingNode): boolean => node.as === true;
export const hasInlineChildren = (node: ModdingNode): boolean =>
  Array.isArray(node.ch) && node.ch.length > 0;
export const isExpandableNode = (node: ModdingNode): boolean =>
  isLazyNode(node) || hasInlineChildren(node);

/** Enfants à afficher : inline si présents, sinon via le chargeur (lazy). */
export async function childrenOfNode(
  node: ModdingNode,
  path: string,
  load: ChildrenLoader,
): Promise<ModdingNode[]> {
  if (hasInlineChildren(node)) return node.ch ?? [];
  if (isLazyNode(node)) return load(path);
  return [];
}

export interface DeepLinkResolution {
  /** parentPath → enfants rendus pour la chaîne développée ("" = racine). */
  levels: Map<string, ModdingNode[]>;
  /** Nœud terminal atteint (null si chemin vide ou introuvable). */
  target: { path: string; node: ModdingNode } | null;
  /** Préfixe où la résolution s'est arrêtée (nœud absent ou feuille traversée). */
  missingAt: string | null;
}

/**
 * Résout un lien profond ?path=gameplay.root.unitType.5.attack : part des
 * enfants inline de home, fetch les nœuds « as » intermédiaires via `load`
 * (un fetch par niveau lazy, jamais l'arbre entier) et renvoie la chaîne des
 * niveaux à rendre développés plus le nœud cible.
 */
export async function resolveDeepLink(
  homeChildren: ModdingNode[],
  path: string,
  load: ChildrenLoader,
): Promise<DeepLinkResolution> {
  const segments = segmentsOf(path);
  const levels = new Map<string, ModdingNode[]>();
  if (segments.length === 0) return { levels, target: null, missingAt: null };
  levels.set("", homeChildren);
  let current = homeChildren;
  let parentPath = "";
  let node: ModdingNode | undefined;
  let nodePath = "";
  for (const segment of segments) {
    node = current.find((child) => child.k === segment);
    if (!node) return { levels, target: null, missingAt: parentPath };
    nodePath = childPath(parentPath, segment);
    if (!isExpandableNode(node)) {
      // Une feuille ne peut être que le dernier segment du chemin.
      const isLast = segment === segments[segments.length - 1];
      return isLast
        ? { levels, target: { path: nodePath, node }, missingAt: null }
        : { levels, target: null, missingAt: nodePath };
    }
    const children = await childrenOfNode(node, nodePath, load);
    levels.set(nodePath, children);
    current = children;
    parentPath = nodePath;
  }
  return { levels, target: node ? { path: nodePath, node } : null, missingAt: null };
}

/** Fil d'Ariane cliquable : segments cumulatifs (gameplay → gameplay.root → …). */
export function breadcrumbOf(path: string): { key: string; path: string }[] {
  let acc = "";
  return segmentsOf(path).map((segment) => {
    acc = acc ? `${acc}.${segment}` : segment;
    return { key: segment, path: acc };
  });
}

export const normalizeQuery = (query: string): string => query.trim().toLowerCase();

const tailOf = (path: string): string => {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? path : path.slice(dot + 1);
};

/**
 * Recherche par chemin sur l'index : sous-chaîne insensible à la casse (les
 * espaces superflus sont ignorés, ex. « unitType.5 » comme « UNITTYPE.5 »).
 * Les chemins dont le DERNIER segment commence par la requête sortent d'abord
 * (defaultFormation → gameplay.root.defaultFormationInterval), puis les autres
 * correspondances, jusqu'à `limit` résultats.
 */
export function searchPaths(paths: readonly string[], query: string, limit = 60): string[] {
  const needle = normalizeQuery(query);
  if (!needle) return [];
  const starts: string[] = [];
  const contains: string[] = [];
  for (const path of paths) {
    const lower = path.toLowerCase();
    if (!lower.includes(needle)) continue;
    if (tailOf(lower).startsWith(needle)) {
      starts.push(path);
      if (starts.length >= limit) break;
    } else {
      contains.push(path);
    }
  }
  const seen = new Set<string>();
  const results: string[] = [];
  for (const path of [...starts, ...contains]) {
    if (seen.has(path)) continue;
    seen.add(path);
    results.push(path);
    if (results.length >= limit) break;
  }
  return results;
}

/** Nombre TOTAL de chemins correspondant à la requête (avant limite d'affichage). */
export function countMatches(paths: readonly string[], query: string): number {
  const needle = normalizeQuery(query);
  if (!needle) return 0;
  let count = 0;
  for (const path of paths) if (path.toLowerCase().includes(needle)) count += 1;
  return count;
}

export interface DatasetMeta {
  datasetId?: string;
  gameVersion?: string;
  publishedAt?: string;
  counts?: { treeFiles?: number };
}

/** Date de publication localisée pour le badge « mis à jour le » (mécanisme /units). */
export function formatPublishedDate(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}
