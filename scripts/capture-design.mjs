#!/usr/bin/env node
/** Captures d'écran de validation design (vagues « Field Archive »).
 *
 *  Usage : node scripts/capture-design.mjs <origin> <outdir> <tag> [pages]
 *    origin : http://localhost:5173 (dev) ou https://ws.aremond.ovh (prod,
 *             captures « avant »)
 *    tag    : avant | apres-v1 | apres-v2 | apres-v3
 *    pages  : liste facultative (défaut : toutes), ex. home,units,replay-result
 *
 *  Sortie : <outdir>/<tag>-<page>-d.png (1440×900, pleine page) et
 *  <tag>-<page>-m.png (375×812, pleine page). Locale forcée fr (cookie),
 *  API officielle des replays mockée sur la fixture fraîche du 31/10 pour un
 *  rendu déterministe de la page résultat, /wus-data resservi depuis le
 *  dataset publié quand l'origine ne l'expose pas (dev).
 */
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";

const origin = process.argv[2];
const outdir = process.argv[3];
const tag = process.argv[4] || "capture";
const only = process.argv[5] ? process.argv[5].split(",") : null;
if (!/^https?:\/\/[\w.:-]+$/.test(origin)) throw new Error("origin invalide");
mkdirSync(outdir, { recursive: true });

const FIXTURE = "/home/ubuntu/War-Selection/datasets/replays/wsva-Jd894wx6so9.json";
const DATASET = "/home/ubuntu/War-Selection/datasets/served";

const MIME = {
  json: "application/json",
  png: "image/png",
  webp: "image/webp",
  jpg: "image/jpeg",
  gz: "application/gzip",
};

async function mockRoutes(context) {
  // API officielle : fixture déterministe pour la page résultat.
  await context.route("**/games-api.warselect.io/getByReplay*", (route) => {
    const code = new URL(route.request().url()).searchParams.get("code") ?? "";
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: code === "Jd894wx6so9" ? readFileSync(FIXTURE, "utf8") : JSON.stringify({ error: 2 }),
    });
  });
  await context.route("**/api/replay/recent", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          { code: "Jd894wx6so9", teamSize: 8, mvpName: "Vzgo", modeKey: "replayMatchTypeTeamMatch" },
        ],
      }),
    }),
  );
  // /wus-data : servi par Apache en prod ; en dev, relecture disque.
  await context.route("**/wus-data/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/wus-data\//, "");
    const ext = path.split(".").pop();
    try {
      return route.fulfill({
        status: 200,
        contentType: MIME[ext] ?? "application/octet-stream",
        body: readFileSync(`${DATASET}/${path}`),
      });
    } catch {
      return route.fulfill({ status: 404, body: "" });
    }
  });
}

/** Actions par page : [nom, chemin, action post-chargement facultative]. */
const pages = [
  ["home", "/", null],
  ["units", "/units", null],
  ["units-detail", "/units", async (page) => {
    await page.waitForSelector(".units-card > button");
    await page.waitForTimeout(1500); // hydratation React (dev) avant le clic
    for (let i = 0; i < 3; i++) {
      await page.locator(".units-card > button").first().click();
      try {
        await page.waitForSelector(".units-detail", { state: "visible", timeout: 4000 });
        break;
      } catch {
        await page.waitForTimeout(800);
      }
    }
    await page.waitForSelector(".units-detail", { state: "visible", timeout: 10000 });
  }],
  ["researches", "/researches", null],
  ["researches-detail", "/researches", async (page) => {
    await page.waitForSelector(".units-card > button");
    await page.waitForTimeout(1500);
    for (let i = 0; i < 3; i++) {
      await page.locator(".units-card > button").first().click();
      try {
        await page.waitForSelector(".units-detail", { state: "visible", timeout: 4000 });
        break;
      } catch {
        await page.waitForTimeout(800);
      }
    }
    await page.waitForSelector(".units-detail", { state: "visible", timeout: 10000 });
  }],
  ["modding", "/modding", null],
  ["maps", "/maps", null],
  ["mods", "/mods", null],
  ["players", "/players", null],
  ["stats", "/season-statistics", null],
  ["submit", "/submit", null],
  ["submissions", "/submissions", null],
  ["account", "/account", null],
  ["replay", "/replay", null],
  [
    "replay-result",
    "/replay?code=rep-Jd894wx6so9",
    async (page) => {
      // L'analyse 8v8 + le rendu complet prennent > 1 s : on attend le
      // verdict (h1 du canvas .rp) avant la capture.
      await page.waitForSelector(".rp h1", { timeout: 30000 });
      await page.waitForTimeout(1500);
    },
  ],
  [
    "player",
    "/player/dbat",
    async (page) => {
      await page.waitForSelector(".rp", { timeout: 30000 });
    },
  ],
];

const browser = await chromium.launch();
try {
  for (const [width, height, suffix, mobile] of [
    [1440, 900, "d", false],
    [375, 812, "m", true],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: mobile,
      hasTouch: mobile,
      deviceScaleFactor: 1,
      locale: "fr-FR",
    });
    await context.addCookies([{ name: "atlas_locale", url: origin, value: "fr" }]);
    await mockRoutes(context);
    const page = await context.newPage();
    for (const [name, path, action] of pages) {
      if (only && !only.includes(name)) continue;
      try {
        await page.goto(origin + path, { waitUntil: "load", timeout: 30000 });
        if (action) await action(page);
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(700);
        await page.screenshot({
          path: `${outdir}/${tag}-${name}-${suffix}.png`,
          fullPage: true,
        });
        console.log(`OK ${tag}-${name}-${suffix}`);
      } catch (e) {
        console.log(`FAIL ${tag}-${name}-${suffix}: ${e.message.split("\n")[0]}`);
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}
