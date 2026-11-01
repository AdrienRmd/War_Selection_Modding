#!/usr/bin/env node
/** E2E filtre Joueurs NvN sur /maps (finitions 08/11).
 *  Contrôles (375 px, locale fr) :
 *   1. le sélecteur « Joueurs » existe avec les formats RÉELS des données
 *      (options NvN construites depuis le champ players, compte impair
 *      jamais proposé) ;
 *   2. filtrer 4v4 → ne restent QUE des cartes 8 joueurs (méta « 8 joueurs »)
 *      et le compteur = nombre de cartes 8 joueurs du corpus complet
 *      (chargées via « afficher plus ») ; aucune carte « non renseignée » ;
 *   3. « Nombre de joueurs inconnu » → uniquement des cartes sans nombre ;
 *   4. retour à « Joueurs : tous » → compteur initial restauré.
 *  Usage : node scripts/test-maps-filters-e2e.mjs [origin] */
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
await page.goto(origin + "/maps", { waitUntil: "networkidle" });

const counter = page.locator(".collection-toolbar > span[aria-live]");
const playersSelect = page.locator("select[aria-label='Filtrer par nombre de joueurs']");
await playersSelect.waitFor({ state: "visible", timeout: 10000 });

const options = await playersSelect.locator("option").allTextContents();
console.log("options Joueurs :", JSON.stringify(options));
check(
  "sélecteur Joueurs : « tous » + formats NvN pairs uniquement",
  options.some((o) => o.startsWith("Joueurs : tous")) &&
    options.some((o) => o.startsWith("4v4")) &&
    options.some((o) => o.startsWith("1v1")) &&
    options.some((o) => o.startsWith("25v25")),
);
check(
  "formats impairs jamais proposés (3, 9, 15, 25 joueurs ≠ NvN)",
  !options.some((o) => /^(3 ·|9 ·|15 ·|25 ·|31 ·|43 ·|63 ·)/.test(o)),
);

const initialCount = Number((await counter.innerText()).match(/\d+/)?.[0] ?? 0);

/** Charge toutes les cartes restantes (« afficher plus ») puis lit les méta. */
async function loadAllCards() {
  for (let i = 0; i < 40; i++) {
    const more = page.getByRole("button", { name: /cartes de plus/ });
    if (!(await more.count())) break;
    await more.first().click();
    await page.waitForTimeout(150);
  }
  const metas = await page.locator(".collection-meta span").allTextContents();
  // Seul le second span de chaque carte porte le nombre de joueurs
  // (l'auteur peut contenir « joueurs » dans un pseudo — filtre structurel).
  return metas.filter((_, i) => i % 2 === 1);
}

// — Filtre 4v4 —
await playersSelect.selectOption({ label: options.find((o) => o.startsWith("4v4")) });
await page.waitForTimeout(300);
const count4v4 = Number((await counter.innerText()).match(/\d+/)?.[0] ?? 0);
const metas4v4 = await loadAllCards();
const with8 = metas4v4.filter((t) => /8 joueurs/.test(t)).length;
const unknownMeta = metas4v4.filter((t) => /inconnu/i.test(t)).length;
check("4v4 : uniquement des cartes « 8 joueurs »", with8 === metas4v4.length && metas4v4.length > 0,
  `(${with8}/${metas4v4.length} cartes « 8 joueurs »)`);
check("4v4 : aucune carte sans nombre de joueurs", unknownMeta === 0);
check("4v4 : compteur = cartes du corpus au format 8 joueurs", count4v4 === with8, `(${count4v4})`);

