/** Groupes d'unités pour l'onglet « Units » du détail joueur — ADAPTÉ aux
 *  catégories réelles de notre dataset public (lib/units-index.json).
 *
 *  Siège (mission 06/11, livrable 2) : ws-stats.pl dispose d'un marqueur
 *  interne (extraType "siege") absent des données publiques ; la liste
 *  lib/replay/unit-siege.json (générée par scripts/gen-unit-siege.mjs,
 *  heuristique attackGround/portée minimale sur le dataset servi) fournit
 *  les ids de fiche classés siège — catapultes, trébuchets, béliers,
 *  canons, mortiers… Écarts documentés dans le script (pillbox, tours
 *  d'artillerie, moto lance-grenades).
 *
 *  Règles déterministes (première règle qui matche gagne) :
 *  1. siège — id de fiche présent dans unit-siege.json, AVANT bâtiments :
 *     trébuchet/bélier sont des DefBuild dans les données du jeu et ne
 *     doivent pas tomber dans l'onglet Bâtiments ;
 *  2. bâtiments — catégorie unitCategory*Build/TC, ou tags Building /
 *     Main building / Wonder (unitTag#2/#5/#9) → onglet « Buildings » ;
 *  3. éco — catégorie unitCategoryWorker, ou tag Worker (#3) ;
 *  4. cavalerie — tag Horseman (#25) ou Horse (#35), avant la règle mêlée
 *     (les chevaliers portent des armes de mêlée) ;
 *  5. blindés — tag Heavy vehicle (#34) ;
 *  6. aviation — catégorie unitCategoryAir, ou tag Aviation (#14) ;
 *  7. marine — catégorie unitCategoryFleet, ou tags Fleet (#16/#7) ;
 *  8. faune — tag officiel « Wild animal » (unitTag#33) ou chemin
 *     animals/* (vaches, cerfs, oies, alligators, sangliers, tigres,
 *     ours, aigles, mammouths, chèvres) → section « Faune » — AVANT
 *     mêlée/distance : les animaux armés restent des animaux ;
 *  9. mêlée — catégorie unitCategoryLand avec une arme weaponTypeMelee ;
 *  10. distance — catégorie unitCategoryLand avec une arme à portée
 *      (weaponTypeRange / weaponTypeAerialBomb) ;
 *  11. autres — le reste (roi, décoration, helpers, horde…).
 *  Unité inconnue de l'index (ne devrait pas arriver : correspondance
 *  453/453 vérifiée) → « autres ». */
import { unitsIndex, type UnitIndexEntry } from "@/lib/units";
import siegeTable from "./unit-siege.json";

export type UnitGroupId =
  | "buildings"
  | "eco"
  | "siege"
  | "cavalry"
  | "vehicles"
  | "air"
  | "fleet"
  | "melee"
  | "ranged"
  | "fauna"
  | "other";

/** Ordre d'affichage de l'onglet Units (façon ws-stats : Travailleur /
 *  Mêlée / À distance / Siège / Cavalerie / [Blindés] / Avions / Navires /
 *  Faune / Autre — bâtiments exclus → onglet dédié). */
export const UNIT_GROUP_ORDER: readonly UnitGroupId[] = [
  "eco",
  "melee",
  "ranged",
  "siege",
  "cavalry",
  "vehicles",
  "air",
  "fleet",
  "fauna",
  "other",
];

const BUILDING_CATEGORIES = new Set([
  "unitCategoryDefBuild",
  "unitCategoryEcoBuild",
  "unitCategoryProdBuild",
  "unitCategoryTC",
  "unitCategoryGameplayBuild",
]);

const TAG_BUILDING = "<*unitTag#2>";
const TAG_MAIN_BUILDING = "<*unitTag#5>";
const TAG_WONDER = "<*unitTag#9>";
const TAG_WORKER = "<*unitTag#3>";
const TAG_HORSEMAN = "<*unitTag#25>";
const TAG_HORSE = "<*unitTag#35>";
const TAG_VEHICLE = "<*unitTag#34>";
const TAG_AVIATION = "<*unitTag#14>";
const TAG_FLEET = "<*unitTag#16>";
const TAG_COMBAT_FLEET = "<*unitTag#7>";
/** Tag officiel « Wild animal » (fr « Animal sauvage ») — marqueur faune. */
const TAG_WILD_ANIMAL = "<*unitTag#33>";

