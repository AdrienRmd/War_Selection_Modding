"use client";
/** Page résultat d'un replay — reproduction pixel-perfect du design wsva
 *  (warselection.vercel.app, capture du 01/11/2026) : structure de DOM,
 *  classes et icônes du design-system (app/wsva.css, scopé .rp), verdict,
 *  bandeau d'infos, événements décisifs, équilibre de puissance, tables
 *  d'équipe dépliables avec médailles et icônes de ressources, timeline à
 *  puces de métriques (Impact/Tués/Armée/…), phases early/mid/late.
 *  Icônes unités/recherches : dataset officiel du jeu (/wus-data/content/
 *  images) ; icônes d'interface : pack wsva (public/icons, cf.
 *  THIRD_PARTY_NOTICES.md). Médailles : lib/replay/medals.ts (calque
 *  documenté). Liens joueur → /player/<name>. */
import { useMemo, useState } from "react";
import Link from "@/components/site-link";
import { useBilingual, useI18n } from "@/components/i18n";
import type { PlayerImpact, ReplayAnalysis, Side, TeamImpact } from "@/lib/replay/analysis";
import { playerSeries } from "@/lib/replay/analysis";
import type { Player, ReplayParseResult } from "@/lib/replay/structure";
import {
  MEDAL_META,
  computeMedals,
  medalsOfPlayer,
  type MedalAward,
} from "@/lib/replay/medals";
import {
  TIMELINE_METRICS,
  formatClock,
  researchDisplayName,
  researchIconUrl,
} from "@/lib/replay/wsva-view";
import {
  PowerBalanceChart,
  StageShareChart,
  VersusChart,
  PLAYER_COLORS,
  TEAM_BLUE,
  TEAM_RED,
} from "./replay-charts";

const MODE_LABELS: Record<string, { zh: string; en: string }> = {
  replayMatchTypeFFA: { zh: "混战", en: "Free for all" },
  replayMatchTypeTeamMatch: { zh: "团队赛", en: "Team match" },
  replayMatchTypeArmageddon: { zh: "末日审判", en: "Armageddon" },
  replayMatchTypeSurvival: { zh: "生存", en: "Survival" },
  replayMatchTypeRank1: { zh: "排位 1v1", en: "Ranked 1v1" },
  replayMatchTypeRank2: { zh: "排位 2v2", en: "Ranked 2v2" },
  replayMatchTypeSandbox: { zh: "沙盒", en: "Sandbox" },
  replayMatchTypeTOW: { zh: "TOW", en: "TOW" },
  replayMatchTypeCustom: { zh: "自定义", en: "Custom" },
  replayMatchTypeMafia: { zh: "黑帮", en: "Mafia" },
  replayMatchTypeUndef: { zh: "未知模式", en: "Unknown mode" },
};

const RESOURCE_ICON = {
  food: "/wus-data/content/images/resource/0.png",
  wood: "/wus-data/content/images/resource/1.png",
  iron: "/wus-data/content/images/resource/2.png",
} as const;

