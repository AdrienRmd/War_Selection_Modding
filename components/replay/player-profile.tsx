"use client";
/** Profil joueur « façon wsva » (V3 01/11/2026) — reproduction du design et
 *  de la structure du profil de référence (capture profile-dom.html du
 *  01/11) : pennant (rang toutes périodes, pseudo, MMR, tuiles Points /
 *  Impact médian / Win rate + W/L « Based on N games »), historique de
 *  saisons, onglets de période (chips), courbe cumulée de points avec dates
 *  (points cliquables → /replay?code=), Médailles (icônes + compte), parties
 *  récentes (badge Win/Loss, impact %, nation, médailles, View replay),
 *  Details (faits saillants, nations/pays préférés avec barres), Fastest
 *  times (Timing/Record/Replay), Favourite units per age (icônes du dataset
 *  jeu + « N games »). État vide gracieux pour un joueur inconnu. */
import { useEffect, useMemo, useState } from "react";
import Link from "@/components/site-link";
import { useBilingual, useI18n } from "@/components/i18n";
import { useElementWidth } from "./replay-charts";
import type { PlayerProfile, PeriodView } from "@/lib/player-profile";
import { MEDAL_META, type MedalKey } from "@/lib/replay/medals";
import {
  UNIT_AGE_BUCKETS,
  formatClock,
  researchDisplayName,
  unitAgeBucketIcon,
  unitDisplayName,
  unitIconUrl,
} from "@/lib/replay/wsva-view";
import { compactNumber } from "@/lib/replay/wsva-view";

