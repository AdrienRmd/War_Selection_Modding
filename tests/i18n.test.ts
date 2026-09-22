import { describe, expect, it } from "vitest";
import { english } from "@/lib/english";
import { french } from "@/lib/french";
import { translate } from "@/lib/i18n";

const placeholderCount = (text: string) => (text.match(/\$\{[^{}]+\}/g) ?? []).length;

describe("dictionnaire français", () => {
  it("couvre toutes les clés du dictionnaire anglais", () => {
    const missing = Object.keys(english).filter((key) => !(key in french));
    expect(missing, `Clés EN absentes du dictionnaire FR : ${missing.join(" | ")}`).toEqual([]);
  });

  it("n'ajoute aucune clé hors du dictionnaire anglais", () => {
    const extra = Object.keys(french).filter((key) => !(key in english));
    expect(extra, `Clés FR inconnues du dictionnaire EN : ${extra.join(" | ")}`).toEqual([]);
  });

  it("conserve les placeholders ${...} de chaque template", () => {
    const broken = Object.keys(english).filter(
      (key) => placeholderCount(key) !== placeholderCount(french[key]),
    );
    expect(broken, `Placeholders altérés pour : ${broken.join(" | ")}`).toEqual([]);
  });

  it("traduit les termes du domaine", () => {
    expect(french["地图"]).toBe("Cartes");
    expect(french["Mod"]).toBe("Mods");
    expect(french["搜索单位"]).toBe("Rechercher des unités");
    expect(french["提交地图"]).toBe("Soumettre une carte");
    expect(french["待审核"]).toBe("En attente de modération");
    expect(french["斯大林格勒"]).toBe("Stalingrad");
  });

  it("traduit via translate(..., 'fr')", () => {
    expect(translate("地图", "fr")).toBe("Cartes");
    expect(translate("搜索单位", "fr")).toBe("Rechercher des unités");
    expect(translate("待审核", "fr")).toBe("En attente de modération");
    expect(translate("已导入工程，共 12 项有效改动。", "fr")).toBe(
      "Projet importé avec 12 modifications valides.",
    );
  });

  it("garde le chinois inchangé et laisse le repli EN puis texte original", () => {
    expect(translate("地图", "zh")).toBe("地图");
    expect(translate("地图", "en")).toBe("Maps");
    expect(translate("Texto inconnu au bataillon", "fr")).toBe("Texto inconnu au bataillon");
  });
});
