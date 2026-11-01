import { describe, expect, it } from "vitest";
import { catalogUnitName } from "@/lib/workbench";

// HOTFIX i18n 01/11/2026 — avant ce correctif, l'atelier mods complet
// (/workbench) affichait les noms d'unités en anglais pour la locale FR :
// `locale !== "zh" ? u.nameEn : u.name` ne lisait jamais nameFr (absent du
// catalogue — ajouté par scripts/add-unit-catalog-fr.mjs, 453/453 unités).
// catalogUnitName est le point de passage unique pour TOUT affichage de nom
// d'unité du catalogue atelier (mod-workbench.tsx et simples vues dérivées).

describe("catalogUnitName", () => {
  const fixture = { name: "仓库", nameEn: "Warehouse", nameFr: "Entrepôt" };

  it("fr → nameFr officiel", () => {
    expect(catalogUnitName(fixture, "fr")).toBe("Entrepôt");
  });

  it("en → nameEn", () => {
    expect(catalogUnitName(fixture, "en")).toBe("Warehouse");
  });

  it("zh → name (texte source)", () => {
    expect(catalogUnitName(fixture, "zh")).toBe("仓库");
  });

  it("fr sans nameFr → repli nameEn (unités non encore fusionnées)", () => {
    expect(catalogUnitName({ name: "工人", nameEn: "Worker" }, "fr")).toBe("Worker");
  });

  it("jamais de chaîne vide : nameEn absent → nom zh", () => {
    expect(catalogUnitName({ name: "祭坛", nameEn: "" }, "en")).toBe("祭坛");
    expect(catalogUnitName({ name: "祭坛", nameEn: "" }, "fr")).toBe("祭坛");
  });

  it("couverture réelle du catalogue public : nameFr présent partout", async () => {
    // Preuve data : le catalogue servi (public/unit-catalog.json.gz) porte
    // bien nameFr sur 100 % des unités — c'est la donnée qui manquait.
    // Distinction : la plupart des noms fr diffèrent de l'anglais, mais les
    // homonymes légitimes (ex. « Temple »/« Temple ») ne sont pas des replis.
    const { readFileSync } = await import("node:fs");
    const { gunzipSync } = await import("node:zlib");
    const raw = JSON.parse(
      gunzipSync(readFileSync("public/unit-catalog.json.gz")).toString("utf8"),
    );
    const units = raw.units as Array<{
      name: string;
      nameEn: string;
      nameFr?: string;
    }>;
    expect(units.length).toBeGreaterThan(400);
    let distinct = 0;
    for (const unit of units) {
      expect(unit.nameFr, `nameFr manquant pour ${unit.name}`).toBeTruthy();
      if (unit.nameFr !== unit.nameEn) distinct += 1;
      expect([unit.nameFr, unit.nameEn, unit.name]).toContain(
        catalogUnitName(unit, "fr"),
      );
    }
    expect(distinct / units.length).toBeGreaterThan(0.85);
  });
});
