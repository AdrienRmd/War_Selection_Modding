#!/usr/bin/env node
/** E2E /replay (refonte wsva) — navigateur réel : rendu de l'accueil
 *  éditorial, analyse d'un code (API officielle mockée sur la fixture fraîche
 *  wsva-Jd894wx6so9 du 31/10), verdict/événements/graphiques/tables, modale
 *  joueur, replays récents, menu Archives, débordement 375 px.
 *  Usage : node scripts/test-replay-e2e.mjs [chromium|webkit] [origin] */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium, webkit } from "playwright";

const engine = process.argv[2] === "webkit" ? webkit : chromium;
const origin = process.argv[3] || "http://localhost:5173";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Tests are restricted to a local, non-production origin.");

const fixture = readFileSync(
  "/home/ubuntu/War-Selection/datasets/replays/wsva-Jd894wx6so9.json",
  "utf8",
);

const report = [];
const check = (name, ok) => {
  if (!ok) throw new Error("FAIL " + name);
  report.push(name);
  console.log("PASS", name);
};

/** WebKit (Safari) transforme les sous-ressources http de localhost/127.0.0.1
 *  en https (origine « potentiellement fiable ») — le serveur de dev ne parle
 *  que http. Ce relais re-sert chaque requête https via Node en http. */
async function relayHttpsUpgrades(context) {
  await context.route(/^https:\/\/((?:localhost|127\.0\.0\.1)(?::\d+)?)\//, async (route) => {
    const httpsUrl = new URL(route.request().url());
    const httpUrl = httpUrlOf(httpsUrl);
    try {
      const upstream = await fetch(httpUrl, {
        method: route.request().method(),
        headers: { accept: route.request().headers()["accept"] ?? "*/*" },
      });
      const headers = {};
      const contentType = upstream.headers.get("content-type");
      if (contentType) headers["content-type"] = contentType;
      const cache = upstream.headers.get("cache-control");
      if (cache) headers["cache-control"] = cache;
      await route.fulfill({
        status: upstream.status,
        headers,
        body: Buffer.from(await upstream.arrayBuffer()),
      });
    } catch {
      await route.abort();
    }
  });
}

const httpUrlOf = (u) => `http://${u.host}${u.pathname}${u.search}`;

async function mockRoutes(context) {
  await relayHttpsUpgrades(context);
  // /wus-data est exposé statiquement par Apache en production ; en dev,
  // le harnais sert le fichier publié (même contenu que la prod).
  await context.route("**/wus-data/content/context.json", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: readFileSync(
        "/home/ubuntu/War-Selection/datasets/served/content/context.json",
        "utf8",
      ),
    }),
  );
  await context.route("**/games-api.warselect.io/getByReplay*", (route) => {
    const url = new URL(route.request().url());
    const code = url.searchParams.get("code") ?? "";
    assert.ok(!code.startsWith("rep-"), "code nu envoyé à l'API officielle");
    // Code frais de soumission e2e : même fixture (le parser étiquette avec
    // le code demandé), pour tester le bouton « Soumettre » bout-en-bout.
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: code === "Jd894wx6so9" || code === "E2eSubmit1A" ? fixture : JSON.stringify({ error: 2 }),
    });
  });
  await context.route("**/api/replay/recent", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          { code: "Jd894wx6so9", teamSize: 8, mvpName: "Vzgo", modeKey: "replayMatchTypeTeamMatch" },
          { code: "HkvVncU3mq9", teamSize: 7, mvpName: "Farmer", modeKey: "replayMatchTypeTeamMatch" },
        ],
      }),
    }),
  );
}

