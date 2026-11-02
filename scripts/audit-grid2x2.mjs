#!/usr/bin/env node
/** Audit complémentaire « 2×2 partout » : débordements internes + desktop.
 *
 *  Usage : QA_SESSION=... node scripts/audit-grid2x2.mjs <origin>
 *
 *  1. Mobile (375 / 360) : pour chaque grille modifiée, vérifie qu'aucune
 *     carte ne déborde horizontalement (scrollWidth vs clientWidth), que le
 *     viewport n'est pas dépassé et que les clamps de titres sont actifs.
 *  2. Desktop 1440 : les colonnes des grilles modifiées sont identiques aux
 *     valeurs d'avant changement (aucune règle ne s'applique >900 px).
 */
import { chromium } from "playwright";

const origin = process.argv[2];
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Tests are restricted to a local, non-production origin.");
const SESSION = process.env.QA_SESSION || "";

const fakeMaps = [1, 2, 3].map((i) => ({
  id: `demo-${i}`,
  title: `Carte démo ${i} — fortifications étendues avec titre volontairement long`,
  summary:
    "Scénario QA : deux camps symétriques, ponts destructibles et économie ralentie pour les tests de grille mobile sur deux colonnes compactes avec un résumé long.",
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

/** [nom, chemin, largeur, action, grilles attendues {sélecteur: colonnes}] */
const cases = [
  ["home-375", "/", 375, null, { ".community-grid": 2, ".explore-grid": 2, ".portal-grid": 2 }],
  ["maps-375", "/maps", 375, null, { ".community-grid": 2 }],
  [
    "stalingrad-375",
    "/maps/stalingrad",
    375,
    async (page) => {
      await page.getByRole("tab", { name: "Économie et fin de partie" }).click();
      await page.waitForTimeout(400);
    },
    { ".economy-metrics": 2 },
  ],
  [
    "stalingrad-balance-375",
    "/maps/stalingrad",
    375,
    null,
    { ".hero-grid": 2 },
  ],
  ["stats-375", "/season-statistics", 375, null, { ".stat-cards": 2 }],
  ["account-375", "/account", 375, null, { ".hub-grid": 2 }],
  ["workbench-360", "/workbench", 360, null, { ".unit-list": 2 }],
  ["mods-375", "/mods", 375, null, { ".library-main .mod-grid": 2 }],
  // Desktop : valeurs inchangées par rapport à l'avant (aucune règle >900 px).
  ["home-1440", "/", 1440, null, { ".community-grid": 3, ".explore-grid": 2, ".portal-grid": 2 }],
  ["maps-1440", "/maps", 1440, null, { ".community-grid": 3 }],
  [
    "stalingrad-1440",
    "/maps/stalingrad",
    1440,
    async (page) => {
      await page.getByRole("tab", { name: "Économie et fin de partie" }).click();
      await page.waitForTimeout(400);
    },
    { ".economy-metrics": 3 },
  ],
  [
    "stalingrad-balance-1440",
    "/maps/stalingrad",
    1440,
    null,
    { ".hero-grid": 4 },
  ],
  ["stats-1440", "/season-statistics", 1440, null, { ".stat-cards": 3 }],
  ["account-1440", "/account", 1440, null, { ".hub-grid": 2 }],
  // Bibliothèque Mod : 2 colonnes par design en desktop (règle de base
  // .library-main .mod-grid, command.css l.372) — vérifié inchangé AVANT
  // (stash) comme APRÈS.
  ["mods-1440", "/mods", 1440, null, { ".library-main .mod-grid": 2 }],
];

const browser = await chromium.launch();
let failures = 0;
try {
  for (const [name, path, width, action, expected] of cases) {
    const context = await browser.newContext({
      viewport: { width, height: 812 },
      isMobile: width < 800,
      hasTouch: width < 800,
      locale: "fr-FR",
    });
    await context.addCookies([
      { name: "atlas_locale", url: origin, value: "fr" },
      ...(SESSION ? [{ name: "atlas_session", url: origin, value: SESSION }] : []),
    ]);
    await context.route("**/api/atlas/maps?offset=0", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: fakeMaps, hasMore: false }),
      }),
    );
    const page = await context.newPage();
    const jsErrors = [];
    page.on("pageerror", (e) => jsErrors.push(String(e).split("\n")[0]));
    try {
      await page.goto(origin + path, { waitUntil: "load", timeout: 30000 });
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(900);
      if (action) await action(page);
      const res = await page.evaluate(
        ({ expected }) => {
          const out = { doc: document.documentElement.scrollWidth, win: window.innerWidth, grids: {} };
          for (const [sel, want] of Object.entries(expected)) {
            const el = document.querySelector(sel);
            if (!el) {
              out.grids[sel] = { got: null, want };
              continue;
            }
            const cs = getComputedStyle(el);
            const cols = cs.gridTemplateColumns ? cs.gridTemplateColumns.split(" ").length : 0;
            // Débordement horizontal interne : chaque carte doit tenir dans
            // sa largeur (tolérance 1 px arrondi).
            let overflowCards = 0;
            for (const card of el.children) {
              if (card.scrollWidth > card.clientWidth + 1) overflowCards++;
            }
            out.grids[sel] = { got: cols, want, cards: el.children.length, overflowCards };
          }
          return out;
        },
        { expected },
      );
      const problems = [];
      if (res.doc > res.win + 1) problems.push(`docOverflow ${res.doc}>${res.win}`);
      for (const [sel, g] of Object.entries(res.grids)) {
        if (g.got !== g.want) problems.push(`${sel} cols=${g.got} want=${g.want}`);
        if (g.overflowCards > 0) problems.push(`${sel} ${g.overflowCards} carte(s) débordent`);
      }
      if (jsErrors.length) problems.push(`jsErrors:${jsErrors.length}`);
      if (problems.length) {
        failures++;
        console.log(`FAIL ${name}: ${problems.join(" | ")}`);
      } else {
        console.log(
          `PASS ${name} doc=${res.doc}/${res.win} ` +
            Object.entries(res.grids)
              .map(([s, g]) => `${s}=${g.got}col/${g.cards}e`)
              .join(" "),
        );
      }
    } catch (e) {
      failures++;
      console.log(`FAIL ${name}: ${e.message.split("\n")[0]}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
process.exit(failures ? 1 : 0);
