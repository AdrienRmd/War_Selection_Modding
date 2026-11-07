"use client";
/** Thème « haute visibilité » des graphiques replay (refonte 04/11 — style
 *  ws-stats strict, après diagnostic prod de la refonte « charts sombres »).
 *
 *  DIAGNOSTIC (mesuré en prod sur rep-Jd894wx6so9, 1440 + 375, 0 erreur
 *  console) : les SVG rendaient à leur vraie taille (ResizeObserver OK,
 *  pas de bug 0 px) et les aires couvraient 95-100 % du tracé — MAIS les
 *  dégradés semi-transparents (alpha 0.95 → 0.85) composités sur le
 *  panneau #181917 lavaient chaque teinte en ton moyen (saturation moyenne
 *  du tracé ≈ 55 %, #7cc4ff rendu #6eacde) : à distance, l'utilisateur
 *  voyait un rectangle sombre pastel — « je ne vois rien / pas beaux ».
 *
 *  NOUVELLE DIRECTION (référence ws-stats, section phases de
 *  wsva-detail/result-full.png : aplats fill-opacity 1) :
 *  - aires OPACHES (aucun dégradé, aucune transparence) ;
 *  - teintes VIVES saturées ≥ 44 % HSL (bleu #4da3ff, jaune #ffd166,
 *    rouge #ff5c5c, cyan #22d3ee, orange #fb923c, violet #a78bfa,
 *    vert #29d36a, magenta #f15bb5, lime #a3e635, rose #fb7185) ;
 *  - ordre d'empilement à familles de teintes alternées : ΔE(CIE76) ≥ 20
 *    entre bandes adjacentes (min mesuré 66.9) ET vs panneau (min 79.0) ;
 *  - liseré clair fin (#f4f6ef, 1 px) entre bandes — séparations nettes
 *    « bord à bord » comme la courbe de séparation ws-stats (stroke
 *    var(--panel) de la référence, ici clair sur fond sombre).
 *
 *  Tout est mesuré dans tests/chart-theme.test.ts (seuils ci-dessus) et,
 *  pour les correctifs du retour visuel 02/11 (palette réordonnée, voile
 *  gris estompant, échelle Y), dans tests/replay-chart-frame.test.ts. */

export const CHART_PANEL = "#181917"; // fond effectif derrière les aires (panneau wsva)
export const CHART_PAGE = "#101413"; // enveloppe ATLAS

/** Équipes : bleu vif vs rouge vif (ΔE 105.1 entre eux, ≥ 79 vs panneau). */
export const TEAM_BLUE = "#4da3ff";
export const TEAM_RED = "#ff5c5c";

/** Palette joueur (10) — ordre = ordre d'empilement (bas → haut),
 *  familles de teintes alternées pour maximiser le ΔE des paires rendues
 *  proches (retour visuel n° 8, 02/11) : ΔE adjacent min 66,9 ; le rouge
 *  (n° 2) et l'orange/ambre (n° 5) ne sont JAMAIS adjacents (ΔE 57,3 —
 *  l'ancien rouge/orange ΔE 39,7 se confondait à distance : « HANIBAL vs
 *  FakeKurier trop proches ») ; le rose framboise vif (sat 1,00, ΔE 39,8
 *  vs rouge — l'ancien #fb7185 plafonnait à 20,4) reste repérable même en
 *  bande fine. */
export const PLAYER_COLORS = [
  "#4da3ff", // bleu        L* 65,7
  "#ffd166", // jaune       L* 85,9
  "#ff5c5c", // rouge       L* 61,4
  "#22d3ee", // cyan        L* 77,9
  "#a78bfa", // violet      L* 64,6
  "#f59e0b", // ambre       L* 72,2 (ex-orange #fb923c, trop proche du rouge)
  "#29d36a", // vert        L* 74,9
  "#f15bb5", // magenta     L* 61,2
  "#a3e635", // lime        L* 84,3
  "#ff2f8f", // rose vif    L* 57,3 (ex-#fb7185, ΔE 20,4 seulement vs rouge)
] as const;

/** Liseré clair entre bandes — ΔE ≥ 45.4 vs chaque teinte de la palette. */
export const BAND_EDGE = "#f4f6ef";

/** Ligne médiane 50 % tracée AU-DESSUS des aires (lecture des parts). */
export const CHART_MIDLINE = "#ffffffb3";

/** Filets 25/75 % tracés AU-DESSUS des aires opaques — sous les aplats,
 *  ils étaient invisibles (le ancien code les dessinait dessous). */
export const CHART_GRID_OVER = "#ffffff2e";

