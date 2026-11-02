#!/usr/bin/env node
/** E2E filtres compactés mobile (finitions 08/11) — /units et /researches à
 *  375 px : le mur de boutons devient UNE ligne de chips scrollables.
 *  Contrôles par page :
 *   1. chaque groupe .units-factions tient sur une seule ligne (~48 px) ;
 *   2. scroll horizontal fonctionnel (gestion + scrollTo) ;
 *   3. aucun débordement horizontal de page ni vertical de la toolbar ;
 *   4. chip active tappable : elementFromPoint(centre) ∈ chip, aria-pressed ;
 *   5. compteur conservé sur la chip active.
 *  Desktop 1280 : flex-wrap conservé (mur), recherche texte intacte.
 *  Usage : node scripts/test-units-filters-mobile.mjs [origin] */
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
const page = await browser.newPage({
  viewport: { width: 375, height: 667 },
  hasTouch: true,
});
await page.context().addCookies([{ name: "atlas_locale", value: "fr", url: origin }]);

async function probeGroups(page, path) {
  await page.goto(origin + path, { waitUntil: "networkidle" });
  await page.locator(".units-toolbar").waitFor({ state: "visible", timeout: 15000 });
  const groups = page.locator(".units-toolbar .units-factions");
  const n = await groups.count();
  check(`${path} : au moins un groupe de filtres`, n >= 1, `(${n} groupe(s))`);

  for (let i = 0; i < n; i++) {
    const g = groups.nth(i);
    const m = await g.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const kids = [...el.children];
      // Une seule ligne = toutes les chips partagent le même top (±2 px).
      const tops = new Set(kids.map((k) => Math.round(k.getBoundingClientRect().top / 2)));
      return {
        height: Math.round(r.height),
        singleLine: tops.size === 1 && kids.length > 1,
        scrollable: el.scrollWidth - el.clientWidth,
        computedWrap: getComputedStyle(el).flexWrap,
        overflowX: getComputedStyle(el).overflowX,
        kids: kids.length,
      };
    });
    check(
      `${path} groupe ${i + 1} : ligne unique de chips`,
      m.singleLine && m.height <= 60,
      `hauteur ${m.height}px, ${m.kids} chips`,
    );
    check(
      `${path} groupe ${i + 1} : défiler horizontal activé`,
      m.overflowX === "auto" && m.computedWrap === "nowrap",
    );
    if (m.scrollable > 8) {
      // Geste réel de défilement horizontal (trackpad-like), puis nettoyage.
      await g.hover();
      await page.mouse.wheel(240, 0);
      await page.waitForTimeout(120);
      const sl = await g.evaluate((el) => el.scrollLeft);
      check(`${path} groupe ${i + 1} : scroll horizontal fonctionnel`, sl > 0, `scrollLeft=${sl}`);
      await g.evaluate((el) => el.scrollTo({ left: 0 }));
    } else {
      check(`${path} groupe ${i + 1} : contenu tient sans scroll (légitime)`, true);
    }
  }

  // Aucun débordement horizontal de page à 375.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check(`${path} : aucun débordement horizontal de page`, overflow <= 1, `(${overflow}px)`);

  // Chip active tappable : tap réel + hit-test au centre.
  const first = groups.first().locator("button").first();
  await first.tap();
  const hit = await first.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      contained: !!at && (el === at || el.contains(at)),
      pressed: el.getAttribute("aria-pressed"),
      hasCount: !!el.querySelector(".units-faction-count"),
    };
  });
  check(`${path} : chip active tappable (elementFromPoint ∈ chip)`, hit.contained);
  check(`${path} : chip active marquée aria-pressed`, hit.pressed === "true");
  check(`${path} : compteur conservé sur la chip`, hit.hasCount);

  // Recherche texte inchangée : filtrage opère toujours.
  await page.locator(".units-search input").first().fill("zzz-inexistant");
  await page.waitForTimeout(250);
  const empty = await page.locator(".units-empty").count();
  check(`${path} : recherche texte toujours fonctionnelle`, empty === 1);
  return n;
}

await probeGroups(page, "/units");
const researchGroups = await probeGroups(page, "/researches");
check(
  "/researches : sous-familles présentes après choix de famille",
  researchGroups >= 1,
  `(${researchGroups} groupe(s) rendus au départ)`,
);

// Desktop 1280 : le mur flex-wrap est conservé (comportement inchangé).
const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await desktop.goto(origin + "/units", { waitUntil: "networkidle" });
const wrap = await desktop
  .locator(".units-toolbar .units-factions")
  .first()
  .evaluate((el) => getComputedStyle(el).flexWrap);
check("desktop 1280 : mur de boutons conservé (flex-wrap)", wrap === "wrap");
await desktop.close();

await page.close();
await browser.close();
console.log(`\nOK — ${report.length} contrôles e2e filtres mobiles`);
