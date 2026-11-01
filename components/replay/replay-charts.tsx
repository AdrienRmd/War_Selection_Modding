"use client";
/** Graphiques SVG de la page résultat /replay — aire empilée power + courbe
 *  win chance, aires empilées par joueur et par phase (early/mid/late), et
 *  duel d'équipes. Rendu vectoriel pur (aucune dépendance, responsive via
 *  viewBox), couleurs et libellés fournis par le parent.
 *
 *  V2 (01/11, refonte wsva) : couleurs via les variables du design-system
 *  scopé .rp (var(--team-blue) #4895ef, var(--team-red) #f72585, grilles
 *  #ffffff12/#ffffff40) — les graphiques ne s'affichent QUE dans le scope
 *  .rp (page résultat). */
import type { ReplayAnalysis } from "@/lib/replay/analysis";

export const TEAM_BLUE = "#4895ef"; // var(--team-blue) wsva
export const TEAM_RED = "#f72585"; // var(--team-red) wsva

/** Palette catégorielle (équipes ≤ 10 joueurs), tons wsva lisibles sur fond
 *  sombre (highlight #4cc9f0, gold, rust, violet late-medieval…). */
export const PLAYER_COLORS = [
  "#4cc9f0",
  "#f72585",
  "#ffd04d",
  "#7aa874",
  "#9b7fd1",
  "#4895ef",
  "#d9825a",
  "#7f9bb5",
  "#cd7f32",
  "#a4a4ae",
];

function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const GRID = "#ffffff12"; // .graph-grid wsva
const TEXT = "#a4a4ae"; // var(--text-muted)

interface Frame {
  width: number;
  height: number;
  padL: number;
  padR: number;
  padT: number;
  padB: number;
}

const FRAME: Frame = { width: 720, height: 230, padL: 44, padR: 12, padT: 14, padB: 26 };

function xAxisLabels(frame: Frame, maxMs: number): Array<{ x: number; label: string }> {
  const ticks = 5;
  const innerW = frame.width - frame.padL - frame.padR;
  return Array.from({ length: ticks }, (_, k) => {
    const t = (maxMs * k) / (ticks - 1);
    return {
      x: frame.padL + (innerW * k) / (ticks - 1),
      label: formatClock(t),
    };
  });
}

function yGrid(frame: Frame): number[] {
  return [0, 0.25, 0.5, 0.75, 1].map((r) => frame.padT + r * (frame.height - frame.padT - frame.padB));
}

