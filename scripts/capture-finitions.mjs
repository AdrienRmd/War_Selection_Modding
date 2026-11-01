#!/usr/bin/env node
/** Captures « finitions » (mission 08/11) — avant/après par chantier.
 *  Usage : node scripts/capture-finitions.mjs <origin> <outdir> <tag> [scenes]
 *    scenes : nav390,footer,footer375,units375,researches375,maps,maps375,
 *             mods,fiche,fiche375 (défaut : toutes, sauf fiche* qui prend un
 *             argument map id supplémentaire via MAP=env)
 *  Locale forcée fr (cookie), pleine page 1440×900 / 375×812 selon scène. */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const origin = process.argv[2];
const outdir = process.argv[3];
const tag = process.argv[4] || "capture";
const only = process.argv[5] ? process.argv[5].split(",") : null;
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("origin local uniquement (jamais la prod pour les captures après).");
mkdirSync(outdir, { recursive: true });
const MAP = process.env.MAP || "map-00200088";

const browser = await chromium.launch();

async function shot(name, viewport, url, setup) {
  if (only && !only.includes(name.split("-")[0])) return;
  const page = await browser.newPage({ viewport, hasTouch: true });
  await page.context().addCookies([
    { name: "atlas_locale", value: "fr", url: origin },
  ]);
  await page.goto(origin + url, { waitUntil: "networkidle" });
  if (setup) await setup(page);
  await page.screenshot({ path: `${outdir}/${tag}-${name}.png`, fullPage: false });
  console.log("CAPTURE", `${tag}-${name}.png`);
  await page.close();
}

// Chantier 1 — panneau Mods ouvert à 390/375 (avant : déborde à droite).
await shot("nav390-mods", { width: 390, height: 844 }, "/", async (page) => {
  await page.locator(".nav-menu-trigger", { hasText: "Mods" }).tap();
  await page.locator(".nav-menu-panel").first().waitFor({ state: "visible" });
});
// Chantier 1 — footer desktop + 375 (liens soulignés ? Discord ?).
await shot("footer-desktop", { width: 1440, height: 900 }, "/", async (page) => {
  await page.locator(".site-footer").scrollIntoViewIfNeeded();
});
await shot("footer375", { width: 375, height: 812 }, "/", async (page) => {
  await page.locator(".site-footer").scrollIntoViewIfNeeded();
});
// Chantier 2 — toolbar /units et /researches à 375.
await shot("units375", { width: 375, height: 812 }, "/units", async (page) => {
  await page.locator(".units-toolbar").scrollIntoViewIfNeeded();
});
await shot("researches375", { width: 375, height: 812 }, "/researches", async (page) => {
  await page.locator(".units-toolbar").scrollIntoViewIfNeeded();
});
// Chantiers 3/5/6 — /maps desktop + 375.
await shot("maps-toolbar", { width: 1440, height: 900 }, "/maps", async (page) => {
  await page.locator(".collection-toolbar").scrollIntoViewIfNeeded();
});
await shot("maps-toolbar375", { width: 375, height: 812 }, "/maps", async (page) => {
  await page.locator(".collection-toolbar").scrollIntoViewIfNeeded();
});
// Chantier 6 — /mods haut de page.
await shot("mods-top", { width: 1440, height: 900 }, "/mods");
// Chantiers 4/7/8 — fiche carte.
await shot("fiche", { width: 1440, height: 900 }, `/maps/${MAP}`);
await shot("fiche375", { width: 375, height: 812 }, `/maps/${MAP}`);

await browser.close();
