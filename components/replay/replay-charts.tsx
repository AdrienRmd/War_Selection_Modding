"use client";
/** Graphiques SVG de la page résultat /replay — refonte « haute
 *  visibilité » style ws-stats (04/11) puis correctifs du retour visuel
 *  utilisateur (02/11, 9 points — cf. tests/replay-chart-frame.test.ts
 *  et scripts/validate-charts-correctifs.mjs pour les mesures) :
 *  - AXE Y JUSTE : 0 % en bas, 100 % en haut, graduations 0/25/50/75/100
 *    réparties sur toute la hauteur, tracé et échelle partagent yFor()
 *    (l'ancien rendu indexait les labels depuis le haut) ;
 *  - plus de ligne claire parasite au sommet 100 % : les aires n'ont plus
 *    de contour, seules les SÉPARATIONS entre bandes portent le liseré ;
 *  - libellés de phases EN BAS sur plaques (anti-collision), pastille
 *    « Partie décidée » seule en haut, marqueurs discrets aux frontières
 *    (le modèle « chaque phase repart de zéro » est inchangé, expliqué
 *    dans la légende) ;
 *  - axe X : ticks ronds réguliers couvrant toute la largeur + repère de
 *    fin à la durée exacte (5 min ≤ 30 min de partie, sinon 10/15/30) ;
 *  - zone « ne compte pas » : voile clair à haute opacité qui ESTOMPE
 *    réellement les teintes dessous (saturation résiduelle ≤ 13 %),
 *    hachures sombres, distincte du panneau ;
 *  - grille 25/75 % et médiane 50 % tracées AU-DESSUS des aires opaques
 *    (elles étaient invisibles dessous) ;
 *  - survol/tap → info-bulle joueur + part + horloge ; légende
 *    interactive (décocher retire SA série, état indexé par identifiant
 *    joueur stable) ;
 *  - rendu 1:1 (viewBox = largeur mesurée) : la largeur est mesurée dès
 *    le montage (useLayoutEffect) puis suivie par ResizeObserver — un
 *    SVG jamais rendu à 0 px ; cadre 228–348 px, mode compact ≤ 520 px.
 *
 *  Géométrie pure (testable) : ./chart-frame.ts. Couleurs : ./chart-theme.ts.
 *  Rendu vectoriel pur (aucune dépendance). Les graphiques ne s'affichent
 *  QUE dans le scope .rp. */
import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReplayAnalysis } from "@/lib/replay/analysis";
import {
  BAND_EDGE,
  CHART_AXIS,
  CHART_GRAY_ZONE,
  CHART_GRID_OVER,
  CHART_INK_LINE,
  CHART_MIDLINE,
  CHART_TEXT,
  GRAY_ZONE_HATCH,
  GRAY_ZONE_HATCH_ALPHA,
  GRAY_ZONE_VEIL,
  GRAY_ZONE_VEIL_ALPHA,
  TEAM_BLUE,
  TEAM_RED,
  WIN_CHANCE_LINE,
  playerSeriesId,
} from "./chart-theme";
import {
  type Frame,
  bandPath,
  decidedPill,
  frameFor,
  phasePlaques,
  stageShares,
  stackPixelEdges,
  timeTicks,
  yFor,
  yTickLabels,
} from "./chart-frame";

export { TEAM_BLUE, TEAM_RED, PLAYER_COLORS } from "./chart-theme";

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
/* Marqueurs de phases / décision / cleanup (annotations AU-DESSUS)    */
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

/** Annotations de phases — rendues AU-DESSUS des aires opaques (prop
 *  overlay) : voile « ne compte pas », frontières de phases + marqueurs
 *  discrets (chaque phase repart de zéro), ligne « Partie décidée » en
 *  haut (seule), libellés de phases EN BAS sur plaques. */
