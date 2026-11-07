import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { english } from "@/lib/english";
import { french } from "@/lib/french";
import {
  BAND_EDGE,
  CHART_PANEL,
  PLAYER_COLORS,
  TEAM_BLUE,
  TEAM_RED,
  contrastRatio,
  deltaE,
  grayZoneComposite,
  hslSaturation,
} from "../components/replay/chart-theme";
import {
  bandPath,
  decidedPill,
  frameFor,
  phasePlaques,
  stageShares,
  stackPixelEdges,
  timeTicks,
  yFor,
  yTickLabels,
} from "../components/replay/chart-frame";

/** Harnais étendu des 9 correctifs du retour visuel replay (02/11) :
 *  la JUSTESSE, pas seulement la visibilité. Rendu réel (DOM, pixels,
 *  anti-collision bounding boxes, saturation mesurée) :
 *  scripts/validate-charts-correctifs.mjs (Playwright + sharp). */
const MIN = 60_000;
const desktop = frameFor(1120);
const mobile = frameFor(375);
const MAX_MS_56 = 112 * 30_000; // partie de 55:56 → axe de 56:00

describe("correctif 1 — axe Y : échelle juste (0 % en bas, 100 % en haut)", () => {
  it("yFor : p = 0 → base du tracé, p = 1 → sommet, monotone", () => {
    for (const f of [desktop, mobile]) {
      expect(yFor(f, 0)).toBe(f.height - f.padB);
      expect(yFor(f, 1)).toBe(f.padT);
      expect(yFor(f, 0.5)).toBeCloseTo((f.padT + f.height - f.padB) / 2, 6);
      expect(yFor(f, 0.25)).toBeGreaterThan(yFor(f, 0.75));
    }
  });

  it("labels de graduation AUX positions de l'échelle (0 % en bas)", () => {
    for (const f of [desktop, mobile]) {
      for (const { pct, y } of yTickLabels(f, f.width < 520))
        expect(y, `${pct}%`).toBeCloseTo(yFor(f, pct / 100) + 4, 6);
    }
    expect(yTickLabels(desktop, false).map((t) => t.pct)).toEqual([0, 25, 50, 75, 100]);
    expect(yTickLabels(mobile, true).map((t) => t.pct)).toEqual([0, 50, 100]);
    // régression : l'ancien rendu plaçait « 0 % » au sommet (y = padT).
    expect(yTickLabels(desktop, false).find((t) => t.pct === 0)!.y).toBeGreaterThan(
      yTickLabels(desktop, false).find((t) => t.pct === 100)!.y,
    );
  });

  it("pile : somme des aires = 100 % de la hauteur à CHAQUE instant", () => {
    const rates = [
      [1, 2, 0.5, 3],
      [0, 1, 1, 1],
      [2, 0, 2.5, 0],
    ];
    const count = 4;
    const shares = stageShares(rates, count, [0, 1, 3]);
    for (const row of shares) {
      expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
      for (const s of row) expect(s).toBeGreaterThanOrEqual(0);
    }
    const { lo, hi } = stackPixelEdges(desktop, shares);
    for (let t = 0; t < count; t++) {
      expect(hi[rates.length - 1][t]).toBeCloseTo(yFor(desktop, 1), 6); // sommet = y(100 %)
      expect(lo[0][t]).toBeCloseTo(yFor(desktop, 0), 6); // base = y(0 %)
    }
    // bord à bord : le bas d'une bande est le haut de la précédente
    for (let t = 0; t < count; t++)
      for (let p = 1; p < rates.length; p++)
        expect(lo[p][t]).toBeCloseTo(hi[p - 1][t], 6);
  });

  it("correctif 9 — le modèle « chaque phase repart de zéro » est inchangé", () => {
    const shares = stageShares(
      [
        [3, 3, 1, 1],
        [1, 1, 1, 1],
      ],
      4,
      [0, 2, 3],
    );
    expect(shares[1][0]).toBeCloseTo(0.75, 9); // fin de phase 1 : cumul 6/8
    expect(shares[2][0]).toBeCloseTo(0.5, 9); // phase 2 : REPART DE ZÉRO
    expect(shares[2][0]).toBeLessThan(shares[1][0]); // le saut à la frontière
  });
});

describe("correctif 2 — plus de ligne claire parasite au sommet 100 %", () => {
  it("les aires ne portent aucun contour (liserés = séparateurs internes)", () => {
    const d = bandPath([0, 10, 20], [5, 6, 7], [3, 4, 5]);
    expect(d).toBe("M 0,5 L 10,6 L 20,7 L 20,5 L 10,4 L 0,3 Z");
    // Le rendu (replay-charts.tsx) trace les <path> SANS stroke et les
    // liserés en <polyline> internes — vérifié sur le DOM réel par
    // scripts/validate-charts-correctifs.mjs (strokedAreaPaths === 0).
  });
});

