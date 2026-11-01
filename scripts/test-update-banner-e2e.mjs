#!/usr/bin/env node
/** E2E bandeau « nouvelle version disponible » (HOTFIX 31/10/2026).
 *  Navigateur réel (chromium) contre un build servi (wrangler local sur le
 *  dist fusionné, cf. déploiement de validation) :
 *   1. /version.json servi : 200, buildId non vide, Cache-Control no-cache ;
 *   2. pas de bandeau au chargement initial ;
 *   3. buildId servi modifié (mock réseau sur /version.json après le premier
 *      relevé) + retour de visibilité simulé → bandeau visible, textes i18n
 *      FR/EN/ZH corrects ;
 *   4. clic « Recharger » → rechargement réel puis bandeau absent (le relevé
 *      de référence du nouveau document correspond au buildId servi) ;
 *   5. ergonomie mobile 375 px : cible tactile ≥ 44 px, pas de débordement ;
 *   6. prefers-reduced-motion: reduce → aucune animation.
 *  Captures (si HOTFIX_SHOT_DIR défini) : desktop 1280 px + mobile 375 px.
 *  Usage : node scripts/test-update-banner-e2e.mjs [origin] */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const origin = process.argv[2] || "http://127.0.0.1:8788";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Tests are restricted to a local, non-production origin.");
const shotDir = process.env.HOTFIX_SHOT_DIR || "";
if (shotDir) mkdirSync(shotDir, { recursive: true });

const FAKE_BUILD_ID = "e2e-simulated-new-build";
const report = [];
const check = (name, ok) => {
  if (!ok) throw new Error("FAIL " + name);
  report.push(name);
  console.log("PASS", name);
};

/** Mock réseau : le premier /version.json passe au serveur réel (relevé de
 *  référence), tous les suivants servent un buildId différent (simule un
 *  redéploiement pendant que l'onglet est ouvert). */
async function mockVersionEndpoint(context) {
  let served = 0;
  await context.route("**/version.json", async (route) => {
    served += 1;
    if (served === 1) return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Cache-Control": "no-cache" },
      body: JSON.stringify({ buildId: FAKE_BUILD_ID, commit: "e2ecafe" }),
    });
  });
}

async function localeContext(browser, locale, viewport) {
  const context = await browser.newContext({ viewport });
  await context.addCookies([{ name: "atlas_locale", value: locale, url: origin }]);
  await mockVersionEndpoint(context);
  return context;
}

const browser = await chromium.launch();

// 1. Endpoint /version.json servi par le build réel.
{
  const res = await fetch(origin + "/version.json", { cache: "no-store" });
  check("version.json HTTP 200", res.status === 200);
  const payload = await res.json();
  check(
    "version.json expose un buildId non vide",
    typeof payload.buildId === "string" &&
      payload.buildId.length > 0 &&
      payload.buildId !== FAKE_BUILD_ID,
  );
  check(
    "version.json servi sans cache immuable",
    !/immutable|max-age=[1-9]/.test(res.headers.get("cache-control") ?? ""),
  );
}

// 2+3. Scénario principal en français : pas de bandeau, puis buildId modifié
//     + retour de visibilité → bandeau.
{
  const context = await localeContext(browser, "fr", { width: 1280, height: 800 });
  const page = await context.newPage();
  await page.goto(origin + "/", { waitUntil: "networkidle" });
  check(
    "pas de bandeau au chargement initial",
    (await page.locator(".update-banner").count()) === 0,
  );

  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.locator(".update-banner").waitFor({ state: "visible", timeout: 5000 });
  const text = await page.locator(".update-banner").innerText();
  check("bandeau visible après changement de buildId servi", true);
  check("message FR correct", text.includes("Une nouvelle version est disponible"));
  check(
    "bouton FR « Recharger »",
    (await page.locator(".update-banner-reload").innerText()).includes("Recharger"),
  );
  check(
    "bandeau annoncé aux lecteurs d'écran (role=status)",
    (await page.locator(".update-banner").getAttribute("role")) === "status",
  );
  if (shotDir) await page.screenshot({ path: shotDir + "/hotfix-version-banner-desktop-1280.png" });

  // 4. Clic → rechargement réel → le nouveau document prend le buildId mocké
  //    comme référence → plus de bandeau (pas de boucle).
  await page.locator(".update-banner-reload").click();
  await page.waitForLoadState("networkidle");
  check(
    "rechargement au clic puis bandeau absent",
    (await page.locator(".update-banner").count()) === 0,
  );
  await context.close();
}

// 3bis. Locales EN et ZH.
for (const [locale, expected] of [
  ["en", "A new version is available"],
  ["zh", "有新版本可用。"],
]) {
  const context = await localeContext(browser, locale, { width: 1280, height: 800 });
  const page = await context.newPage();
  await page.goto(origin + "/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.locator(".update-banner").waitFor({ state: "visible", timeout: 5000 });
  check(
    `message ${locale.toUpperCase()} correct`,
    (await page.locator(".update-banner").innerText()).includes(expected),
  );
  await context.close();
}

// 5. Mobile 375 px : cible ≥ 44 px, aucun débordement horizontal.
{
  const context = await localeContext(browser, "fr", { width: 375, height: 667 });
  const page = await context.newPage();
  await page.goto(origin + "/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  const banner = page.locator(".update-banner");
  await banner.waitFor({ state: "visible", timeout: 5000 });
  const button = page.locator(".update-banner-reload");
  const buttonBox = await button.boundingBox();
  const bannerBox = await banner.boundingBox();
  check("cible tactile ≥ 44 px (375 px)", buttonBox !== null && buttonBox.height >= 44);
  check(
    "bandeau sans débordement horizontal (375 px)",
    bannerBox !== null && bannerBox.x >= 0 && bannerBox.x + bannerBox.width <= 375.5,
  );
  if (shotDir) await page.screenshot({ path: shotDir + "/hotfix-version-banner-mobile-375.png" });
  await context.close();
}

// 6. prefers-reduced-motion: reduce → pas d'animation d'entrée.
{
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
  await context.addCookies([{ name: "atlas_locale", value: "fr", url: origin }]);
  await mockVersionEndpoint(context);
  const page = await context.newPage();
  await page.goto(origin + "/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.locator(".update-banner").waitFor({ state: "visible", timeout: 5000 });
  const animation = await page.evaluate(
    () => getComputedStyle(document.querySelector(".update-banner")).animationName,
  );
  check("prefers-reduced-motion: animation neutralisée", animation === "none");
  await context.close();
}

await browser.close();
console.log(`\n${report.length}/${report.length} contrôles OK (bandeau nouvelle version)`);
