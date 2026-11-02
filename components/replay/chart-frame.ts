/** Géométrie pure des graphiques replay (sans React) — partagée par le
 *  rendu (replay-charts.tsx) et les tests de JUSTESSE (mapping Y, couverture
 *  X, anti-collision, parts cumulées par phase). Correctifs du retour
 *  visuel utilisateur 02/11 :
 *   1. mapping Y : yFor(0) = BASE du tracé, yFor(1) = SOMMET — graduations
 *      et tracé partagent la MÊME fonction (l'ancien rendu indexait les
 *      labels depuis le haut : 0 % affiché en haut, 100 % plus bas) ;
 *   3. libellés de phases : plaques en BAS du tracé, anti-collision (un
 *      libellé qui chevauche le précédent est masqué, frontières restent) ;
 *   4. axe X : pas régulier selon la durée (5 min ≤ 30 min, 10 min ≤ 1 h,
 *      15 min ≤ 2 h, 30 min au-delà), dernier tick rond < fin + repère de
 *      fin à la durée exacte — couverture de toute la largeur ;
 *   9. parts par phase : « chaque phase repart de zéro » est le MODÈLE
 *      (inchangé) — il est seulement explicité visuellement.
 */

export interface Frame {
  width: number;
  height: number;
  padL: number;
  padR: number;
  padT: number;
  padB: number;
}

export function frameFor(width: number): Frame {
  const compact = width < 520;
  // Cadre haut (ratio ≤ 3.7:1, cf. référence ws-stats 1048×280) : les
  // bandes empilées restent épaisses et lisibles même à 8 joueurs.
  const height = Math.round(Math.max(228, Math.min(348, width * 0.36)));
  return {
    width,
    height,
    padL: compact ? 42 : 48,
    padR: compact ? 10 : 14,
    padT: 34,
    padB: 28,
  };
}

/** y (viewBox, croît vers le bas) d'une proportion p ∈ [0, 1] :
 *  p = 0 → BASE du tracé, p = 1 → SOMMET. */
export function yFor(frame: Frame, p: number): number {
  return frame.padT + (1 - p) * (frame.height - frame.padT - frame.padB);
}

/** Labels de graduation Y — baseline ajustée de +4 px pour le centrage
 *  optique des chiffres (les positions SONT l'échelle du tracé). */
export function yTickLabels(frame: Frame, compact: boolean): { pct: number; y: number }[] {
  return (compact ? [0, 50, 100] : [0, 25, 50, 75, 100]).map((pct) => ({
    pct,
    y: yFor(frame, pct / 100) + 4,
  }));
}

export interface TimeTick {
  ms: number;
  anchor: "start" | "middle" | "end";
  /** Repère de fin : la durée exacte de la partie (pas un multiple rond). */
  end: boolean;
}

/** Pas « rond » selon la durée (retour visuel n° 4). */
function stepFor(maxMs: number): number {
  if (maxMs <= 30 * 60_000) return 5 * 60_000;
  if (maxMs <= 60 * 60_000) return 10 * 60_000;
  if (maxMs <= 120 * 60_000) return 15 * 60_000;
  return 30 * 60_000;
}

/** Ticks horaires couvrant TOUTE la largeur : multiples réguliers du pas
 *  (dernier strictement inférieur à la fin) + repère de fin à la durée
 *  exacte. En compact (≤ 520 px), le pas est doublé tant que les labels
 *  ne tiennent pas (≤ 6 graduations) — l'ancien rendu s'arrêtait à
 *  « 0:00 / 30:00 » sur une partie de 55:56. */
export function timeTicks(maxMs: number, compact = false): TimeTick[] {
  const maxLabels = compact ? 6 : 8;
  let step = stepFor(maxMs);
  if (compact) while (Math.floor((maxMs - 1) / step) + 2 > maxLabels) step *= 2;
  const ticks: TimeTick[] = [];
  for (let t = 0; t < maxMs - 500; t += step)
    ticks.push({ ms: t, anchor: t === 0 ? "start" : "middle", end: false });
  if (!ticks.length) ticks.push({ ms: 0, anchor: "start", end: false });
  const lastRound = ticks[ticks.length - 1].ms;
  // La durée EST un multiple du pas → la dernière graduation ronde est le
  // repère de fin (pas de doublon collé).
  if (maxMs - lastRound < step / 4) ticks[ticks.length - 1] = { ms: maxMs, anchor: "end", end: true };
  else ticks.push({ ms: maxMs, anchor: "end", end: true });
  return ticks;
}

/** Parts cumulées par phase (MODÈLE INCHANGÉ — correctif n° 9 : chaque
 *  phase repart de zéro à sa frontière ; on l'explique, on ne le
 *  recalcule pas). Chaque ligne somme à 1 : la pile couvre 100 % de la
 *  hauteur à chaque instant. */
