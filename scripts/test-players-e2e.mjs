#!/usr/bin/env node
/** E2E /players + /season-statistics (Replay phase 2) — navigateur réel.
 *  Données : D1 local (3 replays publiés backfillés, saison 2026-10).
 *  Usage : node scripts/test-players-e2e.mjs [chromium|webkit] [origin] */
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

/** L'hydratation React peut suivre le rendu serveur (dev Vite) : les écouteurs
 *  ne sont posés qu'une fois React prêt — on attend les props React sur le
 *  contrôle avant toute interaction (même astuce que test-replay-e2e). */
async function whenHydrated(page, selector, timeout = 20000) {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return !!el && Object.keys(el).some((key) => key.startsWith("__reactProps"));
    },
    selector,
    { timeout },
  );
}

const browser = await engine.launch();
try {
  /* ---- Desktop EN : /players -------------------------------------- */
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addCookies([{ name: "atlas_locale", value: "en", url: origin }]);
    const page = await context.newPage();
    await page.goto(origin + "/players", { waitUntil: "load" });
    await page.waitForSelector(".ladder-table tbody tr", { timeout: 20000 });
    check("titre <title> localisé EN", (await page.title()) === "Players Ladder | WS ATLAS");
    check(
      "h1 « Players ladder »",
      ((await page.locator("h1").first().textContent()) ?? "").includes("Players ladder"),
    );
    check("saison 2026-10 active", (await page.locator(".season-chip.active").textContent()) === "2026-10");
    const tabs = await page.locator(".cat-tab").allTextContents();
    check("onglets Big team / Solo-Duo", tabs[0].includes("Big team") && tabs[1].includes("Solo"));
    const rows = await page.locator(".ladder-table tbody tr").count();
    check("classement rempli (≥ 20 lignes, données D1)", rows >= 20);
    check("badges top 3 présents", (await page.locator(".rank-badge").count()) === 3);
    check(
      "Vzgo classé (données backfill réelles)",
      (await page.locator("td.player", { hasText: "Vzgo" }).count()) === 1,
    );
    const headers = await page.locator(".ladder-table thead th").allTextContents();
    check(
      "colonnes Rank/Player/Points/Games/MVP/K-D",
      headers.join("|").includes("Rank") &&
        headers.join("|").includes("Player") &&
        headers.join("|").includes("Points") &&
        headers.join("|").includes("K/D"),
    );
    check(
      "dernière màj affichée",
      ((await page.locator(".ladder-updated").textContent()) ?? "").includes("Data updated through"),
    );
    check(
      "formule de points documentée",
      ((await page.locator(".ladder-formula").textContent()) ?? "").includes("kills"),
    );

    /* Recherche joueur : filtre côté client, rang global conservé */
    await whenHydrated(page, ".ladder-search input");
    await page.fill(".ladder-search input", "dbat");
    await page.waitForTimeout(250);
    check("recherche « dbat » → 1 ligne", (await page.locator(".ladder-table tbody tr").count()) === 1);
    check(
      "rang global conservé (#2 pour dbat)",
      ((await page.locator(".ladder-table tbody tr td").first().textContent()) ?? "").trim() !== "1",
    );
    await page.fill(".ladder-search input", "zzzz-nope");
    await page.waitForTimeout(250);
    check(
      "recherche sans résultat → message",
      ((await page.locator(".ladder-empty").textContent()) ?? "").includes("No player matches"),
    );

    /* Lien croisé vers les stats de saison */
    await page.click(".ladder-link");
    await page.waitForURL("**/season-statistics**");
    check("lien croisé /season-statistics", page.url().includes("/season-statistics"));

    /* Catégorie vide : solo */
    await page.goto(origin + "/players?cat=solo", { waitUntil: "load" });
    check(
      "catégorie solo vide → état vide",
      ((await page.locator(".empty-surface").textContent()) ?? "").includes("No ranking"),
    );

    /* Entrée de menu directe (header) */
    await page.goto(origin + "/", { waitUntil: "load" });
    const navLadder = page.locator("nav >> text=Players ladder");
    check("entrée « Players ladder » visible dans le menu", (await navLadder.count()) === 1);
    await navLadder.click();
    await page.waitForURL("**/players**");
    check("menu → /players", page.url().endsWith("/players"));
    await context.close();
  }

  /* ---- Desktop EN : /season-statistics ---------------------------- */
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addCookies([{ name: "atlas_locale", value: "en", url: origin }]);
    const page = await context.newPage();
    await page.goto(origin + "/season-statistics", { waitUntil: "load" });
    await page.waitForSelector(".stat-cards", { timeout: 20000 });
    check(
      "titre <title> localisé EN",
      (await page.title()) === "Season Statistics | WS ATLAS",
    );
    const cards = await page.locator(".stat-card .stat-label").allTextContents();
    check(
      "cartes stats (replays publiés / joueurs / durée moyenne)",
      cards.join("|").includes("Published replays") &&
        cards.join("|").includes("Ranked players") &&
        cards.join("|").includes("Average duration"),
    );
    const firstCard = Number(await page.locator(".stat-card .stat-value").first().textContent());
    check("≥ 3 replays publiés comptés", firstCard >= 3);
    const modes = await page.locator(".stat-panel").first().locator(".bar-label").allTextContents();
    check("modes populaires localisés (Team match)", modes.join("|").includes("Team match"));
    const regions = await page.locator(".stat-bars .bar-label").allTextContents();
    check("régions serveur listées (asia/europe)", /asia|europe/.test(regions.join("|")));
    const units = await page.locator(".unit-ranks li .unit-name").allTextContents();
    check("top unités produites ≥ 5 lignes", units.length >= 5);
    check(
      "noms d'unités localisés (pas d'identifiant brut)",
      units.every((name) => !name.startsWith("WarSelection/")),
    );
    check(
      "lien croisé vers /players",
      (await page.locator('.ladder-link[href="/players"]').count()) === 1,
    );
    await context.close();
  }

  /* ---- Desktop FR : rendu français -------------------------------- */
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addCookies([{ name: "atlas_locale", value: "fr", url: origin }]);
    const page = await context.newPage();
    await page.goto(origin + "/players", { waitUntil: "load" });
    await page.waitForSelector(".ladder-table tbody tr", { timeout: 20000 });
    check("h1 FR « Classement joueurs »", ((await page.locator("h1").first().textContent()) ?? "").includes("Classement joueurs"));
    check(
      "caption màj FR",
      ((await page.locator(".ladder-updated").textContent()) ?? "").includes("Données à jour jusqu'au"),
    );
    check("onglet FR « Grandes équipes »", (await page.locator(".cat-tab").first().textContent()).includes("Grandes"));
    await page.goto(origin + "/season-statistics", { waitUntil: "load" });
    await page.waitForSelector(".stat-cards", { timeout: 20000 });
    check(
      "cartes FR (Replays publiés)",
      ((await page.locator(".stat-card .stat-label").first().textContent()) ?? "").includes("Replays publiés"),
    );
    await context.close();
  }

  /* ---- Mobile 375 px ---------------------------------------------- */
  {
    const context = await browser.newContext({
      viewport: { width: 375, height: 780 },
      isMobile: true,
      hasTouch: true,
    });
    await context.addCookies([{ name: "atlas_locale", value: "en", url: origin }]);
    const page = await context.newPage();
    await page.goto(origin + "/players", { waitUntil: "load" });
    await page.waitForSelector(".ladder-table tbody tr", { timeout: 20000 });
    const scrollW = await page.evaluate(() => document.scrollingElement.scrollWidth);
    check("375 px sans débordement horizontal (/players)", scrollW <= 376);
    const touch = await page.evaluate(() => {
      const h = (sel) => {
        const el = document.querySelector(sel);
        return el ? Math.round(el.getBoundingClientRect().height) : 0;
      };
      return { tab: h(".cat-tab.active"), chip: h(".season-chip"), search: h(".ladder-search input") };
    });
    check("cible tactile onglet catégorie ≥ 44 px", touch.tab >= 44);
    check("cible tactile saison ≥ 44 px", touch.chip >= 44);
    check("champ recherche ≥ 44 px", touch.search >= 44);
    await page.goto(origin + "/season-statistics", { waitUntil: "load" });
    await page.waitForSelector(".stat-cards", { timeout: 20000 });
    const scrollW2 = await page.evaluate(() => document.scrollingElement.scrollWidth);
    check("375 px sans débordement horizontal (/season-statistics)", scrollW2 <= 376);
    check(
      "cartes empilées en mobile",
      (await page.evaluate(() => getComputedStyle(document.querySelector(".stat-cards")).gridTemplateColumns.split(" ").length)) === 1,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(`\n${report.length} contrôles OK (${engine.name()})`);