function ChartFrameSvg({
  frame,
  maxMs,
  ariaLabel,
  children,
  extra,
}: {
  frame: Frame;
  maxMs: number;
  ariaLabel: string;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <svg
      className="rp-chart"
      viewBox={`0 0 ${frame.width} ${frame.height}`}
      role="img"
      aria-label={ariaLabel}
    >
      {yGrid(frame).map((y, i) => (
        <line key={i} x1={frame.padL} x2={frame.width - frame.padR} y1={y} y2={y} stroke={GRID} strokeWidth={1} className="graph-grid" />
      ))}
      {[0, 25, 50, 75, 100].map((p, i) => (
        <text
          key={p}
          x={frame.padL - 8}
          y={yGrid(frame)[i] + 4}
          textAnchor="end"
          fontSize={11}
          fill={TEXT}
        >
          {p}%
        </text>
      ))}
      {xAxisLabels(frame, maxMs).map((t, i) => (
        <text
          key={i}
          x={i === 0 ? t.x : i === 4 ? frame.width - frame.padR : t.x}
          y={frame.height - 8}
          textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"}
          fontSize={11}
          fill={TEXT}
        >
          {t.label}
        </text>
      ))}
      {extra}
      {children}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Équilibre de puissance + win chance                                 */
/* ------------------------------------------------------------------ */

export function PowerBalanceChart({
  power,
  winChanceBlue,
  durationMs,
  labels,
}: {
  power: NonNullable<ReplayAnalysis["power"]>;
  winChanceBlue: number[];
  durationMs: number;
  labels: { blue: string; red: string };
}) {
  const frame = FRAME;
  const n = power.blue.length;
  if (n < 2) return null;
  const maxMs = Math.max(durationMs, n * 30000);
  const x = (i: number) => frame.padL + (i / (n - 1)) * (frame.width - frame.padL - frame.padR);
  const y = (p: number) => frame.padT + (1 - p) * (frame.height - frame.padT - frame.padB);
  const bluePts = power.blue.map((b, i) => `${x(i)},${y(b)}`).join(" ");
  const blueArea = `M ${x(0)},${y(0)} L ${bluePts.replace(/ /g, " L ")} L ${x(n - 1)},${y(0)} Z`;
  const top = frame.padT;
  const redArea = `M ${x(0)},${top} L ${x(n - 1)},${top} L ${bluePts.split(" ").reverse().join(" L ")} Z`;
  return (
    <ChartFrameSvg frame={frame} maxMs={maxMs} ariaLabel={labels.blue + " / " + labels.red}>
      <path d={blueArea} fill={TEAM_BLUE} opacity={0.85} />
      <path d={redArea} fill={TEAM_RED} opacity={0.85} />
      <polyline
        points={winChanceBlue.map((w, i) => `${x(i)},${y(w)}`).join(" ")}
        fill="none"
        stroke="#a4a4ae"
        strokeWidth={1.6}
        strokeDasharray="5 4"
      />
      <line x1={frame.padL} x2={frame.width - frame.padR} y1={y(0.5)} y2={y(0.5)} stroke="#ffffff40" strokeWidth={1} className="graph-axis" />
    </ChartFrameSvg>
  );
}

/* ------------------------------------------------------------------ */
/* Marqueurs de phases / décision / cleanup (partagés)                 */
/* ------------------------------------------------------------------ */

interface StageMarksProps {
  frame: Frame;
  periodMs: number;
  count: number;
  stages: NonNullable<ReplayAnalysis["stages"]>;
  stageLabels: [string, string, string];
  decidedLabel: string;
}

function stageBoundaries(p: StageMarksProps) {
  return [
    Math.round(p.stages.earlyEndMs / p.periodMs),
    Math.round(p.stages.midEndMs / p.periodMs),
  ];
}

function StageMarks(p: StageMarksProps) {
  const innerW = p.frame.width - p.frame.padL - p.frame.padR;
  const maxIdx = p.count - 1;
  const x = (i: number) => p.frame.padL + (Math.min(i, maxIdx) / maxIdx) * innerW;
  const [e, m] = stageBoundaries(p);
  const cleanupIdx = Math.round(p.stages.cleanupFromMs / p.periodMs);
  const top = p.frame.padT;
  const bottom = p.frame.height - p.frame.padB;
  return (
    <>
      {/* Zone grise : cleanup (partie déjà décidée). */}
      <rect
        x={x(cleanupIdx)}
        y={top}
        width={Math.max(0, p.frame.width - p.frame.padR - x(cleanupIdx))}
        height={bottom - top}
        fill="#ffffff14"
        opacity={0.6}
      />
      {[e, m].map((i, k) => (
        <line key={k} x1={x(i)} x2={x(i)} y1={top} y2={bottom} stroke="#ffffff40" strokeWidth={1} strokeDasharray="3 3" className="graph-grid" />
      ))}
      {p.stages.decidedMs !== undefined && (
        <line
          x1={x(Math.round(p.stages.decidedMs / p.periodMs))}
          x2={x(Math.round(p.stages.decidedMs / p.periodMs))}
          y1={top}
          y2={bottom}
          stroke="#a4a4ae"
          strokeWidth={1.4}
        />
      )}
      {/* Libellés de phases, centrés entre bornes. */}
      {[
        { from: 0, to: e, label: p.stageLabels[0] },
        { from: e, to: m, label: p.stageLabels[1] },
        { from: m, to: maxIdx, label: p.stageLabels[2] },
      ].map((s, k) => (
        <text
          key={k}
          x={(x(s.from) + x(s.to)) / 2}
          y={top + 10}
          textAnchor="middle"
          fontSize={10.5}
          fill={TEXT}
        >
          {s.label}
        </text>
      ))}
      <text
        x={p.stages.decidedMs !== undefined ? x(Math.round(p.stages.decidedMs / p.periodMs)) + 4 : x(cleanupIdx) - 4}
        y={top + 10}
        textAnchor={p.stages.decidedMs !== undefined ? "start" : "end"}
        fontSize={10}
        fill="#a4a4ae"
      >
        {p.decidedLabel}
      </text>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Aires empilées par joueur (parts cumulées depuis le début de phase) */
/* ------------------------------------------------------------------ */

export interface StagePlayerSeries {
  name: string;
  color: string;
  rate: number[];
}

export function StageShareChart({
  players,
  stages,
  periodMs,
  caption,
  stageLabels,
  decidedLabel,
  decidedCaption,
}: {
  players: StagePlayerSeries[];
  stages: NonNullable<ReplayAnalysis["stages"]>;
  periodMs: number;
  caption: string;
  stageLabels: [string, string, string];
  decidedLabel: string;
  decidedCaption: string;
}) {
  const frame = { ...FRAME, height: 210 };
  const count = Math.max(...players.map((p) => p.rate.length), 2);
  const starts = [
    0,
    Math.round(stages.earlyEndMs / periodMs),
    Math.round(stages.midEndMs / periodMs),
  ];
  const maxIdx = count - 1;
  const innerW = frame.width - frame.padL - frame.padR;
  const x = (i: number) => frame.padL + (Math.min(i, maxIdx) / maxIdx) * innerW;
  const y = (p: number) => frame.padT + (1 - p) * (frame.height - frame.padT - frame.padB);
  // Une bande par joueur (parts cumulées depuis le début de la phase courante).
  const bands: Array<{ color: string; name: string; top: string[]; bottom: string[] }> =
    players.map((p) => ({ color: p.color, name: p.name, top: [], bottom: [] }));
  const cum = players.map(() => 0);
  for (let t = 0; t < count; t++) {
    const stage = t >= starts[2] ? 2 : t >= starts[1] ? 1 : 0;
    if (t === starts[stage]) cum.fill(0);
    let total = 0;
    for (let p = 0; p < players.length; p++) {
      cum[p] += players[p].rate[t] ?? 0;
      total += cum[p];
    }
    const shares = players.map((_, p) => (total > 0 ? cum[p] / total : 1 / players.length));
    // Empilement : du bas (premier joueur) vers le haut.
    let acc = 0;
    for (let p = 0; p < players.length; p++) {
      const lo = acc;
      acc += shares[p];
      const hi = acc;
      bands[p].bottom.push(`${x(t)},${y(lo)}`);
      bands[p].top.push(`${x(t)},${y(hi)}`);
    }
  }
  return (
    <figure className="rp-stage">
      <ChartFrameSvg
        frame={frame}
        maxMs={count * periodMs}
        ariaLabel={caption}
        extra={
          <StageMarks
            frame={frame}
            periodMs={periodMs}
            count={count}
            stages={stages}
            stageLabels={stageLabels}
            decidedLabel={decidedLabel}
          />
        }
      >
        {bands.map((b, i) => (
          <path
            key={i}
            d={`M ${b.bottom.join(" L ")} L ${b.top.reverse().join(" L ")} Z`}
            fill={b.color}
            opacity={0.9}
          />
        ))}
      </ChartFrameSvg>
      <figcaption className="rp-stage-caption">{caption}{decidedCaption ? ` · ${decidedCaption}` : ""}</figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Duel d'équipes : part d'impact Blue vs Red                          */
/* ------------------------------------------------------------------ */

export function VersusChart({
  blue,
  red,
  stages,
  periodMs,
  caption,
  stageLabels,
  decidedLabel,
}: {
  blue: number[];
  red: number[];
  stages: NonNullable<ReplayAnalysis["stages"]>;
  periodMs: number;
  caption: string;
  stageLabels: [string, string, string];
  decidedLabel: string;
}) {
  const frame = { ...FRAME, height: 210 };
  const count = Math.max(blue.length, red.length, 2);
  const maxIdx = count - 1;
  const innerW = frame.width - frame.padL - frame.padR;
  const x = (i: number) => frame.padL + (Math.min(i, maxIdx) / maxIdx) * innerW;
  const y = (p: number) => frame.padT + (1 - p) * (frame.height - frame.padT - frame.padB);
  const shareBlue = blue.map((b, i) => {
    const r = red[i] ?? 0;
    return b + r > 0 ? b / (b + r) : 0.5;
  });
  const pts = shareBlue.map((s, i) => `${x(i)},${y(s)}`).join(" ");
  const blueArea = `M ${x(0)},${y(0)} L ${pts.replace(/ /g, " L ")} L ${x(count - 1)},${y(0)} Z`;
  const top = frame.padT;
  const redArea = `M ${x(0)},${top} L ${x(count - 1)},${top} L ${pts.split(" ").reverse().join(" L ")} Z`;
  return (
    <figure className="rp-stage">
      <ChartFrameSvg
        frame={frame}
        maxMs={count * periodMs}
        ariaLabel={caption}
        extra={
          <StageMarks
            frame={frame}
            periodMs={periodMs}
            count={count}
            stages={stages}
            stageLabels={stageLabels}
            decidedLabel={decidedLabel}
          />
        }
      >
        <path d={blueArea} fill={TEAM_BLUE} opacity={0.85} />
        <path d={redArea} fill={TEAM_RED} opacity={0.85} />
      </ChartFrameSvg>
      <figcaption className="rp-stage-caption">{caption}</figcaption>
    </figure>
  );
}
