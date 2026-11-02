#!/usr/bin/env node
/** Validation mesurée des graphiques replay « haute visibilité » (04/11).
 *
 *  Usage : node scripts/validate-charts-visibilite.mjs <origin> <outdir> <tag>
 *    origin : http://localhost:<port> — build isolé servi (jamais la prod),
 *             données mockées sur la fixture wsva-Jd894wx6so9 (même replay
 *             que le diagnostic prod 04/11 → comparaison avant/après).
 *    tag    : avant | apres
 *
 *  Capture les 4 graphes (équilibre de puissance, 2 aires de phases, duel)
 *  en desktop 1440 ET mobile 375, puis mesure :
 *    - dimensions réelles des SVG (viewBox = largeur mesurée, jamais 0) ;
 *    - pour chaque bande d'aire ≥ 8 % de la hauteur du tracé : saturation
 *      HSL moyenne ≥ 40 %, ΔE(CIE76) ≥ 20 vs fond ET vs bande adjacente ;
 *    - contraste des labels d'axes ≥ 4.5:1 (fill rendu vs panneau échantillonné).
 *
 *  Seuils = critères de réussite de la mission. Sortie : PNG + JSON +
 *  verdict PASS/FAIL par graphe. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import sharp from "sharp";

const origin = process.argv[2];
const outdir = process.argv[3];
const tag = process.argv[4] || "capture";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin ?? ""))
  throw new Error("Usage : validate-charts-visibilite.mjs <origin locale> <outdir> <tag>");
mkdirSync(outdir, { recursive: true });

const FIXTURE = "/home/ubuntu/War-Selection/datasets/replays/wsva-Jd894wx6so9.json";
const DATASET = "/home/ubuntu/War-Selection/datasets/served";
const SAT_MIN = 40; // %
const DE_MIN = 20;
const BAND_MIN_RATIO = 0.08; // 8 % de la hauteur du tracé
const LABEL_MIN = 4.5;

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
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) }),
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

/* ---------- couleur ---------- */
const hex = (rgb) => "#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");
function rgb2hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx === mn) return [0, 0, (mx + mn) / 2];
  const d = mx - mn;
  const s = mx + mn > 1 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (mx === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, (mx + mn) / 2];
}
function srgbToLinear(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
function luminance([r, g, b]) { return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b); }
function contrast(a, b) {
  const l1 = luminance(a), l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function toLab(rgbP) {
  const [r, g, b] = rgbP;
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

/** Traversée verticale : bandes d'aires dans l'ordre d'empilement.
 *  Les suites de pixels proches (ΔRGB ≤ 40) forment des « runs » ; les runs
 *  consécutifs de MÊME teinte (ΔE ≤ 8) sont FUSIONNÉS — une seule aire
 *  traversée par une annotation claire (médiane 50 %, win chance) ne doit
 *  pas compter comme deux bandes adjacentes. */
async function bandsAt(png, xRatio, plotTopRatio, plotBottomRatio) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => {
    const i = (Math.min(y, info.height - 1) * info.width + Math.min(x, info.width - 1)) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const bg = px(3, Math.round(info.height * 0.5));
  const x = Math.round(info.width * xRatio);
  const runs = [];
  let cur = null;
  const near = (a, b) => Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2]) <= 40;
  for (let k = Math.round(info.height * plotTopRatio); k < Math.round(info.height * plotBottomRatio); k++) {
    const c = px(x, k);
    if (cur && near(cur.last, c)) { cur.sum = cur.sum.map((v, i) => v + c[i]); cur.n++; cur.last = c; }
    else { if (cur && cur.n >= 6) runs.push(cur); cur = { sum: c, n: 1, last: c }; }
  }
  if (cur && cur.n >= 6) runs.push(cur);
  // fusion des runs de même teinte (même aire coupée par une annotation)
  const merged = [];
  for (const r of runs) {
    const avg = r.sum.map((v) => Math.round(v / r.n));
    const prev = merged[merged.length - 1];
    if (prev && deltaE(avg, prev.avg) <= 8) {
      prev.n += r.n;
      prev.sum = prev.sum.map((v, i) => v + r.sum[i]);
      prev.avg = prev.sum.map((v) => Math.round(v / prev.n));
    } else merged.push({ n: r.n, sum: [...r.sum], avg });
  }
  return {
    bg: hex(bg),
    plotH: Math.round(info.height * (plotBottomRatio - plotTopRatio)),
    bands: merged.map((r) => {
      const [, s] = rgb2hsl(r.avg);
      return { hPx: r.n, hex: hex(r.avg), satPct: Math.round(s * 100), dEvsBg: +deltaE(r.avg, bg).toFixed(1) };
    }),
  };
}

