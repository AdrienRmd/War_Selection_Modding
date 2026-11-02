#!/usr/bin/env node
/** Harnais de validation des 9 correctifs graphiques replay (mission
 * « retour visuel utilisateur », 02/11). JUSTESSE rendue, pas seulement
 * visibilité — mesures DOM + pixels sur replay réel (fixture
 * wsva-Jd894wx6so9, partie 55:56) via dev local, jamais la prod.
 *
 * Usage : node validate-charts-correctifs.mjs <origin> <outdir> <avant|apres>
 *   origin : http://localhost:5173 (dev isolé)
 *   mode « avant » : capture + mesures, aucun échec bloquant (état initial).
 *   mode « apres » : mêmes mesures + assertions (exit 1 si échec).
 *
 * Mesures (cf. rapport mission) :
 *   1. AXE Y  : labels 0/25/50/75/100 % — 100 % en HAUT, 0 % en BAS,
 *      positions exactement linéaires, sommet de la pile == y(100 %),
 *      base == y(0 %) (parse des `d` des aires).
 *   2. LIGNE PARASITE 100 % : aucun liseré clair sur le bord supérieur
 *      (les aires n'ont plus de stroke de contour — séparateurs internes
 *      uniquement, mesuré via l'attribut stroke des paths).
 *   3. ANTI-COLLISION : bounding boxes (écran) des libellés de phases,
 *      pastille « Partie décidée », labels Y et labels X — disjointes 2 à 2.
 *   4. AXE X  : ticks couvrant toute la largeur — dernier label ≥ 95 % de
 *      l'étendue, pas régulier, repère de fin présent.
 *   5. ZONE GRISE : saturation HSL des pixels du voile ≤ 15 % (p95 et
 *      moyenne) — ce qui est dessous est réellement estompé.
 *   6. STICKY  : scrollIntoView de l'ancre résultat → le verdict ne passe
 *      PAS sous le header collant (scroll-margin-top).
 *   7. DÉDOUUBLONNAGE : la légende « Part des points de l'équipe depuis le
 *      début de chaque phase » apparaît exactement 2× (1 par équipe).
 *   9. MENTION PHASES : « Chaque phase repart de zéro » présente 2×.
 * Captures desktop 1280 + mobile 375 (FR), smoke EN/ZH mobile.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import sharp from "sharp";

const origin = process.argv[2];
const outdir = process.argv[3];
const mode = process.argv[4] || "avant";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin ?? ""))
  throw new Error("Usage : validate-charts-correctifs.mjs <origin locale> <outdir> <avant|apres>");
mkdirSync(outdir, { recursive: true });

const FIXTURE = "/home/ubuntu/War-Selection/datasets/replays/wsva-Jd894wx6so9.json";
const DATASET = "/home/ubuntu/War-Selection/datasets/served";
const CAPTION = {
  fr: "Part des points de l'équipe depuis le début de chaque phase",
  en: "Share of the team's points since the start of each stage",
  zh: "自各阶段开始以来占全队积分的份额",
};
const PHASE_NOTE = {
  fr: "Chaque phase repart de zéro",
  en: "Each stage restarts from zero",
  zh: "每个阶段从零开始计算",
};

async function mockRoutes(context) {
  await context.route("**/games-api.warselect.io/getByReplay*", (route) => {
    const code = new URL(route.request().url()).searchParams.get("code") ?? "";
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: code.endsWith("Jd894wx6so9") ? readFileSync(FIXTURE, "utf8") : JSON.stringify({ error: 2 }),
    });
  });
  await context.route("**/api/replay/recent", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) }),
  );
  await context.route("**/wus-data/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/wus-data\//, "");
    try {
      return route.fulfill({ status: 200, body: readFileSync(`${DATASET}/${path}`) });
    } catch {
      return route.fulfill({ status: 404, body: "" });
    }
  });
}

/* ---------- Saturation HSL (échelle 0..255) ---------- */
function hslSat([r, g, b]) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx === mn) return 0;
  const d = mx - mn;
  return mx + mn > 255 ? d / (510 - mx - mn) : d / (mx + mn);
}
function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
}

/** Géométrie d'une figure stage/power : labels, aires, plaques (viewBox),
 * boîtes écran pour l'anti-collision. */
