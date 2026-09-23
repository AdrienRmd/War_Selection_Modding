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

  it("traduit les 4 erreurs de l'API collection en EN et FR", () => {
    const keys = [
      "地图不存在。",
      "暂时无法读取收藏地图。",
      "提交内容不是有效 JSON。",
      "缺少有效修订号，请刷新后重试。",
    ];
    for (const key of keys) {
      expect(translate(key, "en")).not.toBe(key);
      expect(translate(key, "fr")).not.toBe(key);
    }
    expect(translate("地图不存在。", "en")).toBe("Map not found.");
    expect(translate("地图不存在。", "fr")).toBe("Carte introuvable.");
  });

  it("traduit le préfixe ET le remainder d'une erreur de validation d'export", () => {
    const input =
      "导出校验未通过，请检查改动：Mk-II #7 · Blindage：请填写 0–100 之间的有效数值（最小精度 0.5）。";
    expect(translate(input, "fr")).toBe(
      "Échec de la validation d'export. Vérifiez vos modifications : Mk-II #7 · Blindage : saisissez une valeur valide entre 0 et 100, par pas de 0.5.",
    );
  });

  it("garde le chinois inchangé et laisse le repli EN puis texte original", () => {
    expect(translate("地图", "zh")).toBe("地图");
    expect(translate("地图", "en")).toBe("Maps");
    expect(translate("Texto inconnu au bataillon", "fr")).toBe("Texto inconnu au bataillon");
  });
});
