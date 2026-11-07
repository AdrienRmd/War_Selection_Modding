"use client";
/** « Statistiques complètes par joueur » — tableau dense façon ws-stats,
 *  une ligne par joueur (les deux équipes), colonnes TRIABLES (clic
 *  d'en-tête, aria-sort). Mission 05/11 : l'utilisateur veut des DONNÉES
 *  lisibles, pas des courbes.
 *  Sources (tout vient du parser, aucune approximation nouvelle) :
 *  - MVP/MMM/survie/unités créées-tuées-perdues/K-D/ressources :
 *    PlayerImpact (lib/replay/analysis.ts, dénombrements bruts) ;
 *  - « Armée max » : PIC de la série courante « unit create points » —
 *    c'est une VALEUR en points (le décompte d'unités vivantes par tranche
 *    n'existe pas dans la timeline du replay) : colonne nommée
 *    honnêtement « Armée max (pts) » ;
 *  - « Âge max » : dernière transition d'âge + instant (icône du jeu).
 *  Tri : buildStatsRows/sortStatsRows, fonctions pures exportées du
 *  composant (pas de suite de tests dédiée à ce jour). */
import { useMemo, useState } from "react";
import Link from "@/components/site-link";
import { useBilingual, useI18n } from "@/components/i18n";
import type { TeamImpact } from "@/lib/replay/analysis";
import { formatClock, researchIconUrl } from "@/lib/replay/wsva-view";

export type StatsSortKey =
  | "mvp"
  | "mmr"
  | "survival"
  | "created"
  | "killed"
  | "lost"
  | "kd"
  | "army"
  | "food"
  | "wood"
  | "iron"
  | "age";

export interface StatsRow {
  side: number;
  name: string;
  mvp: number;
  mmr?: number;
  survivalMs?: number;
  dead: boolean;
  created: number;
  killed: number;
  lost: number;
  kd?: number;
  armyMax: number;
  food: number;
  wood: number;
  iron: number;
  lastAge?: number;
  lastAgeTimeMs?: number;
  lastAgeResearch?: number;
}

/** Lignes du tableau, équipes fusionnées — ordre initial : MVP décroissant. */
export function buildStatsRows(teams: TeamImpact[]): StatsRow[] {
  return teams
    .flatMap((team) =>
      team.players.map((p) => ({
        side: team.side,
        name: p.player.nickname,
        mvp: p.player.mvpScore ?? 0,
        mmr: p.player.rating,
        survivalMs: p.player.survivalTime,
        dead: p.player.isDead === true,
        created: p.created,
        killed: p.killed,
        lost: p.lost,
        kd: p.kd,
        armyMax: p.armyMax,
        food: p.resFood,
        wood: p.resWood,
        iron: p.resIron,
        lastAge: p.lastAge,
        lastAgeTimeMs: p.lastAgeTimeMs,
        lastAgeResearch: p.player.lastAgeResearch,
      })),
    )
    .sort((a, b) => b.mvp - a.mvp);
}

/** Valeur numérique de tri d'une ligne (undefined → -Infinity : en dernier). */
export function statsRowValue(row: StatsRow, key: StatsSortKey): number {
  switch (key) {
    case "mvp":
      return row.mvp;
    case "mmr":
      return row.mmr ?? Number.NEGATIVE_INFINITY;
    case "survival":
      return row.survivalMs ?? Number.NEGATIVE_INFINITY;
    case "created":
      return row.created;
    case "killed":
      return row.killed;
    case "lost":
      return row.lost;
    case "kd":
      return row.kd ?? Number.NEGATIVE_INFINITY;
    case "army":
      return row.armyMax;
    case "food":
      return row.food;
    case "wood":
      return row.wood;
    case "iron":
      return row.iron;
    case "age":
      return row.lastAge ?? Number.NEGATIVE_INFINITY;
  }
}

/** Tri stable (copie) — jamais de mutation des lignes mémoïsées. */
export function sortStatsRows(
  rows: StatsRow[],
  key: StatsSortKey,
  dir: "asc" | "desc",
): StatsRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = statsRowValue(a, key);
    const vb = statsRowValue(b, key);
    if (va !== vb) return sign * (va - vb);
    return sign * (a.mvp - b.mvp); // départage : impact
  });
}