export function ReplayResult({
  data,
  analysis,
  isLegacy,
}: {
  data: Extract<ReplayParseResult, { error: 0 }>;
  analysis: ReplayAnalysis;
  isLegacy: boolean;
}) {
  const { locale } = useI18n();
  const l = useBilingual();
  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [locale],
  );

  const [metric, setMetric] = useState("impact");
  const match = data.match;
  const modeLabel = MODE_LABELS[match.mode] ?? { zh: match.mode, en: match.mode };
  const teamLabel = (side: Side) => (side === 0 ? l("蓝队", "Blue") : l("红队", "Red"));
  const winner = analysis.verdict.winnerSide;
  const reason =
    analysis.verdict.reason === "wonder"
      ? l("通过奇观", "by wonder")
      : analysis.verdict.reason === "undecided"
        ? l("未分胜负", "not decided")
        : analysis.verdict.reason === "survivors"
          ? l("坚持到最后", "by holding out")
          : l("通过歼灭", "by elimination");
  const size = analysis.verdict.teamSize || match.playersCount;
  const verdict =
    winner === null
      ? l("对局未分胜负 · ${size}v${size} ${mode}", "Game not decided · ${size}v${size} ${mode}")
          .replace(/\$\{size\}/g, String(size))
          .replace("${mode}", l(modeLabel.zh, modeLabel.en))
      : l(
          "${team}获胜（${reason}）· ${size}v${size} ${mode}",
          "${team} wins ${reason} · ${size}v${size} ${mode}",
        )
          .replace("${team}", teamLabel(winner))
          .replace("${reason}", reason)
          .replace(/\$\{size\}/g, String(size))
          .replace("${mode}", l(modeLabel.zh, modeLabel.en));

  const medals = useMemo(() => computeMedals(data, analysis), [data, analysis]);

  const stageLabels: [string, string, string] = [
    l("前期", "Early"),
    l("中期", "Mid"),
    l("后期", "Late"),
  ];

  return (
    <div className="rp page-backdrop">
      <main className="page">
        {/* Field Archive V2 : verdict encadré (coins cornés + filigrane)
            et cachet « Archivé ✓ » façon tampon incliné. */}
        <header className="verdict-archive">
          <h1 className="heading-1">
            {winner !== null ? (
              <span className={winner === 0 ? "team-name-blue" : "team-name-red"}>
                {teamLabel(winner)}
              </span>
            ) : null}{" "}
            {winner !== null
              ? verdict.replace(teamLabel(winner), "").trim().replace(/[·]/, "").trim()
              : verdict}
          </h1>
          <span className="archive-cachet">{l("已归档 ✓", "Archived ✓")}</span>
        </header>

        {isLegacy ? (
          <p className="label-text">
            {l(
              "这份回放录制于旧版本，单位按旧编号匹配。",
              "This replay was recorded on an older version; units are matched through legacy ids.",
            )}
          </p>
        ) : null}

        {/* Bandeau d'informations du match. */}
        <section className="panel overview-panel" aria-label={l("对局信息", "Match facts")}>
          <div className="fact-row">
            <Fact icon="/icons/stopwatch.png" label={l("时长", "Duration")} value={formatClock(match.duration)} />
            <Fact
              icon="/icons/calendar.png"
              label={l("进行时间", "Played")}
              value={match.startTime ? dateFmt.format(new Date(match.startTime * 1000)) : "–"}
            />
            <Fact
              icon="/icons/map.png"
              label={l("区域", "Region")}
              value={match.region ? match.region.charAt(0).toUpperCase() + match.region.slice(1) : "–"}
            />
            <Fact
              icon="/icons/squad.png"
              label={l("大厅", "Lobby")}
              value={
                match.isMatchmaking
                  ? l("匹配对战", "Matchmaking")
                  : match.creator
                    ? match.creator
                    : l("自定义", "Custom")
              }
            />
            <Fact icon="/icons/report.png" label={l("游戏版本", "Game version")} value={match.gameVersion ?? "–"} />
            <Fact icon="/icons/flag.png" label={l("回放代码", "Replay code")} value={match.replayCode} />
          </div>

          <hr className="divider" />

          {/* Événements décisifs. */}
          <h2 className="heading-2 insight-heading">
            <img className="icon icon-md" src="/icons/fire.png" alt="" aria-hidden="true" />
            {l("决定性事件", "Decisive events")}
          </h2>
          <p className="label-text">
            {l(
              "对局面和一方胜率产生显著影响的事件。",
              "Events that had a significant impact on the game and on the win chance of a team.",
            )}
          </p>
          {analysis.events.length > 0 ? (
            <ol className="turning-list turning-list-scroll turning-list-fades">
              {analysis.events.map((event, i) => {
                const title =
                  event.kind === "elimination" && event.elimination
                    ? l(
                        "${team}只剩 ${n} 名玩家",
                        "${team} is down to ${n} players",
                      )
                        .replace("${team}", teamLabel(event.side))
                        .replace("${n}", String(event.elimination.downTo))
                    : event.kind === "swing" && event.swing
                      ? l(
                          "${team}扭转了局势：${minutes} 分钟内力量对比 ${from}% → ${to}%",
                          "${team} swings the balance: ${from}% → ${to}% power in ${minutes} minutes",
                        )
                          .replace("${team}", teamLabel(event.side))
                          .replace("${minutes}", String(event.swing.minutes))
                          .replace("${from}", String(Math.round(event.swing.fromPct * 100)))
                          .replace("${to}", String(Math.round(event.swing.toPct * 100)))
                      : event.kind === "workers" && event.workers
                        ? l(
                            "${team}在 ${minutes} 分钟内失去了 ${pct}% 的村民",
                            "${team} lost ${pct}% of its workers in ${minutes} minutes",
                          )
                            .replace("${team}", teamLabel(event.side))
                            .replace("${minutes}", String(event.workers.minutes))
                            .replace("${pct}", String(Math.round(event.workers.lostPct * 100)))
                        : l("本局第一座奇观", "First wonder of the game");
                const detail =
                  event.kind === "elimination" && event.elimination
                    ? event.elimination.leftGame
                      ? l("${victim} 离开了对局", "${victim} left the game").replace(
                          "${victim}",
                          event.elimination.victim,
                        )
                      : l("${victim} 被 ${killers} 淘汰", "${victim} eliminated by ${killers}")
                          .replace("${victim}", event.elimination.victim)
                          .replace("${killers}", event.elimination.killers.join(", "))
                    : event.kind === "swing" && event.swing
                      ? l(
                          "这 ${minutes} 分钟内歼灭敌方军队最多：${killers}。",
                          "Most army killed in those ${minutes} minutes: ${killers}.",
                        )
                          .replace("${minutes}", String(event.swing.minutes))
                          .replace(
                            "${killers}",
                            event.swing.topKillers.map((k) => `${k.name} +${k.value}`).join(", "),
                          )
                      : event.kind === "workers" && event.workers
                        ? l("击杀村民最多：${killers}。", "Most workers killed: ${killers}.").replace(
                            "${killers}",
                            event.workers.topKillers.map((k) => `${k.name} ${k.value}`).join(", "),
                          )
                        : event.wonder
                          ? l("由 ${builder} 建造", "Built by ${builder}").replace(
                              "${builder}",
                              event.wonder.builder,
                            )
                          : "";
                const winText = l(
                  "${team}胜率 ${before}% → ${after}%",
                  "${team} win chance ${before}% → ${after}%",
                )
                  .replace("${team}", teamLabel(event.side))
                  .replace("${before}", String(Math.round(event.winBefore * 100)))
                  .replace("${after}", String(Math.round(event.winAfter * 100)));
                const icon =
                  event.kind === "elimination"
                    ? "/icons/skull.png"
                    : event.kind === "wonder"
                      ? "/icons/trophy.png"
                      : "/icons/battle.png";
                return (
                  <li className="turning-point" key={i}>
                    <span className="turning-time">{formatClock(event.timeMs)}</span>
                    <img className="icon icon-sm" src={icon} alt="" aria-hidden="true" />
                    <span>{title}</span>
                    <span className="event-detail label-text turning-cause">
                      <span className="event-detail-parts">
                        {detail}
                        {detail ? ". " : ""}
                        {winText}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="label-text">
              {l("本局没有检测到决定性事件。", "No decisive events detected in this game.")}
            </p>
          )}

          {/* Équilibre de puissance. */}
          {analysis.power && analysis.winChanceBlue ? (
            <div>
              <header className="chart-heading">
                <h3 className="heading-3">{l("力量对比", "Power balance")}</h3>
                <p className="label-text">
                  {l(
                    "力量由三个均等的部分组成：军队、收入与领土。",
                    "Power is the average of three equal parts: army, income and territory.",
                  )}
                </p>
              </header>
              <p className="chart-key label-text">
                <span>{l("胜率", "Win chance")}</span>
                <span className="chart-key-swatch">
                  <span className="chart-key-dash chart-key-dash-blue" />
                  <span className="chart-key-dash chart-key-dash-red" />
                </span>
              </p>
              <div className="chart-frame">
                <PowerBalanceChart
                  power={analysis.power}
                  winChanceBlue={analysis.winChanceBlue}
                  durationMs={match.duration}
                  labels={{ blue: teamLabel(0), red: teamLabel(1) }}
                />
              </div>
            </div>
          ) : null}
        </section>

        {/* Tables par équipe. */}
        <div className="team-grid">
          {analysis.teams.map((team) => (
            <TeamPanel
              key={team.id}
              team={team}
              medals={medals}
              locale={locale}
              labels={{ team: teamLabel(team.side) }}
            />
          ))}
        </div>

        {/* Timeline à métriques + phases. */}
        {analysis.stages && analysis.power ? (
          <section className="panel">
            <header className="timeline-header">
              <div className="chip-group">
                {TIMELINE_METRICS.map((m) => (
                  <button
                    type="button"
                    key={m.key}
                    className={`chip chip-with-icon${metric === m.key ? " chip-active" : ""}`}
                    aria-pressed={metric === m.key}
                    onClick={() => setMetric(m.key)}
                  >
                    <img className="icon icon-sm" src={m.icon} alt="" aria-hidden="true" />
                    {metricLabel(m.key, l)}
                  </button>
                ))}
              </div>
            </header>
            <div className="tab-panel">
              <h3 className="heading-3 insight-heading timeline-description">
                <img className="icon icon-sm" src="/icons/crown.png" alt="" aria-hidden="true" />
                {l("前中后期谁起到了作用", "Who mattered in the early, mid and late game")}
              </h3>
              <p className="label-text timeline-reading-hint">
                {l(
                  "对局按全体玩家的中位数时间划分：到达中世纪（前期结束）与首次进入工业时代（中期结束），之后为后期。每条色带是一名玩家自本阶段开始以来占全队积分的份额。",
                  "The game is split in three stages by when the median player reached Middle Ages (end of Early) and the first Industrial age (end of Mid); Late is the rest. Each coloured band is the share of the team's points a player earned since the start of the stage.",
                )}
              </p>
              <div className="timeline-grid">
                {analysis.teams.map((team) => (
                  <TimelineTeam
                    key={team.id}
                    team={team}
                    data={data}
                    metric={metric}
                    stages={analysis.stages!}
                    stageLabels={stageLabels}
                    teamLabel={teamLabel(team.side)}
                  />
                ))}
                <section className="timeline-team timeline-versus">
                  <header className="timeline-team-header">
                    {teamLabel(0)} {l("对阵", "against")} {teamLabel(1)}
                  </header>
                  <div className="timeline-chart-row">
                    <VersusChart
                      blue={teamRate(analysis.teams[0]?.players ?? [])}
                      red={teamRate(analysis.teams[1]?.players ?? [])}
                      stages={analysis.stages}
                      periodMs={data.timeLinePeriod}
                      caption={l("两队积分占比", "Share of each team's points")}
                      stageLabels={stageLabels}
                      decidedLabel={l("对局已定", "Game decided")}
                    />
                  </div>
                </section>
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sous-composants                                                     */
/* ------------------------------------------------------------------ */

function metricLabel(key: string, l: ReturnType<typeof useBilingual>): string {
  switch (key) {
    case "impact":
      return l("影响力", "Impact");
    case "kills":
      return l("歼灭", "Kills");
    case "army":
      return l("军队", "Army");
    case "production":
      return l("生产", "Production");
    case "stockpile":
      return l("储备", "Stockpile");
    case "workers":
      return l("村民", "Workers");
    case "gatherEfficiency":
      return l("采集效率", "Gather efficiency");
    case "researches":
      return l("研究", "Researches");
    case "territory":
      return l("领土", "Territory");
    default:
      return key;
  }
}

function Fact({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="fact">
      <img className="icon icon-sm" src={icon} alt="" aria-hidden="true" />
      <div className="fact-text">
        <span className="label-text">{label}</span>
        <span className="fact-value">{value}</span>
      </div>
    </div>
  );
}

function TeamPanel({
  team,
  medals,
  locale,
  labels,
}: {
  team: TeamImpact;
  medals: MedalAward[];
  locale: string;
  labels: { team: string };
}) {
  const l = useBilingual();
  const [open, setOpen] = useState<Set<number>>(new Set());
  const eliminated = team.total - team.aliveCount;
  return (
    <article className="panel team-panel">
      <header className="team-panel-header">
        <h3 className={`team-name ${team.side === 0 ? "team-name-blue" : "team-name-red"}`}>
          {labels.team}
        </h3>
        <span className={`tag label-text ${team.isWinner ? "winner-badge highlight" : "defeated-badge"}`}>
          <img
            className="icon icon-sm"
            src={team.isWinner ? "/icons/trophy.png" : "/icons/skull.png"}
            alt=""
            aria-hidden="true"
          />
          {team.isWinner ? l("获胜方", "Victorious") : l("被击败", "Defeated")}
        </span>
        <span className="label-text team-panel-meta">
          {team.avgRating !== undefined
            ? l("平均 MMR ${mmr}", "Average MMR ${mmr}").replace("${mmr}", String(team.avgRating)) +
              " · "
            : ""}
          {l("${elim} / ${total} 被淘汰", "${elim} of ${total} eliminated")
            .replace("${elim}", String(eliminated))
            .replace("${total}", String(team.total))}
        </span>
      </header>
      <div className="table-scroll">
        <table className="team-table">
          <colgroup>
            <col className="col-chevron" />
            <col className="col-impact" />
            <col className="col-player" />
            <col className="col-age" />
            <col className="col-resources" />
            <col className="col-manpower" />
          </colgroup>
          <caption className="visually-hidden">
            {l(
              "${team}玩家，按影响力排序。展开一行查看详情，玩家名打开其档案。",
              "${team} players, sorted by impact. Expand a row for details, open a player name for their profile.",
            ).replace("${team}", labels.team)}
          </caption>
          <thead>
            <tr>
              <th>
                <span className="visually-hidden">{l("详情", "Details")}</span>
              </th>
              <th>
                {l("影响力", "Impact")}
                <span className="label-text">{l("占胜利的份额", "share of the win")}</span>
              </th>
              <th>{l("玩家", "Player")}</th>
              <th>{l("达到的最后时代", "Last age reached")}</th>
              <th>
                {l("资源", "Resources")}
                <span className="label-text">{l("采集 · 效率", "collected · efficiency")}</span>
              </th>
              <th>
                {l("人力", "Manpower")}
                <span className="label-text">{l("歼灭 / 生产 / 损失 / K/D", "killed / created / lost / K/D")}</span>
              </th>
            </tr>
          </thead>
          {team.players.map((pi) => (
            <TeamRow
              key={pi.player.id}
              impact={pi}
              medals={medalsOfPlayer(medals, pi.player.nickname)}
              locale={locale}
              expanded={open.has(pi.player.id)}
              onToggle={() =>
                setOpen((prev) => {
                  const next = new Set(prev);
                  if (next.has(pi.player.id)) next.delete(pi.player.id);
                  else next.add(pi.player.id);
                  return next;
                })
              }
            />
          ))}
        </table>
      </div>
    </article>
  );
}

function TeamRow({
  impact,
  medals,
  locale,
  expanded,
  onToggle,
}: {
  impact: PlayerImpact;
  medals: MedalAward[];
  locale: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const l = useBilingual();
  const p = impact.player;
  const fmt = useMemo(
    () => compactNumberCurry(locale),
    [locale],
  );
  const ageResearch = p.lastAgeResearch;
  const ageTitle =
    impact.lastAgeTimeMs !== undefined && ageResearch !== undefined
      ? `${researchDisplayName(ageResearch, localeOf(locale))} · ${formatClock(impact.lastAgeTimeMs)}`
      : impact.lastAge === 0
        ? l("石器时代，未升时代", "Stone Age, no age-up")
        : "–";
  const kd =
    impact.kd === undefined
      ? "–"
      : impact.kd >= 10
        ? impact.kd.toFixed(0)
        : impact.kd.toFixed(2);
  return (
    <tbody className={`team-table-row-toggle${expanded ? " team-table-row-open" : ""}`}>
      <tr className="team-table-main-row">
        <td className="cell-chevron">
          <button
            type="button"
            className="chevron-button"
            aria-expanded={expanded}
            aria-label={l("展开 ${name} 的详情", "Expand details of ${name}").replace(
              "${name}",
              p.nickname,
            )}
            onClick={onToggle}
          >
            <span className="chevron-box">
              <span className="expand-chevron" aria-hidden="true" />
            </span>
          </button>
        </td>
        <td className="cell-impact">
          <span className="two-line">
            <span className="two-line-main">
              <span className={`impact-value${impact.share >= 0.05 ? " highlight" : ""}`}>
                {Math.round(impact.share * 100)}%
              </span>
            </span>
            <span className="two-line-sub label-text">{l("影响力", "Impact")}</span>
          </span>
        </td>
        <td className="cell-player">
          <span className="player-cell">
            <span className="name-line">
              <Link className="name-link name-text" href={`/player/${encodeURIComponent(p.nickname)}`} title={p.nickname}>
                {p.nickname}
              </Link>
              {medals.length > 0 ? (
                <span className="name-line-medals">
                  <span className="player-medals">
                    {medals.map((m) => (
                      <img
                        key={m.key}
                        className="medal-image"
                        src={MEDAL_META[m.key].icon}
                        alt={medalName(m.key, l)}
                        title={medalName(m.key, l)}
                        loading="lazy"
                      />
                    ))}
                  </span>
                </span>
              ) : null}
            </span>
            <span className="player-meta label-text">
              <span className="mark">
                <img
                  className="icon icon-sm"
                  src={impact.role === "frontline" ? "/icons/swords.png" : "/icons/bow.png"}
                  alt={impact.role === "frontline" ? l("前排主力", "Frontline") : l("后排支援", "Backline")}
                  title={impact.role === "frontline" ? l("前排主力", "Frontline") : l("后排支援", "Backline")}
                />
                <span>
                  {impact.role === "frontline" ? l("前排主力", "Frontline") : l("后排支援", "Backline")}
                </span>
              </span>
              {typeof p.rating === "number" ? (
                <span>
                  <span title={l("匹配积分（游戏内技能评分）", "Matchmaking rating: the game's skill rating")}>
                    {l("MMR", "MMR")}
                  </span>{" "}
                  {p.rating}
                </span>
              ) : null}
              {impact.squad !== undefined ? (
                <span title={l("同队排行的 Peloton", "Squad: queued together")}>
                  {l("小队", "Squad")} {impact.squad}
                </span>
              ) : null}
            </span>
          </span>
        </td>
        <td className="cell-age">
          <span className="age-cell">
            {ageResearch !== undefined ? (
              <img
                className="age-image age-image-md"
                src={researchIconUrl(ageResearch) || undefined}
                alt={ageTitle}
                title={ageTitle}
                loading="lazy"
              />
            ) : (
              <span className="label-text">{l("石器时代，未升时代", "Stone Age, no age-up")}</span>
            )}
          </span>
        </td>
        <td className="cell-number cell-nowrap">
          <span className="two-line">
            <span className="two-line-main">
              <span className="value-pairs">
                <span title={l("采集的资源：${n}", "Resources collected: ${n}").replace("${n}", String(impact.resTotal))}>
                  <img className="icon icon-sm" src="/icons/coins.png" alt="" aria-hidden="true" />
                  {fmt(impact.resTotal)}
                </span>
                {impact.efficiencyPct !== undefined ? (
                  <span className="icon-value label-text icon-value-small">
                    <img className="icon icon-sm" src="/icons/worker.png" alt="" aria-hidden="true" />
                    <span className="hint-term-value">{Math.round(impact.efficiencyPct)}%</span>
                  </span>
                ) : null}
              </span>
            </span>
            <span className="two-line-sub label-text">
              <span className="value-pairs">
                <span title={l("采集食物：${n}", "Food collected: ${n}").replace("${n}", String(impact.resFood))}>
                  <img className="icon icon-sm" src={RESOURCE_ICON.food} alt="" aria-hidden="true" />
                  {fmt(impact.resFood)}
                </span>
                <span title={l("采集木材：${n}", "Wood collected: ${n}").replace("${n}", String(impact.resWood))}>
                  <img className="icon icon-sm" src={RESOURCE_ICON.wood} alt="" aria-hidden="true" />
                  {fmt(impact.resWood)}
                </span>
                <span title={l("采集铁矿：${n}", "Iron collected: ${n}").replace("${n}", String(impact.resIron))}>
                  <img className="icon icon-sm" src={RESOURCE_ICON.iron} alt="" aria-hidden="true" />
                  {fmt(impact.resIron)}
                </span>
              </span>
            </span>
          </span>
        </td>
        <td className="cell-number cell-nowrap">
          <span className="two-line">
            <span className="two-line-main">
              <span title={l("歼灭人力：${n}", "Manpower killed: ${n}").replace("${n}", String(impact.killed))}>
                <img className="icon icon-sm" src="/icons/swords.png" alt="" aria-hidden="true" />
                {impact.killed}
              </span>
            </span>
            <span className="two-line-sub label-text">
              <span className="value-pairs">
                <span title={l("生产人力：${n}", "Manpower created: ${n}").replace("${n}", String(impact.created))}>
                  +{impact.created}
                </span>
                <span title={l("损失人力：${n}", "Manpower lost: ${n}").replace("${n}", String(impact.lost))}>
                  −{impact.lost}
                </span>
                <span title={l("K/D（歼灭人力 ÷ 损失人力）", "K/D (manpower killed ÷ manpower lost)")}>
                  {l("K/D", "K/D")} {kd}
                </span>
              </span>
            </span>
          </span>
        </td>
      </tr>
      {expanded ? (
        <tr className="player-detail-row">
          <td colSpan={6}>
            <div className="player-detail">
              {medals.length > 0 ? (
                <div className="tile-inset">
                  {medals.map((m) => (
                    <span key={m.key} className={`medal-card medal-${MEDAL_META[m.key].tier}`}>
                      <img className="medal-card-image" src={MEDAL_META[m.key].icon} alt="" aria-hidden="true" />
                      <span className="medal-text">
                        <span className="medal-name">{medalName(m.key, l)}</span>
                        <span className="medal-reason">{medalReason(m, l)}</span>
                      </span>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="tile-inset">
                <span className="label-text">{ageTitle}</span>
                {impact.lastAgeTimeMs !== undefined && p.survivalTime !== undefined && p.isDead ? (
                  <span className="label-text">
                    {l("于 ${time} 被淘汰", "Eliminated at ${time}").replace(
                      "${time}",
                      formatClock(impact.lastAgeTimeMs),
                    )}
                  </span>
                ) : null}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </tbody>
  );
}

function TimelineTeam({
  team,
  data,
  metric,
  stages,
  stageLabels,
  teamLabel,
}: {
  team: TeamImpact;
  data: Extract<ReplayParseResult, { error: 0 }>;
  metric: string;
  stages: NonNullable<ReplayAnalysis["stages"]>;
  stageLabels: [string, string, string];
  teamLabel: string;
}) {
  const l = useBilingual();
  const series = useMemo(() => {
    const meta = TIMELINE_METRICS.find((m) => m.key === metric)!;
    return team.players.map((p, i) => ({
      name: p.player.nickname,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      rate: meta.impact
        ? p.impactRate
        : (playerSeries(data, meta.dataset!, p.player) ?? []).map((v) => Math.max(0, v)),
    }));
  }, [team, data, metric]);
  return (
    <section className="timeline-team stage-running">
      <header className="timeline-team-header">{teamLabel}</header>
      <p className="label-text stage-running-caption">
        {l("自各阶段开始以来占全队积分的份额", "Share of the team's points since the start of each stage")}
      </p>
      <div className="timeline-chart-row">
        <StageShareChart
          players={series}
          stages={stages}
          periodMs={data.timeLinePeriod}
          caption={l("自各阶段开始以来占全队积分的份额", "Share of the team's points since the start of each stage")}
          stageLabels={stageLabels}
          decidedLabel={l("对局已定", "Game decided")}
          decidedCaption={l("灰色区域不计入积分", "Grey zone scores no points")}
        />
      </div>
      <p className="label-text stage-weights">
        {l(
          "前期 ${t1} = ${w1}% · 中期 ${t2} = ${w2}% · 后期 ${t3} = ${w3}%（占全队影响力）",
          "Early ${t1} = ${w1}% · Mid ${t2} = ${w2}% · Late ${t3} = ${w3}% of the team's impact",
        )
          .replace("${t1}", `0:00–${formatClock(stages.earlyEndMs)}`)
          .replace("${w1}", String(Math.round(team.weights.early * 100)))
          .replace("${t2}", `${formatClock(stages.earlyEndMs)}–${formatClock(stages.midEndMs)}`)
          .replace("${w2}", String(Math.round(team.weights.mid * 100)))
          .replace("${t3}", `${formatClock(stages.midEndMs)}–${formatClock(data.match.duration)}`)
          .replace("${w3}", String(Math.round(team.weights.late * 100)))}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Médailles — noms et raisons (i18n)                                  */
/* ------------------------------------------------------------------ */

function medalName(key: string, l: ReturnType<typeof useBilingual>): string {
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

function medalReason(m: MedalAward, l: ReturnType<typeof useBilingual>): string {
  switch (m.key) {
    case "champion":
      return l(
        "没有人比 ${player} 更左右这场战争：${share}% 的队伍影响力。",
        "No ruler weighed more on this war than ${player}: ${share}% of their team's impact.",
      )
        .replace("${player}", String(m.params.player))
        .replace("${share}", String(m.params.share));
    case "first-blade":
      return l(
        "${time}，${player} 击倒了 ${victim}——第一个倒下的统治者。",
        "At ${time}, ${player} struck down ${victim}, the first ruler to fall.",
      )
        .replace("${time}", String(m.params.time))
        .replace("${player}", String(m.params.player))
        .replace("${victim}", String(m.params.victim));
    case "first-to-fall":
      return l(
        "${time}，${player} 第一个倒下。下次早点升时代吧。",
        "At ${time}, ${player} was the first ruler to fall. Next time, rush that age-up.",
      )
        .replace("${time}", String(m.params.time))
        .replace("${player}", String(m.params.player));
    case "master-of-coin":
      return l(
        "${player} 装满了国库：${res} 资源，全场最多。",
        "${player} filled the treasury more than any other ruler: ${res} resources.",
      )
        .replace("${player}", String(m.params.player))
        .replace("${res}", String(m.params.res));
    case "in-total-control":
      return l(
        "${time}，${player} 掌控了全场 ${share}% 的土地。",
        "At ${time}, ${player} held ${share}% of all the land in this war.",
      )
        .replace("${time}", String(m.params.time))
        .replace("${player}", String(m.params.player))
        .replace("${share}", String(m.params.share));
    case "cannon-fodder":
      return l(
        "${player} 把 ${lost} 名士兵送进坟墓，每损失 1 人只换来 ${ratio}。",
        "${player} sent ${lost} troops to their graves, slaying ${ratio} for every one lost.",
      )
        .replace("${player}", String(m.params.player))
        .replace("${lost}", String(m.params.lost))
        .replace("${ratio}", String(m.params.ratio));
    case "deserter":
      return l(
        "${time}，${player} 抛下小队逃离了战场。",
        "At ${time}, ${player} deserted the squad and left it to fight on alone.",
      )
        .replace("${time}", String(m.params.time))
        .replace("${player}", String(m.params.player));
    case "ghost":
      return l(
        "${time}，${player} 带着完好的基地从战争中消失了。",
        "At ${time}, ${player} vanished from the war with the base still standing.",
      )
        .replace("${time}", String(m.params.time))
        .replace("${player}", String(m.params.player));
    case "farmer":
      return l(
        "${player} 在战火中耕田：每 1000 资源只杀 ${ratio} 个单位。",
        "${player} tended the fields while the war raged: ${ratio} troops killed per 1000 resources.",
      )
        .replace("${player}", String(m.params.player))
        .replace("${ratio}", String(m.params.ratio));
    case "last-stand":
      return l(
        "最后一名盟友倒下后，${player} 独自坚守了 ${minutes} 分钟。",
        "${player} stood alone for ${minutes} minutes after the last ally fell.",
      )
        .replace("${player}", String(m.params.player))
        .replace("${minutes}", String(m.params.minutes));
    default:
      return "";
  }
}

/* ------------------------------------------------------------------ */
/* Divers                                                              */
/* ------------------------------------------------------------------ */

function localeOf(locale: string): "zh" | "en" | "fr" {
  return locale === "zh" ? "zh" : locale === "fr" ? "fr" : "en";
}

function compactNumberCurry(locale: string): (v: number) => string {
  const fmt = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  return (v: number) => fmt.format(Math.max(0, Math.round(v)));
}

function teamRate(players: PlayerImpact[]): number[] {
  const len = Math.max(...players.map((p) => p.impactRate.length), 0);
  return Array.from({ length: len }, (_, i) =>
    players.reduce((a, p) => a + (p.impactRate[i] ?? 0), 0),
  );
}

/* Réexport pour la modale existante (obsolète : gardées pour compat). */
export { TEAM_BLUE, TEAM_RED };
export type { Player };