export function stageShares(rates: number[][], count: number, starts: number[]): number[][] {
  if (!rates.length) return Array.from({ length: count }, () => [] as number[]);
  const shares: number[][] = [];
  const cum = rates.map(() => 0);
  for (let t = 0; t < count; t++) {
    const stage = t >= starts[2] ? 2 : t >= starts[1] ? 1 : 0;
    if (t === starts[stage]) cum.fill(0);
    let total = 0;
    for (let p = 0; p < rates.length; p++) {
      cum[p] += rates[p][t] ?? 0;
      total += cum[p];
    }
    shares.push(rates.map((_, p) => (total > 0 ? cum[p] / total : 1 / rates.length)));
  }
  return shares;
}

/** Bords pixel de la pile : xs[t], lo[p][t] / hi[p][t] = bords bas/haut de
 *  la bande du joueur p à l'instant t. La bande la plus haute atteint
 *  EXACTEMENT yFor(1) (sommet = 100 %) et la plus basse yFor(0) — la somme
 *  des aires couvre toute la hauteur du tracé (assertion de test n° 1). */
export function stackPixelEdges(
  frame: Frame,
  shares: number[][],
): { xs: number[]; lo: number[][]; hi: number[][] } {
  const count = shares.length;
  const maxIdx = Math.max(count - 1, 1);
  const innerW = frame.width - frame.padL - frame.padR;
  const xs = Array.from({ length: count }, (_, t) => frame.padL + (t / maxIdx) * innerW);
  const lo: number[][] = [];
  const hi: number[][] = [];
  for (let t = 0; t < count; t++) {
    let acc = 0;
    for (let p = 0; p < shares[t].length; p++) {
      const l = acc;
      acc += shares[t][p];
      (lo[p] ??= [])[t] = yFor(frame, l);
      (hi[p] ??= [])[t] = yFor(frame, acc);
    }
  }
  return { xs, lo, hi };
}

/** Chemin d'une bande : bas → gauche à droite, puis haut → droite à
 *  gauche (jamais de mutation des tableaux mémoïsés). */
export function bandPath(xs: number[], lo: number[], hi: number[]): string {
  const up = xs.map((x, t) => `${x},${lo[t]}`).join(" L ");
  const down = xs
    .map((x, t) => `${x},${hi[t]}`)
    .reverse()
    .join(" L ");
  return `M ${up} L ${down} Z`;
}

export interface PhaseSegment {
  label: string;
  fromIdx: number;
  toIdx: number;
}

export interface PlacedPlaque {
  label: string;
  cx: number;
  cy: number;
  w: number;
  /** Masqué par anti-collision (chevauchement avec le précédent). */
  hidden: boolean;
}

/** Libellés de phases sur plaques EN BAS du tracé (retour visuel n° 3 :
 *  l'ancien étage haut entrait en collision avec la pastille « Partie
 *  décidée » et les libellés voisins). Anti-collision greedy : un
 *  libellé qui chevaucherait le précédent est masqué — les frontières
 *  pointillées restent, la plaque est bornée au cadre. */
export function phasePlaques(
  frame: Frame,
  segments: PhaseSegment[],
  xOfIdx: (i: number) => number,
): PlacedPlaque[] {
  const bottom = frame.height - frame.padB;
  const cy = bottom - 10;
  const GAP = 2;
  const out: PlacedPlaque[] = [];
  let rightEdge = frame.padL;
  for (const s of segments) {
    const w = s.label.length * 5.6 + 10;
    const mid = (xOfIdx(s.fromIdx) + xOfIdx(s.toIdx)) / 2;
    const cx = Math.min(
      Math.max(mid, frame.padL + w / 2 + 2),
      frame.width - frame.padR - w / 2 - 2,
    );
    if (cx - w / 2 < rightEdge + GAP) {
      out.push({ label: s.label, cx, cy, w, hidden: true });
      continue;
    }
    out.push({ label: s.label, cx, cy, w, hidden: false });
    rightEdge = cx + w / 2;
  }
  return out;
}

/** Pastille « Partie décidée » — EN HAUT, désormais SEULE à cet étage
 *  (libellés de phases déplacés en bas). Bascule à gauche du trait si
 *  elle déborderait à droite, calée dans le cadre à gauche. */
export function decidedPill(frame: Frame, x: number, label: string): { x: number; y: number; w: number; h: number } {
  const w = label.length * 5.6 + 12;
  const overflowRight = x + 5 + w > frame.width - frame.padR;
  return {
    x: overflowRight ? Math.max(frame.padL, x - w - 5) : x + 5,
    y: frame.padT + 2,
    w,
    h: 15,
  };
}