const byFicheId = new Map<string, UnitIndexEntry>(
  unitsIndex.units.map((u) => [u.id, u]),
);

/** Unités de siège — ids de fiche sans préfixe (cf. unit-siege.json). */
const SIEGE_IDS: ReadonlySet<string> = new Set(siegeTable.units);

function groupOfEntry(entry: UnitIndexEntry | undefined, ficheId: string): UnitGroupId {
  if (!entry) return "other";
  // Siège en premier : les engins (trébuchet, bélier…) sont des DefBuild
  // dans les données du jeu — ils ne doivent pas finir « Bâtiments ».
  if (SIEGE_IDS.has(ficheId)) return "siege";
  const summary = entry.s ?? {};
  const category = typeof summary.category === "string" ? summary.category : "";
  const tags = new Set(summary.tags ?? []);
  if (BUILDING_CATEGORIES.has(category) || tags.has(TAG_BUILDING) || tags.has(TAG_MAIN_BUILDING) || tags.has(TAG_WONDER)) {
    return "buildings";
  }
  if (category === "unitCategoryWorker" || tags.has(TAG_WORKER)) return "eco";
  if (tags.has(TAG_HORSEMAN) || tags.has(TAG_HORSE)) return "cavalry";
  if (tags.has(TAG_VEHICLE)) return "vehicles";
  if (category === "unitCategoryAir" || tags.has(TAG_AVIATION)) return "air";
  if (category === "unitCategoryFleet" || tags.has(TAG_FLEET) || tags.has(TAG_COMBAT_FLEET)) {
    return "fleet";
  }
  // Faune : tag officiel « Wild animal » ou chemin animals/* — AVANT les
  // règles mêlée/distance (sangliers, tigres et alligators portent des
  // armes de mêlée mais restent des animaux, comme l'onglet Other de
  // ws-stats qui détaille la faune).
  if (tags.has(TAG_WILD_ANIMAL) || entry.id.startsWith("animals/")) return "fauna";
  if (category === "unitCategoryLand") {
    const weaponTypes = new Set((summary.weapons ?? []).map((w) => w.type));
    if (weaponTypes.has("weaponTypeMelee")) return "melee";
    if (weaponTypes.has("weaponTypeRange") || weaponTypes.has("weaponTypeAerialBomb")) {
      return "ranged";
    }
  }
  return "other";
}

