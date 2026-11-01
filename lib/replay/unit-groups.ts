/** Groupes d'unités pour l'onglet « Units » du détail joueur — ADAPTÉ aux
 *  catégories réelles de notre dataset public (lib/units-index.json), pas
 *  aux libellés ws-stats (leur découpe Melee/Range/Siege repose sur des
 *  marqueurs internes non publiés : aucune arme « siege » ni tag dédié
 *  n'existe dans nos données — les armes de siège sont des armes de portée,
 *  elles sont donc fusionnées dans « ranged », écart documenté).
 *
 *  Règles déterministes (première règle qui matche gagne) :
 *  1. bâtiments — catégorie unitCategory*Build/TC, ou tags Building /
 *     Main building / Wonder (unitTag#2/#5/#9) → onglet « Buildings » ;
 *  2. éco — catégorie unitCategoryWorker, ou tag Worker (#3) ;
 *  3. cavalerie — tag Horseman (#25) ou Horse (#35), avant la règle mêlée
 *     (les chevaliers portent des armes de mêlée) ;
 *  4. blindés — tag Heavy vehicle (#34) ;
 *  5. aviation — catégorie unitCategoryAir, ou tag Aviation (#14) ;
 *  6. marine — catégorie unitCategoryFleet, ou tags Fleet (#16/#7) ;
 *  7. mêlée — catégorie unitCategoryLand avec une arme weaponTypeMelee ;
 *  8. distance — catégorie unitCategoryLand avec une arme à portée
 *     (weaponTypeRange / weaponTypeAerialBomb) ;
 *  9. autres — le reste (roi, animaux, unités sans arme…).
 *  Unité inconnue de l'index (ne devrait pas arriver : correspondance
 *  453/453 vérifiée) → « autres ». */
import { unitsIndex, type UnitIndexEntry } from "@/lib/units";

export type UnitGroupId =
  | "buildings"
  | "eco"
  | "cavalry"
  | "vehicles"
  | "air"
  | "fleet"
  | "melee"
  | "ranged"
  | "other";

/** Ordre d'affichage de l'onglet Units (bâtiments exclus → onglet dédié). */
export const UNIT_GROUP_ORDER: readonly UnitGroupId[] = [
  "eco",
  "melee",
  "ranged",
  "cavalry",
  "vehicles",
  "air",
  "fleet",
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

const byFicheId = new Map<string, UnitIndexEntry>(
  unitsIndex.units.map((u) => [u.id, u]),
);

function groupOfEntry(entry: UnitIndexEntry | undefined): UnitGroupId {
  if (!entry) return "other";
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
  const entry = byFicheId.get(gameId.replace(/^WarSelection\//, ""));
  return groupOfEntry(entry);
}

/** Regroupe des compteurs d'unités { gameId → nombre } par groupe
 *  (gameIds en double fusionnés — défensif, les Maps de production sont
 *  déjà uniques). */
export function groupUnitCounts(
  counts: Iterable<[string, number]>,
): Map<UnitGroupId, Array<{ gameId: string; count: number }>> {
  const merged = new Map<UnitGroupId, Map<string, number>>();
  for (const [gameId, count] of counts) {
    const group = unitGroupOf(gameId);
    let byId = merged.get(group);
    if (!byId) {
      byId = new Map();
      merged.set(group, byId);
    }
    byId.set(gameId, (byId.get(gameId) ?? 0) + count);
  }
  const result = new Map<UnitGroupId, Array<{ gameId: string; count: number }>>();
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
