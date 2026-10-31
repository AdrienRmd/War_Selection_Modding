"use client";
/** Page résultat d'un replay — reproduction fidèle de la structure observée
 *  sur warselection.vercel.app (capture du 31/10/2026) : verdict, bandeau
 *  d'infos, événements décisifs, équilibre de puissance, tables d'équipe par
 *  impact, phases early/mid/late. Habillage clair « wsva » (replay.css). */
import { useMemo } from "react";
import { ExternalLink, Trophy } from "lucide-react";
import { useBilingual, useI18n } from "@/components/i18n";
import type { ReplayAnalysis, PlayerImpact, Side } from "@/lib/replay/analysis";
import type { ReplayParseResult } from "@/lib/replay/structure";
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

const AGE_LABELS = [
  { zh: "石器时代", en: "Stone Age" },
  { zh: "青铜时代", en: "Bronze Age" },
  { zh: "铁器时代", en: "Iron Age" },
  { zh: "中世纪", en: "Middle Ages" },
  { zh: "文艺复兴", en: "Renaissance" },
  { zh: "工业时代", en: "Industrial Age" },
  { zh: "现代", en: "Modern Age" },
];

function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function ReplayResult({
  data,
  analysis,
  isLegacy,
  onOpenPlayer,
}: {
  data: Extract<ReplayParseResult, { error: 0 }>;
  analysis: ReplayAnalysis;
  isLegacy: boolean;
  onOpenPlayer: (playerIndex: number) => void;
}) {
  const { locale, t } = useI18n();
  const l = useBilingual();
  const compact = useMemo(
    () =>
      new Intl.NumberFormat(locale === "zh" ? "zh-CN" : locale, {
        notation: "compact",
        maximumFractionDigits: 1,
      }),
    [locale],
  );
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

  const match = data.match;
  const modeLabel = MODE_LABELS[match.mode] ?? { zh: match.mode, en: match.mode };
  const teamLabel = (side: Side) =>
    side === 0 ? l("蓝队", "Blue") : l("红队", "Red");
  const winner = analysis.verdict.winnerSide;
  const reason =
    analysis.verdict.reason === "wonder"
      ? l("通过奇观", "by wonder")
      : analysis.verdict.reason === "undecided"
        ? l("未分胜负", "not decided")
        : analysis.verdict.reason === "survivors"
          ? l("坚持到最后", "by holding out")
          : l("通过歼灭", "by elimination");
  const verdictTpl = l(
    "${team}获胜（${reason}）· ${size}v${size} ${mode}",
    "${team} wins ${reason} · ${size}v${size} ${mode}",
  );
  const verdict =
    winner === null
      ? l("对局未分胜负 · ${size}v${size} ${mode}", "Game not decided · ${size}v${size} ${mode}")
          .replace(/\$\{size\}/g, String(analysis.verdict.teamSize || match.playersCount))
          .replace("${mode}", l(modeLabel.zh, modeLabel.en))
      : verdictTpl
          .replace("${team}", teamLabel(winner))
          .replace("${reason}", reason)
          .replace(/\$\{size\}/g, String(analysis.verdict.teamSize || 1))
          .replace("${mode}", l(modeLabel.zh, modeLabel.en));
  const verdictColor = winner === null ? "#6b7280" : winner === 0 ? TEAM_BLUE : TEAM_RED;

  const stageLabels: [string, string, string] = [
    l("前期", "Early"),
    l("中期", "Mid"),
    l("后期", "Late"),
  ];

  return (
    <article className="rp-result">
      <h1 className="rp-verdict">
        <span style={{ color: verdictColor }}>{verdict.split("·")[0].trim()}</span>
        <span className="rp-verdict-sep"> · </span>
        <span>
          {analysis.verdict.teamSize
            ? `${analysis.verdict.teamSize}v${analysis.verdict.teamSize}`
            : ""}{" "}
          {l(modeLabel.zh, modeLabel.en)}
        </span>
      </h1>

      {isLegacy ? (
        <p className="rp-note">
          {l(
            "这份回放录制于旧版本，单位按旧编号匹配。",
            "This replay was recorded on an older version; units are matched through legacy ids.",
          )}
        </p>
      ) : null}

      {/* Bandeau d'informations du match. */}
      <section className="rp-banner" aria-label={t("对局信息")}>
        <BannerItem label={l("时长", "Duration")} value={formatClock(match.duration)} />
        <BannerItem
          label={l("进行时间", "Played")}
          value={match.startTime ? dateFmt.format(new Date(match.startTime * 1000)) : "–"}
        />
        <BannerItem
          label={l("区域", "Region")}
          value={match.region ? match.region.charAt(0).toUpperCase() + match.region.slice(1) : "–"}
        />
        <BannerItem
          label={l("大厅", "Lobby")}
          value={
            match.isMatchmaking
              ? l("匹配对战", "Matchmaking")
              : match.creator
                ? match.creator
                : l("自定义", "Custom")
          }
        />
        <BannerItem label={l("游戏版本", "Game version")} value={match.gameVersion ?? "–"} />
        <BannerItem label={l("回放代码", "Replay code")} value={match.replayCode} mono />
      </section>

      {/* Événements décisifs. */}
      <section className="rp-card">
        <h2>{l("决定性事件", "Decisive events")}</h2>
        <p className="rp-sub">
          {l(
            "对局面和一方胜率产生显著影响的事件。",
            "Events that had a significant impact on the game and on the win chance of a team.",
          )}
        </p>
        {analysis.events.length > 0 ? (
          <ol className="rp-events">
            {analysis.events.map((event, i) => (
              <li key={i} className="rp-event">
                <span className="rp-event-time">{formatClock(event.timeMs)}</span>
                <div className="rp-event-body">
                  {event.kind === "elimination" && event.elimination ? (
                    <>
                      <p className="rp-event-title">
                        {l(
                          "${team}只剩 ${n} 名玩家",
                          "${team} is down to ${n} players",
                        )
                          .replace("${team}", teamLabel(event.side))
                          .replace("${n}", String(event.elimination.downTo))}
                      </p>
                      <p className="rp-event-sub">
                        {event.elimination.leftGame
                          ? l("${victim} 离开了对局", "${victim} left the game").replace(
                              "${victim}",
                              event.elimination.victim,
                            )
                          : l("${victim} 被 ${killers} 淘汰", "${victim} eliminated by ${killers}")
                              .replace("${victim}", event.elimination.victim)
                              .replace("${killers}", event.elimination.killers.join(", "))}
                      </p>
                    </>
                  ) : null}
                  {event.kind === "swing" && event.swing ? (
                    <>
                      <p className="rp-event-title">
                        {l(
                          "${team}扭转了局势：${minutes} 分钟内力量对比 ${from}% → ${to}%",
                          "${team} swings the balance: ${from}% → ${to}% power in ${minutes} minutes",
                        )
                          .replace("${team}", teamLabel(event.side))
                          .replace("${minutes}", String(event.swing.minutes))
                          .replace("${from}", String(Math.round(event.swing.fromPct)))
                          .replace("${to}", String(Math.round(event.swing.toPct)))}
                      </p>
                      <p className="rp-event-sub">
                        {l(
                          "这 ${minutes} 分钟内歼灭敌方军队最多：${killers}。",
                          "Most army killed in those ${minutes} minutes: ${killers}.",
                        )
                          .replace("${minutes}", String(event.swing.minutes))
                          .replace(
                            "${killers}",
                            event.swing.topKillers.map((k) => `${k.name} ${k.value}`).join(", "),
                          )}
                      </p>
                    </>
                  ) : null}
                  {event.kind === "workers" && event.workers ? (
                    <>
                      <p className="rp-event-title">
                        {l(
                          "${team}在 ${minutes} 分钟内失去了 ${pct}% 的村民",
                          "${team} lost ${pct}% of its workers in ${minutes} minutes",
                        )
                          .replace("${team}", teamLabel(event.side))
                          .replace("${minutes}", String(event.workers.minutes))
                          .replace("${pct}", String(event.workers.lostPct))}
                      </p>
                      <p className="rp-event-sub">
                        {l(
                          "击杀村民最多：${killers}。",
                          "Most workers killed: ${killers}.",
                        ).replace(
                          "${killers}",
                          event.workers.topKillers.map((k) => `${k.name} ${k.value}`).join(", "),
                        )}
                      </p>
                    </>
                  ) : null}
                  {event.kind === "wonder" && event.wonder ? (
                    <>
                      <p className="rp-event-title">
                        {l("本局第一座奇观", "First wonder of the game")}
                      </p>
                      <p className="rp-event-sub">
                        {l("由 ${builder} 建造", "Built by ${builder}").replace(
                          "${builder}",
                          event.wonder.builder,
                        )}
                      </p>
                    </>
                  ) : null}
                  <p className="rp-event-win">
                    {l(
                      "${team}胜率 ${before}% → ${after}%",
                      "${team} win chance ${before}% → ${after}%",
                    )
                      .replace("${team}", teamLabel(event.side))
                      .replace("${before}", String(Math.round(event.winBefore * 100)))
                      .replace("${after}", String(Math.round(event.winAfter * 100)))}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rp-sub">{l("本局没有检测到决定性事件。", "No decisive events detected in this game.")}</p>
        )}
      </section>

      {/* Équilibre de puissance. */}
      {analysis.power && analysis.winChanceBlue ? (
        <section className="rp-card">
          <h2>{l("力量对比", "Power balance")}</h2>
          <p className="rp-sub">
            {l(
              "力量由三个均等的部分组成：军队、收入与领土。",
              "Power is the average of three equal parts: army, income and territory.",
            )}
          </p>
          <PowerBalanceChart
            power={analysis.power}
            winChanceBlue={analysis.winChanceBlue}
            durationMs={match.duration}
            labels={{ blue: l("蓝队", "Blue"), red: l("红队", "Red") }}
          />
          <div className="rp-legend">
            <span>
              <span className="rp-dot" style={{ background: TEAM_BLUE }} /> {l("蓝队", "Blue")}
            </span>
            <span>
              <span className="rp-dot" style={{ background: TEAM_RED }} /> {l("红队", "Red")}
            </span>
            <span>
              <span className="rp-dash" /> {l("胜率", "Win chance")}
            </span>
          </div>
        </section>
      ) : null}

      {/* Tables par équipe. */}
      {analysis.teams.map((team) => (
        <section className="rp-card rp-team" key={team.id}>
          <header className="rp-team-head">
            <h2 style={{ color: team.side === 0 ? TEAM_BLUE : TEAM_RED }}>
              {teamLabel(team.side)}
            </h2>
            <span className={`rp-badge ${team.isWinner ? "rp-badge-win" : "rp-badge-loss"}`}>
              {team.isWinner ? l("获胜方", "Victorious") : l("被击败", "Defeated")}
            </span>
            <span className="rp-team-meta">
              {team.avgRating !== undefined
                ? l("平均 MMR ${mmr}", "Average MMR ${mmr}").replace(
                    "${mmr}",
                    String(team.avgRating),
                  )
                : null}
              {" · "}
              {l(
                "${elim} / ${total} 被淘汰",
                "${elim} of ${total} eliminated",
              )
                .replace("${elim}", String(team.total - team.aliveCount))
                .replace("${total}", String(team.total))}
            </span>
          </header>
          <p className="rp-sub">
            {l(
              "${team}玩家，按影响力排序。点击一行查看该玩家的对局。",
              "${team} players, sorted by impact. Select a row to open that player's game.",
            ).replace("${team}", teamLabel(team.side))}
          </p>
          <div className="rp-table-wrap">
            <table className="rp-table">
              <thead>
                <tr>
                  <th className="rp-th-open">{l("查看玩家", "Open player")}</th>
                  <th>
                    {l("影响力", "Impact")}
                    <span className="rp-th-sub">
                      {l("占胜利的份额", "share of the win")}
                    </span>
                  </th>
                  <th>{l("玩家", "Player")}</th>
                  <th>
                    {l("达到的最后时代", "Last age reached")}
                  </th>
                  <th>
                    {l("资源 · 效率", "Resources · efficiency")}
                    <span className="rp-th-sub">{l("食物 / 木材 / 铁矿", "food / wood / iron")}</span>
                  </th>
                  <th>
                    {l("歼灭人力", "Manpower killed")}
                    <span className="rp-th-sub">{l("生产 / 损失 / K/D", "created / lost / K/D")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {team.players.map((pi) => (
                  <PlayerRow
                    key={pi.player.id}
                    impact={pi}
                    compact={compact}
                    locale={locale}
                    onOpen={() => onOpenPlayer(pi.player.id)}
                    ageLabel={(age: number) =>
                      l(AGE_LABELS[age]?.zh ?? "?", AGE_LABELS[age]?.en ?? "?")
                    }
                    isMvp={pi.player.isMvp === true}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {/* Phases early / mid / late. */}
      {analysis.stages && analysis.power ? (
        <section className="rp-card">
          <h2>{l("前中后期谁起到了作用", "Who mattered in the early, mid and late game")}</h2>
          <p className="rp-sub">
            {l(
              "对局按全体玩家的中位数时间划分：到达中世纪（前期结束）与首次进入工业时代（中期结束），之后为后期。每条色带是一名玩家自本阶段开始以来占全队积分的份额，因此前期影响力显示在累计旁边。图表下方是各阶段在全队影响力中的权重。积分很少的阶段会标注为小样本：其份额可能因一场战斗而波动。末尾的灰色区域是收尾阶段：对局已经决定，那里的军队与村民击杀不再计入（最多截去最后 5 分钟）。淘汰与奇观仍然计入。",
              "The game is split in three stages by when the median player of the game reached Middle Ages (end of Early) and the first Industrial age (end of Mid); Late is the rest. Each coloured band is the share of the team's impact points a player earned since the start of the stage, so early impact shows next to the total. Under each chart is how much each stage weighs for the team. A stage with very few points is marked as a small sample: those shares can swing on a single fight. The grey zone at the end is the cleanup: the game was already decided, so army and workers killed there don't count (at most the last 5 minutes are cut). Eliminations and the wonder still count.",
            )}
          </p>
          {analysis.teams.map((team) => {
            const series = team.players.map((p, i) => ({
              name: p.player.nickname,
              color: PLAYER_COLORS[i % PLAYER_COLORS.length],
              rate: p.impactRate,
            }));
            return (
              <div className="rp-stage-block" key={team.id}>
                <h3>{teamLabel(team.side)}</h3>
                <StageShareChart
                  players={series}
                  stages={analysis.stages!}
                  periodMs={data.timeLinePeriod}
                  caption={l(
                    "自各阶段开始以来占全队积分的份额",
                    "Share of the team's points since the start of each stage",
                  )}
                  stageLabels={stageLabels}
                  decidedLabel={l("对局已定", "Game decided")}
                  decidedCaption={l("灰色区域不计入积分", "Grey zone scores no points")}
                />
                <div className="rp-stage-legend">
                  {series.map((s) => (
                    <span key={s.name}>
                      <span className="rp-dot" style={{ background: s.color }} /> {s.name}
                    </span>
                  ))}
                  <span>
                    <span className="rp-line-mark" /> {l("对局已定", "Game decided")}
                  </span>
                </div>
                <p className="rp-stage-weights">
                  {l(
                    "${stage1} ${t1} = ${w1}% · ${stage2} ${t2} = ${w2}% · ${stage3} ${t3} = ${w3}%（占全队影响力）",
                    "${stage1} ${t1} = ${w1}% · ${stage2} ${t2} = ${w2}% · ${stage3} ${t3} = ${w3}% of the team's impact",
                  )
                    .replace("${stage1}", stageLabels[0])
                    .replace("${t1}", `0:00–${formatClock(analysis.stages!.earlyEndMs)}`)
                    .replace("${w1}", String(Math.round(team.weights.early * 100)))
                    .replace("${stage2}", stageLabels[1])
                    .replace(
                      "${t2}",
                      `${formatClock(analysis.stages!.earlyEndMs)}–${formatClock(analysis.stages!.midEndMs)}`,
                    )
                    .replace("${w2}", String(Math.round(team.weights.mid * 100)))
                    .replace("${stage3}", stageLabels[2])
                    .replace("${t3}", `${formatClock(analysis.stages!.midEndMs)}–${formatClock(match.duration)}`)
                    .replace("${w3}", String(Math.round(team.weights.late * 100)))}
                </p>
              </div>
            );
          })}
          <div className="rp-stage-block">
            <h3>
              {teamLabel(0)} {l("对阵", "against")} {teamLabel(1)}
            </h3>
            <VersusChart
              blue={teamRate(analysis.teams[0]?.players ?? [])}
              red={teamRate(analysis.teams[1]?.players ?? [])}
              stages={analysis.stages}
              periodMs={data.timeLinePeriod}
              caption={l("两队积分占比", "Share of each team's points")}
              stageLabels={stageLabels}
              decidedLabel={l("对局已定", "Game decided")}
            />
            <div className="rp-stage-legend">
              <span>
                <span className="rp-dot" style={{ background: TEAM_RED }} /> {teamLabel(1)}
              </span>
              <span>
                <span className="rp-dot" style={{ background: TEAM_BLUE }} /> {teamLabel(0)}
              </span>
            </div>
          </div>
        </section>
      ) : null}
    </article>
  );
}

/* VersusChart attend des séries par équipe, pas par joueur : agrégation. */
function teamRate(players: PlayerImpact[]): number[] {
  const len = Math.max(...players.map((p) => p.impactRate.length), 0);
  return Array.from({ length: len }, (_, i) =>
    players.reduce((a, p) => a + (p.impactRate[i] ?? 0), 0),
  );
}

function BannerItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rp-banner-item">
      <span className="rp-banner-label">{label}</span>
      <span className={`rp-banner-value${mono ? " rp-mono" : ""}`}>{value}</span>
    </div>
  );
}

function PlayerRow({
  impact,
  compact,
  locale,
  onOpen,
  ageLabel,
  isMvp,
}: {
  impact: PlayerImpact;
  compact: Intl.NumberFormat;
  locale: string;
  onOpen: () => void;
  ageLabel: (age: number) => string;
  isMvp: boolean;
}) {
  const l = useBilingual();
  const p = impact.player;
  const intFmt = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : locale, {
    maximumFractionDigits: 0,
  });
  return (
    <tr onClick={onOpen} className="rp-row">
      <td>
        <button
          type="button"
          className="rp-open"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          aria-label={l("查看玩家", "Open player")}
        >
          <ExternalLink size={14} aria-hidden="true" />
        </button>
      </td>
      <td className="rp-impact-cell">
        <span className="rp-impact-value">{Math.round(impact.share * 100)}%</span>
        <span className="rp-impact-label">{l("影响力", "Impact")}</span>
      </td>
      <td>
        <div className="rp-player-cell">
          <span className="rp-player-name">
            {p.nickname}
            {isMvp ? <Trophy size={12} className="rp-mvp" aria-label="MVP" /> : null}
          </span>
          <span className="rp-player-meta">
            {impact.role === "frontline"
              ? l("前排主力", "Frontline")
              : l("后排支援", "Backline")}
            {typeof p.rating === "number" ? ` · ${l("MMR", "MMR")} ${p.rating}` : ""}
            {impact.squad !== undefined ? ` · ${l("小队", "Squad")} ${impact.squad}` : ""}
          </span>
        </div>
      </td>
      <td className="rp-age-cell">
        {impact.lastAgeTimeMs !== undefined ? (
          <>
            <span className="rp-age-time">{formatClock(impact.lastAgeTimeMs)}</span>
            {impact.lastAge !== undefined ? (
              <span className="rp-player-meta">{ageLabel(impact.lastAge)}</span>
            ) : null}
          </>
        ) : (
          <span className="rp-player-meta">–</span>
        )}
      </td>
      <td className="rp-res-cell">
        <span className="rp-res-total">{compact.format(impact.resTotal)}</span>{" "}
        <span className="rp-res-eff">
          {impact.efficiencyPct !== undefined
            ? `${Math.round(impact.efficiencyPct)}%`
            : "–"}
        </span>
        <span className="rp-res-rows">
          {compact.format(impact.resFood)} / {compact.format(impact.resWood)} /{" "}
          {compact.format(impact.resIron)}
        </span>
      </td>
      <td className="rp-kd-cell">
        <span className="rp-kd-killed">{intFmt.format(impact.killed)}</span>
        <span className="rp-kd-rows">
          +{intFmt.format(impact.created)} −{intFmt.format(impact.lost)}
        </span>
        <span className="rp-kd-ratio">
          {l("K/D", "K/D")}{" "}
          {impact.kd === undefined
            ? "–"
            : impact.kd >= 10
              ? impact.kd.toFixed(0)
              : impact.kd.toFixed(1)}
        </span>
      </td>
    </tr>
  );
}
