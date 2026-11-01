#!/usr/bin/env node
/** E2E guide d'installation 3 étapes (finitions 01/11, chantier 6) — /mods et
 *  /maps : guide visible, 3 étapes numérotées en FR, CTA atelier simple,
 *  fermeture persistée (localStorage), réouverture après vidage.
 *  Usage : node scripts/test-install-guide-e2e.mjs [origin] */
import { chromium } from "playwright";

const origin = process.argv[2] || "http://localhost:5173";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Tests are restricted to a local, non-production origin.");

const report = [];
const check = (name, ok, detail = "") => {
  if (!ok) throw new Error(`FAIL ${name} ${detail}`);
  report.push(name);
  console.log("PASS", name, detail);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 }, hasTouch: true });
await page.context().addCookies([{ name: "atlas_locale", value: "fr", url: origin }]);

const STEPS_FR = [
  "Copiez le code de partage depuis la fiche",
  "partage de cartes pour une carte, chargement de mods",
  "Collez le code, validez, et lancez une partie privée",
];

for (const path of ["/maps", "/mods"]) {
  await page.goto(origin + path, { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  const guide = page.locator(".install-guide");
  await guide.waitFor({ state: "visible", timeout: 10000 });
  check(`${path} : guide d'installation visible`, true);
  const text = await guide.innerText();
  for (const s of STEPS_FR)
    check(`${path} : étape FR présente — « ${s.slice(0, 30)}… »`, text.includes(s));
  const steps = await guide.locator(".install-guide-steps li").count();
  check(`${path} : exactement 3 étapes`, steps === 3, `(${steps})`);
  const cta = guide.locator(".install-guide-cta");
  check(
    `${path} : CTA « Atelier simple » vers /workbench/simple`,
    (await cta.getAttribute("href")) === "/workbench/simple" &&
      /Atelier simple/.test(await cta.innerText()),
  );

  // Fermeture + persistance après rechargement.
  await guide.locator(".install-guide-close").tap();
  await page.waitForTimeout(150);
  const storageKey = `atlas.install-guide.${path.slice(1)}`;
  check(
    `${path} : fermeture persistée (localStorage)`,
    (await page.evaluate((k) => window.localStorage.getItem(k), storageKey)) === "closed",
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  check(`${path} : guide fermé après rechargement`, (await page.locator(".install-guide").count()) === 0);
}

// Desktop : guide visible aussi en 1440 (rendu vérifié, capture dédiée).
const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await desktop.context().addCookies([{ name: "atlas_locale", value: "fr", url: origin }]);
await desktop.goto(origin + "/mods", { waitUntil: "networkidle" });
check("desktop 1440 : guide visible sur /mods", await desktop.locator(".install-guide").isVisible());
await desktop.close();

await page.close();
await browser.close();
console.log(`\nOK — ${report.length} contrôles e2e guide d'installation`);
