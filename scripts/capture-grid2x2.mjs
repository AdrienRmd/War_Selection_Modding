#!/usr/bin/env node
/** Captures + audit « 2×2 partout » (mission grilles 2 colonnes mobiles).
 *
 *  Usage : QA_SESSION=... node scripts/capture-grid2x2.mjs <origin> <outdir> <tag>
 *    origin : http://localhost:5173 (dev uniquement — jamais la prod)
 *    tag    : avant | apres
 *
 *  Pour chaque page : capture pleine page 375×812 (mobile, /workbench 360),
 *  audit scrollWidth (débordement horizontal) et nombre de colonnes réellement
 *  calculé des grilles ciblées. /account passe par le cookie de session QA
 *  local (compte créé via /api/auth/signup). L'API cartes communautaires est
 *  mockée (3 cartes) car la base dev locale est vide — la grille n'apparaît
 *  qu'avec des cartes. Sur /maps/stalingrad, l'onglet « Économie » est
 *  ouvert pour exposer .economy-metrics.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const origin = process.argv[2];
const outdir = process.argv[3];
const tag = process.argv[4] || "capture";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Tests are restricted to a local, non-production origin.");
mkdirSync(outdir, { recursive: true });

const SESSION = process.env.QA_SESSION || "";

const AUDITS = [
  ["community-grid", ".community-grid"],
  ["explore-grid", ".explore-grid"],
  ["portal-grid", ".portal-grid"],
  ["hub-grid", ".hub-grid"],
  ["stat-cards", ".stat-cards"],
  ["mod-grid", ".mod-grid"],
  ["economy-metrics", ".economy-metrics"],
  ["unit-list", ".unit-list"],
  ["hero-grid", ".hero-grid"],
  ["collection-grid", ".collection-grid"],
];

const fakeMaps = [1, 2, 3].map((i) => ({
  id: `demo-${i}`,
  title: `Carte démo ${i} — fortifications étendues`,
  summary:
    "Scénario QA : deux camps symétriques, ponts destructibles et économie ralentie pour les tests de grille mobile sur deux colonnes compactes.",
  category: "据点",
  game_version: "v1.9.6",
  players: "8",
  author: "QA Grid",
  author_verified: i === 1,
  has_cover: false,
  test_status: "tested",
  test_set_by: i === 2 ? "admin" : "author",
  status: "approved",
  created_at: "2026-11-01T00:00:00Z",
}));

const pages = [
  ["home", "/", 375, null],
  ["maps", "/maps", 375, null],
  ["stalingrad-economy", "/maps/stalingrad", 375, async (page) => {
    await page.getByRole("tab", { name: "Économie et fin de partie" }).click();
    await page.waitForTimeout(400);
  }],
  ["mods", "/mods", 375, null],
  ["stats", "/season-statistics", 375, null],
  ["account", "/account", 375, null],
  ["workbench", "/workbench", 360, null],
];

const browser = await chromium.launch();
try {
  for (const [name, path, width, action] of pages) {
    const context = await browser.newContext({
      viewport: { width, height: 812 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
      locale: "fr-FR",
    });
    await context.addCookies([
      { name: "atlas_locale", url: origin, value: "fr" },
      ...(SESSION ? [{ name: "atlas_session", url: origin, value: SESSION }] : []),
    ]);
    // Base dev vide : cartes communautaires mockées pour exposer la grille.
    await context.route("**/api/atlas/maps?offset=0", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: fakeMaps, hasMore: false }),
      }),
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).split("\n")[0]));
    try {
      await page.goto(origin + path, { waitUntil: "load", timeout: 30000 });
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(900);
      if (action) await action(page);
      const audit = await page.evaluate((selectors) => {
        const out = {
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          grids: {},
        };
        for (const [key, sel] of selectors) {
          const el = document.querySelector(sel);
          if (!el) {
            out.grids[key] = null;
            continue;
          }
          const cs = getComputedStyle(el);
          out.grids[key] = {
            cols: cs.gridTemplateColumns ? cs.gridTemplateColumns.split(" ").length : 0,
            display: cs.display,
            children: el.children.length,
          };
        }
        return out;
      }, AUDITS);
      await page.screenshot({ path: `${outdir}/${tag}-${name}-${width}.png`, fullPage: true });
      console.log(
        `OK ${tag}-${name}-${width} scrollW=${audit.scrollWidth}/${audit.innerWidth} ` +
          Object.entries(audit.grids)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}:${v.cols}col/${v.children}e`)
            .join(" ") +
          (errors.length ? ` JS_ERRORS:${errors.length}` : ""),
      );
    } catch (e) {
      console.log(`FAIL ${tag}-${name}-${width}: ${e.message.split("\n")[0]}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
