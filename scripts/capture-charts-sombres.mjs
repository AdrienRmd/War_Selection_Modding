#!/usr/bin/env node
/** Captures + mesures de lisibilité des graphiques replay/profil sur canvas
 *  sombre Field Archive (refonte « charts sombres »).
 *
 *  Usage : node scripts/capture-charts-sombres.mjs <origin> <outdir> <tag>
 *    origin : http://localhost:5173 (dev isolé) — jamais la prod.
 *    tag    : avant | apres
 *
 *  Sorties dans <outdir> :
 *    <tag>-<graphe>-d.png / -m.png   (desktop 1280 / mobile 375, EN)
 *    <tag>-power-d.png    : équilibre de puissance + win chance
 *    <tag>-stage1-d.png   : aires empilées équipe bleue
 *    <tag>-stage2-d.png   : aires empilées équipe rouge
 *    <tag>-versus-d.png   : bleue contre rouge
 *    <tag>-points-d.png   : courbe de points cumulés (/player/dbat)
 *    mesures-<tag>.json   : segments de teintes échantillonnés (hex, L*,
 *                           ΔL adjacents, contraste vs fond panel)
 *
 *  Mesure : une ligne horizontale est échantillonnée à 62 % de la hauteur
 *  de chaque graphe empilé ; les suites de pixels de couleur voisine
 *  (ΔRGB ≤ 30) forment des « segments » = aires visibles. On rapporte la
 *  teinte moyenne, la luminance CIE L*, le ΔL entre segments adjacents et
 *  le contraste WCAG de chaque teinte contre le fond effectif du graphe
 *  (coin supérieur gauche hors tracé).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import sharp from "sharp";

const origin = process.argv[2];
const outdir = process.argv[3];
const tag = process.argv[4] || "capture";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin ?? ""))
  throw new Error("Usage : capture-charts-sombres.mjs <origin locale> <outdir> <tag>");
mkdirSync(outdir, { recursive: true });

const FIXTURE = "/home/ubuntu/War-Selection/datasets/replays/wsva-Jd894wx6so9.json";
const DATASET = "/home/ubuntu/War-Selection/datasets/served";

async function mockRoutes(context) {
  await context.route("**/games-api.warselect.io/getByReplay*", (route) => {
    const code = new URL(route.request().url()).searchParams.get("code") ?? "";
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: code === "Jd894wx6so9" ? readFileSync(FIXTURE, "utf8") : JSON.stringify({ error: 2 }),
    });
  });
  await context.route("**/api/replay/recent", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [] }),
    }),
  );
  await context.route("**/wus-data/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/wus-data\//, "");
    const ext = path.split(".").pop();
    try {
      return route.fulfill({
        status: 200,
        contentType: ext === "png" ? "image/png" : "application/octet-stream",
        body: readFileSync(`${DATASET}/${path}`),
      });
    } catch {
      return route.fulfill({ status: 404, body: "" });
    }
  });
}

/* ---------- Mesures couleur ---------- */
function srgbToLinear(c) {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function luminance([r, g, b]) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}
function contrast(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
/** CIE L* depuis sRGB (D65, approx. Lab blanc = L=100). */
function lightness([r, g, b]) {
  const y = luminance([r, g, b]);
  return y <= 216 / 24389 ? (24389 / 27 * y) / 116 : 116 * y ** (1 / 3) - 16;
}
const hex = (rgb) => "#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");

async function sampleRow(png, { yRatio = 0.62, xFrom = 0.12, xTo = 0.98 }) {
  return sampleLine(png, { axis: "x", at: yRatio, from: xFrom, to: xTo });
}

/** Échantillonne une COLONNE verticale : les suites de pixels forment les
 *  aires dans l'ordre d'empilement — ΔL entre aires adjacentes rendues. */
async function sampleCol(png, { xRatio = 0.6, yFrom = 0.14, yTo = 0.92 }) {
  return sampleLine(png, { axis: "y", at: xRatio, from: yFrom, to: yTo });
}

