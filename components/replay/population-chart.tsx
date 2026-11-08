"use client";
/** Graphe interactif d'évolution de population (mission 06/11, livrable 1).
 *
 *  Chart.js (exigence explicite de l'utilisateur — le site utilise par
 *  ailleurs recharts pour d'autres graphiques) : une courbe par joueur,
 *  petit point à chaque mesure (relevé du jeu toutes les 30 s).
 *  - Axe X : temps MM:SS, graduation toutes les 1:30 (90 s).
 *  - Axe Y : population, cadrée 0–600 (référence du jeu), étendue par
 *    multiples de 100 si une série dépasse réellement.
 *  - Fond du panneau #111827, grille fine peu contrastée, texte gris clair.
 *  - Palette vive par joueur : la palette mesurée de chart-theme
 *    (PLAYER_COLORS, 10 teintes ΔE) CYCLÉE avec variante claire au 2e
 *    passage (populationPlayerColor) ;
 *  - Infobulle index : joueur, temps, valeur.
 *  - Panneau latéral : recherche, « Tout sélectionner », joueurs groupés
 *    par équipe avec case à cocher ; cocher/décocher affiche/masque la
 *    courbe ; survol ou focus d'une ligne met SA courbe en évidence (les
 *    autres atténuées).
 *  - Mobile (≤ 820 px) : le panneau passe SOUS le graphe, repliable.
 *
 *  Données : série replayDatasetPopulation du parser (estimation documentée
 *  — cf. lib/replay/population.ts : travailleurs/bateaux/tracteurs exacts
 *  par tick + armée calibrée R_joueur sur les créations réelles ; libellé
 *  « estimation » partout). */
import { useEffect, useMemo, useRef, useState } from "react";
import { Chart, registerables } from "chart.js";
import { useBilingual } from "@/components/i18n";
import { playerSeries } from "@/lib/replay/analysis";
import type { ReplayAnalysis } from "@/lib/replay/analysis";
import type { Player, ReplayParseSuccess } from "@/lib/replay/structure";
import {
  POPULATION_TICK_SECONDS,
  REPLAY_DATASET_POPULATION,
  formatMinutesSeconds,
  populationYMax,
} from "@/lib/replay/population";
import { populationPlayerColor as playerColor } from "./chart-theme";

Chart.register(...registerables);

const POP_GRID = "#ffffff14"; // filets fins peu contrastés
const POP_TEXT = "#d1d5db"; // texte gris clair
const POP_BORDER = "#ffffff29";

/** Palette joueur : la palette mesurée de chart-theme (teintes vives
 *  saturées, ΔE adjacents ≥ 20 — prouvée par tests/chart-theme.test.ts),
 *  CYCLÉE pour plus de 10 joueurs : au 2e passage la même teinte revient
 *  avec +12 % de luminosité HSL (attribution stable par index joueur). */
/** Atténuation des courbes non mises en évidence (joueur survolé/sélectionné). */
const DIMMED_ALPHA = "2e"; // ~18 % — courbe encore repérable

