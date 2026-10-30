import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LOCALE, negotiateLocale, tagToLocale } from "@/lib/locale-negotiate";

// D2 (décision orchestrée) : le français est la langue d'affichage par défaut
// du site. Sans cookie atlas_locale, la locale se négocie depuis
// Accept-Language : fr → fr, en → en, zh/cn → zh ; navigateur sans préférence
// claire (langues non soutenues, « * », en-tête absent) → fr.

describe("tagToLocale", () => {
  it("mappe les variantes régionales et les séparateurs", () => {
    expect(tagToLocale("fr")).toBe("fr");
    expect(tagToLocale("fr-CA")).toBe("fr");
    expect(tagToLocale("FR_be")).toBe("fr");
    expect(tagToLocale("en")).toBe("en");
    expect(tagToLocale("en-US")).toBe("en");
    expect(tagToLocale("zh")).toBe("zh");
    expect(tagToLocale("zh-CN")).toBe("zh");
    expect(tagToLocale("zh-Hant-TW")).toBe("zh");
    expect(tagToLocale("CN")).toBe("zh");
  });

  it("ignore les langues non soutenues", () => {
    expect(tagToLocale("de")).toBeUndefined();
    expect(tagToLocale("es-ES")).toBeUndefined();
    expect(tagToLocale("ja")).toBeUndefined();
    expect(tagToLocale("*")).toBeUndefined();
    expect(tagToLocale("")).toBeUndefined();
  });
});

describe("negotiateLocale — défaut D2", () => {
  it("retourne fr sans en-tête ou en-tête vide", () => {
    expect(DEFAULT_LOCALE).toBe("fr");
    expect(negotiateLocale(null)).toBe("fr");
    expect(negotiateLocale(undefined)).toBe("fr");
    expect(negotiateLocale("")).toBe("fr");
  });

  it("retourne fr pour un navigateur francophone", () => {
    expect(negotiateLocale("fr-FR,fr;q=0.9,en;q=0.8")).toBe("fr");
    expect(negotiateLocale("fr-CA")).toBe("fr");
  });

  it("retourne zh pour un navigateur chinois, même sans cookie", () => {
    expect(negotiateLocale("zh-CN,zh;q=0.9,en;q=0.8")).toBe("zh");
    expect(negotiateLocale("zh")).toBe("zh");
    expect(negotiateLocale("cn")).toBe("zh");
  });

  it("retourne en pour un navigateur anglais explicite", () => {
    expect(negotiateLocale("en-US,en;q=0.9")).toBe("en");
    expect(negotiateLocale("en-GB")).toBe("en");
  });

  it("retourne fr pour un navigateur sans préférence claire (D2)", () => {
    expect(negotiateLocale("de-DE,de;q=0.9")).toBe("fr");
    expect(negotiateLocale("ja-JP")).toBe("fr");
    expect(negotiateLocale("*")).toBe("fr");
  });

  it("une préférence EN explicite (même à faible q) vaut EN", () => {
    expect(negotiateLocale("de-DE,de;q=0.9,en-US;q=0.4")).toBe("en");
    expect(negotiateLocale("de;q=1.0,en;q=0.5")).toBe("en");
  });

  it("respecte l'ordre de préférence q", () => {
    expect(negotiateLocale("en;q=0.3,zh-CN;q=0.8")).toBe("zh");
    expect(negotiateLocale("de;q=1.0,en;q=0.5")).toBe("en");
    expect(negotiateLocale("fr;q=0.4,en;q=0.9,zh;q=0.2")).toBe("en");
  });

  it("tolère les q à zéro et les formats dégradés", () => {
    expect(negotiateLocale("de;q=1.0,en;q=0")).toBe("fr");
    expect(negotiateLocale("garbage")).toBe("fr");
    expect(negotiateLocale("fr-FR;q=notanumber,en")).toBe("fr");
    expect(negotiateLocale("  zh-CN ; q=0.9 ")).toBe("zh");
  });
});

// requestLocale (lib/page-metadata) réutilise exactement cette négociation :
// cookie > Accept-Language > fr. On vérifie la priorité complète en mockant
// next/headers, sans démarrer de serveur.
const mocks = vi.hoisted(() => ({
  cookieValue: undefined as string | undefined | null,
  headerValue: null as string | null | undefined,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "atlas_locale" ? { value: mocks.cookieValue } : undefined) }),
  headers: async () => ({ get: (name: string) => (name === "accept-language" ? mocks.headerValue : null) }),
}));

describe("requestLocale — priorité cookie > Accept-Language > fr", () => {
  beforeEach(() => {
    mocks.cookieValue = undefined;
    mocks.headerValue = undefined;
  });

  it("le cookie atlas_locale gagne sur l'en-tête navigateur", async () => {
    const { requestLocale } = await import("@/lib/page-metadata");
    mocks.cookieValue = "en";
    mocks.headerValue = "zh-CN,zh;q=0.9";
    expect(await requestLocale()).toBe("en");
    mocks.cookieValue = "zh";
    mocks.headerValue = "fr-FR,fr;q=0.9";
    expect(await requestLocale()).toBe("zh");
  });

  it("sans cookie : Accept-Language décide", async () => {
    const { requestLocale } = await import("@/lib/page-metadata");
    mocks.headerValue = "zh-CN,zh;q=0.9,en;q=0.8";
    expect(await requestLocale()).toBe("zh");
    mocks.headerValue = "en-US,en;q=0.9";
    expect(await requestLocale()).toBe("en");
    mocks.headerValue = "fr-FR,fr;q=0.9";
    expect(await requestLocale()).toBe("fr");
  });

  it("sans cookie ni en-tête clair : fr (D2), SSR inclus", async () => {
    const { requestLocale } = await import("@/lib/page-metadata");
    expect(await requestLocale()).toBe("fr");
    mocks.headerValue = "de-DE,de;q=0.9";
    expect(await requestLocale()).toBe("fr");
    mocks.headerValue = "*";
    expect(await requestLocale()).toBe("fr");
  });

  it("ignore un cookie invalide et retombe sur la négociation", async () => {
    const { requestLocale } = await import("@/lib/page-metadata");
    mocks.cookieValue = "de";
    mocks.headerValue = "zh-CN";
    expect(await requestLocale()).toBe("zh");
  });
});
