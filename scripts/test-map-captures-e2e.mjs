#!/usr/bin/env node
/** E2E captures en jeu (finitions 01/11, chantier 7) — flux complet sur le
 *  dev local (identité locale = admin) :
 *   1. fiche FR : section « Captures en jeu » présente, vide ;
 *   2. upload mocké (PNG 1×1) → 201 pending, visible par son auteur
 *      (badge attente), fichier servi au propriétaire ;
 *   3. /admin : file de modération présente avec la capture ;
 *   4. publication admin → visible par un anonyme (image publique, cache
 *      public) ;
 *   5. retrait auteur → n'apparaît plus publiquement.
 *  Usage : node scripts/test-map-captures-e2e.mjs [origin] */
import { chromium } from "playwright";

const origin = process.argv[2] || "http://localhost:5173";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Tests are restricted to a local, non-production origin.");

// PNG 1×1 minimal (blanc) — capture mockée volontaire, jamais une vraie image
// de jeu : le but est le flux, pas le contenu.
const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const png = Buffer.from(PNG_B64, "base64");

const MAP = "map-00200088";
const report = [];
const check = (name, ok, detail = "") => {
  if (!ok) throw new Error(`FAIL ${name} ${detail}`);
  report.push(name);
  console.log("PASS", name, detail);
};

const browser = await chromium.launch();

// Nettoyage préalable : les runs interrompus peuvent laisser des captures
// de test — on retire tout ce qui reste pour cette carte (l'admin local est
// aussi l'auteur des captures de test).
{
  const cleanupCtx = await browser.newContext();
  await cleanupCtx.addCookies([
    { name: "__sites_local_auth", value: "1", url: origin },
  ]);
  const c = cleanupCtx.request;
  const existing = await (await c.get(`${origin}/api/map-captures/${MAP}`)).json();
  for (const item of existing.items ?? []) {
    await c.patch(`${origin}/api/map-captures/${item.id}`, {
      headers: { Origin: origin, "Content-Type": "application/json" },
      data: { action: "withdraw" },
    });
  }
  await cleanupCtx.close();
}

// 1. Anonyme : section présente, vide.
const anon = await browser.newContext({ viewport: { width: 375, height: 812 } });
await anon.addCookies([{ name: "atlas_locale", value: "fr", url: origin }]);
let page = await anon.newPage();
await page.goto(`${origin}/maps/${MAP}`, { waitUntil: "networkidle" });
await page
  .locator(".map-captures", { hasText: "Captures en jeu" })
  .first()
  .waitFor({ state: "visible", timeout: 10000 });
check("fiche FR : section « Captures en jeu » visible", true);
check(
  "fiche FR : aucune capture au départ",
  (await page.locator(".map-captures-grid a, .map-captures-pending").count()) === 0,
);
check(
  "fiche FR : formulaire masqué pour l'anonyme, invitation à se connecter",
  (await page.locator(".map-captures-form").count()) === 0 &&
    (await page.locator(".map-captures").innerText()).includes("Connectez-vous"),
);

// 2. Identité locale (admin) : upload via le VRAI formulaire (le composant
//    rafraîchit sa liste après envoi — aucun souci de cache navigateur).
const admin = await browser.newContext({ viewport: { width: 375, height: 812 } });
await admin.addCookies([
  { name: "atlas_locale", value: "fr", url: origin },
  { name: "__sites_local_auth", value: "1", url: origin },
]);
page = await admin.newPage();
await page.goto(`${origin}/maps/${MAP}`, { waitUntil: "networkidle" });
await page.locator(".map-captures-form").waitFor({ state: "visible", timeout: 10000 });
check("fiche connectée : formulaire d'upload présent", true);

const apiContext = admin.request;
const captureFile = "/tmp/ws-capture-e2e.png";
const fs = await import("node:fs");
fs.writeFileSync(captureFile, png);
await page.locator(".map-captures-form input[type=file]").setInputFiles(captureFile);
await page.locator(".map-captures-form input[name=caption]").fill("Capture e2e (mock)");
await page.getByRole("button", { name: /Envoyer la capture/ }).click();
await page
  .locator(".map-captures-done", { hasText: /Envoy[ée]e/ })
 .waitFor({ state: "visible", timeout: 10000 });
