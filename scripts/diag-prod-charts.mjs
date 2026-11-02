#!/usr/bin/env node
/** DIAGNOSTIC PROD — pourquoi « on ne voit rien » sur les graphiques replay.
 *  Attaque https://ws.aremond.ovh (VRAIE prod, vraies données) avec Chromium :
 *    1. dimensions réelles des conteneurs/SVG (ResizeObserver a-t-il déclenché ?)
 *    2. captures PNG des 4 graphes (power, stage×2, versus) × (1440, 375)
 *    3. mesures pixels : teintes distinctes, saturation HSL, variance dans
 *       les bandes d'aires, ΔE (CIE76) vs fond et entre bandes adjacentes.
 *  Sortie : /tmp/diag-prod/ (PNG + mesures-*.json + console). */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import sharp from "sharp";

const CODE = process.argv[2] || "rep-Jd894wx6so9";
const OUT = "/tmp/diag-prod";
mkdirSync(OUT, { recursive: true });

/* ---------- couleur ---------- */
const hex = (rgb) => "#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");
function rgb2hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (mx === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}
function srgbToLinear(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
function luminance([r, g, b]) { return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b); }
function toLab(rgb) {
  const [r, g, b] = rgb;
  const rl = srgbToLinear(r), gl = srgbToLinear(g), bl = srgbToLinear(b);
  let x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
  let y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
  let z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x); y = f(y); z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
function deltaE(a, b) {
  const A = toLab(a), B = toLab(b);
  return Math.sqrt((A[0]-B[0])**2 + (A[1]-B[1])**2 + (A[2]-B[2])**2);
}

/** Analyse d'une capture : segments verticaux (colonnes) traversant
 *  l'empilement — chaque segment = une bande d'aire rendue. */
async function analyzeColumn(png, xRatio, yFrom = 0.14, yTo = 0.92) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => {
    const i = (Math.min(y, info.height - 1) * info.width + Math.min(x, info.width - 1)) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const bg = px(3, Math.round(info.height * 0.5) - 2); // marge gauche hors tracé
  const x = Math.round(info.width * xRatio);
  const runs = [];
  let cur = null;
  const near = (a, b) => Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2]) <= 40;
  for (let k = Math.round(info.height * yFrom); k < Math.round(info.height * yTo); k++) {
    const c = px(x, k);
    if (cur && near(cur.last, c)) { cur.sum = cur.sum.map((v, i) => v + c[i]); cur.n++; cur.last = c; }
    else { if (cur && cur.n >= 6) runs.push(cur); cur = { sum: c, n: 1, last: c }; }
  }
  if (cur && cur.n >= 6) runs.push(cur);
  const bands = runs.map((r) => {
    const avg = r.sum.map((v) => Math.round(v / r.n));
    const mean = avg.reduce((a, b) => a + b) / 3;
    const variance = r.sum.reduce((acc, v, i) => acc + (v / r.n - avg[i]) ** 2, 0) / 3;
    const [h, s, l] = rgb2hsl(avg);
    return {
      hPx: r.n, hex: hex(avg), hslHue: Math.round(h * 360),
      satPct: Math.round(s * 100), lightPct: Math.round(l * 100),
      dEvsBg: +deltaE(avg, bg).toFixed(1),
      contrastVsBg: +((Math.max(luminance(avg), luminance(bg)) + 0.05) / (Math.min(luminance(avg), luminance(bg)) + 0.05)).toFixed(2),
      pxStdDev: +Math.sqrt(variance).toFixed(1),
      meanLevel: Math.round(mean),
    };
  });
  for (let i = 1; i < bands.length; i++) bands[i].dEWithPrev = +deltaE(
    [1,3,5].map((k) => parseInt(bands[i].hex.slice(k, k+2), 16)),
    [1,3,5].map((k) => parseInt(bands[i-1].hex.slice(k, k+2), 16)),
  ).toFixed(1);
  return { bg: hex(bg), chartH: info.height, bands };
}

