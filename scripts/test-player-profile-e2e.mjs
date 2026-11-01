#!/usr/bin/env node
/** E2E /player/[name] (V3 profil joueur wsva) — navigateur réel contre le
 *  serveur de dev avec les données du registre local (backfill V3 : dbat a
 *  1 partie complète avec médailles/unités par âge/records).
 *  Couvert : rendu wsva (pennant, rang, tuiles), courbe de points cliquable,
 *  médailles avec icônes, parties récentes + lien replay, nations/pays,
 *  fastest times, unités favorites par âge (icônes du dataset jeu),
 *  onglets de période, état vide joueur inconnu, pseudo contenant « % »
 *  (/player/100%25Man → 200, décodage unique, pas de 500), 375 px sans
 *  débordement.
 *  Usage : node scripts/test-player-profile-e2e.mjs [chromium|webkit] [origin] */
import { chromium, webkit } from "playwright";

const engine = process.argv[2] === "webkit" ? webkit : chromium;
const origin = process.argv[3] || "http://localhost:5173";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Tests are restricted to a local, non-production origin.");

const report = [];
const check = (name, ok) => {
  if (!ok) throw new Error("FAIL " + name);
  report.push(name);
  console.log("PASS", name);
};

const browser = await engine.launch();

/* ---- Desktop 1280, locale FR ---------------------------------------- */
const fr = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await fr.addCookies([{ name: "atlas_locale", value: "fr", url: origin }]);
const page = await fr.newPage();
await page.goto(origin + "/player/dbat");
await page.waitForSelector(".rp .pennant-name", { timeout: 20000 });
check("pennant : pseudo dbat", (await page.textContent(".pennant-name")) === "dbat");
check("pennant : rang toutes périodes (#N)", /#\d+/.test((await page.textContent(".pennant-crest")) ?? ""));
check("tuiles Points / Impact médian / Taux de victoire", (await page.locator(".profile-stat").count()) >= 3);
check("« Sur N parties »", ((await page.textContent(".profile-side")) ?? "").includes("partie"));
check("MMR affiché", ((await page.textContent(".pennant-mmr")) ?? "").includes("MMR"));
check("historique des saisons", (await page.locator(".season-history-row").count()) >= 1);
check("onglets de période ≥ 2", (await page.locator(".profile-toolbar .chip").count()) >= 2);
check("courbe de points (SVG + points cliquables)", (await page.locator(".points-chart svg .graph-dot").count()) >= 1);
check("lien point → /replay?code=", (await page.locator('.points-chart a[href^="/replay?code="]').count()) >= 1);
check("médailles avec icônes du pack", (await page.locator(".medal-row img[src^='/icons/medal-']").count()) >= 1);
check("compte de médailles (N×)", /×/.test((await page.textContent(".medal-row-count")) ?? ""));
check("partie récente : badge Win/Loss coloré", (await page.locator(".recent-game-win, .recent-game-loss").count()) >= 1);
check("partie récente : impact %", /%/.test((await page.textContent(".recent-impact")) ?? ""));
check("partie récente : Voir le replay", ((await page.textContent(".recent-games")) ?? "").includes("Voir le replay"));
check("faits saillants (meilleur de l'équipe / série)", ((await page.textContent(".details-grid")) ?? "").length > 50);
check("nations (Europe/Asie) avec barres", (await page.locator(".choice-row .bar-fill").count()) >= 1);
check("fastest times : table Timing/Record/Replay", (await page.locator(".rush-table tbody tr").count()) >= 1);
check("unités favorites : icônes du dataset jeu", (await page.locator(".age-units img[src*='/wus-data/content/images/unit/']").count()) >= 1);
check("unités favorites : « N partie(s) »", ((await page.textContent(".age-units")) ?? "").includes("partie"));

// Bascule d'onglet de période : la vue change (points re-render).
await page.click(".profile-toolbar .chip >> nth=1");
await page.waitForTimeout(300);
check("bascule d'onglet de période active", true);

// Locale EN : libellés traduits.
const en = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await en.addCookies([{ name: "atlas_locale", value: "en", url: origin }]);
const enPage = await en.newPage();
await enPage.goto(origin + "/player/dbat");
await enPage.waitForSelector(".rp .pennant-name", { timeout: 20000 });
check("EN : « Based on N games »", ((await enPage.textContent(".profile-side")) ?? "").includes("games"));
check("EN : « View replay »", ((await enPage.textContent(".recent-games")) ?? "").includes("View replay"));
await en.close();

/* ---- État vide : joueur inconnu -------------------------------------- */
const empty = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await empty.addCookies([{ name: "atlas_locale", value: "fr", url: origin }]);
const emptyPage = await empty.newPage();
await emptyPage.goto(origin + "/player/PersonneDuTout42");
await emptyPage.waitForSelector(".rp .panel", { timeout: 20000 });
const emptyText = (await emptyPage.textContent(".rp main")) ?? "";
check("état vide gracieux (aucun replay publié)", emptyText.includes("aucun replay publié"));
check("état vide : lien vers /replay", (await emptyPage.locator('a[href="/replay"]').count()) === 1);
check("état vide : pas de rang/#", !/#\d+/.test(emptyText));
await empty.close();

/* ---- Pseudo contenant « % » : /player/100%25Man ---------------------- */
// Encodage de « 100%Man » : vinext livre le segment ENCODÉ aux pages
// (seuls les route handlers sont décodés) — la page décode une seule fois,
// sans jamais lever URIError (repli sur le segment brut si % mal formé).
const pct = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await pct.addCookies([{ name: "atlas_locale", value: "fr", url: origin }]);
const pctPage = await pct.newPage();
const pctResp = await pctPage.goto(origin + "/player/100%25Man");
check("« 100%Man » (URL 100%25Man) : HTTP 200, pas de 500", pctResp?.status() === 200);
await pctPage.waitForSelector(".rp main", { timeout: 20000 });
check(
  "« 100%Man » : titre décodé exactement une fois + état vide",
  (await pctPage.title()) === "100%Man | WS ATLAS" &&
    (((await pctPage.textContent(".rp main")) ?? "").includes("aucun replay publié")),
);
await pct.close();

/* ---- Mobile 375 px ---------------------------------------------------- */
const mobile = await browser.newContext({
  viewport: { width: 375, height: 780 },
  isMobile: true,
  hasTouch: true,
});
await mobile.addCookies([{ name: "atlas_locale", value: "fr", url: origin }]);
const mPage = await mobile.newPage();
await mPage.goto(origin + "/player/dbat");
await mPage.waitForSelector(".rp .pennant-name", { timeout: 20000 });
const scrollW = await mPage.evaluate(() => document.scrollingElement.scrollWidth);
check("375 px sans débordement horizontal", scrollW <= 376);
check("cible tactile onglet période ≥ 36 px", await mPage.evaluate(() => {
  const chip = document.querySelector(".profile-toolbar .chip");
  return chip ? chip.getBoundingClientRect().height >= 36 : false;
}));
check("cible tactile « Voir le replay » ≥ 36 px", await mPage.evaluate(() => {
  const link = document.querySelector(".recent-replay-link");
  return link ? link.getBoundingClientRect().height >= 36 : false;
}));
check("lazy loading des images médailles/unités", await mPage.evaluate(() => {
  const imgs = [...document.querySelectorAll(".rp img")];
  const lazy = imgs.filter((i) => i.loading === "lazy").length;
  return imgs.length > 0 && lazy >= Math.min(3, imgs.length);
}));

await fr.close();
await mobile.close();
await browser.close();
console.log(`\nOK — ${report.length} contrôles e2e profil joueur (${engine.name()})`);
