"use client";
/** Graphique SVG de la page résultat /replay — mission 05/11 (« je veux
 *  des DONNÉES, pas de graphique ») : SEUL graphique conservé, l'ÉQUILIBRE
 *  DE PUISSANCE (2 aires d'équipe + courbe de win chance) — vue d'ensemble
 *  lisible, les analyses par joueur sont désormais des TABLEAUX de données
 *  (phase-impact-table, player-stats-table, research-timeline).
 *  Historique des correctifs conservés ici : axe Y juste (yFor partagé
 *  graduations/tracé), axe X couvrant toute la largeur (ticks ronds +
 *  repère de fin à la durée exacte), info-bulle au survol/tap, rendu 1:1
 *  (viewBox = largeur mesurée au montage puis ResizeObserver — jamais 0 px).
 *
 *  Géométrie pure (testable) : ./chart-frame.ts. Couleurs : ./chart-theme.ts.
 *  Rendu vectoriel pur (aucune dépendance). Les graphiques ne s'affichent
 *  QUE dans le scope .rp. */
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReplayAnalysis } from "@/lib/replay/analysis";
import {
  BAND_EDGE,
  CHART_AXIS,
  CHART_GRID_OVER,
  CHART_MIDLINE,
  CHART_TEXT,
  TEAM_BLUE,
  TEAM_RED,
  WIN_CHANCE_LINE,
} from "./chart-theme";
import { type Frame, frameFor, timeTicks, yFor, yTickLabels } from "./chart-frame";

export { TEAM_BLUE, TEAM_RED } from "./chart-theme";

function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Cadre responsive : largeur mesurée, rendu 1:1                        */
/* ------------------------------------------------------------------ */

/** Largeur rendue d'un conteneur : MESURÉE dès le montage
 *  (useLayoutEffect, avant le premier paint navigateur) puis suivie par
 *  ResizeObserver. Les largeurs nulles (élément masqué/replié) sont
 *  ignorées : on conserve la dernière largeur valide, le SVG ne s'effondre
 *  jamais à 0 px. Retourne 0 avant montage (fallback de rendu 720). */
export function useElementWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = (w: number) => {
      if (w <= 0) return; // élément masqué : garder la dernière largeur valide
      setWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
    };
    apply(el.getBoundingClientRect().width); // mesure synchrone au montage
    const ro = new ResizeObserver((entries) => {
      apply(entries[0]?.contentRect.width ?? 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

interface FrameSvgProps {
  frame: Frame;
  maxMs: number;
  ariaLabel: string;
  children: React.ReactNode;
  /** Annotations rendues AU-DESSUS des aires opaques (filets, médiane,
   *  voile « ne compte pas », frontières, plaques, pastille). */
  overlay?: React.ReactNode;
  defs?: React.ReactNode;
  onPointer?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerLeave?: () => void;
}

function ChartFrameSvg({
  frame,
  maxMs,
  ariaLabel,
  children,
  overlay,
  defs,
  onPointer,
  onPointerLeave,
}: FrameSvgProps) {
  const compact = frame.width < 520;
  const bottom = frame.height - frame.padB;
  const right = frame.width - frame.padR;
  const ticks = timeTicks(maxMs, compact);
  const xTick = (ms: number) => frame.padL + ((ms / maxMs) * (right - frame.padL));
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
      {/* Graduations Y : positions = échelle du tracé (0 % en BAS,
          100 % en HAUT — correctif n° 1 : l'ancien index depuis le haut
          affichait 0 % au sommet et 100 % plus bas). */}
      {yTickLabels(frame, compact).map(({ pct, y }) => (
        <text key={pct} x={frame.padL - 7} y={y} textAnchor="end" fontSize={12} fill={CHART_TEXT}>
          {pct}%
        </text>
      ))}
      {/* Axe X : ticks ronds réguliers couvrant toute la largeur + repère
          de fin (durée exacte, demi-gras, ancré à droite) — l'ancien
          rendu s'arrêtait à 30:00 sur une partie de 55:56. */}
      {ticks.map((t, i) => (
        <line
          key={`m${i}`}
          x1={xTick(t.ms)}
          x2={xTick(t.ms)}
          y1={bottom}
          y2={bottom + 4}
          stroke={CHART_AXIS}
          strokeWidth={1}
        />
      ))}
      {ticks.map((t, i) => (
        <text
          key={`t${i}`}
          x={xTick(t.ms)}
          y={frame.height - 9}
          textAnchor={t.anchor}
          fontSize={12}
          fontWeight={t.end ? 600 : 400}
          fill={CHART_TEXT}
        >
          {formatClock(t.ms)}
        </text>
      ))}
      {children}
      {/* Repères AU-DESSUS des aires opaques (dessous, une grille était
          invisible) : filets 25/75 % discrets, axe 0 %, médiane 50 %. */}
      {yTickLabels(frame, compact)
        .filter(({ pct }) => pct % 50 !== 0)
        .map(({ pct, y }) => (
          <line
            key={`g${pct}`}
            x1={frame.padL}
            x2={right}
            y1={y - 4}
            y2={y - 4}
            stroke={CHART_GRID_OVER}
            strokeWidth={1}
            pointerEvents="none"
          />
        ))}
      <line x1={frame.padL} x2={right} y1={bottom} y2={bottom} stroke={CHART_AXIS} strokeWidth={1} pointerEvents="none" />
      <line
        x1={frame.padL}
        x2={right}
        y1={yFor(frame, 0.5)}
        y2={yFor(frame, 0.5)}
        stroke={CHART_MIDLINE}
        strokeWidth={1}
        pointerEvents="none"
      />
      {overlay}
    </svg>
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
  const frame = useMemo(() => frameFor(width || 720), [width]);
  const plot = useMemo(() => {
    if (n < 2) return null;
    const maxMs = Math.max(durationMs, n * 30000);
    const x = (i: number) => frame.padL + (i / (n - 1)) * (frame.width - frame.padL - frame.padR);
    const y = (p: number) => yFor(frame, p);
    const bluePts = power.blue.map((b, i) => `${x(i)},${y(b)}`).join(" ");
    const blueArea = `M ${x(0)},${y(0)} L ${bluePts.replace(/ /g, " L ")} L ${x(n - 1)},${y(0)} Z`;
    const redArea = `M ${x(0)},${frame.padT} L ${x(n - 1)},${frame.padT} L ${bluePts.split(" ").reverse().join(" L ")} Z`;
    const separator = power.blue.map((b, i) => `${x(i)},${y(b)}`).join(" ");
    return { maxMs, x, y, blueArea, redArea, separator };
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
        onPointer={onPointer}
        onPointerLeave={() => setTip(null)}
      >
        {/* Aplats opaques SANS contour : le liseré clair ne trace que la
            SÉPARATION bleu/rouge — plus de ligne parasite au sommet
            100 % (retour visuel n° 2). */}
        <path d={plot.blueArea} fill={TEAM_BLUE} />
        <path d={plot.redArea} fill={TEAM_RED} />
        <polyline
          points={plot.separator}
          fill="none"
          stroke={BAND_EDGE}
          strokeWidth={1}
          pointerEvents="none"
        />
        <polyline
          points={winChanceBlue.map((w, i) => `${plot.x(i)},${plot.y(w)}`).join(" ")}
          fill="none"
          stroke={WIN_CHANCE_LINE}
          strokeWidth={2.4}
          strokeDasharray="7 5"
          strokeLinejoin="round"
          strokeLinecap="round"
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
