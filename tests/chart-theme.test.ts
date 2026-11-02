import { describe, expect, it } from "vitest";
import {
  BAND_EDGE,
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
  ciel,
  composite,
  contrastRatio,
  deltaE,
  hslSaturation,
  playerSeriesId,
} from "../components/replay/chart-theme";

/** Seuils documentés (refonte « haute visibilité » 04/11, style ws-stats) :
 *  - aires OPACHES : chaque teinte garde saturation HSL ≥ 40 % (palette
 *    vive ws-stats — plus de dégradés semi-transparents qui lavaient les
 *    couleurs sur le panneau sombre) ;
 *  - ΔE(CIE76) ≥ 20 pour chaque teinte vs le fond (panneau ET page) et
 *    entre bandes JOUEUR adjacentes dans l'ordre d'empilement ;
 *  - liseré BAND_EDGE : ΔE ≥ 20 vs chaque teinte (séparation nette) ;
 *  - textes/axes/ligne « décidée » ≥ 4.5:1 (WCAG AA texte) sur le panneau
 *    ET sur la page. */
const DE_MIN = 20;
const SAT_MIN = 0.4;
const TEXT_MIN = 4.5;

describe("palette haute visibilité (ws-stats)", () => {
  it("10 teintes joueur, hex valides", () => {
    expect(PLAYER_COLORS).toHaveLength(10);
    for (const c of PLAYER_COLORS) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("teintes vives : saturation HSL ≥ 40 % (aplat opaque, pas lavé)", () => {
    for (const c of [...PLAYER_COLORS, TEAM_BLUE, TEAM_RED]) {
      expect(hslSaturation(c), `${c}`).toBeGreaterThanOrEqual(SAT_MIN);
    }
  });

  it("chaque teinte : ΔE ≥ 20 vs panneau ET vs page (aires pleines)", () => {
    for (const c of [...PLAYER_COLORS, TEAM_BLUE, TEAM_RED]) {
      expect(deltaE(c, CHART_PANEL), `${c} vs panneau`).toBeGreaterThanOrEqual(DE_MIN);
      expect(deltaE(c, CHART_PAGE), `${c} vs page`).toBeGreaterThanOrEqual(DE_MIN);
    }
  });

  it("ΔE ≥ 20 entre joueurs adjacents dans l'ordre d'empilement", () => {
    for (let i = 1; i < PLAYER_COLORS.length; i++) {
      const de = deltaE(PLAYER_COLORS[i], PLAYER_COLORS[i - 1]);
      expect(de, `${PLAYER_COLORS[i - 1]} → ${PLAYER_COLORS[i]}`).toBeGreaterThanOrEqual(DE_MIN);
    }
  });

  it("aucune paire de teintes confondables (ΔE ≥ 20 sur TOUTES les paires)", () => {
    for (let i = 0; i < PLAYER_COLORS.length; i++)
      for (let j = i + 1; j < PLAYER_COLORS.length; j++) {
        const de = deltaE(PLAYER_COLORS[i], PLAYER_COLORS[j]);
        expect(de, `${PLAYER_COLORS[i]} / ${PLAYER_COLORS[j]}`).toBeGreaterThanOrEqual(DE_MIN);
      }
  });

  it("liseré clair : ΔE ≥ 20 vs chaque teinte (séparation des bandes)", () => {
    for (const c of [...PLAYER_COLORS, TEAM_BLUE, TEAM_RED]) {
      expect(deltaE(BAND_EDGE, c), `liseré vs ${c}`).toBeGreaterThanOrEqual(DE_MIN);
    }
  });

  it("équipes : bleu vif vs rouge vif, ΔE ≥ 20 entre eux", () => {
    expect(deltaE(TEAM_BLUE, TEAM_RED)).toBeGreaterThanOrEqual(DE_MIN);
    expect(TEAM_BLUE).not.toBe(TEAM_RED);
  });

  it("aplats : les couleurs rendues SONT les couleurs de la palette", () => {
    // Plus de dégradé : le composite pleine opacité doit être la teinte
    // elle-même (régression du diagnostic « #7cc4ff rendu #6eacde »).
    for (const c of [...PLAYER_COLORS, TEAM_BLUE, TEAM_RED]) {
      expect(composite(c, CHART_PANEL, 1)).toBe(c.toLowerCase());
    }
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

  it("zone grise « ne compte pas » : teinte pleine ≥ 3:1 (overlay texturé)", () => {
    expect(contrastRatio(CHART_GRAY_ZONE, CHART_PANEL)).toBeGreaterThanOrEqual(3);
  });

  it("ΔL CIE toujours disponible (compat mesures existantes)", () => {
    for (let i = 1; i < PLAYER_COLORS.length; i++) {
      const dl = Math.abs(ciel(PLAYER_COLORS[i]) - ciel(PLAYER_COLORS[i - 1]));
      expect(dl).toBeGreaterThan(0);
    }
  });
});

describe("identifiants stables des séries joueur", () => {
  it("dépend du nom ET de l'index (doublons de pseudo impossible à confondre)", () => {
    expect(playerSeriesId("Alice", 0)).not.toBe(playerSeriesId("Alice", 1));
    expect(playerSeriesId("Alice", 0)).not.toBe(playerSeriesId("Bob", 0));
    expect(playerSeriesId("Alice", 3)).toBe(playerSeriesId("Alice", 3));
  });
});
