"use client";
/** Tableau « Qui a compté par phase » — remplace les trois graphiques
 *  empilés par joueur (mission « je veux des DONNÉES, pas de graphique »,
 *  05/11) : UNE ligne par joueur, les DEUX équipes fusionnées dans un seul
 *  tableau dense façon ws-stats. Chaque phase est mesurée seule (elle
 *  « repart de zéro », même modèle que l'ancien stageShares) :
 *  la valeur = part de l'impact de l'équipe réalisée par le joueur PENDANT
 *  la phase (Σ des joueurs d'une équipe = 100 % par colonne).
 *  Données : PlayerImpact.phaseWeights / share (lib/replay/analysis.ts),
 *  aucune série temporelle n'est chargée ici. */
import { useMemo } from "react";
import Link from "@/components/site-link";
import { useBilingual } from "@/components/i18n";
import type { ReplayAnalysis, TeamImpact } from "@/lib/replay/analysis";
import { formatClock } from "@/lib/replay/wsva-view";

export function PhaseImpactTable({
  teams,
  stages,
  durationMs,
}: {
  teams: TeamImpact[];
  stages: NonNullable<ReplayAnalysis["stages"]>;
  durationMs: number;
}) {
  const l = useBilingual();
  // Lignes fusionnées, triées par impact (score MVP décroissant) — la
  // pastille d'équipe garde l'appartenance lisible sans séparer les tableaux.
  const rows = useMemo(
    () =>
      teams
        .flatMap((team) =>
          team.players.map((p) => ({
            side: team.side,
            name: p.player.nickname,
            early: p.phaseWeights.early,
            mid: p.phaseWeights.mid,
            late: p.phaseWeights.late,
            total: p.share,
            mvp: p.player.mvpScore ?? 0,
          })),
        )
        .sort((a, b) => b.mvp - a.mvp),
    [teams],
  );
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const teamClass = (side: number) => (side === 0 ? "rp-team-blue" : "rp-team-red");
  return (
    <div className="table-scroll rp-table-wrap">
      <table className="rp-data-table phase-impact-table">
        <caption className="visually-hidden">
          {l(
            "各玩家在前期、中期、后期占本队影响力的份额，按总影响力排序。",
            "Each player's share of their team's impact in the early, mid and late game, sorted by total impact.",
          )}
        </caption>
        <thead>
          <tr>
            <th scope="col" className="cell-player-head">
              {l("玩家", "Player")}
            </th>
            <th scope="col" className="cell-number">
              {l("前期", "Early")}
            </th>
            <th scope="col" className="cell-number">
              {l("中期", "Mid")}
            </th>
            <th scope="col" className="cell-number">
              {l("后期", "Late")}
            </th>
            <th scope="col" className="cell-number">
              {l("总影响力", "Total impact")}
            </th>
            <th scope="col" className="cell-number">
              {l("MVP 分", "MVP score")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.side}-${r.name}`}>
              <td className="cell-player">
                <span className="value-pairs">
                  <span className={`rp-team-dot ${teamClass(r.side)}`} aria-hidden="true" />
                  <Link className="name-link name-text" href={`/player/${encodeURIComponent(r.name)}`} title={r.name}>
                    {r.name}
                  </Link>
                </span>
              </td>
              <td className="cell-number cell-mono">{pct(r.early)}</td>
              <td className="cell-number cell-mono">{pct(r.mid)}</td>
              <td className="cell-number cell-mono">{pct(r.late)}</td>
              <td className="cell-number cell-mono cell-strong">{pct(r.total)}</td>
              <td className="cell-number cell-mono">{Math.round(r.mvp)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6} className="rp-table-foot">
              {l(
                "前期 ${a} · 中期 ${b} · 后期 ${c} — 每个阶段从零开始计算",
                "Early ${a} · Mid ${b} · Late ${c} — each stage restarts from zero",
              )
                .replace("${a}", `0:00–${formatClock(stages.earlyEndMs)}`)
                .replace("${b}", `${formatClock(stages.earlyEndMs)}–${formatClock(stages.midEndMs)}`)
                .replace("${c}", `${formatClock(stages.midEndMs)}–${formatClock(durationMs)}`)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