export function PlayerProfileView({ profile }: { profile: PlayerProfile }) {
  const { locale } = useI18n();
  const l = useBilingual();
  const [activeKey, setActiveKey] = useState(profile.views[0]?.key ?? "all");
  // Relatif de date côté client : Date.now() est impur au rendu, on le pose
  // en macrotâche au montage (même motif que components/update-banner.tsx).
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setNowMs(Date.now()), 0);
    return () => clearTimeout(t);
  }, []);
  const view: PeriodView | undefined =
    profile.views.find((v) => v.key === activeKey) ?? profile.views[0];
  // Formateurs mémoïsés (pureté du rendu : react-hooks/purity).
  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : locale, {
        day: "numeric",
        month: "short",
      }),
    [locale],
  );
  const relFmt = useMemo(
    () =>
      new Intl.RelativeTimeFormat(locale === "zh" ? "zh-CN" : locale, {
        numeric: "auto",
      }),
    [locale],
  );

  if (!profile.found || !view) {
    return (
      <div className="rp page-backdrop">
        <main className="page page-narrow">
          <section className="panel profile-panel">
            <h1 className="heading-2">{profile.name}</h1>
            <p className="label-text">
              {l(
                "这位玩家还没有公开的回放：提交并公开他的对局后，档案会自动生成。",
                "This player has no published replay yet — submit and publish one of their games and the profile will build itself.",
              )}
            </p>
            <Link className="button-text" href="/replay">
              {l("去提交一个回放", "Submit a replay")}
            </Link>
          </section>
        </main>
      </div>
    );
  }

  const daysAgo = (iso: string) => {
    if (nowMs === null) return "";
    const days = Math.round((nowMs - new Date(iso).getTime()) / 86_400_000);
    return relFmt.format(-days, "day");
  };

  const periodChip = (key: string) =>
    key === "current"
      ? l("本赛季", "This season")
      : key === "all"
        ? l("全部时期", "All-time")
        : `${l("赛季", "Season")} ${key}`;


  return (
    <div className="rp page-backdrop">
      <main className="page">
        <div className="profile-layout">
          <aside className="profile-side">
            <div className="tab-panel">
              <header className="pennant">
                <div className="pennant-inner">
                  <span className="pennant-crest">
                    {profile.rankAllTime !== null ? `#${profile.rankAllTime}` : "—"}
                  </span>
                  <span className="label-text pennant-season">{l("全部时期", "All-time")}</span>
                  <h1 className="pennant-name">{profile.name}</h1>
                  <p className="label-text pennant-mmr">
                    {l("MMR", "MMR")} <strong>{view.mmr ?? "–"}</strong>
                  </p>
                  <div className="profile-stats">
                    <div className="tile-inset profile-stat">
                      <span className="profile-stat-value">{compactNumber(view.points, locale)}</span>
                      <span className="label-text">{l("积分", "Points")}</span>
                    </div>
                    <div className="tile-inset profile-stat">
                      <span className="profile-stat-value">
                        {view.medianImpactPct !== null ? `${view.medianImpactPct}%` : "–"}
                      </span>
                      <span className="label-text">{l("中位影响力", "Median impact")}</span>
                    </div>
                    <div className="tile-inset profile-stat">
                      <span className="profile-stat-value">{view.winRatePct}%</span>
                      <span className="label-text">{l("胜率", "Win rate")}</span>
                      <span className="label-text pennant-record">
                        {view.wins} {l("胜", "W")} {view.losses} {l("负", "L")}
                      </span>
                    </div>
                  </div>
                  <span className="label-text">
                    {l("基于 ${n} 场对局", "Based on ${n} games").replace("${n}", String(view.games))}
                  </span>
                </div>
              </header>
              <section className="panel profile-panel">
                <h2 className="heading-3">{l("赛季历史", "Season history")}</h2>
                <ul className="season-history">
                  {profile.seasons.map((season) => {
                    const sv = profile.views.find((v) => v.key === season);
                    return (
                      <li
                        key={season}
                        className={`season-history-row${(sv?.games ?? 0) === 0 ? " season-history-row-empty" : ""}`}
                      >
                        <span className="season-history-name">
                          {l("赛季", "Season")} {season}
                        </span>
                        <span className="season-history-points">{sv?.points ?? 0}</span>
                        <span className="label-text">
                          {(sv?.games ?? 0) === 0
                            ? l("0 场", "0 games")
                            : l("${n} 场", "${n} games").replace("${n}", String(sv?.games ?? 0))}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          </aside>

          <div className="profile-main">
            <div className="profile-toolbar">
              <div className="profile-toolbar-label">
                <span className="tag">{periodChip(activeKey)}</span>
                <span className="label-text">
                  {l("选择要查看的时期。", "Pick a period to see the profile for it.")}
                </span>
              </div>
              <div className="chip-group">
                {profile.views.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    className={`chip${activeKey === v.key ? " chip-active" : ""}`}
                    aria-pressed={activeKey === v.key}
                    onClick={() => setActiveKey(v.key)}
                  >
                    {periodChip(v.key)}
                  </button>
                ))}
              </div>
            </div>

            {/* Courbe cumulée de points. */}
            <section className="panel profile-panel points-panel">
              <div className="profile-panel-head">
                <h2 className="heading-3">{l("全部时期积分", "Points all-time")}</h2>
                <p className="label-text">
                  {l(
                    "积分是每场对局影响力份额的累计。",
                    "Points add up the impact share from every game.",
                  )}
                </p>
              </div>
              <div className="points-chart">
                <PointsChart view={view} dateFmt={dateFmt} />
              </div>
            </section>

            <div className="profile-pair">
              {/* Médailles. */}
              <section className="panel profile-panel medals-panel">
                <div className="profile-panel-head">
                  <h2 className="heading-3">{l("勋章", "Medals")}</h2>
                  <span className="label-text">
                    {l("${n} 枚 / ${g} 场", "${n} earned in ${g} games")
                      .replace("${n}", String(view.medals.reduce((a, m) => a + m.count, 0)))
                      .replace("${g}", String(view.games))}
                  </span>
                </div>
                {view.medals.length > 0 ? (
                  <ul className="medal-list">
                    {view.medals.map((m) => (
                      <li key={m.key} className="medal-row">
                        <img src={MEDAL_META[m.key]?.icon ?? ""} alt="" loading="lazy" />
                        <span className="medal-row-count">{m.count}×</span>
                        <span className="medal-row-name">{medalName(m.key, l)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="label-text">
                    {l("暂无勋章：旧回放的摘要不含勋章数据。", "No medals yet — older replays were submitted without medal data.")}
                  </p>
                )}
              </section>

              {/* Parties récentes. */}
              <section className="panel profile-panel">
                <div className="profile-panel-head">
                  <h2 className="heading-3">{l("最近对局", "Recent games")}</h2>
                  <p className="label-text">
                    {l("最近的对局与获得的勋章。", "The latest games with the medals earned in each.")}
                  </p>
                </div>
                <div className="recent-games">
                  {view.recentGames.map((g) => (
                    <div
                      key={g.code}
                      className={`recent-game ${g.won === 1 ? "recent-game-win" : "recent-game-loss"}`}
                    >
                      <span className="recent-result">
                        {g.won === 1 ? l("胜", "Win") : l("负", "Loss")}
                      </span>
                      <span className="recent-impact">{g.impactPct}%</span>
                      <span className="pick-label">{g.nationLabel || g.region || "–"}</span>
                      <span className="recent-medals">
                        {g.medals.map((k) => (
                          <img
                            key={k}
                            className="medal-image"
                            src={MEDAL_META[k as MedalKey]?.icon ?? ""}
                            alt={medalName(k as MedalKey, l)}
                            title={medalName(k as MedalKey, l)}
                            loading="lazy"
                          />
                        ))}
                      </span>
                      <span className="recent-date label-text">{daysAgo(g.at)}</span>
                      <Link
                        className="button-text recent-replay-link"
                        href={`/replay?code=${encodeURIComponent(g.code)}`}
                      >
                        {l("查看回放", "View replay")}
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Details / faits saillants. */}
            <section className="panel profile-panel">
              <h2 className="heading-2 insight-heading">{l("详情", "Details")}</h2>
              <div className="details-grid">
                <section className="tile-inset">
                  <h3 className="heading-3 insight-heading">
                    <img className="icon icon-sm" src="/icons/sparkles.png" alt="" aria-hidden="true" />
                    {l("亮点", "Highlights")}
                  </h3>
                  <div className="fact-list">
                    <div className="fact">
                      {l("全队最佳 ${n} 次", "Top performer of the team ${n} time(s)").replace(
                        "${n}",
                        String(view.topTeamCount),
                      )}
                    </div>
                    <div className="fact">
                      {l("最长连胜 ${n} 场", "Longest win streak ${n} win(s)").replace(
                        "${n}",
                        String(view.bestStreak),
                      )}
                    </div>
                  </div>
                </section>
                <section className="tile-inset">
                  <div className="choice-bars">
                    <h3 className="heading-3 insight-heading">{l("最常选择的文明", "Most chosen nation")}</h3>
                    <p className="label-text">
                      {l("青铜时代的选择。", "Picked most in the Bronze Age.")}
                    </p>
                    {view.bronzeNations.length > 0 ? (
                      view.bronzeNations.map((c) => (
                        <div key={c.id} className="choice-row">
                          <span className="pick-label">{c.label}</span>
                          <span className="bar-track">
                            <span
                              className="bar-fill"
                              style={{ width: `${Math.round((c.count / view.games) * 100)}%` }}
                            />
                          </span>
                          <span className="label-text">
                            {l("${c} / ${n}", "${c} of ${n}")
                              .replace("${c}", String(c.count))
                              .replace("${n}", String(view.games))}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="label-text">
                        {l("暂无数据（旧回放摘要）。", "No data yet (older replay digests).")}
                      </p>
                    )}
                  </div>
                </section>
                <section className="tile-inset">
                  <div className="choice-bars">
                    <h3 className="heading-3 insight-heading">{l("最常选择的国家", "Most chosen country")}</h3>
                    <p className="label-text">
                      {l("工业时代的选择。", "Picked most in the Industrial era.")}
                    </p>
                    {view.countries.length > 0 ? (
                      view.countries.map((c) => (
                        <div key={c.id} className="choice-row">
                          <span className="pick-label">{c.label}</span>
                          <span className="bar-track">
                            <span
                              className="bar-fill"
                              style={{ width: `${Math.round((c.count / view.games) * 100)}%` }}
                            />
                          </span>
                          <span className="label-text">
                            {l("${c} / ${n}", "${c} of ${n}")
                              .replace("${c}", String(c.count))
                              .replace("${n}", String(view.games))}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="label-text">
                        {l("尚未进入工业时代。", "No Industrial era reached yet.")}
                      </p>
                    )}
                  </div>
                </section>
                <section className="tile-inset details-span-2">
                  <h3 className="heading-3 insight-heading">
                    <img className="icon icon-sm" src="/icons/stopwatch.png" alt="" aria-hidden="true" />
                    {l("最快纪录", "Fastest times")}
                  </h3>
                  <p className="label-text">
                    {l("每个节点的个人纪录及其回放。", "Personal best per timing, with the replay it was set in.")}
                  </p>
                  {view.fastest.length > 0 ? (
                    <table className="data-table rush-table">
                      <thead>
                        <tr>
                          <th>{l("节点", "Timing")}</th>
                          <th>{l("纪录", "Record")}</th>
                          <th>{l("回放", "Replay")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {view.fastest.map((f) => (
                          <tr key={f.researchId}>
                            <td>{researchDisplayName(f.researchId, locale)}</td>
                            <td>{formatClock(f.ms)}</td>
                            <td>
                              <Link
                                className="button-text"
                                href={`/replay?code=${encodeURIComponent(f.code)}`}
                              >
                                {l("查看回放", "View replay")}
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="label-text">
                      {l("暂无升时代纪录。", "No age-up record yet.")}
                    </p>
                  )}
                </section>
                <section className="tile-inset details-span-3">
                  <h3 className="heading-3 insight-heading">
                    <img className="icon icon-sm" src="/icons/swords.png" alt="" aria-hidden="true" />
                    {l("各时代最爱单位", "Favourite units per age")}
                  </h3>
                  <p className="label-text">
                    {l(
                      "该玩家有多少场对局把这个单位列入该时代产量前三。",
                      "How many of this player's games had this unit among their three most produced of the age.",
                    )}
                  </p>
                  <div className="age-units-grid">
                    {UNIT_AGE_BUCKETS.map(({ key }) => {
                      const entry = view.favouriteUnits.find((f) => f.bucket === key);
                      return (
                        <div key={key} className="age-units">
                          <h4 className="heading-3">
                            <img
                              className="icon icon-sm"
                              src={unitAgeBucketIcon(key)}
                              alt=""
                              loading="lazy"
                            />
                            {ageBucketName(key, l)}
                          </h4>
                          {entry && entry.units.length > 0 ? (
                            <ul className="unit-value-list">
                              {entry.units.map((u) => (
                                <li key={u.gameId}>
                                  <img
                                    src={unitIconUrl(u.gameId)}
                                    alt={unitDisplayName(u.gameId, locale)}
                                    title={unitDisplayName(u.gameId, locale)}
                                    loading="lazy"
                                  />
                                  <span>{unitDisplayName(u.gameId, locale)}</span>
                                  <span className="label-text">
                                    {l("${n} 场", "${n} games").replace("${n}", String(u.games))}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="label-text">{l("暂无数据。", "No data yet.")}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Courbe de points (SVG, points cliquables → /replay?code=)           */
/* ------------------------------------------------------------------ */

function PointsChart({
  view,
  dateFmt,
}: {
  view: PeriodView;
  dateFmt: Intl.DateTimeFormat;
}) {
  const l = useBilingual();
  const steps = view.pointsCurve;
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();  if (steps.length === 0) return null;
  /* Rendu 1:1 (viewBox = largeur mesurée) : textes à taille réelle,
   * mode compact ≤ 520 px (2 graduations, marges réduites) — 375 px
   * sans collision ni défilement. */
  const W = Math.max(320, Math.round(width || 720));
  const compact = W < 520;
  const H = compact ? 205 : 250;
  const padL = compact ? 44 : 52;
  const padR = 14;
  const padT = 16;
  const padB = 30;
  const rawMax = Math.max(...steps.map((s) => s.cumulative), 10);
  /* Axe Y en valeurs RONDES (pas naturel 1/2/5 × 10^k). */
  const pow = 10 ** Math.floor(Math.log10(rawMax || 1));
  const nice = [1, 2, 5, 10].map((k) => k * pow).find((v) => v >= rawMax) ?? 10 * pow;
  const yTicks = compact ? [0, nice] : [0, nice / 2, nice];
  const maxY = nice;
  const x = (i: number) =>
    steps.length === 1 ? padL : padL + (i / (steps.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v / maxY) * (H - padT - padB);
  const pts = steps.map((s, i) => `${x(i)},${y(s.cumulative)}`).join(" ");
  /* Échantillonnage des dates : ~5 (2 en compact), première et dernière
   * toujours présentes, pas de collision. */
  const every = Math.max(1, Math.ceil(steps.length / (compact ? 2 : 5)));
  const dateTicks = steps.filter((_, i) => i % every === 0 || i === steps.length - 1);
  return (
    <div className="points-chart" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={l("\u79ef\u5206\u66f2\u7ebf", "Points curve")}
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        <defs>
          <linearGradient id="rp-points-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffd166" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ffd166" stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((v, i) => (
          <g key={v}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(v)}
              y2={y(v)}
              className={i === 0 ? "graph-axis" : "graph-grid"}
            />
            <text x={padL - 8} y={y(v) + 4} textAnchor="end" className="graph-label">
              {v}
            </text>
          </g>
        ))}
        {dateTicks.map((s) => (
          <text
            key={s.code}
            x={x(steps.indexOf(s))}
            y={H - 10}
            textAnchor={
              s === dateTicks[0] ? "start" : s === dateTicks[dateTicks.length - 1] ? "end" : "middle"
            }
            className="graph-label"
          >
            {dateFmt.format(new Date(s.at))}
          </text>
        ))}
        <polygon
          points={`${x(0)},${y(0)} ${pts} ${x(steps.length - 1)},${y(0)}`}
          fill="url(#rp-points-fade)"
        />
        <polyline points={pts} className="graph-line" />
        {steps.map((s, i) => (
          <a
            key={s.code}
            href={`/replay?code=${encodeURIComponent(s.code)}`}
            aria-label={l("${d}\uff1a\u7b2c ${n} \u573a\u540e ${p} \u5206\u3002\u6253\u5f00\u56de\u653e\u3002", "${d}: ${p} points after game ${n}. Open the replay.")
              .replace("${d}", dateFmt.format(new Date(s.at)))
              .replace("${n}", String(i + 1))
              .replace("${p}", String(s.cumulative))}
          >
            <circle cx={x(i)} cy={y(s.cumulative)} r={4} className="graph-dot">
              <title>{`${dateFmt.format(new Date(s.at))} — ${s.cumulative}`}</title>
            </circle>
          </a>
        ))}
      </svg>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/* Libellés                                                            */
/* ------------------------------------------------------------------ */

function ageBucketName(key: string, l: ReturnType<typeof useBilingual>): string {
  switch (key) {
    case "stone":
      return l("石器时代", "Stone Age");
    case "bronze":
      return l("青铜时代", "Bronze Age");
    case "iron":
      return l("铁器时代", "Iron Age");
    case "industrial1":
      return l("工业时代 1", "Industrial 1");
    case "industrial2":
      return l("工业时代 2", "Industrial 2");
    default:
      return key;
  }
}

function medalName(key: MedalKey, l: ReturnType<typeof useBilingual>): string {
  switch (key) {
    case "champion":
      return l("战争冠军", "Champion of the War");
    case "first-blade":
      return l("第一把利刃", "The First Blade");
    case "first-to-fall":
      return l("最先倒下", "The First to Fall");
    case "master-of-coin":
      return l("钱币大师", "Master of Coin");
    case "in-total-control":
      return l("全面掌控", "In Total Control");
    case "cannon-fodder":
      return l("炮灰", "Cannon Fodder");
    case "deserter":
      return l("逃兵", "Deserter");
    case "ghost":
      return l("幽灵", "The Ghost");
    case "farmer":
      return l("农夫", "The Farmer");
    case "last-stand":
      return l("最后的坚守", "The Last Stand");
    default:
      return key;
  }
}
