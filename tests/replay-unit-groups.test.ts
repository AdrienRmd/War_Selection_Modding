import { describe, expect, it } from "vitest";
import { unitGroupOf, groupUnitCounts, UNIT_GROUP_ORDER } from "@/lib/replay/unit-groups";
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