function StageMarks(p: StageMarksProps) {
  const innerW = p.frame.width - p.frame.padL - p.frame.padR;
  const maxIdx = p.count - 1;
  const x = (ms: number) =>
    p.frame.padL + (Math.min(Math.round(ms / p.periodMs), maxIdx) / maxIdx) * innerW;
  const [e, m] = [
    Math.round(p.stages.earlyEndMs / p.periodMs),
    Math.round(p.stages.midEndMs / p.periodMs),
  ];
  const cleanupX = x(p.stages.cleanupFromMs);
  const top = p.frame.padT;
  const bottom = p.frame.height - p.frame.padB;
  const decided = p.stages.decidedMs !== undefined;
  const decidedX = x(p.stages.decidedMs ?? 0);
  const pill = decided ? decidedPill(p.frame, decidedX, p.decidedLabel) : null;
  const plaques = phasePlaques(
    p.frame,
    [
      { label: p.stageLabels[0], fromIdx: 0, toIdx: e },
      { label: p.stageLabels[1], fromIdx: e, toIdx: m },
      { label: p.stageLabels[2], fromIdx: m, toIdx: maxIdx },
    ],
    (i) => x(i * p.periodMs),
  );
  return (
    <>
      {/* Zone « ne compte pas » : voile CLAIR à haute opacité — il
          estompe réellement les teintes dessous (saturation résiduelle
          ≤ 13 % sur toute la palette, mesurée) tout en restant distinct
          du panneau sombre ; hachures sombres inversées, frontière nette. */}
      <rect
        x={cleanupX}
        y={top}
        width={Math.max(0, p.frame.width - p.frame.padR - cleanupX)}
        height={bottom - top}
        fill={`url(#${p.patternId})`}
        pointerEvents="none"
      />
      <line
        x1={cleanupX}
        x2={cleanupX}
        y1={top}
        y2={bottom}
        stroke={CHART_GRAY_ZONE}
        strokeOpacity={0.8}
        strokeWidth={1.2}
        pointerEvents="none"
      />
      {/* Frontières de phases + marqueur discret en sommet : à chaque
          frontière, les parts REPARTENT DE ZÉRO (modèle inchangé,
          explicité — les sauts brusques à 16:57 / 33:14 sont attendus). */}
      {[e, m].map((i, k) => {
        const bx = x(i * p.periodMs);
        return (
          <g key={k} pointerEvents="none">
            <line
              x1={bx}
              x2={bx}
              y1={top}
              y2={bottom}
              stroke="#ffffff"
              strokeOpacity={0.45}
              strokeWidth={1}
              strokeDasharray="3 4"
            />
            <path
              d={`M ${bx - 3.5} ${top} L ${bx + 3.5} ${top} L ${bx} ${top + 5.5} Z`}
              fill="#ffffff"
              fillOpacity={0.55}
            />
          </g>
        );
      })}
      {/* Ligne « Partie décidée » : trait doré contrasté + pastille (seule
          en haut — plus de collision avec les libellés de phases). */}
      {decided && pill && (
        <>
          <line
            x1={decidedX}
            x2={decidedX}
            y1={top}
            y2={bottom}
            stroke={CHART_INK_LINE}
            strokeWidth={1.8}
            pointerEvents="none"
          />
          <g transform={`translate(${pill.x}, ${pill.y})`}>
            <rect width={pill.w} height={pill.h} rx={7.5} fill={CHART_INK_LINE} />
            <text
              x={pill.w / 2}
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
      {/* Libellés de phases EN BAS, sur plaques sombres (lisaibles sur
          les aires vives) — anti-collision : un libellé qui chevaucherait
          le précédent est masqué, les frontières restent. */}
      {plaques
        .filter((pl) => !pl.hidden)
        .map((pl, k) => (
          <g key={k} pointerEvents="none">
            <rect
              x={pl.cx - pl.w / 2}
              y={pl.cy - 9}
              width={pl.w}
              height={13}
              rx={3}
              fill="#10120f"
              fillOpacity={0.78}
            />
            <text x={pl.cx} y={pl.cy} textAnchor="middle" fontSize={10.5} fill={CHART_TEXT}>
              {pl.label}
            </text>
          </g>
        ))}
    </>
  );
}

/** Texture de la zone « ne compte pas » : voile clair à haute opacité
 *  (0.90 — estompe les aires vives dessous, saturation résiduelle
 *  ≤ 13 %) traversé de hachures sombres — visible sans confusion avec
 *  une teinte joueur. */
function grayZonePattern(id: string): React.ReactNode {
  return (
    <pattern id={id} width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width={8} height={8} fill={GRAY_ZONE_VEIL} fillOpacity={GRAY_ZONE_VEIL_ALPHA} />
      <line x1={0} y1={0} x2={0} y2={8} stroke={GRAY_ZONE_HATCH} strokeOpacity={GRAY_ZONE_HATCH_ALPHA} strokeWidth={1.3} />
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
  phaseNote,
}: {
  players: StagePlayerSeries[];
  stages: NonNullable<ReplayAnalysis["stages"]>;
  periodMs: number;
  caption: string;
  stageLabels: [string, string, string];
  decidedLabel: string;
  decidedCaption: string;
  /** Mention courte « chaque phase repart de zéro » (modèle inchangé,
   *  explicite les sauts aux frontières — retour visuel n° 9). */
  phaseNote?: string;
}) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [muted, setMuted] = useState<ReadonlySet<string>>(new Set());
  const [tip, setTip] = useState<{ xr: number; yr: number; clock: string; player: number; share: number } | null>(null);
  const patternId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const frame = useMemo(() => frameFor(width || 720), [width]);
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
    // Parts cumulées par phase — MODÈLE INCHANGÉ (chaque phase repart de
    // zéro ; les sauts aux frontières sont attendus, cf. phaseNote).
    const sharesGrid = stageShares(
      players.map((p) => p.rate),
      count,
      starts,
    );
    const { xs, lo, hi } = stackPixelEdges(frame, sharesGrid);
    // Une bande par joueur, chemin figé dans le mémo (jamais de mutation
    // en rendu).
    const bands = players.map((p, idx) => ({
      color: p.color,
      name: p.name,
      d: bandPath(xs, lo[idx] ?? [], hi[idx] ?? []),
    }));
    return { xs, hi, sharesGrid, bands };
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

  // Liserés INTERNES uniquement : chaque bande VISIBLE sauf la plus haute
  // trace son bord supérieur — séparations nettes entre joueurs, aucune
  // ligne claire au sommet 100 % ni à la base (retour visuel n° 2).
  const visibleIdx = players.map((_, i) => i).filter((i) => !muted.has(ids[i]));
  const separatorIdx = visibleIdx.slice(0, -1);

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
          defs={grayZonePattern(`gz-${patternId}`)}
          overlay={
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
          {/* Bandes opaques bord à bord, teinte SATURÉE pleine (aucun
              dégradé — les bandes fines gardent leur hue, liseré 1 px
              pour les repérer) ; PAS de contour d'aire. */}
          {plot.bands.map((b, i) =>
            muted.has(ids[i]) ? null : <path key={ids[i]} d={b.d} fill={b.color} />,
          )}
          {separatorIdx.map((p) => (
            <polyline
              key={`sep-${p}`}
              points={plot.xs.map((x, t) => `${x},${plot.hi[p][t]}`).join(" ")}
              fill="none"
              stroke={BAND_EDGE}
              strokeWidth={1}
              pointerEvents="none"
            />
          ))}
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
        {phaseNote ? ` · ${phaseNote}` : ""}
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
  phaseNote,
  labels,
}: {
  blue: number[];
  red: number[];
  stages: NonNullable<ReplayAnalysis["stages"]>;
  periodMs: number;
  caption: string;
  stageLabels: [string, string, string];
  decidedLabel: string;
  phaseNote?: string;
  labels: { blue: string; red: string };
}) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [tip, setTip] = useState<{ xr: number; yr: number; clock: string; blue: number } | null>(null);
  const patternId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const frame = useMemo(() => frameFor(width || 720), [width]);
  const count = Math.max(blue.length, red.length, 2);
  const plot = useMemo(() => {
    const maxIdx = count - 1;
    const innerW = frame.width - frame.padL - frame.padR;
    const x = (i: number) => frame.padL + (Math.min(i, maxIdx) / maxIdx) * innerW;
    const y = (p: number) => yFor(frame, p);
    const shareBlue = blue.map((b, i) => {
      const r = red[i] ?? 0;
      return b + r > 0 ? b / (b + r) : 0.5;
    });
    const pts = shareBlue.map((s, i) => `${x(i)},${y(s)}`).join(" ");
    const blueArea = `M ${x(0)},${y(0)} L ${pts.replace(/ /g, " L ")} L ${x(count - 1)},${y(0)} Z`;
    const redArea = `M ${x(0)},${frame.padT} L ${x(count - 1)},${frame.padT} L ${pts.split(" ").reverse().join(" L ")} Z`;
    return { x, y, shareBlue, blueArea, redArea, separator: pts };
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
          defs={grayZonePattern(`vz-${patternId}`)}
          overlay={
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
          {/* Aplats opaques, liseré sur la seule frontière bleu/rouge. */}
          <path d={plot.blueArea} fill={TEAM_BLUE} />
          <path d={plot.redArea} fill={TEAM_RED} />
          <polyline
            points={plot.separator}
            fill="none"
            stroke={BAND_EDGE}
            strokeWidth={1}
            pointerEvents="none"
          />
        </ChartFrameSvg>
        <ChartLegend
          items={[
            { id: "blue", name: labels.blue, color: TEAM_BLUE },
            { id: "red", name: labels.red, color: TEAM_RED },
          ]}
        />
      </div>
      <figcaption className="rp-stage-caption">
        {caption}
        {phaseNote ? ` · ${phaseNote}` : ""}
      </figcaption>
    </figure>
  );
}
