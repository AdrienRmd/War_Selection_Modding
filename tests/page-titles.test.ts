import { describe, expect, it } from "vitest";
import { english } from "@/lib/english";
import { french } from "@/lib/french";
import { translate } from "@/lib/i18n";
import { localizePageMeta, pageRoutes, resolvePageMeta } from "@/lib/page-titles";

// Titres localisés : chaque route du registre doit avoir un <title> (et une
// meta description quand elle en expose une) réellement traduit en EN et FR —
// aucune clé zh brute ne doit fuiter dans le rendu d'une locale non chinoise.

describe("registre des titres lib/page-titles", () => {
  it("couvre les 8 pages principales + pages secondaires visibles", () => {
    for (const path of [
      "/",
      "/units",
      "/researches",
      "/modding",
      "/maps",
      "/mods",
      "/workbench",
      "/workbench/simple",
      "/maps/stalingrad",
      "/maps/collection/manage",
      "/reference",
      "/guidelines",
      "/signin",
      "/signup",
      "/account",
      "/submissions",
      "/admin",
      "/submit",
      "/submit/mod",
      "/terms",
      "/privacy",
      "/legal",
    ]) {
      expect(resolvePageMeta(path), `route sans titre : ${path}`).toBeDefined();
    }
  });

  it("matche les segments dynamiques (maps/mods) vers la bonne page", () => {
    expect(resolvePageMeta("/maps/une-carte")?.title).toBe("玩家地图档案 | WS ATLAS");
    expect(resolvePageMeta("/maps/une-carte/edit")?.title).toBe("编辑地图 | WS ATLAS");
    expect(resolvePageMeta("/maps/stalingrad")?.title).toBe("斯大林格勒 · 地图档案 | WS ATLAS");
    expect(resolvePageMeta("/maps/collection/manage")?.title).toBe("收藏地图管理 | WS ATLAS");
    expect(resolvePageMeta("/mods/un-mod")?.title).toBe("Mod 档案 | WS ATLAS");
    expect(resolvePageMeta("/mods/un-mod/edit")?.title).toBe("编辑 Mod | WS ATLAS");
    expect(resolvePageMeta("/workbench/simple")?.title).toBe("简易 Mod 工作台 | WS ATLAS");
  });

  it("ignore les query strings et les routes inconnues", () => {
    expect(resolvePageMeta("/units?unit=1/depot")?.title).toBe("单位档案 | WS ATLAS");
    expect(resolvePageMeta("/researches?research=12")?.title).toBe("科技档案 | WS ATLAS");
    expect(resolvePageMeta("/api/health")).toBeUndefined();
    expect(resolvePageMeta("/nimporte/quoi")).toBeUndefined();
    expect(resolvePageMeta(null)).toBeUndefined();
  });

  it("traduit chaque titre en EN et FR (aucune clé zh brute en fr/en)", () => {
    for (const [key, route] of Object.entries(pageRoutes)) {
      const en = translate(route.meta.title, "en");
      expect(en, `titre EN brut pour ${key}`).not.toBe(route.meta.title);
      const fr = translate(route.meta.title, "fr");
      expect(fr, `titre FR brut pour ${key}`).not.toBe(route.meta.title);
    }
  });

  it("traduit chaque meta description en EN et FR", () => {
    const described = Object.entries(pageRoutes).filter(([, r]) => r.meta.description);
    expect(described.map(([k]) => k).sort()).toEqual(["home", "workbench", "workbenchSimple"]);
    for (const [key, route] of described) {
      expect(translate(route.meta.description!, "en"), `desc EN brute pour ${key}`).not.toBe(
        route.meta.description,
      );
      expect(translate(route.meta.description!, "fr"), `desc FR brute pour ${key}`).not.toBe(
        route.meta.description,
      );
    }
  });

  it("zh reste la langue source (identité)", () => {
    const meta = pageRoutes.units.meta;
    expect(localizePageMeta(meta, "zh").title).toBe("单位档案 | WS ATLAS");
    expect(localizePageMeta(meta, "en").title).toBe("Unit Archive | WS ATLAS");
    expect(localizePageMeta(meta, "fr").title).toBe("Archives des unités | WS ATLAS");
  });

  it("toutes les clés du registre existent dans les dictionnaires en/fr", () => {
    const keys = Object.values(pageRoutes).flatMap((r) =>
      r.meta.description ? [r.meta.title, r.meta.description] : [r.meta.title],
    );
    expect(keys.filter((k) => !(k in english))).toEqual([]);
    expect(keys.filter((k) => !(k in french))).toEqual([]);
  });

  it("conserve la marque « WS ATLAS » dans chaque titre localisé", () => {
    for (const [key, route] of Object.entries(pageRoutes)) {
      for (const locale of ["en", "fr"] as const) {
        const title = translate(route.meta.title, locale);
        expect(
          /WS ATLAS/.test(title),
          `titre ${locale} sans marque pour ${key} : ${title}`,
        ).toBe(true);
      }
    }
  });
});
