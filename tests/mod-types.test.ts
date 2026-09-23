import { describe, expect, it } from "vitest";
import { emptyMod, kindLabels, publicationLabels, usageLabels, usageStates } from "@/lib/mod-types";

const bilingualTables: Array<[string, Record<string, [string, string]>]> = [
  ["usageLabels", usageLabels],
  ["kindLabels", kindLabels],
  ["publicationLabels", publicationLabels],
];

describe("tables de libellés des mods", () => {
  it("aligne usageLabels sur usageStates, dans le même ordre et sans doublon d'id", () => {
    expect(Object.keys(usageLabels)).toEqual([...usageStates]);
    expect(new Set(usageStates).size).toBe(usageStates.length);
  });

  it("couvre exactement les ids attendus pour kind et publication", () => {
    expect(Object.keys(kindLabels)).toEqual(["gameplay", "visual", "bundle", "tool", "tutorial"]);
    expect(Object.keys(publicationLabels)).toEqual([
      "all",
      "pending",
      "approved",
      "rejected",
      "withdrawn",
    ]);
  });

  it("fournit deux langues non vides et distinctes pour chaque entrée", () => {
    for (const [name, table] of bilingualTables)
      for (const [id, [zh, en]] of Object.entries(table)) {
        expect(zh.trim(), `${name}.${id} zh`).not.toBe("");
        expect(en.trim(), `${name}.${id} en`).not.toBe("");
        expect(zh, `${name}.${id} : zh === en`).not.toBe(en);
      }
  });

  it("n'a aucun libellé dupliqué au sein d'une même langue", () => {
    for (const [name, table] of bilingualTables) {
      for (const index of [0, 1] as const) {
        const labels = Object.values(table).map((pair) => pair[index]);
        expect(new Set(labels).size, `${name} colonne ${index}`).toBe(labels.length);
      }
    }
  });

  it("les valeurs par défaut d'emptyMod pointent vers des ids existants", () => {
    expect(usageStates).toContain(emptyMod.usage_status);
    expect(Object.keys(kindLabels)).toContain(emptyMod.kind);
  });

  it("range chaque id de publication dans une langue cohérente avec son rôle", () => {
    expect(publicationLabels.all[1]).toBe("All");
    expect(publicationLabels.pending[1]).toBe("Pending");
    expect(publicationLabels.approved[1]).toBe("Published");
    expect(publicationLabels.rejected[1]).toBe("Changes requested");
    expect(publicationLabels.withdrawn[1]).toBe("Withdrawn");
  });
});