async function sampleLine(png, { axis, at, from, to }) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => {
    const i = (Math.min(y, info.height - 1) * info.width + Math.min(x, info.width - 1)) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const bgSamples = [px(4, 4), px(10, Math.round(info.height * 0.5)), px(4, Math.round(info.height * 0.95))];
  const bg = bgSamples
    .reduce((a, b) => a.map((v, k) => v + b[k] / bgSamples.length), [0, 0, 0])
    .map((v) => Math.round(v));
  const y = axis === "x" ? Math.round(info.height * at) : 0;
  const x = axis === "x" ? 0 : Math.round(info.width * at);
  const runs = [];
  let cur = null;
  const start = Math.round((axis === "x" ? info.width : info.height) * from);
  const end = Math.round((axis === "x" ? info.width : info.height) * to);
  for (let k = start; k < end; k++) {
    const c = axis === "x" ? px(k, y) : px(x, k);
    const near = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) <= 36;
    if (cur && near(cur.last, c)) {
      cur.sum = cur.sum.map((v, i2) => v + c[i2]);
      cur.n += 1;
      cur.last = c;
    } else {
      if (cur && cur.n >= 8) runs.push(cur);
      cur = { sum: c, n: 1, last: c, x0: k };
    }
  }
  if (cur && cur.n >= 8) runs.push(cur);
  const segments = runs.map((r) => {
    const avg = r.sum.map((v) => Math.round(v / r.n));
    return {
      widthPx: r.n,
      x0ratio: +(r.x0 / (axis === "x" ? info.width : info.height)).toFixed(3),
      hex: hex(avg),
      L: +lightness(avg).toFixed(1),
      contrastVsBg: +contrast(avg, bg).toFixed(2),
    };
  });
  for (let i = 1; i < segments.length; i++)
    segments[i].deltaLWithPrev = +Math.abs(segments[i].L - segments[i - 1].L).toFixed(1);
  return { bg: hex(bg), segments };
}

