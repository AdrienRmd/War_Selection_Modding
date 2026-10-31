import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Sitemap & robots (V3-P1) : les routes publiques des sections de données
// livrées le 30/10 (/units, /researches, /modding, /workbench, /workbench/
// simple) doivent être déclarées aux moteurs, sans jamais exposer les routes
// privées bloquées par robots.txt.

const sitemap = readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8");
const robots = readFileSync(new URL("../public/robots.txt", import.meta.url), "utf8");
const locs = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]!);

describe("sitemap.xml — vitrine des sections de données (V3-P1)", () => {
  it("déclare les nouvelles routes publiques", () => {
    for (const route of [
      "https://ws.aremond.ovh/units",
      "https://ws.aremond.ovh/researches",
      "https://ws.aremond.ovh/modding",
      "https://ws.aremond.ovh/workbench",
      "https://ws.aremond.ovh/workbench/simple",
      "https://ws.aremond.ovh/players",
      "https://ws.aremond.ovh/season-statistics",
    ]) {
      expect(locs, `${route} absente du sitemap`).toContain(route);
    }
  });

  it("garde les routes historiques (accueil, cartes, mods, légales)", () => {
    for (const route of [
      "https://ws.aremond.ovh/",
      "https://ws.aremond.ovh/maps",
      "https://ws.aremond.ovh/maps/stalingrad",
      "https://ws.aremond.ovh/mods",
      "https://ws.aremond.ovh/reference",
      "https://ws.aremond.ovh/guidelines",
      "https://ws.aremond.ovh/legal",
      "https://ws.aremond.ovh/privacy",
      "https://ws.aremond.ovh/terms",
    ]) {
      expect(locs).toContain(route);
    }
  });

  it("n'expose aucune route privée ou bloquée par robots.txt", () => {
    const disallowed = [...robots.matchAll(/Disallow: (\S+)/g)].map((m) => m[1]!);
    for (const loc of locs) {
      const path = new URL(loc).pathname;
      for (const rule of disallowed) {
        expect(
          path === rule || path.startsWith(`${rule}/`),
          `${loc} est déclarée alors que robots.txt bloque ${rule}`,
        ).toBe(false);
      }
    }
    expect(disallowed).toContain("/admin");
    expect(disallowed).toContain("/api");
  });

  it("n'utilise que des URL absolues du domaine public, sans doublon", () => {
    expect(locs.length).toBeGreaterThan(0);
    expect(new Set(locs).size).toBe(locs.length);
    for (const loc of locs) {
      expect(loc.startsWith("https://ws.aremond.ovh/")).toBe(true);
    }
  });

  it("chaque entrée porte un lastmod ISO (aaaa-mm-jj)", () => {
    const entries = sitemap.split("<url>").slice(1);
    expect(entries.length).toBe(locs.length);
    for (const entry of entries) {
      expect(entry).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
    }
  });
});

describe("robots.txt — cohérence avec le sitemap", () => {
  it("autorise le crawl global et référence le sitemap", () => {
    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Sitemap: https://ws.aremond.ovh/sitemap.xml");
  });

  it("ne bloque aucune route déclarée dans le sitemap", () => {
    const disallowed = [...robots.matchAll(/Disallow: (\S+)/g)].map((m) => m[1]!);
    for (const loc of locs) {
      const path = new URL(loc).pathname;
      for (const rule of disallowed) {
        expect(path === rule || path.startsWith(`${rule}/`)).toBe(false);
      }
    }
  });
});
