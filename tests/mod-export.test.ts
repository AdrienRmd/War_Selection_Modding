import { describe, expect, it } from "vitest";
import { generateGameplayLua } from "@/lib/mod-export.mjs";
import type { Rule } from "@/lib/workbench";
import { field, makeCatalog, makeUnit, testEdit } from "./fixtures";

const catalog = makeCatalog([1, 2, 3, 4, 5].map((id) => makeUnit(id)));
const rule = (unitId: number, requiredUnitId: number): Rule => ({
  unitId,
  targetKey: "req-empty",
  requiredUnitId,
  min: 1,
  max: 2,
});

describe("generateGameplayLua : whitelist des chemins", () => {
  it("accepte les chemins whitelistés et génère le patch attendu", () => {
    const out = generateGameplayLua(catalog, [testEdit]);
    expect(out).toContain('{path={"unitType", 1, "health", "max"}, value=150, expected=100');
    expect(out).toContain("addMod({onStart=onStart})");
  });

  it("rejette un chemin hors whitelist", () => {
    const bad = makeCatalog([
      makeUnit(10, { fields: [field({ key: "hp", path: "root.other[0].health.max" })] }),
    ]);
    expect(() => generateGameplayLua(bad, [{ unitId: 10, fieldKey: "hp", value: 5 }])).toThrow(
      "Untrusted catalog path",
    );
  });

  it("rejette une traversée de répertoire dans le chemin", () => {
    const bad = makeCatalog([
      makeUnit(11, {
        fields: [field({ key: "hp", path: "root.unitType[11].health.max/../evil" })],
      }),
    ]);
    expect(() => generateGameplayLua(bad, [{ unitId: 11, fieldKey: "hp", value: 5 }])).toThrow(
      "Untrusted catalog path",
    );
  });

  it("rejette un chemin réduit à la racine sans segment final", () => {
    const bad = makeCatalog([
      makeUnit(12, { fields: [field({ key: "hp", path: "root.unitType[12]" })] }),
    ]);
    expect(() => generateGameplayLua(bad, [{ unitId: 12, fieldKey: "hp", value: 5 }])).toThrow(
      "Untrusted catalog path",
    );
  });
});

describe("generateGameplayLua : limites du projet", () => {
  it("rejette plus de 500 edits", () => {
    const edits = Array.from({ length: 501 }, () => testEdit);
    expect(() => generateGameplayLua(catalog, edits)).toThrow("Project is too large");
  });

  it("rejette plus de 100 règles", () => {
    const rules = Array.from({ length: 101 }, () => rule(1, 1));
    expect(() => generateGameplayLua(catalog, [], "t", rules)).toThrow("Project is too large");
  });

  it("rejette une 5e condition unitaire sur la même cible", () => {
    const rules = [1, 2, 3, 4, 5].map((id) => rule(1, id));
    expect(() => generateGameplayLua(catalog, [], "t", rules)).toThrow(
      "At most four unit conditions",
    );
  });

  it("rejette une règle avec requis inconnu ou bornes inversées", () => {
    expect(() => generateGameplayLua(catalog, [], "t", [rule(1, 999)])).toThrow(
      "Invalid unit requirement",
    );
    expect(() =>
      generateGameplayLua(catalog, [], "t", [{ ...rule(1, 2), min: 5, max: 1 }]),
    ).toThrow("Invalid unit requirement");
  });

  it("rejette une cible de règles en any-of (unitsAll=false)", () => {
    const anyOf = makeCatalog([
      makeUnit(2, {
        ruleTargets: [
          {
            key: "req-any",
            label: "Prérequis",
            labelEn: "Requirement",
            path: "root.unitType[2].ability.work[0].requirements",
            requirements: { unitsAll: false, units: [], researchAny: [], researchAll: [] },
          },
        ],
      }),
    ]);
    expect(() =>
      generateGameplayLua(anyOf, [], "t", [{ ...rule(2, 2), targetKey: "req-any" }]),
    ).toThrow("Any-of unit requirements are read-only");
  });
});

describe("generateGameplayLua : validation des edits", () => {
  it("rejette un mode de conflit inconnu", () => {
    expect(() => generateGameplayLua(catalog, [testEdit], "t", [], "explode" as "abort")).toThrow(
      "Invalid conflict policy",
    );
  });

  it("rejette des edits dupliqués sur le même champ", () => {
    expect(() => generateGameplayLua(catalog, [testEdit, testEdit])).toThrow("Duplicate edit");
  });

  it("rejette une valeur hors bornes ou NaN", () => {
    expect(() => generateGameplayLua(catalog, [{ ...testEdit, value: 1001 }])).toThrow(
      "Invalid value",
    );
    expect(() => generateGameplayLua(catalog, [{ ...testEdit, value: Number.NaN }])).toThrow(
      "Invalid value",
    );
  });

  it("n'exporte rien quand aucune valeur ne change par rapport à la baseline", () => {
    expect(() => generateGameplayLua(catalog, [{ ...testEdit, value: 100 }])).toThrow(
      "No changed values to export",
    );
  });

  it("détecte des edits en conflit sur un même champ producteur", () => {
    const shared = makeCatalog([
      makeUnit(1),
      makeUnit(2, {
        fields: [field({ key: "hp", path: "root.unitType[1].health.max" })],
      }),
    ]);
    const edits = [
      { unitId: 1, fieldKey: "hp", value: 150 },
      { unitId: 2, fieldKey: "hp", value: 160 },
    ];
    expect(() => generateGameplayLua(shared, edits)).toThrow(
      "The same producer field has conflicting edits.",
    );
  });
});

describe("generateGameplayLua : sortie Lua", () => {
  it("embarque le préflight pcall et le message d'échec", () => {
    const out = generateGameplayLua(catalog, [testEdit]);
    expect(out).toContain("local ok, reason = pcall(function()");
    expect(out).toContain("[WS ATLAS] Preflight failed; no changes applied");
  });

  it("sérialise strictBaseline selon le mode de conflit", () => {
    expect(generateGameplayLua(catalog, [testEdit])).toContain("local strictBaseline = true");
    expect(generateGameplayLua(catalog, [testEdit], "t", [], "overwrite")).toContain(
      "local strictBaseline = false",
    );
  });

  it("sérialise les champs booléens en true/false", () => {
    const boolCatalog = makeCatalog([
      makeUnit(1, {
        fields: [
          field({
            key: "stealth",
            path: "root.unitType[1].ability.stealth",
            raw: 0,
            value: 0,
            min: 0,
            max: 1,
            kind: "boolean",
            round: true,
          }),
        ],
      }),
    ]);
    const out = generateGameplayLua(boolCatalog, [{ unitId: 1, fieldKey: "stealth", value: 1 }]);
    expect(out).toContain("value=true, expected=false");
  });
});