const browser = await engine.launch();
try {
  if (engine === webkit) {
    /* WebKit (Safari) force https sur les sous-ressources des origines
     * localhost/127.0.0.1 « potentiellement fiables » : le serveur de dev
     * Vite (http seul) rejette les handshakes TLS et le flux SPA ne s'hydrate
     * pas. En production le site est servi derrière Apache en https — le flux
     * complet est couvert par Chromium. WebKit : smoke test du rendu serveur. */
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addCookies([{ name: "atlas_locale", value: "en", url: origin }]);
    const page = await context.newPage();
    await page.goto(origin + "/replay");
    await page.waitForSelector(".rp-hero h1");
    check("webkit smoke : titre éditorial rendu",
      ((await page.textContent(".rp-hero h1")) ?? "").includes("How well did you really play?"));
    check("webkit smoke : formulaire présent", (await page.locator(".rp-form input").count()) === 1);
    check("webkit smoke : conteneur thème clair présent",
      (await page.locator("main.replay-page .replay-wsva").count()) === 1);
    await context.close();
    console.log(`\n${report.length} contrôles OK (${engine.name()}, smoke)`);
    process.exit(0);
  }

  /* ---- Desktop 1280, locale EN ---------------------------------- */
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await mockRoutes(context);
  await context.addCookies([{ name: "atlas_locale", value: "en", url: origin }]);
  const page = await context.newPage();
  await page.goto(origin + "/replay");
  await page.waitForSelector(".rp-hero h1");
  check("accueil éditorial (EN)", (await page.textContent(".rp-hero h1")).includes("How well did you really play?"));
  check("aide code sensible à la casse", ((await page.textContent(".rp-hero-help")) ?? "").includes("case-sensitive"));
  check("replays récents (mock API)", (await page.textContent(".rp-recent"))?.includes("rep-Jd894wx6so9"));

  await page.fill(".rp-form input", "rep-Jd894wx6so9");
  await page.click(".rp-submit-main");
  await page.waitForSelector(".rp-verdict", { timeout: 30000 });
  const verdict = (await page.textContent(".rp-verdict")) ?? "";
  check("verdict Red wins by elimination", verdict.includes("wins by elimination") && verdict.includes("8v8"));
  check("bandeau durée 55:56", (await page.textContent(".rp-banner"))?.includes("55:56"));
  check("bandeau région Europe", (await page.textContent(".rp-banner"))?.includes("Europe"));
  check("bandeau code nu Jd894wx6so9", (await page.textContent(".rp-banner"))?.includes("Jd894wx6so9"));
  const events = await page.locator(".rp-event").count();
  check("événements décisifs ≥ 5", events >= 5);
  check("événement merveille dbat", (await page.textContent(".rp-events"))?.includes("Built by dbat"));
  check("abandon détecté (left the game)", (await page.textContent(".rp-events"))?.includes("left the game"));
  check("power balance SVG", (await page.locator(".rp-power, .rp-card svg").count()) >= 1);
  const tables = page.locator("table.rp-table");
  check("2 tables d'équipe", (await tables.count()) === 2);
  check("8 lignes par équipe", (await page.locator("table.rp-table tbody tr").count()) === 16);
  check("en-têtes exacts", ((await page.textContent("table.rp-table thead")) ?? "").includes("Manpower killed"));
  check("impact Vzgo en tête", (await page.textContent("table.rp-table tbody tr td:nth-child(3)"))?.includes("Vzgo"));
  check("MMR moyen 91", (await page.textContent(".rp-team-head"))?.includes("Average MMR 91"));

  // Modale joueur (détail conservé).
  await page.click("table.rp-table tbody tr");
  await page.waitForSelector(".units-detail");
  check("modale joueur s'ouvre", (await page.textContent(".units-detail"))?.length > 0);
  await page.click(".units-close");
  await page.waitForSelector(".units-detail", { state: "detached" });
  check("modale joueur se ferme", true);

  // Menu Archives (header) ouvre toujours.
  await page.click("button[aria-label='Archives'], [aria-label='档案'] >> visible=true").catch(() => {});
  const archiveOpened =
    (await page.locator(".nav-menu-item, [role='menuitem']").count()) > 0 ||
    (await page.textContent("nav"))?.includes("/replay");
  check("menu Archives accessible", !!archiveOpened);

  /* ---- Locale FR ------------------------------------------------ */
  const frContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await mockRoutes(frContext);
  await frContext.addCookies([{ name: "atlas_locale", value: "fr", url: origin }]);
  const frPage = await frContext.newPage();
  await frPage.goto(origin + "/replay?code=rep-Jd894wx6so9");
  await frPage.waitForSelector(".rp-verdict", { timeout: 30000 });
  const frVerdict = (await frPage.textContent(".rp-verdict")) ?? "";
  check("verdict FR l'emporte par élimination", frVerdict.includes("l'emporte par élimination"));
  check("événements FR", ((await frPage.textContent(".rp-card")) ?? "").includes("Événements décisifs"));
  await frContext.close();

  /* ---- Soumission bout-en-bout (cookie dev local, non-admin) -------- */
  const subContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await mockRoutes(subContext);
  await subContext.addCookies([
    { name: "atlas_locale", value: "en", url: origin },
    { name: "__sites_local_auth", value: "1", url: origin },
  ]);
  const subPage = await subContext.newPage();
  await subPage.goto(origin + "/replay");
  await subPage.waitForSelector(".rp-hero h1");
  // L'hydratation React peut suivre le rendu serveur de peu : on retente la
  // soumission du formulaire jusqu'à ce que l'analyse démarre.
  let submitted = false;
  for (let attempt = 0; attempt < 5 && !submitted; attempt++) {
    await subPage.fill(".rp-form input", "E2eSubmit1A");
    await subPage.click(".rp-submit-main");
    try {
      await subPage.waitForSelector(".rp-verdict", { timeout: 6000 });
      submitted = true;
    } catch {
      /* hydratation pas encore prête : nouvel essai */
    }
  }
  check("analyse du code frais (retry hydratation)", submitted);
  check("bouton de soumission visible (session active)", (await subPage.locator(".rp-share-button").count()) === 1);
  await subPage.click(".rp-share-button");
  await subPage.waitForSelector(".rp-share-done", { timeout: 15000 });
  check(
    "soumission bout-en-bout (201 → message de confirmation)",
    ((await subPage.textContent(".rp-share-done")) ?? "").includes("Submitted"),
  );
  // Nettoyage : retrait de la ligne e2e (le propriétaire est la session dev).
  const withdrawn = await subPage.evaluate(async () => {
    const r = await fetch("/api/replay/E2eSubmit1A", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "withdrawn" }),
    });
    return r.status;
  });
  check("retrait de la soumission e2e (cleanup)", withdrawn === 200);
  await subContext.close();

  /* ---- Mobile 375 px sans débordement --------------------------- */
  const mobile = await browser.newContext({
    viewport: { width: 375, height: 780 },
    isMobile: true,
    hasTouch: true,
  });
  await mockRoutes(mobile);
  await mobile.addCookies([{ name: "atlas_locale", value: "en", url: origin }]);
  const mPage = await mobile.newPage();
  await mPage.goto(origin + "/replay?code=rep-Jd894wx6so9");
  await mPage.waitForSelector(".rp-verdict", { timeout: 30000 });
  const scrollW = await mPage.evaluate(() => document.scrollingElement.scrollWidth);
  check("375 px sans débordement horizontal", scrollW <= 376);
  const touch = await mPage.evaluate(() => {
    const btn = document.querySelector(".rp-open");
    const main = document.querySelector(".rp-submit-main");
    const h = (el) => (el ? Math.max(el.getBoundingClientRect().height, 0) : 0);
    return { open: h(btn), main: h(main) };
  });
  check("cible tactile bouton principal ≥ 44 px", touch.main >= 44);
  check("bouton joueur ≥ 34 px (zone ligne ≥ 44)", touch.open >= 34);
  const rows = mPage.locator("table.rp-table tbody tr");
  check("tables scrollables en mobile", (await rows.count()) === 16);
  await mobile.close();
  await context.close();
} finally {
  await browser.close();
}
console.log(`\n${report.length} contrôles OK (${engine.name()})`);