export function PlayerStatsTable({ teams }: { teams: TeamImpact[] }) {
  const l = useBilingual();
  const { locale } = useI18n();
  const [sort, setSort] = useState<{ key: StatsSortKey; dir: "asc" | "desc" }>({
    key: "mvp",
    dir: "desc",
  });
  const rows = useMemo(() => buildStatsRows(teams), [teams]);
  const sorted = useMemo(() => sortStatsRows(rows, sort.key, sort.dir), [rows, sort]);
  const fmt = useMemo(() => compactNumberCurry(locale), [locale]);

  const headers: Array<{ key: StatsSortKey; label: string }> = [
    { key: "mvp", label: l("MVP 分", "MVP score") },
    { key: "mmr", label: l("MMR", "MMR") },
    { key: "survival", label: l("存活 / 被淘汰", "Survival / eliminated") },
    { key: "created", label: l("生产单位", "Units created") },
    { key: "killed", label: l("歼灭单位", "Units killed") },
    { key: "lost", label: l("损失单位", "Units lost") },
    { key: "kd", label: l("K/D", "K/D") },
    { key: "army", label: l("最大军队（点）", "Max army (pts)") },
    { key: "food", label: l("食物", "Food") },
    { key: "wood", label: l("木材", "Wood") },
    { key: "iron", label: l("铁矿", "Iron") },
    { key: "age", label: l("最高时代", "Max age") },
  ];

  const onSort = (key: StatsSortKey) =>
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" },
    );

  return (
    <div className="table-scroll rp-table-wrap">
      <table className="rp-data-table player-stats-table" aria-label={l("玩家完整统计", "Full player statistics")}>
        <caption className="visually-hidden">
          {l(
            "全体玩家的完整统计，点击列标题排序。",
            "Full statistics for every player; click a column header to sort.",
          )}
        </caption>
        <thead>
          <tr>
            <th scope="col" className="cell-player-head">
              {l("玩家", "Player")}
            </th>
            {headers.map((h) => {
              const active = sort.key === h.key;
              return (
                <th
                  key={h.key}
                  scope="col"
                  aria-sort={active ? (sort.dir === "desc" ? "descending" : "ascending") : "none"}
                  className="cell-number"
                >
                  <button type="button" className="rp-sort-head" onClick={() => onSort(h.key)}>
                    {h.label}
                    <span className={`rp-sort-arrow${active ? " rp-sort-arrow-on" : ""}`} aria-hidden="true">
                      {active && sort.dir === "asc" ? "↑" : "↓"}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const ageIcon = r.lastAgeResearch !== undefined ? researchIconUrl(r.lastAgeResearch) : "";
            return (
              <tr key={`${r.side}-${r.name}`}>
                <td className="cell-player">
                  <span className="value-pairs">
                    <span
                      className={`rp-team-dot ${r.side === 0 ? "rp-team-blue" : "rp-team-red"}`}
                      aria-hidden="true"
                    />
                    <Link
                      className="name-link name-text"
                      href={`/player/${encodeURIComponent(r.name)}`}
                      title={r.name}
                    >
                      {r.name}
                    </Link>
                  </span>
                </td>
                <td className="cell-number cell-mono cell-strong">{Math.round(r.mvp)}</td>
                <td className="cell-number cell-mono">{r.mmr ?? "–"}</td>
                <td className="cell-number cell-mono">
                  {r.survivalMs === undefined ? (
                    "–"
                  ) : r.dead ? (
                    <span title={l("于 ${time} 被淘汰", "Eliminated at ${time}").replace("${time}", formatClock(r.survivalMs))}>
                      ✞ {formatClock(r.survivalMs)}
                    </span>
                  ) : (
                    <span title={l("存活到对局结束", "Survived to the end of the game")}>
                      {formatClock(r.survivalMs)}
                    </span>
                  )}
                </td>
                <td className="cell-number cell-mono">{r.created}</td>
                <td className="cell-number cell-mono">{r.killed}</td>
                <td className="cell-number cell-mono">{r.lost}</td>
                <td className="cell-number cell-mono">{r.kd === undefined ? "–" : kdText(r.kd)}</td>
                <td className="cell-number cell-mono">{r.armyMax > 0 ? fmt(r.armyMax) : "–"}</td>
                <td className="cell-number cell-mono">{fmt(r.food)}</td>
                <td className="cell-number cell-mono">{fmt(r.wood)}</td>
                <td className="cell-number cell-mono">{fmt(r.iron)}</td>
                <td className="cell-number cell-nowrap">
                  <span className="value-pairs">
                    {ageIcon ? (
                      <img className="icon icon-sm" src={ageIcon} alt="" aria-hidden="true" loading="lazy" />
                    ) : null}
                    <span className="cell-mono">
                      {r.lastAgeTimeMs !== undefined && (r.lastAge ?? 0) > 0 ? formatClock(r.lastAgeTimeMs) : "–"}
                    </span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function kdText(kd: number): string {
  return kd >= 10 ? kd.toFixed(0) : kd.toFixed(2);
}

function compactNumberCurry(locale: string): (v: number) => string {
  const fmt = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  return (v: number) => fmt.format(Math.max(0, Math.round(v)));
}