export function PopulationChartSection({
  result,
  analysis,
}: {
  result: ReplayParseSuccess;
  analysis: ReplayAnalysis;
}) {
  const l = useBilingual();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  // Sélection initiale : toutes les courbes affichées (état initial pur,
  // pas de setState dans un effet).
  const [visible, setVisible] = useState<ReadonlySet<number>>(
    () => new Set(result.players.map((p) => p.id)),
  );
  const [highlight, setHighlight] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  /** Panneau repliable sous le graphe en petit écran (≥ 821 px : toujours
   *  visible à côté, le bouton disparaît). */
  const [panelOpen, setPanelOpen] = useState(false);

  /** Joueurs avec série population (id, nom, équipe, points {x:s, y:pop}). */
  const players = useMemo(() => {
    const sideOf = (player: Player) =>
      analysis.teams.find((t) => t.id === player.team)?.side ?? 0;
    return result.players
      .map((player, index) => {
        const series = playerSeries(result, REPLAY_DATASET_POPULATION, player) ?? [];
        const stepSec = Math.max(1, Math.round(result.timeLinePeriod / 1000));
        // Stats secondaires compactes (mission 08/11) — MÊMES sources et
        // formats que le tableau « Statistiques complètes » : score MVP
        // (entier), unités produites / tuées (dénombrements bruts),
        // recherches accomplies. Aucun calcul nouveau.
        const impact = analysis.teams
          .flatMap((t) => t.players)
          .find((p) => p.player.id === player.id);
        return {
          id: player.id,
          index,
          name: player.nickname,
          side: sideOf(player),
          points: series.map((value, i) => ({ x: i * stepSec, y: value })),
          stats: {
            score: Math.round(impact?.player.mvpScore ?? 0),
            created: impact?.created ?? 0,
            killed: impact?.killed ?? 0,
            researches: (player.researches ?? []).length,
          },
        };
      })
      .filter((p) => p.points.length > 1);
  }, [result, analysis]);

  // Durée retenue : le dernier relevé OU la durée officielle du match,
  // pour que l'axe couvre toute la partie (aligné sur la grille 1:30).
  const durationSec = Math.max(
    ...players.map((p) => p.points[p.points.length - 1]?.x ?? 0),
    Math.round(result.match.duration / 1000),
    0,
  );

  // Liste filtrée par la recherche (insensible à la casse, sur le pseudo).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? players.filter((p) => p.name.toLowerCase().includes(q)) : players;
  }, [players, query]);
  const visibleFiltered = filtered.filter((p) => visible.has(p.id));
  const allChecked = visibleFiltered.length === filtered.length && filtered.length > 0;

  const togglePlayer = (id: number) =>
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setVisible((prev) => {
      const filteredIds = new Set(filtered.map((p) => p.id));
      const allShown = filtered.every((p) => prev.has(p.id));
      const next = new Set(prev);
      for (const id of filteredIds) {
        if (allShown) next.delete(id);
        else next.add(id);
      }
      return next;
    });

  /* Courbe Chart.js — reconstruite quand la sélection change ; la mise en
   * évidence n'altère que les couleurs (update sans réanimation). */
  const maxVisible = useMemo(
    () =>
      Math.max(
        0,
        ...players
          .filter((p) => visible.has(p.id))
          .flatMap((p) => p.points.map((pt) => pt.y)),
      ),
    [players, visible],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || players.length === 0) return;
    const buildDatasets = (highlighted: number | null) =>
      players.map((p) => {
        const baseColor = playerColor(p.index);
        const dim = highlighted !== null && highlighted !== p.id;
        return {
          label: p.name,
          data: p.points as { x: number; y: number }[],
          borderColor: dim ? baseColor + DIMMED_ALPHA : baseColor,
          backgroundColor: baseColor,
          pointRadius: 1.5,
          pointHoverRadius: 3,
          pointBackgroundColor: baseColor,
          pointBorderColor: "transparent",
          borderWidth: highlighted !== null && highlighted === p.id ? 2.6 : 1.8,
          tension: 0.22,
          spanGaps: false,
          hidden: !visible.has(p.id),
        };
      });
    const chart =
      chartRef.current ??
      new Chart(canvas, {
        type: "line",
        data: { datasets: buildDatasets(null) },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#0b1220",
              titleColor: POP_TEXT,
              bodyColor: "#f8fafc",
              borderColor: POP_BORDER,
              borderWidth: 1,
              padding: 10,
              itemSort: (a, b) => (b.parsed.y ?? 0) - (a.parsed.y ?? 0),
              callbacks: {
                title: (items) =>
                  formatMinutesSeconds(items[0]?.parsed?.x ?? 0),
                label: (item) => ` ${item.dataset.label} : ${item.parsed.y}`,
              },
            },
          },
          scales: {
            x: {
              type: "linear",
              min: 0,
              // fin d'axe alignée sur la grille 1:30 (multiple de 90 s)
              max: durationSec > 0 ? Math.ceil(durationSec / POPULATION_TICK_SECONDS) * POPULATION_TICK_SECONDS : 300,
              grid: { color: POP_GRID, tickColor: POP_BORDER },
              border: { color: POP_BORDER },
              ticks: {
                stepSize: POPULATION_TICK_SECONDS,
                maxRotation: 0,
                color: POP_TEXT,
                font: { size: 11 },
                callback: (value) => formatMinutesSeconds(Number(value)),
              },
            },
            y: {
              min: 0,
              max: populationYMax(maxVisible),
              grid: { color: POP_GRID, tickColor: POP_BORDER },
              border: { color: POP_BORDER },
              ticks: {
                stepSize: 100,
                color: POP_TEXT,
                font: { size: 11 },
              },
            },
          },
        },
      });
    if (!chartRef.current) chartRef.current = chart;
    // Hook d'introspection e2e (validation, jamais lu par l'application).
    (canvas as HTMLCanvasElement & { __populationChart?: Chart }).__populationChart = chart;
    chart.data.datasets = buildDatasets(highlight);
    if (chart.options.scales?.y) {
      chart.options.scales.y.max = populationYMax(maxVisible);
    }
    chart.update("none");
    return () => {
      /* le graphe vit tant que la section est montée */
    };
  }, [players, visible, highlight, maxVisible, durationSec]);

  useEffect(
    () => () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    },
    [],
  );

  if (players.length === 0) return null;
  const teamLabel = (side: number) => (side === 0 ? l("蓝队", "Blue") : l("红队", "Red"));

  return (
    <section className="rp-population panel rp-section" data-testid="population-chart">
      <header className="chart-heading rp-population-heading">
        <h3 className="heading-3">
          {l("人口曲线（估算）", "Population over time (estimate)")}
        </h3>
        <p className="label-text rp-population-note">
          {l(
            "每个玩家一条曲线。村民/渔船/拖拉机为逐时段精确值，军队按玩家实际生产校准估算；被淘汰后回落到 0。",
            "One line per player. Workers, fishing boats and tractors are exact per tick; the army part is calibrated on each player's actual production. Eliminated players fold back to 0.",
          )}
        </p>
      </header>
      <div className="rp-population-body">
        <div className="rp-population-chart-frame">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={l("各玩家人口随时间变化的折线图（估算）", "Line chart of each player's population over time (estimate)")}
          />
        </div>
        <aside className={`rp-population-panel${panelOpen ? " rp-population-panel-open" : ""}`}>
          <button
            type="button"
            className="rp-population-panel-toggle"
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen((v) => !v)}
          >
            {l("玩家与队伍", "Players & teams")}
            <span className="rp-population-panel-count label-text">{players.length}</span>
          </button>
          <div className="rp-population-panel-body">
          <input
            type="search"
            className="rp-population-search"
            placeholder={l("搜索玩家们…", "Search players…")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={l("搜索玩家", "Search players")}
          />
          <label className="rp-population-selectall">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
            />
            <span>{l("全选", "Select all")}</span>
          </label>
          <div className="rp-population-list" role="group" aria-label={l("玩家曲线", "Player lines")}>
            {[0, 1].map((side) => {
              const sidePlayers = filtered.filter((p) => p.side === side);
              if (sidePlayers.length === 0) return null;
              return (
                <div key={side} className="rp-population-team">
                  <span
                    className={`label-text rp-population-team-name ${
                      side === 0 ? "team-name-blue" : "team-name-red"
                    }`}
                  >
                    {teamLabel(side)}
                  </span>
                  {sidePlayers.map((p) => (
                    <label
                      key={p.id}
                      className={`rp-population-player${highlight === p.id ? " rp-population-player-hot" : ""}`}
                      onMouseEnter={() => setHighlight(p.id)}
                      onMouseLeave={() => setHighlight(null)}
                      onFocus={() => setHighlight(p.id)}
                      onBlur={() => setHighlight(null)}
                    >
                      <input
                        type="checkbox"
                        checked={visible.has(p.id)}
                        onChange={() => togglePlayer(p.id)}
                      />
                      <span className="rp-population-swatch" style={{ background: playerColor(p.index) }} aria-hidden="true" />
                      <span className="rp-population-ident">
                        <span className="rp-population-name" title={p.name}>{p.name}</span>
                        <span className="rp-population-player-stats label-text">
                          {l("分数 ${score} · 生产 ${created} · 歼灭 ${killed} · 研究 ${researches}", "Score ${score} · Built ${created} · Kills ${killed} · Res. ${researches}")
                            .replace("${score}", String(p.stats.score))
                            .replace("${created}", String(p.stats.created))
                            .replace("${killed}", String(p.stats.killed))
                            .replace("${researches}", String(p.stats.researches))}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              );
            })}
            {filtered.length === 0 ? (
              <p className="label-text">{l("没有匹配的玩家。", "No player matches.")}</p>
            ) : null}
          </div>
          </div>
        </aside>
      </div>
      <p className="label-text rp-population-axis">
        {l(
          "纵轴 0–600（超出时自动扩展）· 横轴每 1:30 一格 · 数值为估算",
          "Y axis 0–600 (auto-extended beyond) · X axis tick every 1:30 · values are estimated",
        )}
      </p>
    </section>
  );
}
