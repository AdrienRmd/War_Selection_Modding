import { describe, expect, it } from "vitest";
import {
  buildingSubgroupOf,
  groupBuildingCounts,
  unitGroupOf,
  groupUnitCounts,
  UNIT_GROUP_ORDER,
  BUILDING_SUBGROUP_ORDER,
} from "@/lib/replay/unit-groups";
import { unitsIndex } from "@/lib/units";

/* Classificateur de groupes d'unités — règles déterministes sur le dataset
 * public (lib/units-index.json, 453 unités, correspondance vérifiée). */

describe("unit-groups — classification du dataset réel", () => {
  it("cas nominaux (ids réels du dataset)", () => {
    expect(unitGroupOf("WarSelection/1/worker")).toBe("eco");
    expect(unitGroupOf("WarSelection/1/maceman")).toBe("melee");
    expect(unitGroupOf("WarSelection/3/aw/ballista")).toBe("ranged");
    expect(unitGroupOf("WarSelection/3/ew/knight")).toBe("cavalry"); // Horseman avant mêlée
    expect(unitGroupOf("WarSelection/1/townhall")).toBe("buildings");
    expect(unitGroupOf("WarSelection/2/a/wall_big")).toBe("buildings");
    expect(unitGroupOf("WarSelection/1/wonder")).toBe("buildings"); // tag Wonder
    expect(unitGroupOf("WarSelection/4/aero/military")).toBe("air");
    expect(unitGroupOf("WarSelection/2/a/boat_archer")).toBe("fleet");
    expect(unitGroupOf("WarSelection/1/king")).toBe("other"); // sans arme
  });

  it("faune (V C 02/11) : animaux du dataset → groupe « fauna »", () => {
    // Tag officiel « Wild animal » (unitTag#33) ou chemin animals/*.
    expect(unitGroupOf("WarSelection/animals/goose")).toBe("fauna"); // volaille
    expect(unitGroupOf("WarSelection/animals/alligator")).toBe("fauna");
    expect(unitGroupOf("WarSelection/animals/boar/male")).toBe("fauna");
    expect(unitGroupOf("WarSelection/animals/tiger/male")).toBe("fauna");
    expect(unitGroupOf("WarSelection/animals/deer")).toBe("fauna");
    // Le roi / décoration / helpers restent dans « other ».
    expect(unitGroupOf("WarSelection/1/king")).toBe("other");
    expect(unitGroupOf("WarSelection/decor/dragon")).toBe("other");
  });

  it("sous-catégories de bâtiments (V C) : façon ws-stats", () => {
    expect(buildingSubgroupOf("WarSelection/1/depot")).toBe("eco"); // entrepôt
    expect(buildingSubgroupOf("WarSelection/2/a/poultry_yard")).toBe("eco"); // basse-cour
    expect(buildingSubgroupOf("WarSelection/1/house")).toBe("population");
    expect(buildingSubgroupOf("WarSelection/1/townhall")).toBe("population");
    expect(buildingSubgroupOf("WarSelection/1/tower")).toBe("defense"); // tour
    expect(buildingSubgroupOf("WarSelection/2/a/wall_big")).toBe("defense"); // mur
    expect(buildingSubgroupOf("WarSelection/2/a/shooting_range")).toBe("military");
    expect(buildingSubgroupOf("WarSelection/1/barracks")).toBe("military");
    expect(buildingSubgroupOf("WarSelection/1/temple")).toBe("research"); // temple
    expect(buildingSubgroupOf("WarSelection/1/wonder")).toBe("other"); // merveille
    // Ordre d'affichage complet.
    expect(BUILDING_SUBGROUP_ORDER).toEqual(["eco", "population", "defense", "military", "research", "other"]);
  });

  it("groupBuildingCounts : regroupement trié par sous-catégorie", () => {
    const grouped = groupBuildingCounts([
      ["WarSelection/1/depot", 5],
      ["WarSelection/1/house", 10],
      ["WarSelection/1/tower", 3],
      ["WarSelection/1/house", 2], // doublon fusionné
    ]);
    expect(grouped.get("eco")).toEqual([{ gameId: "WarSelection/1/depot", count: 5 }]);
    expect(grouped.get("population")).toEqual([{ gameId: "WarSelection/1/house", count: 12 }]);
    expect(grouped.get("defense")).toEqual([{ gameId: "WarSelection/1/tower", count: 3 }]);
    expect(grouped.has("military")).toBe(false);
  });

  it("blindés : les véhicules terrestres de combat (tag Heavy vehicle)", () => {
    const vehicles = unitsIndex.units.filter((u) => (u.s?.tags ?? []).includes("<*unitTag#34>"));
    expect(vehicles.length).toBeGreaterThan(0);
    for (const v of vehicles) {
      expect(unitGroupOf(`WarSelection/${v.id}`)).toBe("vehicles");
    }
  });

  it("l'ordre d'affichage n'inclut pas les bâtiments (onglet dédié)", () => {
    expect(UNIT_GROUP_ORDER).not.toContain("buildings");
    expect(UNIT_GROUP_ORDER[0]).toBe("eco");
  });

  it("chaque unité du dataset tombe dans un groupe connu", () => {
    const groups = new Set<string>([
      "buildings",
      "eco",
      "cavalry",
      "vehicles",
      "air",
      "fleet",
      "melee",
      "ranged",
      "fauna",
      "other",
    ]);
    for (const u of unitsIndex.units) {
      const g = unitGroupOf(`WarSelection/${u.id}`);
      if (!groups.has(g)) throw new Error(`groupe inconnu ${g} pour ${u.id}`);
    }
  });

  it("la mêlée et la distance couvrent les unités terrestres armées", () => {
    let melee = 0;
    let ranged = 0;
    for (const u of unitsIndex.units) {
      const g = unitGroupOf(`WarSelection/${u.id}`);
      if (g === "melee") melee++;
      if (g === "ranged") ranged++;
    }
    expect(melee).toBeGreaterThan(20);
    expect(ranged).toBeGreaterThan(20);
  });

  it("groupUnitCounts agrège et trie par count décroissant", () => {
    const grouped = groupUnitCounts([
      ["WarSelection/1/maceman", 5],
      ["WarSelection/1/worker", 42],
      ["WarSelection/3/ew/knight", 12],
      ["WarSelection/1/worker", 0],
    ]);
    // doublon fusionné (42 + 0) :
    expect(grouped.get("eco")).toEqual([{ gameId: "WarSelection/1/worker", count: 42 }]);
    expect(grouped.get("melee")).toEqual([{ gameId: "WarSelection/1/maceman", count: 5 }]);
    expect(grouped.get("cavalry")).toEqual([{ gameId: "WarSelection/3/ew/knight", count: 12 }]);
  });

  it("id inconnu → autres ( repli défensif )", () => {
    expect(unitGroupOf("WarSelection/9/does_not_exist")).toBe("other");
  });
});