/** Zone « ne compte pas » — voile CLAIR à haute opacité (retour visuel
 *  n° 5) : l'ancien voile sombre 0,62 laissait passer 42–66 % de
 *  saturation des aires vives (« les couleurs restent visibles »).
 *  Composite mesuré sur toute la palette : saturation HSL résiduelle
 *  ≤ 0,126, contraste ≥ 3:1 vs panneau (zone distincte du fond). */
export const GRAY_ZONE_VEIL = "#666a63";
export const GRAY_ZONE_VEIL_ALPHA = 0.9;
export const GRAY_ZONE_HATCH = "#14161a";
export const GRAY_ZONE_HATCH_ALPHA = 0.55;

/** Teinte réellement rendue sous le voile « ne compte pas » (mesure). */
export function grayZoneComposite(bandHex: string): string {
  return composite(GRAY_ZONE_VEIL, bandHex, GRAY_ZONE_VEIL_ALPHA);
}

/** Encre du graphe : axes, grille, textes, séparations. */
export const CHART_TEXT = "#c8cfbf"; // labels axes/phases — 11.0:1 sur panneau
export const CHART_TEXT_SOFT = "#aab3a0"; // libellés secondaires — ~8:1
export const CHART_GRID = "#ffffff17"; // filets fins horizontaux (sous les aires)
export const CHART_AXIS = "#ffffff3d"; // axes 0 % / 100 %
export const CHART_INK_LINE = "#ffd700"; // « Partie décidée » — or pur, 12.6:1 ; ΔE ≥ 26.3 vs toute teinte mesurée (l'ancien #ffd04d tombait à 19.2 vs l'ambre rendu #f7aa1a, sous le seuil 20)
export const CHART_GRAY_ZONE = "#9aa58c"; // zone « ne compte pas » (frontière + hachures)
export const WIN_CHANCE_LINE = "#ffffff"; // courbe win chance — ≥ 3:1 sur les aires
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

/** ΔE CIE76 entre deux couleurs (seuil de distinction d'aire ≥ 20). */
export function deltaE(a: string, b: string): number {
  const lab = (h: string) => {
    const [r, g, bl] = rgb(h);
    const rl = srgbToLinear(r);
    const gl = srgbToLinear(g);
    const bll = srgbToLinear(bl);
    let x = (rl * 0.4124 + gl * 0.3576 + bll * 0.1805) / 0.95047;
    let y = rl * 0.2126 + gl * 0.7152 + bll * 0.0722;
    let z = (rl * 0.0193 + gl * 0.1192 + bll * 0.9505) / 1.08883;
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    x = f(x);
    y = f(y);
    z = f(z);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)] as const;
  };
  const A = lab(a);
  const B = lab(b);
  return Math.sqrt((A[0] - B[0]) ** 2 + (A[1] - B[1]) ** 2 + (A[2] - B[2]) ** 2);
}

/** Saturation HSL (0..1) — les teintes d'aire visibles gardent ≥ 0.40. */
export function hslSaturation(hexColor: string): number {
  const [r, g, b] = rgb(hexColor).map((v) => v / 255) as [number, number, number];
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx === mn) return 0;
  const d = mx - mn;
  return mx + mn > 1 ? d / (2 - mx - mn) : d / (mx + mn);
}

/** Couleur composite d'une teinte semi-transparente sur un fond opaque. */
export function composite(hexColor: string, bg: string, alpha: number): string {
  const c = rgb(hexColor);
  const b = rgb(bg);
  const out = c.map((v, i) => Math.round(alpha * v + (1 - alpha) * b[i]));
  return "#" + out.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** Identifiant stable d'une série joueur (la légende et l'état « estompé »
 *  sont indexés par identifiant, JAMAIS par position — cf. correctif
 *  « décocher A n'affecte pas B »). */
export function playerSeriesId(name: string, index: number): string {
  return `${name}#${index}`;
}

/* ------------------------------------------------------------------ */
/* Graphe de population (mission 06/11) — la palette mesurée ci-dessus
 *  est CYCLÉE pour plus de 10 joueurs : au 2e passage la même teinte
 *  revient éclaircie de 12 % (mélange uniforme vers le blanc — même
 *  teinte, même saturation relative, attribution stable par index). */

/** Éclaircissement (+12 %) : mélange uniforme vers le blanc. */
export function lightenColor(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  const out = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16);
    return Math.round(v + (255 - v) * amount);
  });
  return "#" + out.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** Couleur de la courbe population d'un joueur : PLAYER_COLORS cyclée,
 *  +12 % de luminosité au 2e passage (14 joueurs = 10 teintes mesurées
 *  + variantes claires). */
export function populationPlayerColor(index: number): string {
  const base = PLAYER_COLORS[index % PLAYER_COLORS.length];
  return index < PLAYER_COLORS.length ? base : lightenColor(base, 0.12);
}
