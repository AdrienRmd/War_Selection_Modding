#!/usr/bin/env node
/** E2E procédure correction/retrait auteurs (finitions 01/11, chantier 8) :
 *  lien mailto pré-rempli sur une fiche carte (FR) + section « Droits des
 *  créateurs » sur /legal (3 locales). Usage : [origin] */
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
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
await page.context().addCookies([{ name: "atlas_locale", value: "fr", url: origin }]);

// Fiche FR (carte titrée) : lien + mailto avec code et nom pré-remplis.
await page.goto(origin + "/maps/map-00200088", { waitUntil: "networkidle" });
const link = page.locator(".map-author-rights a");
await link.waitFor({ state: "visible", timeout: 10000 });
const href = (await link.getAttribute("href")) ?? "";
check(
  "fiche : lien « Signaler / demander une correction ou un retrait » visible",
  (await link.innerText()).includes("Signaler / demander une correction"),
);
check("fiche : mailto vers l'éditeur", href.startsWith("mailto:adrien.remond@protonmail.com"));
check("fiche : sujet pré-rempli avec le code de la carte", href.includes(encodeURIComponent("map-00200088")), href.slice(0, 80));
const decoded = decodeURIComponent(href);
check("fiche : corps pré-rempli avec code + nom + motif", decoded.includes("Code de carte : map-00200088") && decoded.includes("Nom : Bataille de Stalingrad") && decoded.includes("ce qui doit être corrigé"));

// Fiche sans nom : le corps utilise le défaut propre « Carte <code> ».
await page.goto(origin + "/maps/map-1c54042c", { waitUntil: "networkidle" });
const href2 = (await page.locator(".map-author-rights a").getAttribute("href")) ?? "";
check(
  "fiche sans nom : corps avec défaut « Carte map-… »",
  decodeURIComponent(href2).includes("Nom : Carte map-1c54042c"),
);

// /legal : section « Droits des créateurs » présente dans les 3 locales.
for (const [loc, heading] of [
  ["fr", "Droits des créateurs"],
  ["en", "Creators' rights"],
  ["zh", "创作者权利"],
]) {
  await page.context().clearCookies();
  await page.context().addCookies([{ name: "atlas_locale", value: loc, url: origin }]);
  await page.goto(origin + "/legal", { waitUntil: "networkidle" });
  const h = page.getByRole("heading", { name: heading });
  check(`/legal ${loc} : section « ${heading} »`, (await h.count()) === 1);
}

await page.close();
await browser.close();
console.log(`\nOK — ${report.length} contrôles e2e droits des créateurs`);