/** Compte de couleurs distinctes « visibles » (quantifiées 32, surface ≥ 8px²). */
async function distinctColors(png) {
  const { data } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const counts = new Map();
  for (let i = 0; i < data.length; i += 16) { // sample every 4th px
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = (r >> 5) + "," + (g >> 5) + "," + (b >> 5);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const total = Math.ceil(data.length / 16);
  const visible = [...counts.entries()].filter(([, n]) => n / total > 0.004).length;
  return { quantizedBuckets: counts.size, visibleColors: visible };
}

/* ---------- navigateur ---------- */
const report = { code: CODE, charts: {}, console: [] };
const browser = await chromium.launch();
for (const [kind, viewport] of [
  ["d1440", { width: 1440, height: 900 }],
  ["m375", { width: 375, height: 780, isMobile: true, hasTouch: true }],
]) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addCookies([{ name: "atlas_locale", value: "en", url: "https://ws.aremond.ovh" }]);
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") report.console.push(`${kind}: [${m.type()}] ${m.text().slice(0, 160)}`); });
  page.on("pageerror", (e) => report.console.push(`${kind}: [pageerror] ${String(e).slice(0, 200)}`));
  await page.goto(`https://ws.aremond.ovh/replay?code=${CODE}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".rp-chart", { timeout: 60000 });
  await page.waitForTimeout(1200); // hydratation + ResizeObserver + images

  // --- dimensions réelles ---
  report.charts[kind] = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll(".rp-chart-wrap").forEach((wrap, i) => {
      const svg = wrap.querySelector("svg.rp-chart");
      const r = wrap.getBoundingClientRect();
      const sr = svg ? svg.getBoundingClientRect() : null;
      const grads = svg ? [...svg.querySelectorAll("linearGradient")].map((g) => ({
        stops: [...g.querySelectorAll("stop")].map((s) => `${s.getAttribute("stop-color")}@${+(s.getAttribute("stop-opacity") ?? 1)}`),
      })) : [];
      const visible = svg ? [...svg.querySelectorAll("path")].filter((p) => {
        const b = p.getBBox();
        return b.width > 4 && b.height > 4;
      }).length : 0;
      const caption = wrap.parentElement?.querySelector(".rp-stage-caption")?.textContent?.slice(0, 60) ?? "";
      out.push({
        i, caption,
        wrapBox: { w: +r.width.toFixed(1), h: +r.height.toFixed(1) },
        svgBox: sr ? { w: +sr.width.toFixed(1), h: +sr.height.toFixed(1) } : null,
        viewBox: svg?.getAttribute("viewBox"),
        roMatched: sr && svg ? Math.abs(sr.width - r.width) < 2 && +svg.getAttribute("viewBox").split(" ")[2] > r.width - 3 : false,
        pathCount: svg ? svg.querySelectorAll("path").length : 0,
        visibleAreaPaths: visible,
        gradientSample: grads[0]?.stops ?? [],
        legendChips: wrap.querySelectorAll(".rp-legend-chip").length,
      });
    });
    return out;
  });

  // --- captures ---
  const shots = [];
  const power = page.locator(".chart-frame").first();
  if (await power.count()) {
    await power.scrollIntoViewIfNeeded(); await page.waitForTimeout(250);
    const f = `${OUT}/avant-power-${kind}.png`;
    await power.screenshot({ path: f }); shots.push(["power", f]);
  }
  const stages = page.locator("figure.rp-stage");
  const n = await stages.count();
  for (let i = 0; i < Math.min(n, 2); i++) {
    const el = stages.nth(i);
    await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
    const f = `${OUT}/avant-stage${i + 1}-${kind}.png`;
    await el.screenshot({ path: f }); shots.push([`stage${i + 1}`, f]);
  }
  const versus = page.locator(".timeline-versus figure.rp-stage").first();
  if (await versus.count()) {
    await versus.scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
    const f = `${OUT}/avant-versus-${kind}.png`;
    await versus.screenshot({ path: f }); shots.push(["versus", f]);
  }

  // --- mesures pixels ---
  for (const [name, file] of shots) {
    const key = `${name}-${kind}`;
    report.charts[key] = {
      cols: [await analyzeColumn(file, 0.5), await analyzeColumn(file, 0.78)],
      colors: await distinctColors(file),
    };
    console.log(`\n===== ${key} =====`);
    for (const c of report.charts[key].cols) {
      console.log(`  fond=${c.bg} — bandes (x traversée verticale):`);
      for (const b of c.bands)
        console.log(
          `    ${b.hex} h=${b.hPx}px sat=${b.satPct}% L=${b.lightPct}% ΔE(fond)=${b.dEvsBg} ΔE(préc)=${b.dEWithPrev ?? "-"} σpx=${b.pxStdDev} contraste=${b.contrastVsBg}:1`,
        );
    }
    console.log(`  couleurs distinctes visibles: ${report.charts[key].colors.visibleColors} (buckets ${report.charts[key].colors.quantizedBuckets})`);
  }
  await context.close();
}
await browser.close();
writeFileSync(`${OUT}/mesures-prod.json`, JSON.stringify(report, null, 2));
console.log("\nÉcrit:", `${OUT}/mesures-prod.json`);