// — Non renseigné —
const noneLabel = options.find((o) => o.startsWith("Nombre de joueurs inconnu"));
check("option « non renseigné » présente (volumétrie significative)", !!noneLabel);
if (noneLabel) {
  await playersSelect.selectOption({ label: noneLabel });
  await page.waitForTimeout(300);
  const countNone = Number((await counter.innerText()).match(/\d+/)?.[0] ?? 0);
  const metasNone = await loadAllCards();
  check(
    "non renseigné : uniquement des cartes sans nombre",
    metasNone.length > 0 && metasNone.every((t) => /inconnu/i.test(t)),
    `(${metasNone.length} cartes)`,
  );
  check("non renseigné : compteur = option annoncée", countNone === Number(noneLabel.match(/(\d+)\s*$/)?.[1]),
    `(${countNone})`);
}

// — Retour à tous —
await playersSelect.selectOption({ index: 0 });
await page.waitForTimeout(300);
check(
  "retour « Joueurs : tous » restaure le corpus complet",
  Number((await counter.innerText()).match(/\d+/)?.[0] ?? 0) === initialCount,
);

// — Tri du listing (finitions 08/11, chantier 5) —
const sortSelect = page.locator("select[aria-label='Ordre de tri']");
await sortSelect.waitFor({ state: "visible", timeout: 10000 });
check("tri : défaut = Récemment ajoutées (ordre d'import)", (await sortSelect.inputValue()) === "recent");
check(
  "tri : mention discrète « ordre d'import » affichée sur le défaut",
  (await page.locator(".collection-sort-note").innerText()).includes("ordre d'import"),
);

// Vérité terrain : ordre d'import = source_order décroissant sur les seeds
// fusionnés (D1 local vide — même logique que lib/collection.ts).
const { readFileSync } = await import("node:fs");
const base = JSON.parse(
  readFileSync(new URL("../lib/collection-seeds.json", import.meta.url)),
  "utf8",
);
const discord = JSON.parse(
  readFileSync(new URL("../lib/discord-map-seeds.json", import.meta.url)),
  "utf8",
);
const byCode = new globalThis.Map(base.map((m) => [m.map_code, m]));
for (const inc of discord) {
  const cur = byCode.get(inc.map_code);
  if (!cur) byCode.set(inc.map_code, inc);
  else {
    const merged = { ...inc, ...cur };
    if (!merged.players) merged.players = inc.players;
    byCode.set(inc.map_code, merged);
  }
}
const listed = [...byCode.values()].filter((m) => m.visibility !== "hidden");
const newest = listed.reduce((a, b) => (b.source_order > a.source_order ? b : a));
const firstHref = await page.locator(".collection-card h3 a").first().getAttribute("href");
check(
  "tri défaut : 1ʳᵉ carte = import le plus récent (source_order max)",
  firstHref === `/maps/${newest.id}`,
  `(attendu ${newest.id}, source_order ${newest.source_order})`,
);

// A→Z : les 5 premiers titres triés ascendants (locale fr), ordre changé.
const hrefsBefore = await page.locator(".collection-card h3 a").evaluateAll((els) =>
  els.slice(0, 5).map((el) => el.getAttribute("href")),
);
await sortSelect.selectOption("az");
await page.waitForTimeout(300);
const titles = await page.locator(".collection-card h3 a").allTextContents();
const first5 = titles.slice(0, 5).map((s) => s.trim());
const sorted5 = [...first5].sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
check("tri A→Z : 5 premiers titres ascendants", JSON.stringify(first5) === JSON.stringify(sorted5),
  `(${first5.join(" | ")})`);
const hrefsAfter = await page.locator(".collection-card h3 a").evaluateAll((els) =>
  els.slice(0, 5).map((el) => el.getAttribute("href")),
);
check("tri A→Z : l'ordre a réellement changé", JSON.stringify(hrefsBefore) !== JSON.stringify(hrefsAfter));
check("tri A→Z : mention d'import retirée", (await page.locator(".collection-sort-note").count()) === 0);

