import { describe, expect, it } from "vitest";
import { projectJSON, readProject, validateDraft, type Rule } from "@/lib/workbench";
import { SHA, STEAM_BUILD, defaultCatalog, testEdit } from "./fixtures";

const catalog = defaultCatalog();
const rule: Rule = { unitId: 1, targetKey: "req-empty", requiredUnitId: 1, min: 1, max: 3 };

describe("validateDraft", () => {
  it("accepte un draft minimal valide et retourne l'édition correspondante", () => {
    const edits = validateDraft(catalog, { "1:hp": "150" });
    expect(edits).toHaveLength(1);
    expect(edits[0]).toEqual(testEdit);
  });

  it("ne retourne aucune édition si la valeur saisie égale la baseline", () => {
    expect(validateDraft(catalog, { "1:hp": "100" })).toEqual([]);
  });

  it("rejette une unité ou un champ inconnu", () => {
    expect(() => validateDraft(catalog, { "1:aucun": "1" })).toThrow(/未知的单位或数值字段/);
    expect(() => validateDraft(catalog, { "99:hp": "1" })).toThrow(/未知的单位或数值字段/);
  });

  it("rejette une valeur hors bornes ou non numérique", () => {
    expect(() => validateDraft(catalog, { "1:hp": "1001" })).toThrow(/请填写/);
    expect(() => validateDraft(catalog, { "1:hp": "abc" })).toThrow(/请填写/);
  });

  it("applique la précision imposée par l'échelle du champ", () => {
    expect(() => validateDraft(catalog, { "1:speed": "2.55" })).toThrow(/最小精度/);
    expect(validateDraft(catalog, { "1:speed": "3.5" })).toEqual([
      { unitId: 1, fieldKey: "speed", value: 3.5 },
    ]);
  });
});

describe("readProject", () => {
  it("assure le round-trip export → import v2 avec règles et mode overwrite", () => {
    const json = projectJSON(catalog, [testEdit], "Mon mod", [rule], "overwrite");
    const project = readProject(json, catalog);
    expect(project.name).toBe("Mon mod");
    expect(project.conflictMode).toBe("overwrite");
    expect(project.rules).toEqual([rule]);
    expect(project.edits).toEqual([testEdit]);
    expect(project.draft).toEqual({ "1:hp": "150" });
  });

  it("traite un projet v1 sans règles en mode abort", () => {
    const json = JSON.stringify({
      format: "ws-atlas-unit-project",
      schemaVersion: 1,
      name: "Ancien",
      sourceSha256: SHA,
      steamBuild: STEAM_BUILD,
      edits: [testEdit],
    });
    const project = readProject(json, catalog);
    expect(project.name).toBe("Ancien");
    expect(project.rules).toEqual([]);
    expect(project.conflictMode).toBe("abort");
    expect(project.edits).toEqual([testEdit]);
  });

  it("rejette un hash de base invalide ou un autre snapshot de données", () => {
    const build = (sha: string, build: string) =>
      JSON.stringify({
        format: "ws-atlas-unit-project",
        schemaVersion: 1,
        name: "Test",
        sourceSha256: sha,
        steamBuild: build,
        edits: [testEdit],
      });
    expect(() => readProject(build("deadbeef", STEAM_BUILD), catalog)).toThrow(/WS ATLAS/);
    expect(() => readProject(build("b".repeat(64), STEAM_BUILD), catalog)).toThrow(/快照/);
    expect(() => readProject(build(SHA, "autre-build"), catalog)).toThrow(/快照/);
  });

  it("rejette un projet trop volumineux : plus de 500 edits ou 100 règles", () => {
    const tooManyEdits = JSON.stringify({
      format: "ws-atlas-unit-project",
      schemaVersion: 1,
      name: "Test",
      sourceSha256: SHA,
      steamBuild: STEAM_BUILD,
      edits: Array.from({ length: 501 }, (_, i) => ({
        unitId: i,
        fieldKey: "hp",
        value: 1,
      })),
    });
    expect(() => readProject(tooManyEdits, catalog)).toThrow(/WS ATLAS/);
    const tooManyRules = JSON.stringify({
      format: "ws-atlas-unit-project",
      schemaVersion: 2,
      name: "Test",
      sourceSha256: SHA,
      steamBuild: STEAM_BUILD,
      edits: [],
      rules: Array.from({ length: 101 }, () => rule),
      conflictMode: "abort",
    });
    expect(() => readProject(tooManyRules, catalog)).toThrow(/WS ATLAS/);
  });

  it("rejette des edits dupliqués sur le même champ", () => {
    const json = JSON.stringify({
      format: "ws-atlas-unit-project",
      schemaVersion: 1,
      name: "Test",
      sourceSha256: SHA,
      steamBuild: STEAM_BUILD,
      edits: [testEdit, { ...testEdit, value: 200 }],
    });
    expect(() => readProject(json, catalog)).toThrow(/重复改动/);
  });

  it("rejette un edit contenant une propriété inconnue (schéma strict)", () => {
    const json = JSON.stringify({
      format: "ws-atlas-unit-project",
      schemaVersion: 1,
      name: "Test",
      sourceSha256: SHA,
      steamBuild: STEAM_BUILD,
      edits: [{ ...testEdit, injection: true }],
    });
    expect(() => readProject(json, catalog)).toThrow(/WS ATLAS/);
  });
});
