#!/usr/bin/env node
/** E2E menus déroulants du header — visibilité RÉELLE sur mobile (FIX 02/11).
 *  Leçon du bug : aria-expanded ne prouve rien si un ancêtre clippe le
 *  panneau (nav overflow:auto ≤760 px rognait les panneaux Archives/Mods
 *  ENTÈREMENT). Standard de test : après ouverture par TAP tactile,
 *  elementFromPoint(centre du panneau) doit être DANS le panneau.
 *  Viewports : 375×667 et 390×664 (barres dynamiques iOS), + vérif du
 *  menu Compte (header-actions) et du pattern sur une seconde page.
 *  Usage : node scripts/test-header-menus-e2e.mjs [origin] */
import { chromium } from "playwright";

const origin = process.argv[2] || "http://localhost:5173";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Tests are restricted to a local, non-production origin.");

const report = [];
const check = (name, ok) => {
  if (!ok) throw new Error("FAIL " + name);
  report.push(name);
  console.log("PASS", name);
};

/** Ouvre un menu par TAP puis vérifie que le panneau est réellement visible
 *  (hit-test au centre) : elementFromPoint ∈ panneau. */
async function openAndAssertVisible(page, triggerSelector, label) {
  const trigger =
    typeof triggerSelector === "string"
      ? page.locator(triggerSelector).first()
      : triggerSelector;
  await trigger.waitFor({ state: "visible", timeout: 10000 });
  await trigger.tap();
  const panel = page.locator(".nav-menu-panel").first();
  await panel.waitFor({ state: "visible", timeout: 5000 });
  const hit = await panel.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = Math.min(r.top + r.height / 2, window.innerHeight - 8);
    const at = document.elementFromPoint(x, y);
    return {
      contained: !!at && el.contains(at),
      rect: { top: r.top, bottom: r.bottom, height: r.height, width: r.width },
      inViewport: r.top >= 0 && r.bottom <= window.innerHeight + 1,
    };
  });
  check(
    `${label} : panneau réellement visible (elementFromPoint au centre ∈ panneau)`,
    hit.contained,
  );
  check(
    `${label} : panneau entier dans le viewport (${hit.rect.width.toFixed(0)}×${hit.rect.height.toFixed(0)} px, top=${hit.rect.top.toFixed(0)})`,
    hit.inViewport,
  );
  return hit.rect;
}

const engine = await chromium.launch();
try {
  for (const viewport of [
    { width: 375, height: 667, name: "375" },
    { width: 390, height: 664, name: "390" },
  ]) {
    const context = await engine.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: true,
      isMobile: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    const page = await context.newPage();

    /* — Accueil : Archives puis Mods — */
    await page.goto(origin + "/", { waitUntil: "networkidle" });
    await openAndAssertVisible(page, "button[aria-label='Archives'], button[aria-label='档案']", `accueil ${viewport.name} Archives`);
    await page.keyboard.press("Escape");
    await openAndAssertVisible(page, "button[aria-label='Mods'], button[aria-label='Mod']", `accueil ${viewport.name} Mods`);

    /* — Aucun ancêtre du header ne crée de clipping horizontal du panneau — */
    await page.tap("button[aria-label='Archives'], button[aria-label='档案']");
    const clip = await page.evaluate(() => {
      const panel = document.querySelector(".nav-menu-panel");
      if (!panel) return { clipped: true };
      // Ancêtres entre le panneau et le header inclus (html overflow-x:hidden
      // est volontaire et ne rogne pas les panneaux dans le viewport).
      let el = panel.parentElement;
      while (el) {
        const style = getComputedStyle(el);
        if (
          /(auto|scroll|hidden|clip)/.test(style.overflow + style.overflowX + style.overflowY)
        )
          return {
            clipped: true,
            clipper: `${el.tagName}.${el.className && el.className.split(" ")[0]} overflow=${style.overflow}/${style.overflowX}/${style.overflowY}`,
          };
        if (el.classList.contains("header")) break;
        el = el.parentElement;
      }
      return { clipped: false };
    });
    check(`accueil ${viewport.name} : aucun ancêtre à débordement masqué ne clippe le panneau`, !clip.clipped);

    /* — Deuxième page (replay) : le pattern tiendrait partout — */
    await page.goto(origin + "/replay", { waitUntil: "domcontentloaded" });
    // Laisse l'hydratation client se poser avant le tap (déclencheurs
    // présents au SSR mais inertes avant l'attachement des écouteurs).
    await page.waitForTimeout(2500);
    await openAndAssertVisible(page, "button[aria-label='Archives'], button[aria-label='档案']", `replay ${viewport.name} Archives`);

    /* — Menu Compte (header-actions) si présent (non connecté : ignoré) — */
    const accountTrigger = page.locator(".header-actions .nav-menu-trigger").first();
    if ((await accountTrigger.count()) > 0 && (await accountTrigger.isVisible())) {
      await openAndAssertVisible(accountTrigger, `compte ${viewport.name}`);
    } else {
      console.log(`SKIP compte ${viewport.name} (non connecté)`);
    }

    await context.close();
  }
} finally {
  await engine.close();
}
console.log(`\nOK — ${report.length} contrôles e2e menus header (visibilité réelle)`);
