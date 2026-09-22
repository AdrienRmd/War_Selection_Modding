import type { Catalog, Field, Unit } from "@/lib/workbench";

export const SHA = "a".repeat(64);
export const STEAM_BUILD = "test-build";

export function field(overrides: Partial<Field> & { key: string; path: string }): Field {
  return {
    label: overrides.key,
    raw: 100,
    scale: 1,
    value: 100,
    group: "base",
    min: 0,
    max: 1000,
    step: 1,
    ...overrides,
  };
}

export function makeUnit(
  id: number,
  extra: Partial<Pick<Unit, "fields" | "ruleTargets">> = {},
): Unit {
  return {
    id,
    name: "Unité " + id,
    nameEn: "Unit " + id,
    nation: "fr",
    category: "test",
    population: 1,
    fields: extra.fields ?? [field({ key: "hp", path: `root.unitType[${id}].health.max` })],
    weapons: [],
    armor: [],
    trainingSources: [],
    workItems: [],
    buildingCosts: [],
    ruleTargets: extra.ruleTargets ?? [
      {
        key: "req-empty",
        label: "Prérequis",
        labelEn: "Requirement",
        path: `root.unitType[${id}].ability.work[0].requirements`,
        requirements: { unitsAll: true, units: [], researchAny: [], researchAll: [] },
      },
    ],
    abilityItems: [],
  };
}

export function makeCatalog(units: Unit[]): Catalog {
  return {
    schemaVersion: 1,
    provenance: {
      steamBuild: STEAM_BUILD,
      gameplayVersion: 1,
      sourceSha256: SHA,
      sourceUpdatedAt: "2026-01-01T00:00:00Z",
      extractedAt: "2026-01-01T00:00:00Z",
    },
    units,
  };
}

export const defaultCatalog = (): Catalog =>
  makeCatalog([
    makeUnit(1, {
      fields: [
        field({ key: "hp", path: "root.unitType[1].health.max" }),
        field({
          key: "speed",
          label: "Vitesse",
          path: "root.unitType[1].movement.speed",
          raw: 25,
          scale: 10,
          value: 2.5,
          min: 0,
          max: 100,
        }),
        field({
          key: "stealth",
          label: "Furtif",
          path: "root.unitType[1].ability.stealth",
          raw: 0,
          scale: 1,
          value: 0,
          min: 0,
          max: 1,
          kind: "boolean",
          round: true,
        }),
      ],
    }),
  ]);

export const testEdit = { unitId: 1, fieldKey: "hp", value: 150 };
