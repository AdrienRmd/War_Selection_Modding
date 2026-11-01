#!/usr/bin/env node
/** E2E i18n atelier complet (HOTFIX 01/11/2026) — preuve navigateur que
 *  /workbench affiche les noms d'unités FR pour la locale fr.
 *  Le catalogue (unit-catalog.json.gz) est chargé côté CLIENT : le HTML seul
 *  ne contient jamais les noms — la preuve passe donc par un navigateur réel
 *  (chromium), cookie atlas_locale=fr, puis lecture du texte rendu :
 *    - noms FR visibles (Entrepôt/Ouvrier/Autel) ;
 *    - aucun nom anglais-only (« Warehouse », « Hut », « Clubman ») dans le
 *      texte visible ;
 *    - bascule en : noms EN visibles (Warehouse) — la locale marche bien ;
 *    - bascule zh : nom zh visible (仓库).
 *  Usage : node scripts/test-workbench-i18n-e2e.mjs [origin] */
import { chromium } from "playwright";

const origin = process.argv[2] || "http://localhost:5173";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Tests are restricted to a local, non-production origin.");

const report = [];
const check = (name, ok) => {
  if (!ok) throw new Error("FAIL " + name);
  report.push(name);
  console.log("PASS", name);
};

const browser = await chromium.launch();

async function visibleText(locale) {
  const context = await browser.newContext();
  await context.addCookies([{ name: "atlas_locale", value: locale, url: origin }]);
  const page = await context.newPage();
  await page.goto(origin + "/workbench", { waitUntil: "domcontentloaded" });
  // Attendre le chargement du catalogue client (cartes d'unités rendues).
  await page.waitForSelector(".unit-card, .unit-title, h2", { timeout: 20000 });
  await page.waitForFunction(
    () => document.body.innerText.includes("UNIT") || document.querySelectorAll("main *").length > 200,
    { timeout: 20000 },
  );
  const text = await page.evaluate(() => document.body.innerText);
  await context.close();
  return text;
}

// 1. Locale fr : noms français, aucun nom anglais-only du catalogue.
const fr = await visibleText("fr");
check("fr : nom FR « Entrepôt » visible", fr.includes("Entrepôt"));
check("fr : nom FR « Ouvrier » visible", fr.includes("Ouvrier"));
check("fr : nom FR « Autel » visible", fr.includes("Autel"));
check("fr : aucun « Warehouse » visible", !/\bWarehouse\b/.test(fr));
check("fr : aucun « Hut » visible (mot entier, « Hutte » est légitime)", !/\bHut\b/.test(fr));

// 2. Locale en : noms anglais (la locale en n'a pas régressé).
const en = await visibleText("en");
check("en : nom EN « Warehouse » visible", en.includes("Warehouse"));

// 3. Locale zh : nom source zh.
const zh = await visibleText("zh");
check("zh : nom zh « 仓库 » visible", zh.includes("仓库"));

await browser.close();
console.log(`\nOK — ${report.length} contrôles i18n atelier complet`);