/* ---------- Captures ---------- */
const browser = await chromium.launch();
const report = { tag, charts: {} };
try {
  for (const [kind, viewport] of [
    ["d", { width: 1280, height: 900 }],
    ["m", { width: 375, height: 780, isMobile: true, hasTouch: true }],
  ]) {
    const context = await browser.newContext({ viewport });
    await mockRoutes(context);
    await context.addCookies([{ name: "atlas_locale", value: "en", url: origin }]);
    const page = await context.newPage();
    await page.goto(origin + "/replay?code=rep-Jd894wx6so9");
    await page.waitForSelector(".rp .heading-1", { timeout: 45000 });
    await page.waitForTimeout(600);

    const power = page.locator(".chart-frame").first();
    await power.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await power.screenshot({ path: `${outdir}/${tag}-power-${kind}.png` });

    const stages = page.locator("figure.rp-stage");
    const nStages = await stages.count();
    for (let i = 0; i < Math.min(nStages, 3); i++) {
      const el = stages.nth(i);
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
      await el.screenshot({ path: `${outdir}/${tag}-stage${i + 1}-${kind}.png` });
    }
    if (kind === "d") {
      const versus = page.locator(".timeline-versus figure.rp-stage").first();
      if (await versus.count()) await versus.screenshot({ path: `${outdir}/${tag}-versus-d.png` });
    }

    // Scénario légende (une fois, desktop) : 2 joueurs décochés (par nom) —
    // chips estompés SANS barré, leurs séries absentes du graphe.
    if (kind === "d") {
      const lfigure = page.locator("figure.rp-stage").first();
      await lfigure.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      const chips = lfigure.locator(".rp-legend-chip");
      const names = await chips.allTextContents();
      for (const n of [names[1]?.trim(), names[6]?.trim()])
        if (n) await chips.filter({ hasText: n }).first().click();
      await page.waitForTimeout(250);
      await lfigure.screenshot({ path: `${outdir}/${tag}-legende-2decoches-d.png` });
    }

    // Profil joueur : courbe de points cumulés (attendre l'hydratation —
    // la largeur 1:1 n'est mesurée qu'après le montage client).
    const ppage = await context.newPage();
    await ppage.goto(origin + "/player/dbat");
    await ppage.waitForSelector(".rp .pennant-name", { timeout: 30000 });
    await ppage
      .waitForFunction(
        () => {
          const svg = document.querySelector(".points-chart svg");
          const div = document.querySelector(".points-panel .points-chart");
          return (
            svg instanceof SVGSVGElement &&
            div instanceof HTMLElement &&
            Math.abs(svg.getBoundingClientRect().width - div.getBoundingClientRect().width) < 2 &&
            svg.getAttribute("viewBox") !== "0 0 720 250"
          );
        },
        undefined,
        { timeout: 15000 },
      )
      .catch(() => {});
    const chart = ppage.locator(".points-chart").first();
    await chart.scrollIntoViewIfNeeded();
    await ppage.waitForTimeout(300);
    await chart.screenshot({ path: `${outdir}/${tag}-points-${kind}.png` });
    await context.close();
  }

  // Mesures sur les captures desktop — plusieurs lignes horizontales
  // traversent l'empilement (une seule ligne peut rester dans l'aire du
  // joueur dominant) ; on agrège aussi les teintes distinctes vues.
  const measure = async (file, rows, cols = [0.6, 0.75]) => {
    const chart = { bg: null, rows: [], cols: [], hues: [] };
    for (const yRatio of rows) {
      const m = await sampleRow(`${outdir}/${file}`, { yRatio, xFrom: 0.12, xTo: 0.98 });
      if (!chart.bg) chart.bg = m.bg;
      chart.rows.push({ yRatio, segments: m.segments });
    }
    // Colonnes verticales : aires dans l'ordre d'empilement + ΔL adjacent.
    for (const xRatio of cols) {
      const m = await sampleCol(`${outdir}/${file}`, { xRatio, yFrom: 0.14, yTo: 0.92 });
      const bands = m.segments.filter((s) => s.widthPx >= 12);
      chart.cols.push({ xRatio, bands });
    }
    // Teintes distinctes (fusion ΔRGB ≤ 60) sur toutes les lignes.
    const seen = [];
    for (const r of chart.rows)
      for (const s of r.segments) {
        const rgb = [1, 3, 5].map((i) => parseInt(s.hex.slice(i, i + 2), 16));
        if (
          !seen.some((h) => {
            const o = [1, 3, 5].map((i) => parseInt(h.hex.slice(i, i + 2), 16));
            return Math.abs(o[0] - rgb[0]) + Math.abs(o[1] - rgb[1]) + Math.abs(o[2] - rgb[2]) <= 60;
          })
        )
          seen.push(s);
      }
    chart.hues = seen;
    report.charts[file] = chart;
    console.log(`\n== ${file} (fond ${chart.bg}) — ${seen.length} teintes distinctes ==`);
    for (const s of seen)
      console.log(`  ${s.hex}  L*=${String(s.L).padStart(5)}  vs fond ${s.contrastVsBg}:1`);
    for (const c of chart.cols)
      console.log(
        `  empilement x=${c.xRatio}: ` +
          c.bands
            .map((s) => `${s.hex}(h${s.widthPx}px,${s.contrastVsBg}:1${s.deltaLWithPrev !== undefined ? ",ΔL" + s.deltaLWithPrev : ""})`)
            .join(" → "),
      );
  };
  await measure(`${tag}-power-d.png`, [0.3, 0.55, 0.8]);
  await measure(`${tag}-stage1-d.png`, [0.35, 0.5, 0.65, 0.8]);
  await measure(`${tag}-stage2-d.png`, [0.35, 0.5, 0.65, 0.8]);
  await measure(`${tag}-versus-d.png`, [0.4, 0.5, 0.6]);
} finally {
  await browser.close();
}
writeFileSync(`${outdir}/mesures-${tag}.json`, JSON.stringify(report, null, 2));
console.log(`\n[ok] captures + mesures-${tag}.json dans ${outdir}`);