// Persistance localStorage (leçon 16) + réinitialisation propre.
check(
  "tri : préférence persistée (localStorage)",
  (await page.evaluate(() => window.localStorage.getItem("atlas.maps.sort"))) === "az",
);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(400);
const sortSelect2 = page.locator("select[aria-label='Ordre de tri']");
await sortSelect2.waitFor({ state: "visible", timeout: 10000 });
check("tri : préférence restaurée après rechargement", (await sortSelect2.inputValue()) === "az");
await sortSelect2.selectOption("recent");
await page.waitForTimeout(150);

// « Les plus jouées » : DONNÉE INEXISTANTE côté source — jamais proposée.
const sortOptions = await sortSelect2.locator("option").allTextContents();
check(
  "tri : aucune option de popularité inventée (pas de stats par carte côté jeu)",
  !sortOptions.some((o) => /jou[ée]|play(ed|s)|popul/i.test(o)),
  JSON.stringify(sortOptions),
);

// — Fiches trilingues (finitions 01/11, chantier 4) —
// Échantillon FR : titres sans CJK, sans « Carte non identifiée », recherche FR
// et EN via le dictionnaire. (Re-localisation des contrôles après rechargement.)
const playersSelect3 = page.locator("select[aria-label='Filtrer par nombre de joueurs']");
await playersSelect3.selectOption({ index: 0 }); // Joueurs : tous
await page.locator("select[aria-label='Ordre de tri']").selectOption("az");
await page.waitForTimeout(300);
await page.locator(".collection-card h3 a").first().waitFor();
const sampleTitles = await page.locator(".collection-card h3 a").allTextContents();
check(
  "FR : aucun titre de carte avec caractères chinois résiduels (échantillon affiché)",
  sampleTitles.every((t) => !/[\u4e00-\u9fff]/.test(t)),
  `(${sampleTitles.length} titres)`,
);
check(
  "FR : plus aucun « Carte non identifiée » en titre",
  sampleTitles.every((t) => !/non identifi/i.test(t)),
);
// Défaut propre : filtre « Nom à compléter » (fiches sans nom) → tous « Carte <code> ».
await page
  .locator("select[aria-label='Filtrer les cartes sauvegardées']")
  .selectOption("unknown");
await page.waitForTimeout(300);
const untitledTitles = await page.locator(".collection-card h3 a").allTextContents();
check(
  "FR : défaut propre « Carte <code> » présent sur les fiches sans nom",
  untitledTitles.some((t) => /^Carte map-[0-9a-f]+$/.test(t.trim())) &&
    untitledTitles.every((t) => !/non identifi/i.test(t)),
  `(${untitledTitles.filter((t) => /^Carte map-/.test(t.trim())).length} « Carte <code> » sur ${untitledTitles.length})`,
);
await page
  .locator("select[aria-label='Filtrer les cartes sauvegardées']")
  .selectOption("all");
// Recherche trilingue : FR (dictionnaire) et EN (données) → résultats.
const searchBox = page.locator("input[aria-label='Rechercher des cartes sauvegardées']");
await searchBox.fill("bataille de stalingrad");
await page.waitForTimeout(300);
let results = Number((await counter.innerText()).match(/\d+/)?.[0] ?? 0);
let first = (await page.locator(".collection-card h3 a").first().innerText()).trim();
check("recherche FR « bataille de stalingrad » → au moins 1 résultat", results >= 1, `(${results})`);
check("recherche FR : 1ʳᵉ carte = Bataille de Stalingrad (dictionnaire)", /Bataille de Stalingrad/.test(first), `(${first})`);
await searchBox.fill("westerplatte");
await page.waitForTimeout(300);
results = Number((await counter.innerText()).match(/\d+/)?.[0] ?? 0);
first = (await page.locator(".collection-card h3 a").first().innerText()).trim();
check("recherche EN « westerplatte » → 1 résultat, titre nettoyé", results === 1 && first === "Westerplatte", `(${first})`);
await searchBox.fill("");
await page.waitForTimeout(200);

await page.close();
await browser.close();
console.log(`\nOK — ${report.length} contrôles e2e filtre Joueurs NvN`);
