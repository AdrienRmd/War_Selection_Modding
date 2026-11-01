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
  // /wus-data/content/images/** servi depuis la copie publiée (Apache en
  // production) — requis pour les contrôles « icônes chargées non cassées ».
  await context.route("**/wus-data/content/images/**", async (route) => {
    const rel = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/wus-data/content/images/")[1],
    );
    try {
      const body = readFileSync(`/home/ubuntu/War-Selection/datasets/served/content/images/${rel}`);
      await route.fulfill({
        status: 200,
        contentType: rel.endsWith(".png") ? "image/png" : "application/octet-stream",
        body,
      });
    } catch {
      await route.fulfill({ status: 404, body: "" });
    }
  });
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

  /* ---- Fix UX V4 : code récent distinct du badge de mode ---------- */
  check(
    "code récent : le mode n'est pas accolé au code (bouton = code seul)",
    ((await page.textContent(".rp-recent-code")) ?? "").trim() === "rep-Jd894wx6so9",
  );
  check(
    "badge de mode distinct (« 8v8 »)",
    ((await page.textContent(".rp-recent .rp-recent-mode")) ?? "").trim() === "8v8",
  );
  const sep = await page.evaluate(() => {
    const btn = document.querySelector(".rp-recent-code");
    const mode = document.querySelector(".rp-recent .rp-recent-mode");
    if (!btn || !mode) return null;
    const b = btn.getBoundingClientRect();
    const m = mode.getBoundingClientRect();
    const cs = getComputedStyle(btn);
    return {
      gap: m.left - b.right,
      pill: cs.backgroundColor !== "rgba(0, 0, 0, 0)",
      select: cs.userSelect,
    };
  });
  check(
    "badge détaché du code (≥ 8 px), code en pilule sélectionnable",
    !!sep && sep.gap >= 8 && sep.pill && sep.select === "text",
  );
  // Comportement conservé : le clic sur une carte récente analyse le code.
  await page.click(".rp-recent-code");
  await page.waitForSelector(".rp .heading-1", { timeout: 30000 });
  check("clic carte récente analyse toujours", true);
  // Sauvetage à la saisie : code + mode collé → code normalisé, pas d'erreur de format.
  await page.fill(".rp-form input", "rep-Jd894wx6so98v8");
  await page.click(".rp-submit-main");
  // NB : pas de générique TS (querySelector<X>) dans les fns sérialisées —
  // V8 le parse comme des comparaisons chaînées et la condition vaut
  // silencieusement false (constaté : timeout waitForFunction).
  await page.waitForFunction(
    () => {
      const input = document.querySelector(".rp-form input");
      return input instanceof HTMLInputElement && input.value === "Jd894wx6so9";
    },
    undefined,
    { timeout: 15000 },
  );
  check("suffixe de mode collé retiré à la saisie (input normalisé)", true);
  // Contrôle négatif : code absent du mock + mode collé → erreur « n'existe
  // pas » de l'API (le format a PASSÉ), pas « Format de code invalide ».
  await page.fill(".rp-form input", "rep-HkvVncU3mq97v7");
  await page.click(".rp-submit-main");
  await page.waitForSelector(".rp-error", { timeout: 15000 });
  check(
    "code collé accepté par le format (erreur API replay introuvable, pas format invalide)",
    ((await page.textContent(".rp-error")) ?? "").includes("Replay does not exist"),
  );

  await page.fill(".rp-form input", "rep-Jd894wx6so9");
  await page.click(".rp-submit-main");
  await page.waitForSelector(".rp .heading-1", { timeout: 30000 });
  const verdict = (await page.textContent(".rp .heading-1")) ?? "";
  check("verdict Red wins by elimination", verdict.includes("wins by elimination") && verdict.includes("8v8"));
  check("scope .rp présent (design-system wsva)", (await page.locator(".rp.page-backdrop").count()) === 1);
  check("bandeau durée 55:56", (await page.textContent(".overview-panel"))?.includes("55:56"));
  check("bandeau région Europe", (await page.textContent(".overview-panel"))?.includes("Europe"));
  check("bandeau code nu Jd894wx6so9", (await page.textContent(".overview-panel"))?.includes("Jd894wx6so9"));
  check("faits avec icônes (stopwatch)", (await page.locator('.overview-panel .fact img[src="/icons/stopwatch.png"]').count()) === 1);
  const events = await page.locator(".turning-point").count();
  check("événements décisifs ≥ 5", events >= 5);
  check("événement merveille dbat", (await page.textContent(".turning-list"))?.includes("Built by dbat"));
  check("abandon détecté (left the game)", (await page.textContent(".turning-list"))?.includes("left the game"));
  check("icône crâne sur événements", (await page.locator('.turning-list img[src="/icons/skull.png"]').count()) >= 1);
  check("power balance SVG", (await page.locator(".chart-frame svg").count()) >= 1);
  const tables = page.locator("table.team-table");
  check("2 tables d'équipe", (await tables.count()) === 2);
  check("16 lignes principales (8 par équipe)", (await page.locator("tr.team-table-main-row").count()) === 16);
  check("en-têtes exacts", ((await page.textContent("table.team-table thead")) ?? "").includes("Manpower"));
  check("impact Vzgo en tête", (await page.textContent("tr.team-table-main-row td:nth-child(3)"))?.includes("Vzgo"));
  check("MMR moyen 91", (await page.textContent(".team-panel-header"))?.includes("Average MMR 91"));
  check("lien joueur → /player/", (await page.locator('a.name-link[href^="/player/"]').count()) >= 15);
  check("médailles affichées (lignes d'équipe)", (await page.locator(".player-medals img").count()) >= 1);
  check("icônes ressources jeu (food/wood/iron)", (await page.locator('td img[src*="/resource/"]').count()) >= 30);

  /* ---- Sections repliables façon ws-stats (V C) -------------------- */
  check(
    "sections de page repliables présentes (≥ 2 en-têtes + chevron)",
    (await page.locator(".rp-section-toggle").count()) >= 2,
  );
  const factsToggle = page.locator(".overview-panel .rp-section-toggle");
  await factsToggle.click();
  check(
    "bandeau infos replié : contenu démonté (aria-expanded=false)",
    (await factsToggle.getAttribute("aria-expanded")) === "false" &&
      (await page.locator(".overview-panel .fact-row").count()) === 0,
  );
  await factsToggle.click();
  check(
    "bandeau infos rouvert : faits remontés",
    (await factsToggle.getAttribute("aria-expanded")) === "true" &&
      (await page.locator(".overview-panel .fact-row").count()) === 1,
  );

  /* ---- Transferts de ressources (V5 : récap seul, échelle ressources) -- */
  await page.waitForSelector(".transfers-panel", { timeout: 15000 });
  check(
    "section transferts : caption « Sent by (40 transactions) »",
    /Sent by \(40 transactions\)/.test((await page.locator(".transfers-table").first().textContent()) ?? ""),
  );
  check(
    "V5 : liste détaillée « Transactions » ABSENTE (récap seul)",
    (await page.locator(".transfers-table").count()) === 1 &&
      !/Transactions \(\d+\)/.test((await page.locator(".transfers-panel").textContent()) ?? ""),
  );
  check("badge Very generous présent", (await page.locator(".transfer-gen-veryGenerous").count()) >= 1);
  check(
    "échelle v2 : total top donneur ≈ 56K ressources (plus de « M »)",
    /56K|56\s?k|56,0\s?k/i.test((await page.locator(".transfers-table td.cell-strong").first().textContent()) ?? ""),
  );

  // Ligne dépliable : détail inline (une ligne AVEC médailles — dbat, MVP).
  const medalRow = page.locator("tbody.team-table-row-toggle:has(.player-medals img) .chevron-button").first();
  await medalRow.click();
  await page.waitForSelector("tr.player-detail-row");
  check("détail de ligne s'ouvre (inline)", (await page.locator("tr.player-detail-row").count()) === 1);
  check("détail : carte médaille", (await page.locator("tr.player-detail-row .medal-card").count()) >= 1);
  check("détail : nom de médaille traduit", ((await page.textContent("tr.player-detail-row")) ?? "").length > 10);

  /* ---- Player statistics : onglets (V4) --------------------------- */
  await page.waitForSelector(".player-stats", { timeout: 10000 });
  const statTabs = page.locator(".player-stats-tab");
  check("5 onglets Resources/Units/Defeated/Buildings/Research", (await statTabs.count()) === 5);
  check(
    "onglet Resources actif par défaut",
    /Resources/.test((await page.locator(".player-stats-tab.chip-active").first().textContent()) ?? ""),
  );
  check("cartes ressources denses (≥ 6)", (await page.locator(".player-stats-tile").count()) >= 6);
  await statTabs.filter({ hasText: "Units" }).click();
  await page.waitForSelector(".player-stats-group", { timeout: 10000 });
  check(
    "onglet Units : sections par catégorie (≥ 2)",
    (await page.locator(".player-stats-group").count()) >= 2,
  );
  check("sections repliées par défaut (aucune tuile rendue)", (await page.locator(".player-stats-unit-tile").count()) === 0);
  const groupToggle = page.locator(".player-stats-group-toggle").first();
  await groupToggle.click();
  await page.waitForSelector(".player-stats-unit-tile", { timeout: 5000 });
  check("section ouverte → tuiles unité (icône + nom + nombre)", (await page.locator(".player-stats-unit-tile").count()) >= 1);
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll(".player-stats-unit-icon")).every((i) => i.complete),
    undefined,
    { timeout: 10000 },
  );
  check(
    "icônes d'unités chargées (non cassées)",
    await page.evaluate(() =>
      Array.from(document.querySelectorAll(".player-stats-unit-icon")).every(
        (i) => i.complete && i.naturalWidth > 0,
      ),
    ),
  );
  await groupToggle.click();
  check("section refermée (tuiles démontées)", (await page.locator(".player-stats-unit-tile").count()) === 0);
  await statTabs.filter({ hasText: "Defeated" }).click();
  await page.waitForSelector(".player-stats-defeated", { timeout: 5000 });
  check("onglet Defeated : vaincues + perdues", (await page.locator(".player-stats-groups-title").count()) === 2);
  // V C : la FAUNE (oies/cerfs/alligators…) a sa section dédiée — 1 357
  // animaux tués sur cette fixture 8v8, ouverte → tuiles avec icônes jeu.
  const faunaToggle = page.locator('.player-stats-defeated .player-stats-group[data-group="fauna"] .player-stats-group-toggle');
  await faunaToggle.first().waitFor({ state: "visible", timeout: 5000 });
  check("onglet Defeated : section Faune présente (animaux tués)", (await faunaToggle.count()) === 2);
  await faunaToggle.first().click();
  await page.waitForSelector('.player-stats-defeated .player-stats-group[data-group="fauna"] .player-stats-unit-tile', { timeout: 5000 });
  check(
    "section Faune ouverte → tuiles animaux (icônes jeu)",
    (await page.locator('.player-stats-defeated .player-stats-group[data-group="fauna"] .player-stats-unit-tile').count()) >= 1,
  );
  // V C : onglet Buildings → sous-catégories façon ws-stats.
  await statTabs.filter({ hasText: "Buildings" }).click();
  await page.waitForSelector(".player-stats-group", { timeout: 5000 });
  const buildingGroups = await page
    .locator(".player-stats .player-stats-group")
    .evaluateAll((els) => els.map((el) => el.dataset.group ?? ""));
  check(
    "onglet Buildings : sous-catégories éco/population/défense/militaire (ws-stats)",
    ["eco", "population", "defense", "military"].every((g) => buildingGroups.includes(g)),
  );
  await statTabs.filter({ hasText: "Research" }).click();
  await page.waitForSelector(".player-stats-research", { timeout: 5000 });
  check("onglet Research : lignes avec horloge m:ss",
    /^\d+:\d{2}$/.test((((await page.locator(".player-stats-research tbody tr td").nth(1).textContent()) ?? "")).trim()));
  // Les icônes lazy se chargent juste après le montage de l'onglet : on
  // attend qu'elles soient toutes résolues (complete) avant de juger.
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll(".player-stats-research .research-image")).every(
        (i) => i.complete,
      ),
    undefined,
    { timeout: 10000 },
  );
  check(
    "icônes de recherches chargées (non cassées)",
    await page.evaluate(() =>
      Array.from(document.querySelectorAll(".player-stats-research .research-image")).every(
        (i) => i.complete && i.naturalWidth > 0,
      ),
    ),
  );
  await medalRow.click();
  await page.waitForSelector("tr.player-detail-row", { state: "detached" });
  check("détail de ligne se referme", true);

  // Puce de métrique : bascule Impact → Kills (timeline).
  await page.click('.chip-group .chip:has-text("Kills") >> nth=0');
  await page.waitForTimeout(150);
  check("puces de métriques présentes (9)", (await page.locator(".timeline-header .chip").count()) === 9);
  await page.click('.timeline-header .chip >> nth=0'); // retour Impact

  // Menu Archives (header) ouvre toujours.
  await page.click("button[aria-label='Archives'], [aria-label='档案'] >> visible=true").catch(() => {});
  const archiveOpened =
    (await page.locator(".nav-menu-item, [role='menuitem']").count()) > 0 ||
    (await page.textContent("nav"))?.includes("/replay");
  check("menu Archives accessible", !!archiveOpened);

  /* ---- Widget feedback (B4) : anonyme → lien de connexion -------- */
  await page.waitForSelector(".rp-feedback", { timeout: 15000 });
  check(
    "widget « How accurate is this data? » visible (anonyme)",
    ((await page.textContent(".rp-feedback-q")) ?? "").includes("How accurate is this data?"),
  );
  check(
    "anonyme → lien « Sign in to rate this data »",
    ((await page.textContent(".rp-feedback-signin")) ?? "").includes("Sign in to rate this data"),
  );

  /* ---- Locale FR ------------------------------------------------ */
  const frContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await mockRoutes(frContext);
  await frContext.addCookies([{ name: "atlas_locale", value: "fr", url: origin }]);
  const frPage = await frContext.newPage();
  await frPage.goto(origin + "/replay?code=rep-Jd894wx6so9");
  await frPage.waitForSelector(".rp .heading-1", { timeout: 30000 });
  const frVerdict = (await frPage.textContent(".rp .heading-1")) ?? "";
  check("verdict FR l'emporte par élimination", frVerdict.includes("l'emporte par élimination"));
  check("événements FR", ((await frPage.textContent(".overview-panel")) ?? "").includes("Événements décisifs"));
  const frMedalAlt = (await frPage.getAttribute(".team-grid .player-medals img", "alt")) ?? "";
  check(
    "médailles FR (alt traduit)",
    ["Première lame", "Déserteur", "Champion de la guerre", "Maître de la monnaie", "Contrôle total", "Le Fantôme", "Le Fermier", "Chair à canon", "Dernier rempart", "Premier à tomber"].some((n) =>
      frMedalAlt.includes(n),
    ),
  );
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
      await subPage.waitForSelector(".rp .heading-1", { timeout: 6000 });
      submitted = true;
    } catch {
      /* hydratation pas encore prête : nouvel essai */
    }
  }
  check("analyse du code frais (retry hydratation)", submitted);
  check("bouton de soumission visible (session active)", (await subPage.locator(".rp-share-button").count()) === 1);

  /* ---- Widget feedback signé : vote, changement d'avis, agrégat --- */
  await subPage.waitForSelector(".rp-feedback-btn", { timeout: 15000 });
  check("session active : 3 boutons de vote", (await subPage.locator(".rp-feedback-btn").count()) === 3);
  // Attendre le GET initial du widget (preuve d'hydratation) avant de cliquer :
  // un clic pré-hydratation est perdu silencieusement (harness robuste).
  try {
    await subPage.waitForResponse((r) => r.url().includes("/api/replay/feedback") && r.request().method() === "GET", { timeout: 8000 });
  } catch {
    /* GET déjà consommé avant l'armement du listener : le retry du clic
       ci-dessous couvre le cas restant (clic pré-hydratation perdu). */
  }
  // Vote déjà « accurate » d'un run précédent (persisté en D1) ? On repasse
  // par « issues » d'abord pour que le vote « accurate » soit un vrai
  // changement (POST réel + message de remerciement) — déterministe.
  if (await subPage.locator('.rp-feedback-btn[data-vote="accurate"][aria-pressed="true"]').count()) {
    await subPage.click('.rp-feedback-btn[data-vote="issues"]');
    await subPage.waitForSelector('.rp-feedback-btn[data-vote="issues"][aria-pressed="true"]', { timeout: 15000 });
  }
  for (let voteAttempt = 0; voteAttempt < 3; voteAttempt++) {
    await subPage.click('.rp-feedback-btn[data-vote="accurate"]');
    try {
      await subPage.waitForSelector('.rp-feedback-btn[data-vote="accurate"][aria-pressed="true"]', { timeout: 5000 });
      break;
    } catch {
      /* retry : clic perdu pendant la réhydratation du widget */
    }
  }
  check(
    "vote « accurate » enregistré (aria-pressed)",
    (await subPage.getAttribute('.rp-feedback-btn[aria-pressed="true"]', "data-vote")) === "accurate",
  );
  check(
    "message de remerciement",
    ((await subPage.textContent(".rp-feedback-status")) ?? "").includes("Recorded, thanks"),
  );
  await subPage.click('.rp-feedback-btn[data-vote="issues"]');
  await subPage.waitForFunction(
    () =>
      document
        .querySelector('.rp-feedback-btn[aria-pressed="true"]')
        ?.getAttribute("data-vote") === "issues",
    { timeout: 15000 },
  );
  check("changement d'avis possible (accurate → issues)", true);
  check(
    "agrégat public affiché (compteurs)",
    ((await subPage.textContent(".rp-feedback-counts")) ?? "").includes("I see problems 1"),
  );

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
  await mPage.waitForSelector(".rp .heading-1", { timeout: 30000 });
  const scrollW = await mPage.evaluate(() => document.scrollingElement.scrollWidth);
  check("375 px sans débordement horizontal", scrollW <= 376);
  const mSep = await mPage.evaluate(() => {
    const btn = document.querySelector(".rp-recent-code");
    const mode = document.querySelector(".rp-recent .rp-recent-mode");
    if (!btn || !mode) return null;
    return mode.getBoundingClientRect().left - btn.getBoundingClientRect().right;
  });
  check("375 px : badge mode détaché du code (≥ 8 px)", mSep !== null && mSep >= 8);
  const touch = await mPage.evaluate(() => {
    const btn = document.querySelector(".chevron-button");
    const main = document.querySelector(".rp-submit-main");
    const chip = document.querySelector(".timeline-header .chip");
    const h = (el) => (el ? Math.max(el.getBoundingClientRect().height, 0) : 0);
    return { open: h(btn), main: h(main), chip: h(chip) };
  });
  check("cible tactile bouton principal ≥ 44 px", touch.main >= 44);
  check("cible tactile chevron ligne ≥ 34 px (zone ligne ≥ 44)", touch.open >= 34);
  check("cible tactile puce de métrique ≥ 36 px", touch.chip >= 36);
  const rows = mPage.locator("tr.team-table-main-row");
  check("tables scrollables en mobile", (await rows.count()) === 16);
  check("scroll horizontal table natif (table-scroll)", (await mPage.locator(".table-scroll").count()) >= 2);
  // V4 : transferts + onglets joueur exploitables à 375 px.
  check("375 px : section transferts présente", (await mPage.locator(".transfers-panel").count()) === 1);
  await mPage.locator(".team-table-main-row .chevron-button").first().click();
  await mPage.waitForSelector(".player-stats", { timeout: 10000 });
  const mTabs = mPage.locator(".player-stats-tab");
  check("375 px : 5 onglets joueur", (await mTabs.count()) === 5);
  await mTabs.filter({ hasText: "Units" }).click();
  await mPage.waitForSelector(".player-stats-group", { timeout: 5000 });
  await mPage.locator(".player-stats-group-toggle").first().click();
  await mPage.waitForSelector(".player-stats-unit-tile", { timeout: 5000 });
  check("375 px : section catégorie ouvrable, tuiles rendues", (await mPage.locator(".player-stats-unit-tile").count()) >= 1);
  const scrollW2 = await mPage.evaluate(() => document.scrollingElement.scrollWidth);
  check("375 px : toujours sans débordement après onglets", scrollW2 <= 376);
  await mobile.close();
  await context.close();
} finally {
  await browser.close();
}
console.log(`\n${report.length} contrôles OK (${engine.name()})`);
