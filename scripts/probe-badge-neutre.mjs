#!/usr/bin/env node
/** Vérification badge version neutre (chantier 1) — sur origine de dev où
 *  /wus-data ne répond PAS (404) : le badge doit être ABSENT du HTML initial
 *  puis passer à l'état erreur discret (jamais « Lecture de la version… »).
 *  Usage : node scripts/probe-badge-neutre.mjs [origin] */
import { chromium } from "playwright";

const origin = process.argv[2] || "http://localhost:5173";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.context().addCookies([{ name: "atlas_locale", value: "fr", url: origin }]);

for (const [name, url] of [
  ["units", "/units"],
  ["researches", "/researches"],
  ["modding", "/modding"],
  ["home-explore", "/"],
]) {
  const res = await page.goto(origin + url, { waitUntil: "domcontentloaded" });
  const html = await res.text();
  const ssrBadge = /data-badge="(units|researches|modding|explore)-updated"/.test(html);
  const ssrLoading = html.includes("Lecture de la version du jeu de données");
  await page.waitForTimeout(1200); // fetch manifeste résolu (404 en dev → failed)
  const badges = await page.locator("[data-badge$='-updated']").allTextContents();
  console.log(
    `${name.padEnd(13)} | badge SSR: ${ssrBadge ? "PRÉSENT (KO)" : "absent (OK)"} | texte lecture SSR: ${ssrLoading ? "KO" : "non (OK)"} | après fetch: ${JSON.stringify(badges)}`,
  );
}
await browser.close();
