#!/usr/bin/env node
/** Mesure de contraste WCAG du thème Field Archive sombre (Volet B) sur les
 *  pages réelles : /replay (portail + résultat .rp) et /player/[name]
 *  (profil). Pour chaque sélecteur clé : couleur calculée du TEXTE vs fond
 *  EFFECTIF (remonte les parents jusqu'à trouver un fond opaque) ; les
 *  courbes/graphes sont mesurées contre le canvas .rp. Sortie triée, pire
 *  cas en tête ; échec < 4.5:1 (texte) sauf décor pur (indiqué).
 *  Usage : node scripts/check-contrast-replay.mjs [origin] */
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const origin = process.argv[2] || "http://localhost:5173";

const SELECTORS = [
  // — Page (thème Field Archive sombre, replay.css) —
  [".rp-hero h1", "titre portail"],
  [".rp-hero-help", "aide portail (muted)"],
  [".rp-hero-mark", "marque portail (ambre)"],
  [".rp-form .search-input input", "champ code (placeholder/valeur)"],
  [".rp-submit-main", "bouton Analyser (ambre)"],
  [".rp-hero-note", "note code (small muted)"],
  [".rp-recent h2", "titre replays récents"],
  [".rp-recent-code", "pilule code"],
  [".rp-recent .rp-recent-mode", "badge mode 6v6"],
  [".rp-recent .rp-recent-author", "auteur récent"],
  [".rp-feedback-q", "question feedback"],
  [".rp-feedback-btn", "bouton vote feedback"],
  [".rp-feedback-count.accurate", "compteur accurate"],
  [".rp-feedback-count.issues", "compteur issues"],
  // — Canvas résultat .rp (wsva) —
  [".rp .display-title", "titre verdict"],
  [".rp .heading-2.insight-heading", "titres de section"],
  [".rp .label-text", "texte d'aide section"],
  [".rp .team-name-blue", "nom équipe bleue"],
  [".rp .team-name-red", "nom équipe rouge"],
  [".rp .table-caption", "caption tableau transferts"],
  [".rp .cell-strong", "valeurs fortes tableau"],
  [".rp .transfer-gen-veryGenerous", "badge Very generous"],
  [".rp .transfer-gen-fair", "badge Fair"],
  [".rp .transfer-gen-small", "badge Small"],
  [".rp .text-muted", "texte muted wsva"],
  [".rp .small-text", "petit texte wsva"],
  // — Profil —
  [".rp .profile-toolbar .chip", "onglet période profil"],
  [".rp .recent-game .button-text", "lien Voir le replay"],
];

function luminance([r, g, b]) {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const engine = await chromium.launch();
const context = await engine.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await context.route("**/wus-data/content/context.json", (route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: readFileSync("/home/ubuntu/War-Selection/datasets/served/content/context.json", "utf8"),
  }),
);
await context.route("**/wsunitstats.com/**", async (route) => {
  if (route.request().url().includes("replayFile"))
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: readFileSync("/home/ubuntu/War-Selection/datasets/replays/wsva-Jd894wx6so9.json", "utf8"),
    });
  return route.continue();
});

async function measure(url, waitSel) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector(waitSel, { timeout: 20000 });
  await page.waitForTimeout(800);
  const rows = await page.evaluate((selectors) => {
    function effectiveBg(el) {
      let node = el;
      while (node && node !== document.documentElement) {
        const cs = getComputedStyle(node);
        for (const bg of [cs.backgroundColor, cs.backgroundImage]) {
          if (bg && bg !== "none" && !/gradient\(/.test(bg)) {
            const c = parse(bg);
            if (c && c[3] > 0.85) return c;
          }
          if (bg && /gradient\(/.test(bg)) {
            // première couleur du dégradé comme approximation du fond —
            // UNIQUEMENT si opaque (les halos radial-gradient blancs α≈0.08
            // des panneaux wsva ne sont pas des fonds).
            const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(bg);
            if (m && (m[4] === undefined || +m[4] > 0.85)) return [+m[1], +m[2], +m[3]];
          }
        }
        node = node.parentElement;
      }
      return [16, 20, 19];
    }
    function parse(s) {
      const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(s);
      return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
    }
    const out = [];
    for (const [sel] of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const cs = getComputedStyle(el);
      const fg = parse(cs.color);
      if (!fg) continue;
      const bg = effectiveBg(el);
      // blend du fg semi-transparent sur le fond (badges translucides)
      const fgB = [
        fg[3] * fg[0] + (1 - fg[3]) * bg[0],
        fg[3] * fg[1] + (1 - fg[3]) * bg[1],
        fg[3] * fg[2] + (1 - fg[3]) * bg[2],
      ];
      out.push({ sel, fg: cs.color, bg: `rgb(${bg.join(",")})` });
      out[out.length - 1].fgB = fgB.map((v) => Math.round(v));
      out[out.length - 1].bgC = bg;
    }
    return out;
  }, SELECTORS);
  return rows.map((r) => ({
    sel: r.sel,
    fg: r.fg,
    bg: r.bg,
    ratio: +ratio(r.fgB, r.bgC).toFixed(2),
  }));
}

const rowsReplay = await measure(origin + "/replay?code=Jd894wx6so9", ".rp .panel");
const rowsProfile = await measure(origin + "/player/nuttawat", ".rp .panel");
await engine.close();

const seen = new Set();
const all = [...rowsReplay, ...rowsProfile].filter((r) => (seen.has(r.sel) ? false : seen.add(r.sel)));
all.sort((a, b) => a.ratio - b.ratio);
console.log("=== Contrastes WCAG (pires cas en tête ; cible ≥ 4.5) ===");
for (const r of all) console.log(`${String(r.ratio).padStart(6)}  ${r.sel.padEnd(38)} fg=${r.fg} bg=${r.bg}`);
const failing = all.filter((r) => r.ratio < 4.5);
console.log(`\n${all.length} mesures, ${failing.length} sous 4.5:1`);
if (failing.length) {
  console.log("SOUS SEUIL:", failing.map((f) => f.sel).join(", "));
  process.exit(1);
}