/* ---------- navigateur ---------- */
const report = { tag, thresholds: { satPct: SAT_MIN, deltaE: DE_MIN, bandMinRatio: BAND_MIN_RATIO, labelMin: LABEL_MIN }, charts: {} };
const browser = await chromium.launch();
let allPass = true;
for (const [kind, viewport] of [
  ["d1440", { width: 1440, height: 900 }],
  ["m375", { width: 375, height: 780, isMobile: true, hasTouch: true }],
]) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await mockRoutes(context);
  await context.addCookies([{ name: "atlas_locale", value: "en", url: origin }]);
  const page = await context.newPage();
  await page.goto(origin + "/replay?code=rep-Jd894wx6so9");
  await page.waitForSelector(".rp .heading-1", { timeout: 45000 });
  await page.waitForTimeout(900); // hydratation + ResizeObserver

  const svgs = page.locator("svg.rp-chart");
  const names = ["power", "stage1", "stage2", "versus"];
  const n = await svgs.count();
  for (let i = 0; i < n; i++) {
    const name = names[i] ?? `chart${i}`;
    const key = `${name}-${kind}`;
    const el = svgs.nth(i);
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const svgBox = await el.boundingBox();
    const vb = (await el.getAttribute("viewBox")).split(" ").map(Number);
    const file = `${outdir}/${tag}-${name}-${kind}.png`;
    await el.screenshot({ path: file });
    // ratios du tracé interne (paddings du cadre, cf. frameFor)
    const padT = 34, padB = 28;
    const plotTop = padT / vb[3], plotBottom = (vb[3] - padB) / vb[3];

    // Plusieurs traversées verticales : une frontière d'aire quasi verticale
    // produit sur UNE colonne des pixels de transition (anticrénelage) qui
    // ne sont pas « l'aire » — la teinte réelle d'une aire est sa version
    // la PLUS saturée parmi les traversées (indexées bas → haut : l'ordre
    // d'empilement des joueurs est fixe).
    const traversals = [];
    for (const xRatio of [0.35, 0.45, 0.5, 0.55, 0.62, 0.7]) {
      const t = await bandsAt(file, xRatio, plotTop + 0.02, plotBottom - 0.02);
      t.bands.reverse(); // bas → haut = ordre d'empilement
      t.xRatio = xRatio;
      traversals.push(t);
    }
    // Verdict PRIMAIRE — par traversée : une traversée « propre » doit montrer
    // TOUTES ses aires ≥ 8 % vives et séparées (sat ≥ 40 %, ΔE fond ≥ 20,
    // ΔE adjacent ≥ 20). Une frontière quasi verticale produit sur une
    // colonne donnée des pixels de transition (anticrénelage) : la teinte
    // réelle d'une aire est mesurée sur une colonne où elle est franche.
    // Le graphe passe si AU MOINS une traversée est intégralement conforme
    // ET toutes les positions éligibles (cf. dessous) satisfont les seuils
    // dans leur occurrence la plus saturée.
    const traversalVerdicts = traversals.map((t) => {
      const viol = [];
      const elig = t.bands.filter((b) => b.hPx >= BAND_MIN_RATIO * t.plotH);
      for (let j = 0; j < elig.length; j++) {
        const b = elig[j];
        if (b.satPct < SAT_MIN) viol.push(`${b.hex} sat ${b.satPct}%`);
        if (b.dEvsBg < DE_MIN) viol.push(`${b.hex} ΔE fond ${b.dEvsBg}`);
        if (j > 0) {
          const de = +deltaE(
            [1,3,5].map((q) => parseInt(elig[j].hex.slice(q, q+2), 16)),
            [1,3,5].map((q) => parseInt(elig[j-1].hex.slice(q, q+2), 16)),
          ).toFixed(1);
          if (de < DE_MIN) viol.push(`${b.hex} ΔE adj ${de}`);
        }
      }
      return { xRatio: t.xRatio, eligible: elig.length, violations: viol, clean: viol.length === 0 && elig.length >= 2 };
    });
    // Positions d'empilement (rapport) : occurrence la plus saturée.
    const maxLen = Math.max(...traversals.map((t) => t.bands.length));
    const positions = [];
    for (let k = 0; k < maxLen; k++) {
      const instances = traversals.map((t) => t.bands[k]).filter(Boolean);
      const eligible = instances.some((b) => b.hPx >= BAND_MIN_RATIO * (traversals[0]?.plotH ?? 0));
      const purest = instances.sort((a, b) => b.satPct - a.satPct)[0];
      if (eligible && purest) positions.push({ stackIndex: k, ...purest });
    }
    for (let j = 1; j < positions.length; j++)
      positions[j].dEWithPrev = +deltaE(
        [1,3,5].map((q) => parseInt(positions[j].hex.slice(q, q+2), 16)),
        [1,3,5].map((q) => parseInt(positions[j-1].hex.slice(q, q+2), 16)),
      ).toFixed(1);

    // labels d'axes : fill rendu + panneau échantillonné en marge GAUCHE
    // (x=2..4 — plus à droite on touche l'anticrénelage des glyphes « % »)
    const labels = await el.evaluate((svg) => {
      const texts = [...svg.querySelectorAll("text")].filter((t) => /%|\d:\d/.test(t.textContent ?? ""));
      const fill = texts[0]?.getAttribute("fill") ?? "";
      return { count: texts.length, sampleFill: fill, sampleText: texts[0]?.textContent ?? "" };
    });
    const raw = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pSamples = [];
    for (const yy of [0.3, 0.5, 0.7]) {
      const y = Math.round(raw.info.height * yy);
      pSamples.push([raw.data[(y * raw.info.width + 3) * 4], raw.data[(y * raw.info.width + 3) * 4 + 1], raw.data[(y * raw.info.width + 3) * 4 + 2]]);
    }
    const panelRgb = pSamples.sort((a, b) => luminance(a) - luminance(b))[0]; // la plus sombre = panneau net
    const labelFill = labels.sampleFill.replace("#", "");
    const labelRgb = [0, 2, 4].map((k) => parseInt(labelFill.slice(k, k + 2), 16));
    const labelContrast = labelFill.length === 6 ? +contrast(labelRgb, panelRgb).toFixed(2) : null;

    // verdict
    const fails = [];
    for (const p of positions) {
      if (p.satPct < SAT_MIN) fails.push(`position ${p.stackIndex} ${p.hex} sat ${p.satPct}% < ${SAT_MIN}%`);
      if (p.dEvsBg < DE_MIN) fails.push(`position ${p.stackIndex} ${p.hex} ΔE fond ${p.dEvsBg} < ${DE_MIN}`);
      if (p.dEWithPrev !== undefined && p.dEWithPrev < DE_MIN)
        fails.push(`position ${p.stackIndex} ${p.hex} ΔE adj ${p.dEWithPrev} < ${DE_MIN}`);
    }
    if (!traversalVerdicts.some((t) => t.clean))
      fails.push(`aucune traversée intégralement conforme (${traversalVerdicts.map((t) => `x${t.xRatio}:${t.violations.length}écarts`).join(", ")})`);
    if (!svgBox || svgBox.width < 200) fails.push("SVG trop étroit / non rendu");
    if (Math.abs(vb[2] - (svgBox?.width ?? 0)) > 2) fails.push("viewBox ≠ largeur rendue (ResizeObserver)");
    if (labelContrast === null || labelContrast < LABEL_MIN) fails.push(`contraste labels ${labelContrast} < ${LABEL_MIN}`);
    const pass = fails.length === 0;
    if (!pass) allPass = false;

    report.charts[key] = {
      svg: { w: svgBox?.width ?? 0, h: svgBox?.height ?? 0, viewBox: vb.join(" ") },
      labels: { ...labels, contrastVsPanel: labelContrast },
      panelSample: hex(panelRgb),
      traversals: traversalVerdicts,
      positions,
      pass,
      fails,
    };
    console.log(`${pass ? "PASS" : "FAIL"} ${key} — ${positions.length} aires ≥ 8% | labels ${labelContrast}:1 | ${svgBox?.width.toFixed(0)}×${svgBox?.height.toFixed(0)}`);
    for (const p of positions)
      console.log(`     pos ${p.stackIndex} ${p.hex} h(max)~${p.hPx}px sat=${p.satPct}% ΔE(fond)=${p.dEvsBg} ΔE(adj)=${p.dEWithPrev ?? "—"}`);
    for (const f of fails) console.log(`     ✗ ${f}`);
  }
  await context.close();
}
await browser.close();
report.allPass = allPass;
writeFileSync(`${outdir}/mesures-${tag}.json`, JSON.stringify(report, null, 2));
console.log(`\n${allPass ? "✅ TOUS LES SEUILS ATTEINTS" : "❌ ÉCHECS (voir fails)"} — ${outdir}/mesures-${tag}.json`);
process.exit(allPass ? 0 : 1);