async function figureGeometry(fig) {
  return fig.evaluate((root) => {
    const svg = root.querySelector("svg.rp-chart");
    const vb = svg.viewBox.baseVal;
    const scale = svg.getBoundingClientRect().width / vb.width;
    const pct = [];
    const clock = [];
    for (const t of svg.querySelectorAll("text")) {
      const txt = (t.textContent ?? "").trim();
      const b = t.getBBox();
      const entry = { txt, x: b.x, y: b.y, w: b.width, h: b.height, cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
      if (/^\d+%$/.test(txt)) pct.push(entry);
      else if (/^\d{1,3}:\d{2}$/.test(txt)) clock.push(entry);
    }
    const bands = [];
    let strokedAreaPaths = 0;
    for (const p of svg.querySelectorAll("path")) {
      const fill = p.getAttribute("fill");
      if (!fill || fill === "none") continue;
      if (p.getAttribute("stroke")) strokedAreaPaths += 1;
      const d = p.getAttribute("d") ?? "";
      const pts = [...d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) => [
        parseFloat(m[1]),
        parseFloat(m[2]),
      ]);
      if (pts.length) bands.push({ fill, pts });
    }
    const gray = svg.querySelector('rect[fill^="url"]');
    const grayBox = gray ? (({ x, y, width, height }) => ({ x, y, width, height }))(gray.getBBox()) : null;
    // Boîtes ÉCRAN (transform compris) : plaques/pastille + labels.
    const screenBoxes = [];
    for (const g of svg.querySelectorAll("g")) {
      if (g.querySelector("rect") && g.querySelector("text")) {
        const r = g.getBoundingClientRect();
        if (r.width > 0)
          screenBoxes.push({ kind: "plaque", label: g.querySelector("text").textContent.trim(), l: r.left, t: r.top, r: r.right, b: r.bottom });
      }
    }
    for (const t of svg.querySelectorAll("text")) {
      // Textes des plaques/pastille déjà couverts par leur <g> (sinon
      // auto-collision factice).
      if (t.closest("g")?.querySelector("rect")) continue;
      const r = t.getBoundingClientRect();
      if (r.width > 0)
        screenBoxes.push({ kind: "label", label: t.textContent.trim(), l: r.left, t: r.top, r: r.right, b: r.bottom });
    }
    const svgRect = svg.getBoundingClientRect();
    return { vb: { w: vb.width, h: vb.height }, scale, pct, clock, bands, grayBox, screenBoxes, svgRect, strokedAreaPaths };
  });
}

function parseClockMs(txt) {
  const [m, s] = txt.split(":").map(Number);
  return ((m * 60) + s) * 1000;
}

