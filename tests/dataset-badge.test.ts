import { describe, expect, it } from "vitest";
import { datasetBadgeState } from "@/components/dataset-badge";

// Mission finitions 08/11 — état initial NEUTRE du badge version dataset :
// « Lecture de la version du jeu de données… » restait figé sur les pages où
// le manifeste /wus-data ne répond jamais. Le badge doit rester masqué tant
// qu'il n'y a pas de donnée : uniquement version réelle ou erreur discrète.
describe("datasetBadgeState — badge version neutre tant que pas de donnée", () => {
  it("état initial (manifeste non chargé, pas d'erreur) → masqué", () => {
    expect(datasetBadgeState(null, false)).toBe("hidden");
  });

  it("manifeste chargé → version affichée", () => {
    expect(datasetBadgeState({ publishedAt: "2026-11-01T02:02:24Z" }, false)).toBe("version");
  });

  it("manifeste sans publishedAt reste une donnée → version (formatage en repli)", () => {
    expect(datasetBadgeState({ publishedAt: undefined }, false)).toBe("version");
  });

  it("échec du manifeste → erreur discrète, jamais d'attente figée", () => {
    expect(datasetBadgeState(null, true)).toBe("error");
    expect(datasetBadgeState({ publishedAt: "2026-11-01T02:02:24Z" }, true)).toBe("error");
  });
});
