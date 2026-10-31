"use client";
/** Tableau du classement joueurs (/players) — filtre par pseudo côté client
 *  (les lignes ≤ 500 sont servies sérialisées), colonnes façon wsva :
 *  rang, joueur, points, matchs, victoires, MVP, K/D, dernière partie.
 *  Le rang affiché est toujours celui du classement complet (pas celui du
 *  sous-ensemble filtré). */
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useBilingual } from "@/components/i18n";
import type { PlayerStatsRow } from "@/lib/replay-stats";

const fmt = new Intl.NumberFormat("en-US");

export function PlayersLadder({
  rows,
  hasOtherCategory = false,
}: {
  rows: PlayerStatsRow[];
  hasOtherCategory?: boolean;
}) {
  const l = useBilingual();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      needle
        ? rows.filter((r) => r.player_name.toLowerCase().includes(needle))
        : rows,
    [rows, needle],
  );

  return (
    <div className="ladder">
      <div className="search-input ladder-search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={l("搜索玩家…", "Search a player…")}
          aria-label={l("搜索玩家", "Search players")}
        />
      </div>
      <div className="ladder-scroll">
        <table className="ladder-table">
          <caption className="sr-only-caption">
            {l("玩家积分榜", "Players ladder")}
          </caption>
          <thead>
            <tr>
              <th scope="col">{l("排名", "Rank")}</th>
              <th scope="col">{l("玩家", "Player")}</th>
              <th scope="col" className="num">
                {l("积分", "Points")}
              </th>
              <th scope="col" className="num">
                {l("场次", "Games")}
              </th>
              <th scope="col" className="num">
                {l("胜", "W")}
              </th>
              <th scope="col" className="num">
                {l("MVP", "MVP")}
              </th>
              <th scope="col" className="num">
                {l("K/D", "K/D")}
              </th>
              <th scope="col">{l("最近一局", "Last game")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const rank = rows.indexOf(row) + 1;
              return (
                <tr key={row.season + row.category + row.player_name} className={rank <= 3 ? `top top-${rank}` : undefined}>
                  <td className="rank">
                    {rank <= 3 ? (
                      <span className="rank-badge" aria-label={`#${rank}`}>
                        {rank}
                      </span>
                    ) : (
                      <span className="rank-plain">{rank}</span>
                    )}
                  </td>
                  <td className="player">{row.player_name}</td>
                  <td className="num points">{fmt.format(row.points)}</td>
                  <td className="num">{fmt.format(row.games)}</td>
                  <td className="num">{fmt.format(row.wins)}</td>
                  <td className="num">{fmt.format(row.mvps)}</td>
                  <td className="num">
                    {row.losses > 0 ? (row.kills / row.losses).toFixed(2) : "—"}
                  </td>
                  <td className="last">{row.last_played.slice(0, 10)}</td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="ladder-empty">
                  {l("没有匹配的玩家。", "No player matches this search.")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {hasOtherCategory ? (
        <p className="caption ladder-note">
          {l(
            "单排/双排与大部队分开计算：切换上方标签查看。",
            "Solo/duo and big team are ranked separately — switch tabs above.",
          )}
        </p>
      ) : null}
    </div>
  );
}
