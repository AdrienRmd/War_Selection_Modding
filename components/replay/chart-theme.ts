"use client";
/** Thème des graphiques replay/profil sur canvas sombre Field Archive
 *  (refonte 03/11 — « charts sombres ») : palette catégorielle VIVE dont
 *  l'ordre d'empilement alterne clair/sombre (ΔL CIE ≥ 15 entre aires
 *  adjacentes, mesuré — min 15.9 sur la séquence complète), teintes d'équipe
 *  contrastées (bleu clair vs rouge soutenu, ΔL 23.6), encre/grille/texte
 *  ≥ 4.5:1 sur le fond effectif (#0d100e panneau / #101413 page).
 *
 *  Les dégradés verticaux des aires (opacité pleine en haut → réduite en
 *  bas) sont calibrés PAR COULEUR : l'opacité du bas est la plus faible
 *  garantissant un contraste composite ≥ 3:1 contre le panneau (les teintes
 *  foncées gardent plus d'opacité) — cf. bottomAreaAlpha, testé dans
 *  tests/chart-theme.test.ts. */

export const CHART_PANEL = "#181917"; // fond effectif derrière les aires (panneau wsva)
export const CHART_PAGE = "#101413"; // enveloppe ATLAS

/** Équipes : bleu CLAIR vs rouge SOUTENU (ΔL 19.7 — lisibles l'un de
 *  l'autre et du fond, ≥ 5:1 plein). */
export const TEAM_BLUE = "#7cc4ff"; // L* 76.7 — 9.4:1 sur panneau
export const TEAM_RED = "#e05e6b"; // L* 57.0 — 5.0:1 sur panneau

/** Palette joueur (10) — ordre = ordre d'empilement (bas → haut).
 *  Séquence claire/fonceé alternée : ambre, indigo, ocre, magenta, sauge,
 *  cuivre rouille, menthe, rose framboise, or, sarcelle. */
export const PLAYER_COLORS = [
  "#ffb454", // ambre        L* 78.8
  "#8b7ce8", // indigo       L* ~58
  "#e6b84c", // ocre         L* 77.1
  "#f15bb5", // magenta      L* 61.2
  "#a3d977", // vert sauge   L* 81.2
  "#c65f3d", // cuivre rouille L* 52.4
  "#7ae0c3", // menthe       L* 82.6
  "#e05263", // rose framboise L* 54.8
  "#ffd166", // or           L* 85.9
  "#2a9d8f", // sarcelle     L* 58.6
] as const;

/** Encre du graphe : axes, grille, textes, séparations. */
export const CHART_TEXT = "#c8cfbf"; // labels axes/phases — 12.0:1
export const CHART_TEXT_SOFT = "#aab3a0"; // libellés secondaires — ~8:1
export const CHART_GRID = "#ffffff17"; // filets fins horizontaux
export const CHART_AXIS = "#ffffff3d"; // axes 0 % / 100 % + ligne 50 %
export const CHART_INK_LINE = "#ffd04d"; // « Partie décidée » — 13.1:1
export const CHART_GRAY_ZONE = "#9aa58c"; // zone « ne compte pas » (texturée)
export const WIN_CHANCE_LINE = "#f2ead8"; // courbe win chance — ~13:1
export const POINTS_LINE = "#ffd166"; // courbe de points profil (or)

/* ------------------------------------------------------------------ */
/* Mesures couleur (partagées avec les tests)                          */
/* ------------------------------------------------------------------ */

function srgbToLinear(c: number): number {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function rgb(hexColor: string): [number, number, number] {
  const h = hexColor.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function relativeLuminance(c: [number, number, number]): number {
  return (
    0.2126 * srgbToLinear(c[0]) + 0.7152 * srgbToLinear(c[1]) + 0.0722 * srgbToLinear(c[2])
  );
}

/** Rapport de contraste WCAG entre deux couleurs. */
export function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(rgb(a));
  const l2 = relativeLuminance(rgb(b));
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Luminance CIE L* (utilisée pour l'écart entre aires adjacentes). */
export function ciel(hexColor: string): number {
  const y = relativeLuminance(rgb(hexColor));
  return y <= 216 / 24389 ? (24389 / 27 * y) / 116 : 116 * y ** (1 / 3) - 16;
}

/** Couleur composite d'une teinte semi-transparente sur un fond opaque. */
export function composite(hexColor: string, bg: string, alpha: number): string {
  const c = rgb(hexColor);
  const b = rgb(bg);
  const out = c.map((v, i) => Math.round(alpha * v + (1 - alpha) * b[i]));
  return "#" + out.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** Opacité du BAS de dégradé d'une aire : dégradé SUBTIL — plancher 0.85
 *  (une fondu plus profond affaiblirait le ΔL aux jonctions entre aires
 *  adjacentes) ; si la teinte est trop foncée pour garder ≥ 3:1 en
 *  composite sur le panneau, l'opacité est relevée au-delà. */
export function bottomAreaAlpha(hexColor: string): number {
  let lo = 0.55;
  let hi = 0.96;
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    if (contrastRatio(composite(hexColor, CHART_PANEL, mid), CHART_PANEL) >= 3) hi = mid;
    else lo = mid;
  }
  return Math.min(0.96, Math.max(0.85, hi));
}

/** Identifiant stable d'une série joueur (la légende et l'état « estompé »
 *  sont indexés par identifiant, JAMAIS par position — cf. correctif
 *  « décocher A n'affecte pas B »). */
export function playerSeriesId(name: string, index: number): string {
  return `${name}#${index}`;
}