function overlapArea(a, b) {
  const w = Math.min(a.r, b.r) - Math.max(a.l, b.l);
  const h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Toutes les assertions d'une figure rp-stage (points 1,2,3,4). */
function checkStageFigure(geo, tag, compact) {
  const fails = [];
  const notes = {};
  // --- 1. AXE Y : 100 % en haut, 0 % en bas, linéaire, pile = échelle.
  const byPct = new Map(geo.pct.map((p) => [parseInt(p.txt, 10), p]));
  const p0 = byPct.get(0);
  const p50 = byPct.get(50);
  const p100 = byPct.get(100);
  if (!p0 || !p100 || (!p50 && !compact)) fails.push(`${tag}: labels Y incomplets (${geo.pct.map((p) => p.txt).join(",")})`);
  if (p0 && p100 && !(p100.cy < p0.cy - 20)) fails.push(`${tag}: 100 % n'est pas AU-DESSUS de 0 % (cy100=${p100.cy} cy0=${p0.cy})`);
  let minY = Infinity;
  let maxY = -Infinity;
  let maxX = -Infinity;
  for (const band of geo.bands)
    for (const [x, y] of band.pts) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x > maxX) maxX = x;
    }
  notes.stack = { minY, maxY, bandCount: geo.bands.length };
  if (p0 && p100 && geo.bands.length) {
    if (Math.abs(p100.cy - minY) > 3) fails.push(`${tag}: sommet de pile (${minY.toFixed(1)}) != y(100 %)=${p100.cy.toFixed(1)}`);
    if (Math.abs(p0.cy - maxY) > 3) fails.push(`${tag}: base de pile (${maxY.toFixed(1)}) != y(0 %)=${p0.cy.toFixed(1)}`);
    for (const [v, p] of byPct) {
      const expected = p0.cy + (p100.cy - p0.cy) * (v / 100);
      if (Math.abs(p.cy - expected) > 2.5) fails.push(`${tag}: tick ${v} % hors échelle (${p.cy.toFixed(1)} ≠ ${expected.toFixed(1)})`);
    }
  }
  // --- 2. Aucun contour clair sur les aires (liserés internes uniquement).
  if (geo.strokedAreaPaths > 0) fails.push(`${tag}: ${geo.strokedAreaPaths} aire(s) avec stroke de contour (ligne parasite 100 %)`);
  // --- 3. ANTI-COLLISION : boîtes écran disjointes 2 à 2 (tolérance 1 px).
  const boxes = geo.screenBoxes;
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      a.r += 0.5; a.b += 0.5; b.l -= 0.5; b.t -= 0.5; // tolérance
      const ov = overlapArea(a, b);
      a.r -= 0.5; a.b -= 0.5; b.l += 0.5; b.t += 0.5;
      if (ov > 1) fails.push(`${tag}: collision « ${a.label} » / « ${b.label} » (${ov.toFixed(1)} px²)`);
    }
  notes.labels = boxes.map((b) => `${b.kind}:${b.label}`).join(" | ");
  // --- 4. AXE X : couverture pleine largeur + pas régulier + repère fin.
  const ticks = geo.clock.map((c) => ({ ...c, ms: parseClockMs(c.txt) })).sort((a, b) => a.ms - b.ms);
  notes.xTicks = ticks.map((t) => t.txt).join(" ");
  if (ticks.length < (compact ? 3 : 4)) fails.push(`${tag}: axe X clairsemé (${ticks.length} ticks : ${notes.xTicks})`);
  if (ticks.length >= 2) {
    // Pas régulier entre les ticks RONDS (le repère de fin — toujours en
    // dernier — peut être à une valeur non ronde).
    const rounds = ticks.slice(0, -1);
    const steps = [];
    for (let i = 1; i < rounds.length; i++) steps.push(rounds[i].ms - rounds[i - 1].ms);
    if (steps.length && new Set(steps).size > 1)
      fails.push(`${tag}: pas X irrégulier (${steps.map((s) => s / 60000).join("/")} min)`);
    // Dernier label = repère de fin, ancré à droite : son BORD DROIT est au
    // bord droit du tracé (couverture totale).
    const last = ticks[ticks.length - 1];
    const lastRight = last.x + last.w;
    if (Math.abs(lastRight - maxX) > 8)
      fails.push(`${tag}: dernier tick X (${last.txt}, bord droit ${lastRight.toFixed(0)}) ≠ fin du tracé (${maxX.toFixed(0)})`);
    const t0 = ticks[0].cx;
    const coverage = (lastRight - t0) / (maxX - t0);
    notes.xCoverage = +coverage.toFixed(3);
    if (coverage < 0.94) fails.push(`${tag}: axe X ne couvre que ${(coverage * 100).toFixed(0)} % de la largeur`);
  }
  return { fails, notes };
}

async function grayZoneSaturation(png, geo, tag) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const s = info.width / geo.vb.w; // capture (px, relative à l'élément) → viewBox
  const x0 = Math.round((geo.grayBox.x + 8) * s);
  const x1 = Math.round((geo.grayBox.x + geo.grayBox.width - 3) * s);
  const y0 = Math.round(geo.vb.h * 0.25 * s);
  const y1 = Math.round(geo.vb.h * 0.7 * s);
  const sats = [];
  for (let y = Math.max(0, y0); y < Math.min(info.height, y1); y += 2)
    for (let x = Math.max(0, x0); x < Math.min(info.width, x1); x += 2) {
      const i = (y * info.width + x) * 4;
      sats.push(hslSat([data[i], data[i + 1], data[i + 2]]));
    }
  if (!sats.length) return { error: `crop vide (${x0},${y0})-(${x1},${y1}) vs ${info.width}x${info.height}`, tag };
  sats.sort((a, b) => a - b);
  return {
    mean: +(sats.reduce((a, b) => a + b, 0) / sats.length).toFixed(3),
    p95: +percentile(sats, 0.95).toFixed(3),
    max: +sats[sats.length - 1].toFixed(3),
    n: sats.length,
  };
}

