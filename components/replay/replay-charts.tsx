"use client";
/** Graphiques SVG de la page résultat /replay — refonte « charts sombres »
 *  (03/11) pour le canvas Field Archive (#101413) :
 *
 *  - teintes VIVES par joueur, ordre d'empilement alterné clair/sombre
 *    (ΔL CIE ≥ 15 entre aires adjacentes — palette dans chart-theme.ts,
 *    mesurée dans tests/chart-theme.test.ts) ;
 *  - aires en dégradé vertical (opacité pleine en haut → réduite en bas,
 *    calibrée par teinte pour un contraste composite ≥ 3:1) séparées par un
 *    liseré d'encre fin ;
 *  - grille fine discrète + axes 0/25/50/75/100 % marqués, ticks
 *    horaires RONDS (multiples de 5 min) ;
 *  - zone grise « ne compte pas » texturée (hachures), ligne « Partie
 *    décidée » dorée + pastille ;
 *  - légende interactive par joueur (pastille + nom) : décocher estompe le
 *    chip SANS barrer le nom et retire SA série — l'état est indexé par
 *    identifiant joueur stable (jamais par position) ;
 *  - survol/tap → info-bulle joueur + part + horloge (div HTML positionnée
 *    sur le graphe, non mise à l'échelle) ;
 *  - rendu 1:1 (viewBox = largeur mesurée) : les textes gardent leur taille
 *  réelle quel que soit l'écran ; mode compact ≤ 520 px (3 ticks, marges
 *  réduites) — responsive 375 px sans collision.
 *
 *  Rendu vectoriel pur (aucune dépendance). Couleurs et libellés fournis par
 *  le parent ; les graphiques ne s'affichent QUE dans le scope .rp. */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReplayAnalysis } from "@/lib/replay/analysis";
import {
  bottomAreaAlpha,
  CHART_AXIS,
  CHART_GRAY_ZONE,
  CHART_INK_LINE,
  CHART_TEXT,
  CHART_TEXT_SOFT,
  CHART_GRID,
  TEAM_BLUE,
  TEAM_RED,
  WIN_CHANCE_LINE,
  playerSeriesId,
} from "./chart-theme";

export { TEAM_BLUE, TEAM_RED, PLAYER_COLORS } from "./chart-theme";

function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Ticks horaires RONDS : multiples de 5 min (pas « naturel » 1/2/5 × 60 s)
 *  couvrant maxMs en ~`target` graduations. */
function roundTimeTicks(maxMs: number, target: number): number[] {
  const rough = maxMs / target;
  const units = [60_000, 120_000, 300_000, 600_000, 900_000, 1_800_000, 3_600_000];
  const step = units.find((u) => u >= rough) ?? units[units.length - 1];
  const ticks: number[] = [];
  for (let t = 0; t <= maxMs; t += step) ticks.push(t);
  return ticks;
}

/* ------------------------------------------------------------------ */
/* Cadre responsive : largeur mesurée, rendu 1:1                        */
/* ------------------------------------------------------------------ */

/** Largeur rendue d'un conteneur (ResizeObserver) — 0 avant montage. */
export function useElementWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

interface Frame {
  width: number;
  height: number;
  padL: number;
  padR: number;
  padT: number;
  padB: number;
}

function frameFor(width: number): Frame {
  const compact = width < 520;
  const height = Math.round(Math.max(205, Math.min(255, width * 0.33)));
  return {
    width,
    height,
    padL: compact ? 42 : 48,
    padR: compact ? 10 : 14,
    padT: 30,
    padB: 28,
  };
}

function yPositions(frame: Frame): number[] {
  return [0, 0.25, 0.5, 0.75, 1].map(
    (r) => frame.padT + r * (frame.height - frame.padT - frame.padB),
  );
}

interface FrameSvgProps {
  frame: Frame;
  maxMs: number;
  ariaLabel: string;
  children: React.ReactNode;
  extra?: React.ReactNode;
  defs?: React.ReactNode;
  onPointer?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerLeave?: () => void;
}