check("upload via formulaire → accusé « Envoyée »", true);

// L'id de la capture soumise vient de la liste (author = admin local).
const listAfter = await (await apiContext.get(`${origin}/api/map-captures/${MAP}`)).json();
const submittedItem = (listAfter.items ?? []).find((i) => i.caption === "Capture e2e (mock)");
check("API : capture en attente (pending, mine)", !!submittedItem && submittedItem.status === "pending");
const captureId = submittedItem?.id;

await page
  .locator(".map-captures-pending", { hasText: /En attente/ })
  .first()
  .waitFor({ state: "visible", timeout: 10000 });
check("auteur voit sa capture en attente (badge)", true);
const ownFile = await apiContext.get(`${origin}/api/map-captures/file/${captureId}`);
check("fichier servi au propriétaire (pending)", ownFile.status() === 200, `(${ownFile.status()})`);

// 3. /admin : file de modération.
await page.goto(`${origin}/admin`, { waitUntil: "networkidle" });
await page.getByRole("tab", { name: /cartes|地图|maps/i }).first().click().catch(() => {});
await page
  .locator(".captures-moderation", { hasText: "capture" })
  .first()
  .waitFor({ state: "visible", timeout: 10000 });
check("/admin : file « Modération des captures en jeu » présente", true);
check(
  "/admin : la capture soumise y figure",
  (await page.locator(".captures-moderation-list").innerText()).includes(MAP),
);

// 4. Publication admin → visible anonyme (contexte NEUF : la liste publique
//    est mise en cache navigateur 30 s — un contexte vierge garantit un fetch
//    frais, ce que verrait un vrai nouveau visiteur).
const publish = await apiContext.patch(`${origin}/api/map-captures/${captureId}`, {
  headers: { Origin: origin, "Content-Type": "application/json" },
  data: { status: "published" },
});
check("publication admin acceptée", publish.status() === 200, `(${publish.status()})`);

const anonFresh = await browser.newContext({ viewport: { width: 375, height: 812 } });
await anonFresh.addCookies([{ name: "atlas_locale", value: "fr", url: origin }]);
const anonPage = await anonFresh.newPage();
await anonPage.goto(`${origin}/maps/${MAP}`, { waitUntil: "networkidle" });
await anonPage
  .locator(".map-captures-grid a", { hasText: "" })
  .first()
  .waitFor({ state: "visible", timeout: 10000 });
check("anonyme voit la capture publiée (grille)", true);
const anonFile = await anon.request.get(`${origin}/api/map-captures/file/${captureId}`);
check(
  "fichier publié public (200, cache public)",
  anonFile.status() === 200 &&
    (anonFile.headers()["cache-control"] ?? "").includes("public"),
  `(${anonFile.status()}, ${anonFile.headers()["cache-control"]})`,
);
const capText = await anonPage.locator(".map-captures").innerText();
check("légende publiée affichée", capText.includes("Capture e2e (mock)"));

// Capture d'écran de preuve (fiche avec capture publiée).
await anonPage
  .locator(".map-captures")
  .scrollIntoViewIfNeeded();
await anonPage
  .locator(".map-captures")
  .screenshot({ path: "/home/ubuntu/War-Selection/validation/design/finitions/apres-c7-capture-publiee-375.png" });
console.log("CAPTURE apres-c7-capture-publiee-375.png");

// 5. Nettoyage : retrait auteur (l'admin local est aussi l'auteur ici).
const withdraw = await apiContext.patch(`${origin}/api/map-captures/${captureId}`, {
  headers: { Origin: origin, "Content-Type": "application/json" },
  data: { action: "withdraw" },
});
check("retrait auteur accepté", withdraw.status() === 200, `(${withdraw.status()})`);
const checkPage = await anon.newPage();
await checkPage.goto(`${origin}/maps/${MAP}`, { waitUntil: "networkidle" });
await checkPage.waitForTimeout(600);
check(
  "après retrait : plus aucune capture publique",
  (await checkPage.locator(".map-captures-grid a").count()) === 0,
);

await browser.close();
console.log(`\nOK — ${report.length} contrôles e2e captures en jeu`);