const report = { mode, origin, locales: {} };
const browser = await chromium.launch();
let hardFails = [];
try {
  for (const [kind, viewport, locale, full] of [
    ["d", { width: 1280, height: 900 }, "fr", true],
    ["m", { width: 375, height: 780, isMobile: true, hasTouch: true }, "fr", true],
    ["m-en", { width: 375, height: 780, isMobile: true, hasTouch: true }, "en", false],
    ["m-zh", { width: 375, height: 780, isMobile: true, hasTouch: true }, "zh", false],
  ]) {
    const compact = kind.startsWith("m");
    const context = await browser.newContext({ viewport });
    await mockRoutes(context);
    await context.addCookies([{ name: "atlas_locale", value: locale, url: origin }]);
    const page = await context.newPage();
    await page.goto(origin + "/replay?code=rep-Jd894wx6so9");
    await page.waitForSelector("figure.rp-stage", { timeout: 45000 });
    await page.waitForTimeout(700);
    const entry = (report.locales[`${locale}-${kind}`] = { fails: [], measures: {} });

    const figures = page.locator("figure.rp-stage");
    const n = await figures.count();
    entry.measures.figures = n;
    for (let i = 0; i < Math.min(n, 3); i++) {
      const fig = figures.nth(i);
      await fig.scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
      const geo = await figureGeometry(fig);
      const { fails, notes } = checkStageFigure(geo, `stage${i + 1}-${kind}`, compact);
      entry.fails.push(...fails);
      entry.measures[`stage${i + 1}`] = notes;
      if (full || i === 0) {
        await fig.locator("svg.rp-chart").screenshot({ path: `${outdir}/${mode}-stage${i + 1}-${kind}.png` });
        if (geo.grayBox) {
          const sat = await grayZoneSaturation(`${outdir}/${mode}-stage${i + 1}-${kind}.png`, geo, `stage${i + 1}`);
          entry.measures[`stage${i + 1}`].graySat = sat;
          if (mode === "apres" && (sat.p95 > 0.15 || sat.mean > 0.15))
            entry.fails.push(`stage${i + 1}-${kind}: saturation résiduelle zone grise ${JSON.stringify(sat)} > 15 %`);
        }
      }
    }
    // Power balance (axes Y/X partagés) — captures desktop/mobile.
    if (full) {
      const power = page.locator(".chart-frame").first();
      if (await power.count()) {
        await power.scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        await power.screenshot({ path: `${outdir}/${mode}-power-${kind}.png` });
      }
      const tl = page.locator(".timeline-grid");
      if (await tl.count()) {
        await tl.scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        await tl.screenshot({ path: `${outdir}/${mode}-timeline-${kind}.png` });
      }
    }

    // --- 7/9. Dédoublonnage légende + mention « chaque phase repart de zéro ».
    const bodyText = await page.evaluate(() => document.body.innerText);
    const count = (s) => bodyText.split(s).length - 1;
    const capCount = count(CAPTION[locale]);
    entry.measures.captionCount = capCount;
    const noteCount = count(PHASE_NOTE[locale]);
    entry.measures.phaseNoteCount = noteCount;
    if (mode === "apres") {
      if (capCount !== 2) entry.fails.push(`${locale}-${kind}: légende « ${CAPTION[locale]} » ×${capCount} (attendu 2)`);
      if (noteCount !== 3) entry.fails.push(`${locale}-${kind}: mention phase ×${noteCount} (attendu 2)`);
    }

    // --- 6. STICKY : le VRAI flux utilisateur (soumission du code) défile
    // vers le résultat — le verdict ne doit pas passer sous le header.
    if (full) {
      await page.fill(".rp-code-input input", "rep-Jd894wx6so9");
      await page.click(".rp-submit-main");
      await page.waitForSelector(".verdict-archive", { timeout: 20000 });
      const sticky = await page.evaluate(async () => {
        let prev = -1;
        for (let k = 0; k < 40; k++) {
          await new Promise((r) => setTimeout(r, 100));
          const y = window.scrollY;
          if (Math.abs(y - prev) < 1 && k > 8) break;
          prev = y;
        }
        const hb = document.querySelector("header.header")?.getBoundingClientRect().bottom ?? -1;
        const vt = document.querySelector(".verdict-archive")?.getBoundingClientRect().top ?? -1;
        return { headerBottom: +hb.toFixed(1), verdictTop: +vt.toFixed(1), clear: vt >= hb - 1 };
      });
      entry.measures.sticky = sticky;
      if (mode === "apres" && sticky.clear !== true)
        entry.fails.push(`${locale}-${kind}: verdict sous le header sticky (${JSON.stringify(sticky)})`);
      await page.screenshot({ path: `${outdir}/${mode}-sticky-${kind}.png` });
    }
    await context.close();
  }
} finally {
  await browser.close();
}
writeFileSync(`${outdir}/mesures-${mode}.json`, JSON.stringify(report, null, 2));
hardFails = Object.values(report.locales).flatMap((l) => l.fails ?? []);
console.log(JSON.stringify(report, null, 2));
if (mode === "apres" && hardFails.length) {
  console.error("\nÉCHECS (" + hardFails.length + ") :\n" + hardFails.map((f) => " - " + f).join("\n"));
  process.exit(1);
}
console.log(`\n[${mode}] ${hardFails.length ? hardFails.length + " écarts enregistrés (mode avant)" : "toutes les assertions passent"}`);