function ChartFrameSvg({
  frame,
  maxMs,
  ariaLabel,
  children,
  extra,
  defs,
  onPointer,
  onPointerLeave,
}: FrameSvgProps) {
  const compact = frame.width < 520;
  const ys = yPositions(frame);
  const innerW = frame.width - frame.padL - frame.padR;
  const ticks = roundTimeTicks(maxMs, compact ? 3 : 5);
  const pcts = compact ? [0, 50, 100] : [0, 25, 50, 75, 100];
  return (
    <svg
      className="rp-chart"
      viewBox={`0 0 ${frame.width} ${frame.height}`}
      role="img"
      aria-label={ariaLabel}
      onPointerMove={onPointer}
      onPointerDown={onPointer}
      onPointerLeave={onPointerLeave}
    >
      {defs}
      {/* Grille fine ; axes 0 % et 100 % marqués + ligne 50 % visible. */}
      {[0.25, 0.75].map((r) => (
        <line
          key={r}
          x1={frame.padL}
          x2={frame.width - frame.padR}
          y1={frame.padT + r * (frame.height - frame.padT - frame.padB)}
          y2={frame.padT + r * (frame.height - frame.padT - frame.padB)}
          stroke={CHART_GRID}
          strokeWidth={1}
        />
      ))}
      {[0, 0.5, 1].map((r, i) => (
        <line
          key={i}
          x1={frame.padL}
          x2={frame.width - frame.padR}
          y1={ys[i * 2]}
          y2={ys[i * 2]}
          stroke={CHART_AXIS}
          strokeWidth={i === 1 ? 1 : 1.4}
        />
      ))}
      {pcts.map((p, i) => (
        <text
          key={p}
          x={frame.padL - 7}
          y={ys[i] + 4}
          textAnchor="end"
          fontSize={12}
          fill={CHART_TEXT}
        >
          {p}%
        </text>
      ))}
      {ticks.map((t, i) => (
        <line
          key={i}
          x1={frame.padL + (innerW * t) / maxMs}
          x2={frame.padL + (innerW * t) / maxMs}
          y1={frame.height - frame.padB}
          y2={frame.height - frame.padB + 4}
          stroke={CHART_AXIS}
          strokeWidth={1}
        />
      ))}
      {ticks.map((t, i) => (
        <text
          key={i}
          x={frame.padL + (innerW * t) / maxMs}
          y={frame.height - 9}
          textAnchor={i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"}
          fontSize={12}
          fill={CHART_TEXT}
        >
          {formatClock(t)}
        </text>
      ))}
      {extra}
      {children}
    </svg>
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
  patternId: string;
}

function StageMarks(p: StageMarksProps) {
  const innerW = p.frame.width - p.frame.padL - p.frame.padR;
  const maxIdx = p.count - 1;
  const x = (ms: number) =>
    p.frame.padL +
    (Math.min(Math.round(ms / p.periodMs), maxIdx) / maxIdx) * innerW;
  const [e, m] = [
    Math.round(p.stages.earlyEndMs / p.periodMs),
    Math.round(p.stages.midEndMs / p.periodMs),
  ];
  const cleanupX = x(p.stages.cleanupFromMs);
  const top = p.frame.padT;
  const bottom = p.frame.height - p.frame.padB;
  const decided = p.stages.decidedMs !== undefined;
  const decidedX = x(p.stages.decidedMs ?? 0);
  const labelW = p.decidedLabel.length * 5.6 + 12;
  const pillRight = decidedX + 4 + labelW > p.frame.width - p.frame.padR;
  return (
    <>
      {/* Zone grise « ne compte pas » : fond discret + hachures (texture
          distincte de toute teinte joueur) + liseré de départ. */}
      <rect
        x={cleanupX}
        y={top}
        width={Math.max(0, p.frame.width - p.frame.padR - cleanupX)}
        height={bottom - top}
        fill={`url(#${p.patternId})`}
      />
      <line
        x1={cleanupX}
        x2={cleanupX}
        y1={top}
        y2={bottom}
        stroke={CHART_GRAY_ZONE}
        strokeOpacity={0.55}
        strokeWidth={1}
        strokeDasharray="2 3"
      />
      {[e, m].map((i, k) => (
        <line
          key={k}
          x1={x(i * p.periodMs)}
          x2={x(i * p.periodMs)}
          y1={top}
          y2={bottom}
          stroke={CHART_AXIS}
          strokeWidth={1}
          strokeDasharray="3 4"
        />
      ))}
      {/* Ligne « Partie décidée » : trait doré contrasté + pastille. */}
      {decided && (
        <>
          <line
            x1={decidedX}
            x2={decidedX}
            y1={top}
            y2={bottom}
            stroke={CHART_INK_LINE}
            strokeWidth={1.8}
          />
          <g
            transform={
              pillRight
                ? `translate(${decidedX - labelW - 5}, ${top + 2})`
                : `translate(${decidedX + 5}, ${top + 2})`
            }
          >
            <rect width={labelW} height={15} rx={7.5} fill={CHART_INK_LINE} />
            <text
              x={labelW / 2}
              y={11}
              textAnchor="middle"
              fontSize={9.5}
              fontWeight={700}
              fill="#171410"
            >
              {p.decidedLabel}
            </text>
          </g>
        </>
      )}
      {/* Libellés de phases, centrés entre bornes. */}
      {[
        { from: 0, to: e, label: p.stageLabels[0] },
        { from: e, to: m, label: p.stageLabels[1] },
        { from: m, to: maxIdx, label: p.stageLabels[2] },
      ].map((s, k) => (
        <text
          key={k}
          x={(x(s.from * p.periodMs) + x(s.to * p.periodMs)) / 2}
          y={top + (decided ? 26 : 12)}
          textAnchor="middle"
          fontSize={10.5}
          fill={CHART_TEXT_SOFT}
        >
          {s.label}
        </text>
      ))}
    </>
  );
}

function grayZonePattern(id: string): React.ReactNode {
  return (
    <pattern id={id} width={7} height={7} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width={7} height={7} fill={CHART_GRAY_ZONE} fillOpacity={0.14} />
      <line x1={0} y1={0} x2={0} y2={7} stroke={CHART_GRAY_ZONE} strokeOpacity={0.5} strokeWidth={1.4} />
    </pattern>
  );
}

/* ------------------------------------------------------------------ */
/* Légende interactive + info-bulle                                    */
/* ------------------------------------------------------------------ */

export interface LegendItem {
  id: string;
  name: string;
  color: string;
}

function ChartLegend({
  items,
  muted,
  onToggle,
}: {
  items: LegendItem[];
  muted?: ReadonlySet<string>;
  onToggle?: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="rp-legend" role="group">
      {items.map((it) => {
        const active = !muted?.has(it.id);
        const Chip = onToggle ? "button" : "span";
        return (
          <Chip
            key={it.id}
            {...(onToggle
              ? {
                  type: "button" as const,
                  "aria-pressed": active,
                  onClick: () => onToggle(it.id),
                }
              : {})}
            className="rp-legend-chip"
          >
            <span className="rp-legend-swatch" style={{ background: it.color }} aria-hidden="true" />
            <span className="rp-legend-name">{it.name}</span>
          </Chip>
        );
      })}
    </div>
  );
}

interface TipRow {
  color: string;
  name: string;
  value: string;
}

function ChartTip({
  leftPct,
  topPct,
  clock,
  rows,
}: {
  leftPct: number;
  topPct: number;
  clock: string;
  rows: TipRow[];
}) {
  return (
    <div
      className="rp-chart-tip"
      style={{
        left: `${Math.min(88, Math.max(12, leftPct))}%`,
        top: `${Math.max(14, topPct)}%`,
      }}
    >
      {rows.map((r) => (
        <span key={r.name}>
          <span className="rp-chart-tip-swatch" style={{ background: r.color }} aria-hidden="true" />
          {r.name} <strong>{r.value}</strong>
        </span>
      ))}
      <span className="rp-chart-tip-clock">{clock}</span>
    </div>
  );
}

/** Convertit un événement pointeur en coordonnées du viewBox [0..1]. */
function pointerRatio(e: React.PointerEvent<SVGSVGElement>): { xr: number; yr: number } | null {
  const rect = e.currentTarget.getBoundingClientRect();
  if (rect.width === 0) return null;
  return {
    xr: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
    yr: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
  };
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
  labels: { blue: string; red: string; winChance: string };
}) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [tip, setTip] = useState<
    { xr: number; yr: number; clock: string; blue: number; red: number; win: number } | null
  >(null);
  const n = power.blue.length;
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const frame = frameFor(width || 720);
  const plot = useMemo(() => {
    if (n < 2) return null;
    const maxMs = Math.max(durationMs, n * 30000);
    const x = (i: number) => frame.padL + (i / (n - 1)) * (frame.width - frame.padL - frame.padR);
    const y = (p: number) => frame.padT + (1 - p) * (frame.height - frame.padT - frame.padB);
    const bluePts = power.blue.map((b, i) => `${x(i)},${y(b)}`).join(" ");
    const blueArea = `M ${x(0)},${y(0)} L ${bluePts.replace(/ /g, " L ")} L ${x(n - 1)},${y(0)} Z`;
    const redArea = `M ${x(0)},${frame.padT} L ${x(n - 1)},${frame.padT} L ${bluePts.split(" ").reverse().join(" L ")} Z`;
    return { maxMs, x, y, blueArea, redArea };
  }, [power.blue, n, durationMs, frame]);
  const onPointer = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!plot) return;
      const r = pointerRatio(e);
      if (!r) return;
      const i = Math.round(r.xr * (n - 1));
      setTip({
        xr: r.xr,
        yr: r.yr,
        clock: formatClock((i / (n - 1)) * plot.maxMs),
        blue: power.blue[i] ?? 0,
        red: 1 - (power.blue[i] ?? 0),
        win: winChanceBlue[i] ?? 0.5,
      });
    },
    [plot, n, power.blue, winChanceBlue],
  );
  if (n < 2 || !plot) return null;
  return (
    <div className="rp-chart-wrap" ref={wrapRef}>
      {tip && (
        <ChartTip
          leftPct={tip.xr * 100}
          topPct={tip.yr * 100}
          clock={tip.clock}
          rows={[
            { color: TEAM_BLUE, name: labels.blue, value: `${Math.round(tip.blue * 100)}%` },
            { color: TEAM_RED, name: labels.red, value: `${Math.round(tip.red * 100)}%` },
            { color: WIN_CHANCE_LINE, name: labels.winChance, value: `${Math.round(tip.win * 100)}%` },
          ]}
        />
      )}
      <ChartFrameSvg
        frame={frame}
        maxMs={plot.maxMs}
        ariaLabel={`${labels.blue} / ${labels.red}`}
        defs={
          <>
            <linearGradient id={`pb-b-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={TEAM_BLUE} stopOpacity={0.95} />
              <stop offset="100%" stopColor={TEAM_BLUE} stopOpacity={bottomAreaAlpha(TEAM_BLUE)} />
            </linearGradient>
            <linearGradient id={`pb-r-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={TEAM_RED} stopOpacity={0.95} />
              <stop offset="100%" stopColor={TEAM_RED} stopOpacity={bottomAreaAlpha(TEAM_RED)} />
            </linearGradient>
          </>
        }
        onPointer={onPointer}
        onPointerLeave={() => setTip(null)}
      >
        <path d={plot.blueArea} fill={`url(#pb-b-${gid})`} stroke={TEAM_BLUE} strokeWidth={1.4} />
        <path d={plot.redArea} fill={`url(#pb-r-${gid})`} stroke={TEAM_RED} strokeWidth={1.4} />
        <polyline
          points={winChanceBlue.map((w, i) => `${plot.x(i)},${plot.y(w)}`).join(" ")}
          fill="none"
          stroke={WIN_CHANCE_LINE}
          strokeWidth={2.2}
          strokeDasharray="6 4"
          strokeLinejoin="round"
        />
      </ChartFrameSvg>
      <ChartLegend
        items={[
          { id: "blue", name: labels.blue, color: TEAM_BLUE },
          { id: "red", name: labels.red, color: TEAM_RED },
          { id: "win", name: labels.winChance, color: WIN_CHANCE_LINE },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Aires empilées par joueur (parts cumulées depuis le début de phase) */
/* ------------------------------------------------------------------ */

export interface StagePlayerSeries {
  id?: string;
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
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [muted, setMuted] = useState<ReadonlySet<string>>(new Set());
  const [tip, setTip] = useState<{ xr: number; yr: number; clock: string; player: number; share: number } | null>(null);
  const patternId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const frame = frameFor(width || 720);
  const count = Math.max(...players.map((p) => p.rate.length), 2);
  const starts = useMemo(
    () => [
      0,
      Math.round(stages.earlyEndMs / periodMs),
      Math.round(stages.midEndMs / periodMs),
    ],
    [stages, periodMs],
  );

  const ids = players.map((p, i) => p.id ?? playerSeriesId(p.name, i));
  const toggle = useCallback((id: string) => {
    setMuted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const plot = useMemo(() => {
    const maxIdx = count - 1;
    const innerW = frame.width - frame.padL - frame.padR;
    const x = (i: number) => frame.padL + (Math.min(i, maxIdx) / maxIdx) * innerW;
    const y = (p: number) => frame.padT + (1 - p) * (frame.height - frame.padT - frame.padB);
    // Parts cumulées par phase (identique au rendu précédent).
    const sharesGrid: number[][] = [];
    const cum = players.map(() => 0);
    for (let t = 0; t < count; t++) {
      const stage = t >= starts[2] ? 2 : t >= starts[1] ? 1 : 0;
      if (t === starts[stage]) cum.fill(0);
      let total = 0;
      for (let p = 0; p < players.length; p++) {
        cum[p] += players[p].rate[t] ?? 0;
        total += cum[p];
      }
      sharesGrid.push(players.map((_, p) => (total > 0 ? cum[p] / total : 1 / players.length)));
    }
    // Une bande par joueur : bas = cumul des parts précédentes, haut = + sienne.
    const bands = players.map((p) => ({
      color: p.color,
      name: p.name,
      top: [] as string[],
      bottom: [] as string[],
    }));
    for (let t = 0; t < count; t++) {
      let acc = 0;
      for (let p = 0; p < players.length; p++) {
        const lo = acc;
        acc += sharesGrid[t][p];
        bands[p].bottom.push(`${x(t)},${y(lo)}`);
        bands[p].top.push(`${x(t)},${y(acc)}`);
      }
    }
    return { x, y, sharesGrid, bands };
  }, [players, count, starts, frame]);

  const onPointer = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const r = pointerRatio(e);
      if (!r) return;
      const innerW = frame.width - frame.padL - frame.padR;
      const innerH = frame.height - frame.padT - frame.padB;
      const idx = Math.min(
        count - 1,
        Math.max(0, Math.round(((r.xr * frame.width - frame.padL) / innerW) * (count - 1))),
      );
      const shares = plot.sharesGrid[idx] ?? [];
      // Position du curseur dans l'espace des parts (0 = bas, 1 = haut).
      const v = Math.min(1, Math.max(0, 1 - (r.yr * frame.height - frame.padT) / innerH));
      let acc = 0;
      let player = -1;
      for (let p = 0; p < players.length; p++) {
        if (muted.has(ids[p])) continue; // série retirée : pas d'info-bulle
        if (v >= acc - 0.001 && v < acc + shares[p] + 0.001) {
          player = p;
          break;
        }
        acc += shares[p];
      }
      if (player < 0) {
        setTip(null);
        return;
      }
      setTip({
        xr: r.xr,
        yr: r.yr,
        clock: formatClock((idx / Math.max(1, count - 1)) * count * periodMs),
        player,
        share: shares[player],
      });
    },
    [frame, count, plot, players.length, muted, ids, periodMs],
  );

  return (
    <figure className="rp-stage">
      <div className="rp-chart-wrap" ref={wrapRef}>
        {tip && players[tip.player] && (
          <ChartTip
            leftPct={tip.xr * 100}
            topPct={tip.yr * 100}
            clock={tip.clock}
            rows={[
              {
                color: players[tip.player].color,
                name: players[tip.player].name,
                value: `${Math.round(tip.share * 100)}%`,
              },
            ]}
          />
        )}
        <ChartFrameSvg
          frame={frame}
          maxMs={count * periodMs}
          ariaLabel={caption}
          defs={
            <>
              {grayZonePattern(`gz-${patternId}`)}
              {players.map((p, i) => (
                <linearGradient key={`sg-${patternId}-${i}`} id={`sg-${patternId}-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={p.color} stopOpacity={0.96} />
                  <stop offset="100%" stopColor={p.color} stopOpacity={bottomAreaAlpha(p.color)} />
                </linearGradient>
              ))}
            </>
          }
          extra={
            <StageMarks
              frame={frame}
              periodMs={periodMs}
              count={count}
              stages={stages}
              stageLabels={stageLabels}
              decidedLabel={decidedLabel}
              patternId={`gz-${patternId}`}
            />
          }
          onPointer={onPointer}
          onPointerLeave={() => setTip(null)}
        >
          {plot.bands.map((b, i) =>
            muted.has(ids[i]) ? null : (
              <path
                key={ids[i]}
                d={`M ${b.bottom.join(" L ")} L ${b.top.reverse().join(" L ")} Z`}
                fill={`url(#sg-${patternId}-${i})`}
                stroke="#0d100e"
                strokeWidth={1}
                strokeOpacity={0.9}
              />
            ),
          )}
        </ChartFrameSvg>
        <ChartLegend
          items={players.map((p, i) => ({ id: ids[i], name: p.name, color: p.color }))}
          muted={muted}
          onToggle={toggle}
        />
      </div>
      <figcaption className="rp-stage-caption">
        {caption}
        {decidedCaption ? ` · ${decidedCaption}` : ""}
      </figcaption>
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
  labels,
}: {
  blue: number[];
  red: number[];
  stages: NonNullable<ReplayAnalysis["stages"]>;
  periodMs: number;
  caption: string;
  stageLabels: [string, string, string];
  decidedLabel: string;
  labels: { blue: string; red: string };
}) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [tip, setTip] = useState<{ xr: number; yr: number; clock: string; blue: number } | null>(null);
  const patternId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const frame = frameFor(width || 720);
  const count = Math.max(blue.length, red.length, 2);
  const plot = useMemo(() => {
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
    const redArea = `M ${x(0)},${frame.padT} L ${x(count - 1)},${frame.padT} L ${pts.split(" ").reverse().join(" L ")} Z`;
    return { x, y, shareBlue, blueArea, redArea };
  }, [blue, red, count, frame]);
  const onPointer = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const r = pointerRatio(e);
      if (!r) return;
      const idx = Math.min(count - 1, Math.max(0, Math.round(((r.xr * frame.width - frame.padL) / (frame.width - frame.padL - frame.padR)) * (count - 1))));
      setTip({
        xr: r.xr,
        yr: r.yr,
        clock: formatClock((idx / Math.max(1, count - 1)) * count * periodMs),
        blue: plot.shareBlue[idx] ?? 0.5,
      });
    },
    [count, frame, plot, periodMs],
  );
  return (
    <figure className="rp-stage">
      <div className="rp-chart-wrap" ref={wrapRef}>
        {tip && (
          <ChartTip
            leftPct={tip.xr * 100}
            topPct={tip.yr * 100}
            clock={tip.clock}
            rows={[
              { color: TEAM_BLUE, name: labels.blue, value: `${Math.round(tip.blue * 100)}%` },
              { color: TEAM_RED, name: labels.red, value: `${Math.round((1 - tip.blue) * 100)}%` },
            ]}
          />
        )}
        <ChartFrameSvg
          frame={frame}
          maxMs={count * periodMs}
          ariaLabel={caption}
          defs={
            <>
              {grayZonePattern(`vz-${patternId}`)}
              <linearGradient id={`vs-b-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TEAM_BLUE} stopOpacity={0.96} />
                <stop offset="100%" stopColor={TEAM_BLUE} stopOpacity={bottomAreaAlpha(TEAM_BLUE)} />
              </linearGradient>
              <linearGradient id={`vs-r-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TEAM_RED} stopOpacity={0.96} />
                <stop offset="100%" stopColor={TEAM_RED} stopOpacity={bottomAreaAlpha(TEAM_RED)} />
              </linearGradient>
            </>
          }
          extra={
            <StageMarks
              frame={frame}
              periodMs={periodMs}
              count={count}
              stages={stages}
              stageLabels={stageLabels}
              decidedLabel={decidedLabel}
              patternId={`vz-${patternId}`}
            />
          }
          onPointer={onPointer}
          onPointerLeave={() => setTip(null)}
        >
          <path d={plot.blueArea} fill={`url(#vs-b-${gid})`} stroke={TEAM_BLUE} strokeWidth={1.4} />
          <path d={plot.redArea} fill={`url(#vs-r-${gid})`} stroke={TEAM_RED} strokeWidth={1.4} />
        </ChartFrameSvg>
        <ChartLegend
          items={[
            { id: "blue", name: labels.blue, color: TEAM_BLUE },
            { id: "red", name: labels.red, color: TEAM_RED },
          ]}
        />
      </div>
      <figcaption className="rp-stage-caption">{caption}</figcaption>
    </figure>
  );
}