/** Groupe d'affichage d'une unité du jeu (gameId complet ou id de fiche). */
export function unitGroupOf(gameId: string): UnitGroupId {
  const ficheId = gameId.replace(/^WarSelection\//, "");
  return groupOfEntry(byFicheId.get(ficheId), ficheId);
}

/** Regroupe des compteurs d'unités { gameId → nombre } par groupe
 *  (gameIds en double fusionnés — défensif, les Maps de production sont
 *  déjà uniques). */
export function groupUnitCounts(
  counts: Iterable<[string, number]>,
): Map<UnitGroupId, Array<{ gameId: string; count: number }>> {
  const grouped = groupUnitRows(
    [...counts].map(([gameId, count]) => [gameId, gameId, count] as const),
  );
  // groupUnitRows ajoute rowKey (clé de ligne non fusionnée) — l'API
  // historique { gameId, count } reste inchangée pour les usages existants.
  const out = new Map<UnitGroupId, Array<{ gameId: string; count: number }>>();
  for (const [group, rows] of grouped) {
    const merged = new Map<string, number>();
    for (const row of rows) merged.set(row.gameId, (merged.get(row.gameId) ?? 0) + row.count);
    out.set(
      group,
      [...merged.entries()]
        .map(([gameId, count]) => ({ gameId, count }))
        .sort((a, b) => b.count - a.count || a.gameId.localeCompare(b.gameId)),
    );
  }
  return out;
}

/** Regroupe des LIGNES d'unités par groupe SANS fusionner les lignes de
 *  même gameId (mission 06/11 : la référence ws-stats liste séparément les
 *  mêmes unités tuées chez des factions différentes — « ne pas fusionner
 *  ce que la référence ne fusionne pas »). `rowKey` distingue les lignes
 *  (ex. faction victime), `gameId` porte l'icône et le nom. */
export function groupUnitRows(
  rows: Iterable<readonly [rowKey: string, gameId: string, count: number]>,
): Map<UnitGroupId, Array<{ gameId: string; count: number; rowKey: string }>> {
  const merged = new Map<UnitGroupId, Array<{ gameId: string; count: number; rowKey: string }>>();
  for (const [rowKey, gameId, count] of rows) {
    const group = unitGroupOf(gameId);
    let list = merged.get(group);
    if (!list) {
      list = [];
      merged.set(group, list);
    }
    list.push({ gameId, count, rowKey });
  }
  const result = new Map<UnitGroupId, Array<{ gameId: string; count: number; rowKey: string }>>();
  for (const [group, list] of merged) {
    result.set(
      group,
      list.sort((a, b) => b.count - a.count || a.gameId.localeCompare(b.gameId)),
    );
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Sous-catégories de bâtiments (V C 02/11) — onglet « Buildings » façon
 *  ws-stats.pl (Eco / Population / Defense / Military / Research / Other),
 *  dérivées des classificateurs PUBLICS du dataset :
 *  - unitCategoryEcoBuild → éco (entrepôt/depot, ferme, basse-cour…)
 *    SAUF temple → Recherche et maison/house → Population ;
 *  - unitCategoryTC → Population (townhall) ; wonder → Autre ;
 *  - unitCategoryDefBuild → Défense (tours, murailles) ;
 *  - unitCategoryProdBuild → Militaire (caserne, écurie, champ de tir,
 *    pier) ;
 *  - unitCategoryGameplayBuild → Autre (forge, arsenal, radar, aéroport).
 *  Les engins de siège (DefBuild mobiles/à tourelle) sont exclus via
 *  unitGroupOf → ils ne passent jamais par ici (groupe « siege »). */

export type BuildingSubgroupId = "eco" | "population" | "defense" | "military" | "research" | "other";

/** Ordre d'affichage des sous-sections de l'onglet Buildings. */
export const BUILDING_SUBGROUP_ORDER: readonly BuildingSubgroupId[] = [
  "eco",
  "population",
  "defense",
  "military",
  "research",
  "other",
];

function buildingSubgroupOfEntry(entry: UnitIndexEntry | undefined): BuildingSubgroupId {
  if (!entry) return "other";
  const category = typeof entry.s?.category === "string" ? entry.s.category : "";
  const leaf = entry.id.split("/").filter(Boolean).pop() ?? "";
  if (leaf === "temple") return "research";
  if (leaf === "house" || leaf === "hut" || leaf === "townhall") return "population";
  if (leaf === "wonder") return "other"; // merveille : pas un bâtiment de population
  switch (category) {
    case "unitCategoryEcoBuild":
      return "eco";
    case "unitCategoryTC":
      return "population";
    case "unitCategoryDefBuild":
      return "defense";
    case "unitCategoryProdBuild":
      return "military";
    default:
      return "other";
  }
}

/** Sous-catégorie d'affichage d'un bâtiment (gameId complet ou id de fiche). */
export function buildingSubgroupOf(gameId: string): BuildingSubgroupId {
  const ficheId = gameId.replace(/^WarSelection\//, "");
  return buildingSubgroupOfEntry(byFicheId.get(ficheId));
}

/** Regroupe des compteurs de BÂTIMENTS par sous-catégorie. */
export function groupBuildingCounts(
  counts: Iterable<[string, number]>,
): Map<BuildingSubgroupId, Array<{ gameId: string; count: number }>> {
  const merged = new Map<BuildingSubgroupId, Map<string, number>>();
  for (const [gameId, count] of counts) {
    const group = buildingSubgroupOf(gameId);
    let byId = merged.get(group);
    if (!byId) {
      byId = new Map();
      merged.set(group, byId);
    }
    byId.set(gameId, (byId.get(gameId) ?? 0) + count);
  }
  const result = new Map<BuildingSubgroupId, Array<{ gameId: string; count: number }>>();
  for (const [group, byId] of merged) {
    result.set(
      group,
      [...byId.entries()]
        .map(([gameId, count]) => ({ gameId, count }))
        .sort((a, b) => b.count - a.count || a.gameId.localeCompare(b.gameId)),
    );
  }
  return result;
}
