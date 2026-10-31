import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { translate } from "@/lib/i18n";
import { english } from "@/lib/english";
import { unitsIndex } from "@/lib/units";
import { researchesIndex } from "@/lib/researches";
import { moddingMeta } from "@/lib/modding";
import {
  datasetImageUrl,
  exploreStats,
  formatExploreDate,
  localizedExploreName,
  pickSampleUnits,
} from "@/lib/explore";

// Vitrine « Explorer le jeu » de l'accueil (V3-P1) : les compteurs montrés
// doivent TOUJOURS dériver des index réels (jamais de littéral 453/156/9041)
// et les mini-vignettes rester déterministes, avec image du dataset.

const REAL_COUNTS = new Set(["453", "156", "9041", "9063"]);

describe("exploreStats — compteurs dérivés des sources, jamais codés en dur", () => {
  it("reflète les longueurs des index embarqués réels", () => {
    const stats = exploreStats({
      units: unitsIndex.units,
      researches: researchesIndex.researches,
      parameterNodes: moddingMeta.pathCount,
    });
    expect(stats.unitsCount).toBe(unitsIndex.units.length);
    expect(stats.researchesCount).toBe(researchesIndex.researches.length);
    expect(stats.parameterNodes).toBe(moddingMeta.pathCount);
  });

  it("suit la source quand elle change (aucune valeur figée)", () => {
    const stats = exploreStats({
      units: [{}, {}, {}],
      researches: [{}],
      parameterNodes: 42,
    });
    expect(stats).toEqual({ unitsCount: 3, researchesCount: 1, parameterNodes: 42 });
  });

  it("ne contient aucun compteur littéral dans le code de la vitrine", () => {
    for (const file of ["lib/explore.ts", "components/game-explore.tsx", "app/page.tsx"]) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      const forbidden = [...source.matchAll(/\b\d{3,5}\b/g)]
        .map((m) => m[0])
        .filter((n) => REAL_COUNTS.has(n));
      expect(forbidden, `${file} contient des compteurs codés en dur : ${forbidden}`).toEqual([]);
    }
  });
});

describe("pickSampleUnits — vignettes déterministes", () => {
  const units = unitsIndex.units;

  it("renvoie au plus 3 unités avec image, de groupes (nations/factions) distincts", () => {
    const samples = pickSampleUnits(units, "fr");
    expect(samples.length).toBeGreaterThan(0);
    expect(samples.length).toBeLessThanOrEqual(3);
    for (const sample of samples) {
      expect(sample.image).toBeTruthy();
      expect(sample.id).toBeTruthy();
      expect(datasetImageUrl(sample.image)).toMatch(/^\/wus-data\/content\/images\//);
    }
  });

  it("est stable entre deux appels (déterminisme, pas de hasard)", () => {
    expect(pickSampleUnits(units, "en")).toEqual(pickSampleUnits(units, "en"));
  });

  it("respecte l'ordre du dataset : ignorer une unité décale la sélection", () => {
    const full = pickSampleUnits(units, "en");
    expect(full.length).toBe(3);
    const first = units.find((u) => u.image);
    expect(full[0]!.id).toBe(first!.id);
  });

  it("saute les unités sans image et boucle sur des entrées synthétiques", () => {
    const synthetic = [
      { id: "a", faction: "1", nationId: 1 }, // pas d'image : ignorée
      { id: "b", faction: "1", nationId: 1, image: "unit/b.png", names: { fr: "B français" } },
      { id: "c", faction: "1", nationId: 1, image: "unit/c.png" }, // même nation : ignorée
      { id: "d", faction: "9", image: "unit/d.png", names: { en: "D english" } },
    ] as const;
    const samples = pickSampleUnits(synthetic, "fr");
    expect(samples.map((s) => s.id)).toEqual(["b", "d"]);
    expect(samples[0]!.name).toBe("B français"); // fr → fr
    expect(samples[1]!.name).toBe("D english"); // fr absent → repli en
  });

  it("localise les noms officiels (zh → cn puis tw, repli en)", () => {
    expect(localizedExploreName({ cn: "角斗场", tw: "戰鬥坑", en: "Fight pit" }, "zh")).toBe(
      "角斗场",
    );
    expect(localizedExploreName({ tw: "戰鬥坑", en: "Fight pit" }, "zh")).toBe("戰鬥坑");
    expect(localizedExploreName({ en: "Fight pit" }, "fr")).toBe("Fight pit");
    expect(localizedExploreName(undefined, "fr")).toBeUndefined();
  });

  it("replie le nom sur l'id quand aucune localisation n'existe", () => {
    const samples = pickSampleUnits([{ id: "x/y", faction: "7", image: "unit/x.png" }], "fr");
    expect(samples[0]!.name).toBe("x/y");
  });
});

describe("formatExploreDate — badge « données mises à jour le »", () => {
  it("formate la date publiée par langue (même pattern que /units)", () => {
    const iso = "2026-10-30T13:26:05.643Z";
    expect(formatExploreDate(iso, "fr")).toContain("octobre");
    expect(formatExploreDate(iso, "en")).toContain("October");
    expect(formatExploreDate(iso, "zh")).toContain("10月");
  });

  it("renvoie la chaîne brute si la date est invalide", () => {
    expect(formatExploreDate("not-a-date", "fr")).toBe("not-a-date");
  });
});

describe("i18n de la vitrine — pièces du badge et compteurs en 3 langues", () => {
  it("traduit le préfixe « 数据更新于 » et les états du manifeste", () => {
    for (const [locale, expected] of [
      ["en", "Data updated"],
      ["fr", "Données mises à jour le"],
    ] as const) {
      expect(translate("数据更新于", locale)).toBe(expected);
      expect(translate("正在读取数据版本…", locale)).not.toBe("正在读取数据版本…");
      expect(translate("数据版本暂时不可用", locale)).not.toBe("数据版本暂时不可用");
    }
  });

  it("traduit les compteurs des trois cartes de données", () => {
    expect(translate("共 453 个单位", "en")).toBe("453 units");
    expect(translate("共 453 个单位", "fr")).toBe("453 unités");
    expect(translate("共 156 项研究", "en")).toBe("156 researches");
    expect(translate("共 156 项研究", "fr")).toBe("156 recherches");
    expect(translate("共 9041 个参数节点", "en")).toBe("9041 parameter nodes");
    expect(translate("共 9041 个参数节点", "fr")).toBe("9041 nœuds de paramètres");
  });

  it("traduit les titres de section et le lien vers le mode simple", () => {
    for (const key of ["探索游戏数据", "简易模式（三步导出）", "ARCHIVE / 01", "WORKSHOP / 04"]) {
      // fr doit toujours différer de la clé zh ; en peut être identique
      // (surtitres propres, ex. « LIBRARY / 01 ») mais doit être déclaré.
      expect(translate(key, "fr"), `clé non traduite en fr : ${key}`).not.toBe(key);
      expect(english[key], `clé absente du dictionnaire EN : ${key}`).toBeDefined();
    }
  });
});