describe("correctif 3 — libellés de phases : en bas, anti-collision", () => {
  const xOf = (f: ReturnType<typeof frameFor>, maxIdx = 111) => (i: number) =>
    f.padL + (i / maxIdx) * (f.width - f.padL - f.padR);

  it("plaques EN BAS, disjointes et dans le cadre (desktop + 375 px)", () => {
    for (const f of [desktop, mobile]) {
      const plaques = phasePlaques(
        f,
        [
          { label: "Début", fromIdx: 0, toIdx: 34 }, // frontière 16:57 ≈ idx 34
          { label: "Milieu", fromIdx: 34, toIdx: 66 }, // frontière 33:14 ≈ idx 66
          { label: "Fin", fromIdx: 66, toIdx: 111 },
        ],
        xOf(f),
      ).filter((pl) => !pl.hidden);
      expect(plaques.length).toBe(3);
      for (const pl of plaques) expect(pl.cy).toBe(f.height - f.padB - 10); // EN BAS
      for (let i = 1; i < plaques.length; i++)
        expect(plaques[i].cx - plaques[i].w / 2, "chevauchement").toBeGreaterThanOrEqual(
          plaques[i - 1].cx + plaques[i - 1].w / 2,
        );
      for (const pl of plaques) {
        expect(pl.cx - pl.w / 2).toBeGreaterThanOrEqual(f.padL - 0.5);
        expect(pl.cx + pl.w / 2).toBeLessThanOrEqual(f.width - f.padR + 0.5);
      }
    }
  });

  it("phases très proches : le libellé en collision est MASQUÉ, jamais superposé", () => {
    const plaques = phasePlaques(
      mobile,
      [
        { label: "Début", fromIdx: 0, toIdx: 50 },
        { label: "Milieu", fromIdx: 50, toIdx: 54 }, // ~2 min
        { label: "Fin", fromIdx: 54, toIdx: 58 }, // ~2 min, centrée à côté
      ],
      xOf(mobile),
    );
    const shown = plaques.filter((pl) => !pl.hidden);
    expect(shown.length).toBeLessThan(3); // au moins un masqué
    expect(plaques.some((pl) => pl.hidden)).toBe(true);
    for (let i = 1; i < shown.length; i++)
      expect(shown[i].cx - shown[i].w / 2).toBeGreaterThanOrEqual(shown[i - 1].cx + shown[i - 1].w / 2);
  });

  it("pastille « Partie décidée » : seule en haut, bornée au cadre", () => {
    for (const f of [desktop, mobile]) {
      const nearRight = decidedPill(f, f.width - f.padR - 5, "Partie décidée");
      expect(nearRight.x + nearRight.w).toBeLessThanOrEqual(f.width - f.padR + 0.5); // bascule à gauche
      expect(nearRight.x).toBeGreaterThanOrEqual(f.padL - 0.5);
      expect(nearRight.y).toBe(f.padT + 2); // étage HAUT
      const nearLeft = decidedPill(f, f.padL + 5, "Partie décidée");
      expect(nearLeft.x).toBeGreaterThanOrEqual(f.padL + 5);
      // étages haut (pastille) et bas (plaques) disjoints
      const pl = phasePlaques(f, [{ label: "Fin", fromIdx: 0, toIdx: 111 }], xOf(f))[0];
      expect(nearRight.y + 15).toBeLessThan(pl.cy - 9);
    }
  });
});

describe("correctif 4 — axe X : ticks réguliers couvrant toute la largeur", () => {
  it("partie de 55:56 — pas de 10 min + repère de fin à 56:00", () => {
    const ticks = timeTicks(MAX_MS_56, false);
    expect(ticks.map((t) => t.ms / MIN)).toEqual([0, 10, 20, 30, 40, 50, 56]);
    expect(ticks[ticks.length - 1]).toMatchObject({ ms: MAX_MS_56, end: true, anchor: "end" });
    expect(ticks[ticks.length - 2].ms).toBeLessThan(MAX_MS_56); // dernier rond < fin
    for (const t of ticks.slice(0, -1)) expect(t.ms % (10 * MIN)).toBe(0);
    // régression : l'ancien rendu compact s'arrêtait à 0:00 / 30:00.
    expect(timeTicks(MAX_MS_56, true).map((t) => t.ms / MIN)).toEqual([0, 20, 40, 56]);
  });

  it("partie ≤ 30 min : pas de 5 min", () => {
    expect(timeTicks(28 * MIN, false).map((t) => t.ms / MIN)).toEqual([0, 5, 10, 15, 20, 25, 28]);
  });

  it("durée multiple du pas : pas de doublon au repère de fin", () => {
    const ticks = timeTicks(60 * MIN, false);
    const vals = ticks.map((t) => t.ms);
    expect(new Set(vals).size).toBe(vals.length);
    expect(ticks[ticks.length - 1]).toMatchObject({ ms: 60 * MIN, end: true });
  });

  it("compact : ≤ 6 labels, pas régulier, fin couverte", () => {
    const ticks = timeTicks(MAX_MS_56, true);
    expect(ticks.length).toBeLessThanOrEqual(6);
    expect(ticks[ticks.length - 1].ms).toBe(MAX_MS_56);
    const rounds = ticks.slice(0, -1).map((t) => t.ms);
    for (let i = 2; i < rounds.length; i++)
      expect(rounds[i] - rounds[i - 1]).toBe(rounds[1] - rounds[0]);
  });

  it("parties longues : 15 min ≤ 2 h, 30 min au-delà", () => {
    expect(timeTicks(90 * MIN, false).slice(0, 3).map((t) => t.ms / MIN)).toEqual([0, 15, 30]);
    expect(timeTicks(180 * MIN, false).slice(0, 3).map((t) => t.ms / MIN)).toEqual([0, 30, 60]);
  });
});

