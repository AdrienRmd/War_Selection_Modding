#!/usr/bin/env node
/** Sondage AVANT chantier 1 — débordement du panneau de menu à 390px.
 *  Ouvre chaque menu du header (Archives / Mods / Compte) au viewport 390 et
 *  mesure le dépassement horizontal du panneau (.nav-menu-panel) hors du
 *  viewport. Usage : node /tmp/probe-nav-390.mjs [origin] */
import { chromium } from "playwright";

const origin = process.argv[2] || "http://localhost:5173";
const browser = await chromium.launch();
for (const vp of [
  { width: 390, height: 844 },
  { width: 375, height: 667 },
]) {
  const page = await browser.newPage({ viewport: vp, hasTouch: true });
  await page.goto(origin + "/", { waitUntil: "networkidle" });
  const triggers = await page.locator(".nav-menu-trigger").all();
  for (const trig of triggers) {
    const label = (await trig.innerText()).trim().replace(/\n/g, " ");
    await trig.tap();
    const panel = page.locator(".nav-menu-panel").first();
    await panel.waitFor({ state: "visible", timeout: 5000 });
    const m = await panel.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        left: Math.round(r.left),
        right: Math.round(r.right),
        width: Math.round(r.width),
        overflowRight: Math.round(r.right - window.innerWidth),
        overflowLeft: Math.round(-r.left),
        vw: window.innerWidth,
      };
    });
    console.log(
      `${vp.width}px | ${label.padEnd(12)} | panel ${m.width}px | left ${m.left} right ${m.right} | overflowRight ${m.overflowRight}px | overflowLeft ${m.overflowLeft}px`,
    );
    await page.keyboard.press("Escape");
  }
  await page.close();
}
await browser.close();
