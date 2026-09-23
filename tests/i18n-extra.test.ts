import { describe, expect, it, vi } from "vitest";
import { english } from "@/lib/english";
import { translate } from "@/lib/i18n";

// The real French dictionary covers 100% of the English keys (cf. i18n.test.ts),
// so the fr→en chain fallback only becomes observable with a partial dictionary.
const { partialFrench } = vi.hoisted(() => ({
  partialFrench: { 地图: "Cartes" } as Record<string, string>,
}));
vi.mock("@/lib/french", () => ({ french: partialFrench }));

describe("cache mémoïsé", () => {
  it("renvoie strictement le même résultat sur des appels répétés", () => {
    const text = "已导入工程，共 12 项有效改动。";
    const first = translate(text, "fr");
    const second = translate(text, "fr");
    expect(first).toBe("Project imported with 12 valid changes.");
    expect(second).toBe(first);
  });

  it("distingue les locales dans la clé de cache", () => {
    const zh = translate("规则 3 名称", "zh");
    const en = translate("规则 3 名称", "en");
    expect(zh).toBe("规则 3 名称");
    expect(en).toBe("Rule 3 name");
  });

  it("reste fonctionnel après purge du cache (>2000 entrées)", () => {
    for (let i = 0; i < 2001; i++) expect(translate(`inconnu-${i}`, "en")).toBe(`inconnu-${i}`);
    expect(translate("地图", "en")).toBe("Maps");
    expect(translate("地图", "fr")).toBe("Cartes");
  });
});

describe("repli fr → en", () => {
  it("utilise le dictionnaire anglais quand la clé manque côté français", () => {
    expect(translate("搜索单位", "fr")).toBe("Search units");
    expect(translate("待审核", "fr")).toBe("Pending review");
  });

  it("continue de servir les entrées françaises disponibles", () => {
    expect(translate("地图", "fr")).toBe("Cartes");
  });

  it("rend le texte original quand aucune langue ne connaît la clé", () => {
    expect(translate("Prix : ${x}", "en")).toBe("Prix : ${x}");
    expect(translate("Prix : ${x}", "fr")).toBe("Prix : ${x}");
  });
});

describe("templates multi-slots", () => {
  it("substitue plusieurs slots d'un template avec valeurs traduites", () => {
    expect(translate("移除 地图 前线 的改动", "en")).toBe("Remove the 前线 change for Maps");
  });

  it("gère un template à 6 slots numériques", () => {
    const input = "Mk-II #7 · Blindage：请填写 0–100 之间的有效数值（最小精度 0.5）。";
    expect(translate(input, "en")).toBe(
      "Mk-II #7 · Blindage: Enter a valid value from 0 to 100, in increments of 0.5.",
    );
  });

  it("traduit le préfixe de validation d'export et conserve la suite", () => {
    expect(translate("导出校验未通过，请检查改动： Champ requis", "fr")).toBe(
      "Export validation failed. Check your changes:  Champ requis",
    );
  });

  it("traduit aussi le remainder de validation workbench (cas unit.name + message)", () => {
    const input =
      "导出校验未通过，请检查改动：Mk-II #7 · Blindage：请填写 0–100 之间的有效数值（最小精度 0.5）。";
    expect(translate(input, "en")).toBe(
      "Export validation failed. Check your changes: Mk-II #7 · Blindage: Enter a valid value from 0 to 100, in increments of 0.5.",
    );
    // Même remainder inconnu des dictionnaires : il est rendu tel quel.
    expect(translate("导出校验未通过，请检查改动： X", "en")).toBe(
      "Export validation failed. Check your changes:  X",
    );
  });

  it("laisse le chinois intact, même pour templates et préfixe", () => {
    expect(translate("移除 地图 前线 的改动", "zh")).toBe("移除 地图 前线 的改动");
    expect(translate("导出校验未通过，请检查改动： X", "zh")).toBe(
      "导出校验未通过，请检查改动： X",
    );
  });

  it("normalise les espacements pour retrouver une clé exacte", () => {
    expect(translate("  地图  ", "en")).toBe("Maps");
  });

  it("préserve les placeholders des sources du dictionnaire anglais", () => {
    const templateKeys = Object.keys(english).filter((k) => k.includes("${"));
    expect(templateKeys.length).toBeGreaterThan(10);
    for (const key of templateKeys) {
      const slots = key.match(/\$\{[^{}]+\}/g) ?? [];
      const target = english[key];
      for (const slot of slots) expect(target.includes(slot), `${key} manque ${slot}`).toBe(true);
    }
  });
});