describe("correctif 5 — zone « ne compte pas » : estompe réellement", () => {
  it("saturation résiduelle ≤ 15 % sur toute la palette (voile clair)", () => {
    for (const c of [...PLAYER_COLORS, BAND_EDGE, TEAM_BLUE, TEAM_RED]) {
      const veil = grayZoneComposite(c);
      expect(hslSaturation(veil), `${c} → ${veil}`).toBeLessThanOrEqual(0.15);
    }
  });

  it("voile distinct du fond (≥ 2:1) : la zone reste identifiable", () => {
    for (const c of PLAYER_COLORS)
      expect(contrastRatio(grayZoneComposite(c), CHART_PANEL)).toBeGreaterThanOrEqual(2);
  });
});

describe("correctif 8 — palette : ΔE des paires fréquentes", () => {
  it("ΔE ≥ 25 entre bandes adjacentes dans l'ordre d'empilement", () => {
    for (let i = 1; i < PLAYER_COLORS.length; i++)
      expect(deltaE(PLAYER_COLORS[i], PLAYER_COLORS[i - 1]), `${PLAYER_COLORS[i - 1]}/${PLAYER_COLORS[i]}`).toBeGreaterThanOrEqual(25);
  });

  it("rouge et orange/ambre : jamais adjacents, ΔE ≥ 25", () => {
    const rouge = PLAYER_COLORS[2];
    const ambre = PLAYER_COLORS[5];
    expect(Math.abs(2 - 5)).toBeGreaterThanOrEqual(2);
    expect(deltaE(rouge, ambre)).toBeGreaterThanOrEqual(25);
  });

  it("bandes fines : teinte SATURÉE pleine + liseré suffisant", () => {
    for (const c of PLAYER_COLORS) expect(hslSaturation(c), c).toBeGreaterThanOrEqual(0.6);
    for (const c of PLAYER_COLORS) expect(deltaE(BAND_EDGE, c), `liseré vs ${c}`).toBeGreaterThanOrEqual(25);
  });
});

describe("correctifs 6/7/9 — rendu (garde-régression source + i18n)", () => {
  // 05/11 : les graphiques empilés par joueur ont été remplacés par le
  // TABLEAU d'impact par phase (phase-impact-table.tsx) — les libellés
  // gardes ont déménagé avec lui ; l'intent (pas de doublon de légende,
  // mention « repart de zéro » + i18n) est conservé sur la nouvelle cible.
  it("7 — la légende de phase n'est rendue qu'UNE fois (l'ancienne doublait)", () => {
    const result = readFileSync("components/replay/replay-result.tsx", "utf8");
    const table = readFileSync("components/replay/phase-impact-table.tsx", "utf8");
    expect((result.match(/自各阶段开始以来占全队积分的份额/g)?.length ?? 0) +
      (table.match(/自各阶段开始以来占全队积分的份额/g)?.length ?? 0)).toBeLessThanOrEqual(1);
  });

  it("9 — mention « chaque phase repart de zéro » (tableau d'impact par phase), i18n complet", () => {
    const table = readFileSync("components/replay/phase-impact-table.tsx", "utf8");
    expect(table.match(/每个阶段从零开始计算/g)?.length ?? 0).toBe(1);
    expect(english["每个阶段从零开始计算"]).toBe("Each stage restarts from zero");
    expect(french["每个阶段从零开始计算"]).toBe("Chaque phase repart de zéro");
  });

  it("6 — ancre résultat : scroll-margin (classe + ajustement header sticky)", () => {
    const src = readFileSync("components/replay/replay-portal.tsx", "utf8");
    expect(src).toContain('className="result-anchor"');
    expect(src).toContain("scrollMarginTop");
  });
});
