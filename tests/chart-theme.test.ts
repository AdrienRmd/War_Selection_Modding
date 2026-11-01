import { describe, expect, it } from "vitest";
import {
  CHART_GRAY_ZONE,
  CHART_INK_LINE,
  CHART_PAGE,
  CHART_PANEL,
  CHART_TEXT,
  CHART_TEXT_SOFT,
  PLAYER_COLORS,
  TEAM_BLUE,
  TEAM_RED,
  WIN_CHANCE_LINE,
  bottomAreaAlpha,
  ciel,
  composite,
  contrastRatio,
  playerSeriesId,
} from "../components/replay/chart-theme";

/** Seuils documentés (refonte « charts sombres » 03/11) :
 *  - ΔL CIE ≥ 15 entre aires JOUEUR adjacentes (ordre d'empilement) ;
 *  - teintes d'aire ≥ 4:1 pleines et ≥ 3:1 au bas de leur dégradé
 *    (grandes surfaces non textuelles : WCAG 1.4.11 = 3:1, marge prise) ;
 *  - textes/axes/ligne « décidée » ≥ 4.5:1 (WCAG AA texte). */
const DL_MIN = 15;
const FILL_MIN = 4;
const FILL_BOTTOM_MIN = 3;
const TEXT_MIN = 4.5;

describe("palette des graphiques sombres", () => {
  it("10 teintes joueur, hex valides", () => {
    expect(PLAYER_COLORS).toHaveLength(10);
    for (const c of PLAYER_COLORS) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("ΔL ≥ 15 entre joueurs adjacents dans l'ordre d'empilement", () => {
    for (let i = 1; i < PLAYER_COLORS.length; i++) {
      const dl = Math.abs(ciel(PLAYER_COLORS[i]) - ciel(PLAYER_COLORS[i - 1]));
      expect(dl, `${PLAYER_COLORS[i - 1]} → ${PLAYER_COLORS[i]}`).toBeGreaterThanOrEqual(DL_MIN);
    }
  });

  it("alternance clair/sombre : aucune paire ADJACENTE sous le seuil (couvert ci-dessus)", () => {
    // L'ordre d'empilement alterne clair/foncé : deux teintes claires proches
    // (ex. ocre/sauge) ne sont JAMAIS adjacentes — un bande foncée les sépare.
    const ls = [...PLAYER_COLORS].map(ciel);
    const adjacentDeltas = ls.slice(1).map((v, i) => Math.abs(v - ls[i]));
    expect(Math.min(...adjacentDeltas)).toBeGreaterThanOrEqual(DL_MIN);
  });

  it("chaque teinte ≥ 4:1 pleine et ≥ 3:1 en bas de dégradé (panneau)", () => {
    for (const c of PLAYER_COLORS) {
      expect(contrastRatio(c, CHART_PANEL), `${c} pleine`).toBeGreaterThanOrEqual(FILL_MIN);
      const bottom = composite(c, CHART_PANEL, bottomAreaAlpha(c));
      expect(contrastRatio(bottom, CHART_PANEL), `${c} bas de dégradé`).toBeGreaterThanOrEqual(
        FILL_BOTTOM_MIN,
      );
    }
  });

  it("dégradé subtil : opacité du bas bornée [0.85, 0.96]", () => {
    for (const c of [...PLAYER_COLORS, TEAM_BLUE, TEAM_RED]) {
      const a = bottomAreaAlpha(c);
      expect(a, `${c}`).toBeGreaterThanOrEqual(0.85);
      expect(a).toBeLessThanOrEqual(0.96);
    }
  });

  it("équipes : bleu clair vs rouge soutenu, ΔL ≥ 15, ≥ 4.5:1 pleines", () => {
    expect(Math.abs(ciel(TEAM_BLUE) - ciel(TEAM_RED))).toBeGreaterThanOrEqual(DL_MIN);
    expect(contrastRatio(TEAM_BLUE, CHART_PANEL)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(TEAM_RED, CHART_PANEL)).toBeGreaterThanOrEqual(4.5);
  });

  it("encre : textes, axes, « partie décidée », win chance ≥ 4.5:1", () => {
    for (const [name, c] of [
      ["texte axes", CHART_TEXT],
      ["texte secondaire", CHART_TEXT_SOFT],
      ["ligne décidée", CHART_INK_LINE],
      ["courbe win chance", WIN_CHANCE_LINE],
    ] as const) {
      expect(contrastRatio(c, CHART_PANEL), `${name} vs panneau`).toBeGreaterThanOrEqual(TEXT_MIN);
      expect(contrastRatio(c, CHART_PAGE), `${name} vs page`).toBeGreaterThanOrEqual(TEXT_MIN);
    }
  });

  it("zone grise « ne compte pas » : teinte pleine ≥ 3:1 (texture discrète)", () => {
    expect(contrastRatio(CHART_GRAY_ZONE, CHART_PANEL)).toBeGreaterThanOrEqual(3);
  });
});

describe("identifiants stables des séries joueur", () => {
  it("dépend du nom ET de l'index (doublons de pseudo impossible à confondre)", () => {
    expect(playerSeriesId("Alice", 0)).not.toBe(playerSeriesId("Alice", 1));
    expect(playerSeriesId("Alice", 0)).not.toBe(playerSeriesId("Bob", 0));
    expect(playerSeriesId("Alice", 3)).toBe(playerSeriesId("Alice", 3));
  });
});
