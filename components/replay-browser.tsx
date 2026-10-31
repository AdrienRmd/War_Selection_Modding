"use client";
import { useMemo, useState } from "react";
import { Search, TriangleAlert, Clock, Trophy, X } from "lucide-react";
import { useBilingual, useI18n } from "@/components/i18n";
import { isReplaySuccess, type Player } from "@/lib/replay/structure";
import { ReplayInfoParser } from "@/lib/replay/parser";
import { getGameContext, loadLegacyUnitIds, parseReplayCode } from "@/lib/replay";
import { calcKillDeath } from "@/lib/replay/kill-death";
import type { BaseDataset, TimeLineDataset } from "@/lib/replay/dataset";
import { TimeLineMultiRowDataset } from "@/lib/replay/dataset";
import {
  localizedResearchName,
  researchesIndex,
  researchImageUrl,
} from "@/lib/researches";
import { localizedUnitName, unitsIndex, type UnitIndexEntry } from "@/lib/units";

/** Cache mémoire des replays analysés, par code (rafraîchi à la session). */
const replayCache = new Map<string, LoadedReplay>();

interface LoadedReplay {
  result: ReturnType<ReplayInfoParser["parse"]>;
  isLegacy: boolean;
}

interface LoadError {
  message: string;
}

/** Libellés des courbes (clé = containerName de la source). */
const CHART_LABELS: Record<string, { zh: string; en: string }> = {
  replayDatasetUnitCreatePoints: { zh: "军队规模", en: "Army size" },
  replayDatasetUnitKillPoints: { zh: "战斗点数", en: "Combat points" },
  replayDatasetLandPoints: { zh: "领土", en: "Territory" },
  replayDatasetWorkerPoints: { zh: "村民", en: "Workers" },
  replayDatasetGatherEfficiency: { zh: "采集效率", en: "Gather efficiency" },
  replayDatasetGatherValueScore: { zh: "采集价值", en: "Gathered value" },
  replayDatasetResourcesCollected: { zh: "已采集资源", en: "Resources collected" },
  replayDatasetResourcesNow: { zh: "当前资源", en: "Current resources" },
  replayDatasetResourcesSpent: { zh: "已消耗资源", en: "Resources spent" },
  replayDatasetFoodCollected: { zh: "已采集食物", en: "Food collected" },
  replayDatasetWoodCollected: { zh: "已采集木材", en: "Wood collected" },
  replayDatasetIronCollected: { zh: "已采集铁矿", en: "Iron collected" },
  replayDatasetFoodNow: { zh: "当前食物", en: "Food now" },
  replayDatasetWoodNow: { zh: "当前木材", en: "Wood now" },
  replayDatasetIronNow: { zh: "当前铁矿", en: "Iron now" },
};

const MATCH_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
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

const RESOURCE_ROW_COLORS = ["#d84946", "#89411e", "#a29999"];

function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function formatInt(value: number | undefined, locale: string): string {
  if (value === undefined || !Number.isFinite(value)) return "–";
  return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : locale, {
    maximumFractionDigits: 0,
  }).format(value);
}

export function ReplayBrowser({ initialCode = "" }: { initialCode?: string }) {
  const { locale, t } = useI18n();
  const l = useBilingual();
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoadError | null>(null);
  const [data, setData] = useState<LoadedReplay | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [chartKey, setChartKey] = useState<string>("");
  const [chartGroup, setChartGroup] = useState<string>("players");

  // Lookup id → recherche / unité pour les libellés localisés.
  const researchById = useMemo(() => {
    const map = new Map<number, (typeof researchesIndex.researches)[number]>();
    for (const r of researchesIndex.researches) map.set(r.gameId, r);
    return map;
  }, []);
  const unitsById = useMemo(() => {
    const map = new Map<string, UnitIndexEntry>();
    for (const u of unitsIndex.units) map.set(u.id, u);
    return map;
  }, []);
  const researchName = (gameId: number): string => {
    const entry = researchById.get(gameId);
    return entry ? localizedResearchName(entry, locale) : `#${gameId}`;
  };
  const unitName = (unitPathId: string): string => {
    const entry = unitsById.get(unitPathId.replace(/^WarSelection\//, ""));
    return entry ? localizedUnitName(entry, locale) : unitPathId.split("/").pop() ?? unitPathId;
  };

  async function analyze(rawInput: string) {
    const normalized = parseReplayCode(rawInput);
    if (!normalized) {
      setError({ message: l("回放代码格式不对：需要 rep- 后跟 11 个字符，区分大小写。", "Invalid replay code: 11 characters after rep-, case-sensitive.") });
      setData(null);
      return;
    }
    setCode(normalized);
    setError(null);
    const cached = replayCache.get(normalized);
    if (cached) {
      setData(cached);
      setSelectedPlayer(null);
      return;
    }
    setLoading(true);
    try {
      // Seule destination de données : l'API officielle War Selection.
      const response = await fetch(
        `https://games-api.warselect.io/getByReplay?code=${encodeURIComponent(normalized)}`,
      );
      if (!response.ok) {
        setError({
          message: l(
            `游戏官方接口返回错误（HTTP ${response.status}），请稍后再试。`,
            `The official game API responded with HTTP error ${response.status}. Try again later.`,
          ),
        });
        return;
      }
      const json = (await response.json()) as { error?: number; description?: string };
      if (json.error === 2) {
        setError({ message: l("回放不存在（代码可能已过期）。", "Replay does not exist (the code may have expired).") });
        return;
      }
      if (json.error === 5) {
        setError({ message: l("回放代码不正确：需要 11 个字符，区分大小写。", "Incorrect replay code: 11 characters, case-sensitive.") });
        return;
      }
      if (json.error === 6) {
        setError({ message: l("游戏官方接口维护中，可能持续数小时，请稍后再试。", "The official game API is under maintenance (may last hours). Try again later.") });
        return;
      }
      if (json.error !== 0) {
        setError({
          message: l(
            `游戏官方接口返回错误（${json.error}）：${json.description ?? ""}`,
            `Official game API error (${json.error}): ${json.description ?? ""}`,
          ),
        });
        return;
      }
      const isLegacy =
        (json as { data?: { extraData?: Record<string, string> } }).data?.extraData?.["7"] == null;
      const [context, legacyUnitIds] = await Promise.all([
        getGameContext(),
        isLegacy ? loadLegacyUnitIds() : Promise.resolve(undefined),
      ]);
      const result = new ReplayInfoParser(context, normalized, legacyUnitIds).parse(json);
      if (!isReplaySuccess(result)) {
        setError({
          message: l(
            `无法解析这份回放数据：${result.message}`,
            `Cannot parse this replay data: ${result.message}`,
          ),
        });
        return;
      }
      const loaded: LoadedReplay = { result, isLegacy };
      if (replayCache.size >= 20) {
        replayCache.delete(replayCache.keys().next().value as string);
      }
      replayCache.set(normalized, loaded);
      setData(loaded);
      setSelectedPlayer(null);
      setChartKey("");
      setChartGroup("players");
    } catch {
      setError({ message: l("无法连接游戏官方接口，请检查网络后重试。", "Cannot reach the official game API. Check your connection and retry.") });
    } finally {
      setLoading(false);
    }
  }

  const success = data && isReplaySuccess(data.result) ? data.result : null;

  const chartOptions = useMemo(() => {
    if (!success) return [];
    return success.charts
      .filter((c) => c.containerType !== "events")
      .map((c) => ({
        key: c.containerName.replace(/Name$/, ""),
        container: c,
        label: CHART_LABELS[c.containerName.replace(/Name$/, "")],
      }))
      .filter((c) => c.label !== undefined);
  }, [success]);

  const activeChart =
    chartOptions.find((c) => c.key === chartKey) ?? chartOptions[0];
  const activeGroup =
    activeChart?.container.datasetGroups.find(
      (g) => g.dataGroupIdentifier === chartGroup,
    ) ?? activeChart?.container.datasetGroups[0];

  const players = useMemo(
    () =>
      success
        ? [...success.players]
            .filter(Boolean)
            .sort((a, b) => (b.mvpScore ?? 0) - (a.mvpScore ?? 0))
        : [],
    [success],
  );

  const awards = useMemo(() => {
    if (!success) return [];
    const list: Array<{ label: { zh: string; en: string }; value: string }> = [];
    const mvp = players.find((p) => p.isMvp);
    if (mvp) {
      list.push({
        label: { zh: "MVP", en: "MVP" },
        value: `${mvp.nickname} · ${formatInt(mvp.mvpScore, locale)}`,
      });
    }
    const firstWonder = players.find((p) => (p.firstWonderTime ?? 0) > 0);
    if (firstWonder) {
      list.push({
        label: { zh: "首个奇观", en: "First wonder" },
        value: `${firstWonder.nickname} · ${formatClock(firstWonder.firstWonderTime!)}`,
      });
    }
    let bestKd: { p: Player; kd: number } | null = null;
    for (const p of players) {
      const kd = p.unitsKilledPlain && p.unitsLostPlain
        ? calcKillDeath(p, killValuesFor(p))
        : undefined;
      if (kd && (!bestKd || kd.value > bestKd.kd)) bestKd = { p, kd: kd.value };
    }
    if (bestKd) {
      list.push({
        label: { zh: "最佳战损比", en: "Best kill/death" },
        value: `${bestKd.p.nickname} · ${bestKd.kd.toFixed(2)}`,
      });
    }
    let biggestArmy: { p: Player; n: number } | null = null;
    for (const p of players) {
      const n = p.unitsCreated
        ? Array.from(p.unitsCreated.values()).flat().reduce((a, u) => a + u.number, 0)
        : 0;
      if (!biggestArmy || n > biggestArmy.n) biggestArmy = { p, n };
    }
    if (biggestArmy && biggestArmy.n > 0) {
      list.push({
        label: { zh: "最大军队", en: "Largest army" },
        value: `${biggestArmy.p.nickname} · ${formatInt(biggestArmy.n, locale)}`,
      });
    }
    return list;
  }, [players, success, locale]);

  return (
    <section className="units-section replay-section" aria-label={t("回放分析")}>
      <div className="section-head compact">
        <div>
          <h2>{t("回放分析")}</h2>
          <p className="caption">
            {l(
              "粘贴对局回放代码，查看比分、玩家、时间线与单位统计。数据直接查询游戏官方接口。",
              "Paste a match replay code to see scores, players, timeline and unit stats. Data comes straight from the official game API.",
            )}
          </p>
        </div>
      </div>

      <form
        className="replay-form"
        onSubmit={(e) => {
          e.preventDefault();
          void analyze(code);
        }}
      >
        <div className="search-input">
          <Search size={16} />
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={l("rep-XXXXXXXXXXX", "rep-XXXXXXXXXXX")}
            aria-label={l("回放代码", "Replay code")}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <button type="submit" className="button primary" disabled={loading}>
          {loading ? l("分析中…", "Analyzing…") : l("分析回放", "Analyze replay")}
        </button>
      </form>
      <p className="caption replay-help">
        {l(
          "代码可在游戏内的回放列表或结算画面找到，格式 rep- 加 11 个字符，区分大小写。分析只调用游戏官方接口，不会保存你的对局。",
          "Find the code in the in-game replay list or the end-of-match screen — format rep- plus 11 characters, case-sensitive. Analysis only calls the official game API and stores nothing.",
        )}
      </p>
      <div className="replay-examples">
        <span className="caption">{l("示例：", "Examples:")}</span>
        <button type="button" onClick={() => void analyze("rep-jxXISVZ90rk")}>
          rep-jxXISVZ90rk
        </button>
        <button type="button" onClick={() => void analyze("rep-JUqOV1ljGxg")}>
          rep-JUqOV1ljGxg
        </button>
      </div>

      {loading ? (
        <p className="replay-status" role="status">
          <Clock size={15} /> {l("正在获取并解析回放…", "Fetching and parsing the replay…")}
        </p>
      ) : null}

      {error ? (
        <p className="replay-status replay-error" role="alert">
          <TriangleAlert size={15} /> {error.message}
        </p>
      ) : null}

      {success && data ? (
        <>
          {data.isLegacy ? (
            <p className="replay-status">
              <span className="replay-legacy-badge">
                {l("旧版回放", "Legacy replay")}
              </span>
              {l(
                "这份回放录制于旧版本，单位按旧编号匹配。",
                "This replay was recorded on an older version; units are matched through legacy ids.",
              )}
            </p>
          ) : null}

          <dl className="replay-match-grid">
            <div className="replay-match-card">
              <dt>{l("模式", "Mode")}</dt>
              <dd>{l(...matchTypeLabel(success.match.mode))}</dd>
            </div>
            <div className="replay-match-card">
              <dt>{l("时长", "Duration")}</dt>
              <dd>{formatClock(success.match.duration)}</dd>
            </div>
            <div className="replay-match-card">
              <dt>{l("玩家数", "Players")}</dt>
              <dd>{success.match.playersCount}</dd>
            </div>
            {success.match.startTime ? (
              <div className="replay-match-card">
                <dt>{l("开始时间", "Start time")}</dt>
                <dd>
                  {new Date(success.match.startTime * 1000).toLocaleString(
                    locale === "zh" ? "zh-CN" : locale,
                  )}
                </dd>
              </div>
            ) : null}
            {success.match.region ? (
              <div className="replay-match-card">
                <dt>{l("服务器区域", "Region")}</dt>
                <dd>{success.match.region}</dd>
              </div>
            ) : null}
            {success.match.gameVersion ? (
              <div className="replay-match-card">
                <dt>{l("游戏版本", "Game version")}</dt>
                <dd>{success.match.gameVersion}</dd>
              </div>
            ) : null}
            <div className="replay-match-card">
              <dt>{l("胜负", "Outcome")}</dt>
              <dd>
                {success.match.isComplete
                  ? success.match.isWonderWin
                    ? l("奇观胜利", "Wonder victory")
                    : l("有胜方", "Decided")
                  : l("未分胜负", "Undecided")}
              </dd>
            </div>
            {success.match.mapCode ? (
              <div className="replay-match-card">
                <dt>{l("地图", "Map")}</dt>
                <dd>{success.match.mapCode}</dd>
              </div>
            ) : null}
          </dl>

          {awards.length > 0 ? (
            <div className="replay-awards">
              {awards.map((award) => (
                <div key={award.label.en} className="replay-award">
                  <p className="award-label">
                    <Trophy size={13} style={{ verticalAlign: "-2px" }} /> {l(award.label.zh, award.label.en)}
                  </p>
                  <p className="award-value">{award.value}</p>
                </div>
              ))}
            </div>
          ) : null}

          <h3 className="replay-subtitle">{l("玩家总表", "Players overview")}</h3>
          <div className="replay-table-wrap">
            <table className="replay-table">
              <thead>
                <tr>
                  <th>{l("玩家", "Player")}</th>
                  <th>{l("队伍", "Team")}</th>
                  <th className="num">{l("MVP 分数", "MVP score")}</th>
                  <th className="num">{l("战损比（价值）", "K/D (value)")}</th>
                  <th className="num">{l("战损比（数量）", "K/D (count)")}</th>
                  <th className="num">{l("单位生产", "Units built")}</th>
                  <th className="num">{l("击杀单位", "Units killed")}</th>
                  <th className="num">{l("损失单位", "Units lost")}</th>
                  <th className="num">{l("存活时长", "Survival time")}</th>
                  <th>{l("结果", "Result")}</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player) => {
                  const kd = calcKillDeath(player, killValuesFor(player));
                  const built = player.unitsCreated
                    ? Array.from(player.unitsCreated.values()).flat().reduce((a, u) => a + u.number, 0)
                    : 0;
                  const killed = player.unitsKilledPlain
                    ? Array.from(player.unitsKilledPlain.values()).flat().reduce((a, u) => a + u.number, 0)
                    : 0;
                  const lost = player.unitsLostPlain
                    ? Array.from(player.unitsLostPlain.values()).flat().reduce((a, u) => a + u.number, 0)
                    : 0;
                  return (
                    <tr key={player.id} onClick={() => setSelectedPlayer(player)}>
                      <td>
                        <span className="replay-player-cell">
                          <span className="replay-player-dot" style={{ background: player.color }} />
                          <span className="replay-player-name">{player.nickname}</span>
                          {player.isMvp ? <span className="replay-flag-mvp">MVP</span> : null}
                        </span>
                      </td>
                      <td>{(player.team ?? 0) + 1}</td>
                      <td className="num">{formatInt(player.mvpScore, locale)}</td>
                      <td className="num">{kd ? kd.value.toFixed(2) : "–"}</td>
                      <td className="num">{kd ? kd.raw.toFixed(2) : "–"}</td>
                      <td className="num">{formatInt(built, locale)}</td>
                      <td className="num">{formatInt(killed, locale)}</td>
                      <td className="num">{formatInt(lost, locale)}</td>
                      <td className="num">
                        {player.survivalTime !== undefined ? formatClock(player.survivalTime) : "–"}
                      </td>
                      <td>
                        {player.isWinner ? (
                          <span className="replay-flag-winner">{l("胜", "Win")}</span>
                        ) : player.isDead ? (
                          l("淘汰", "Eliminated")
                        ) : (
                          l("存活", "Alive")
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {chartOptions.length > 0 && activeChart && activeGroup ? (
            <>
              <h3 className="replay-subtitle">{l("时间线", "Timeline")}</h3>
              <div className="replay-chart-controls">
                <select
                  value={activeChart.key}
                  onChange={(e) => setChartKey(e.target.value)}
                  aria-label={l("选择数据", "Select data")}
                >
                  {chartOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {l(option.label.zh, option.label.en)}
                    </option>
                  ))}
                </select>
                <select
                  value={activeGroup.dataGroupIdentifier}
                  onChange={(e) => setChartGroup(e.target.value)}
                  aria-label={l("选择分组", "Select group")}
                >
                  {activeChart.container.datasetGroups.map((group) => (
                    <option
                      key={group.dataGroupIdentifier}
                      value={group.dataGroupIdentifier}
                    >
                      {groupLabel(group.dataGroupIdentifier, l)}
                    </option>
                  ))}
                </select>
              </div>
              <TimelineChart
                datasets={activeGroup.datasets}
                multiRow={activeChart.container.containerType === "multiRow"}
              />
              <div className="replay-legend">
                {activeGroup.datasets.map((dataset, i) => (
                  <span key={dataset.datasetName + i}>
                    <span
                      className="replay-player-dot"
                      style={{ background: legendColor(dataset, i) }}
                    />
                    {dataset.isLocalizeName ? groupLabel(dataset.datasetName, l) : dataset.datasetName}
                  </span>
                ))}
              </div>
            </>
          ) : null}

          {selectedPlayer ? (
            <div
              className="units-detail-backdrop"
              role="presentation"
              onClick={() => setSelectedPlayer(null)}
            >
              <div
                className="units-detail"
                role="dialog"
                aria-modal="true"
                aria-label={selectedPlayer.nickname}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="units-detail-head">
                  <div className="units-detail-title">
                    <h3>
                      <span className="replay-player-dot" style={{ background: selectedPlayer.color }} />{" "}
                      {selectedPlayer.nickname}
                    </h3>
                    {selectedPlayer.isMvp ? <span className="replay-flag-mvp">MVP</span> : null}
                    {selectedPlayer.isWinner ? (
                      <span className="replay-flag-winner">{l("胜方", "Winner")}</span>
                    ) : null}
                  </div>
                  <button type="button" className="units-close" onClick={() => setSelectedPlayer(null)}>
                    <X size={16} />
                    <span>{l("关闭", "Close")}</span>
                  </button>
                </div>

                <div className="units-fiche">
                  {selectedPlayer.researches && selectedPlayer.researches.length > 0 ? (
                    <div className="units-block">
                      <h4>{l("研究时间线", "Research timeline")}</h4>
                      <ul className="replay-detail-list">
                        {[...selectedPlayer.researches]
                          .sort((a, b) => a.takenTime - b.takenTime)
                          .map((research) => {
                            const entry = researchById.get(research.id);
                            return (
                              <li key={`${research.id}-${research.takenTime}`}>
                                <span className="detail-time">{formatClock(research.takenTime)}</span>
                                {entry?.image ? (
                                  <img
                                    src={researchImageUrl(entry.image)}
                                    alt=""
                                    width={18}
                                    height={18}
                                    loading="lazy"
                                  />
                                ) : null}
                                <span className="detail-name">{researchName(research.id)}</span>
                              </li>
                            );
                          })}
                      </ul>
                    </div>
                  ) : null}

                  {selectedPlayer.unitsCreated && selectedPlayer.unitsCreated.size > 0 ? (
                    <div className="units-block">
                      <h4>{l("生产单位（按类别）", "Units built (by category)")}</h4>
                      <ul className="replay-detail-list">
                        {Array.from(selectedPlayer.unitsCreated.entries()).map(([category, units]) => (
                          <li key={category}>
                            <span className="detail-name">
                              {l(...categoryLabel(category))} —{" "}
                              {units
                                .map((u) => `${unitName(u.id)} ×${formatInt(u.number, locale)}`)
                                .join(", ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {selectedPlayer.unitsKilledPlain && selectedPlayer.unitsKilledPlain.size > 0 ? (
                    <div className="units-block">
                      <h4>{l("击杀单位", "Units killed")}</h4>
                      <ul className="replay-detail-list">
                        {Array.from(selectedPlayer.unitsKilledPlain.entries()).map(([category, units]) => (
                          <li key={`k-${category}`}>
                            <span className="detail-name">
                              {l(...categoryLabel(category))} —{" "}
                              {units
                                .map((u) => `${unitName(u.id)} ×${formatInt(u.number, locale)}`)
                                .join(", ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {selectedPlayer.unitsLostPlain && selectedPlayer.unitsLostPlain.size > 0 ? (
                    <div className="units-block">
                      <h4>{l("损失单位", "Units lost")}</h4>
                      <ul className="replay-detail-list">
                        {Array.from(selectedPlayer.unitsLostPlain.entries()).map(([category, units]) => (
                          <li key={`l-${category}`}>
                            <span className="detail-name">
                              {l(...categoryLabel(category))} —{" "}
                              {units
                                .map((u) => `${unitName(u.id)} ×${formatInt(u.number, locale)}`)
                                .join(", ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

/** Valeurs de combat par unité pour le K/D : les PlayerUnitStat portent
 *  déjà `points` (killValue du contexte de jeu). */
function killValuesFor(player: Player): Map<string, number> {
  const map = new Map<string, number>();
  for (const units of player.unitsLostPlain?.values() ?? []) {
    for (const unit of units) {
      if (unit.points !== undefined) map.set(unit.id, unit.points);
    }
  }
  return map;
}

function matchTypeLabel(key: string): [string, string] {
  const label = MATCH_TYPE_LABELS[key];
  return label ? [label.zh, label.en] : [key, key];
}

const CATEGORY_LABELS: Record<string, { zh: string; en: string }> = {
  unitCategoryProdBuild: { zh: "生产建筑", en: "Production buildings" },
  unitCategoryUnit: { zh: "单位", en: "Units" },
  unitCategoryBuild: { zh: "建筑", en: "Buildings" },
  unitCategoryEnv: { zh: "环境", en: "Environment" },
  unitCategoryWonder: { zh: "奇观", en: "Wonder" },
  unknown: { zh: "其他", en: "Other" },
};

function categoryLabel(category: string): [string, string] {
  const label = CATEGORY_LABELS[category];
  return label ? [label.zh, label.en] : [category, category];
}

function groupLabel(
  identifier: string,
  l: (zh: string, en: string) => string,
): string {
  if (identifier === "teams") return l("队伍", "Teams");
  if (identifier === "squads") return l("小队", "Squads");
  if (identifier === "players") return l("玩家", "Players");
  if (identifier === "replayTeam") return l("队伍", "Teams");
  if (identifier === "replaySquad") return l("小队", "Squads");
  return identifier;
}

function legendColor(dataset: BaseDataset, index: number): string {
  if (dataset.color) return dataset.color;
  return RESOURCE_ROW_COLORS[index % RESOURCE_ROW_COLORS.length];
}

/** Valeurs scalaires d'un dataset (somme des lignes pour le multi-lignes). */
function scalarValues(dataset: BaseDataset): number[] {
  if (dataset instanceof TimeLineMultiRowDataset) {
    const rows = dataset.values;
    return rows[0].map((_, i) => rows.reduce((acc, row) => acc + (row[i] ?? 0), 0));
  }
  return (dataset as TimeLineDataset).values;
}

function TimelineChart({
  datasets,
  multiRow,
}: {
  datasets: BaseDataset[];
  multiRow: boolean;
}) {
  const width = 720;
  const height = 240;
  const padLeft = 46;
  const padBottom = 22;
  const padTop = 10;
  const series = datasets.map((dataset) => ({
    name: dataset.datasetName,
    color: dataset.color ?? "#efaf65",
    values: scalarValues(dataset),
  }));
  const maxIndex = Math.max(...series.map((s) => s.values.length), 2);
  let max = 0;
  for (const s of series) for (const v of s.values) if (Number.isFinite(v) && v > max) max = v;
  if (max <= 0) max = 1;
  const x = (i: number) => padLeft + (i / (maxIndex - 1)) * (width - padLeft - 10);
  const y = (v: number) => padTop + (1 - Math.max(0, v) / max) * (height - padTop - padBottom);
  void multiRow;
  return (
    <svg
      className="replay-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
        <line
          key={ratio}
          x1={padLeft}
          x2={width - 10}
          y1={padTop + ratio * (height - padTop - padBottom)}
          y2={padTop + ratio * (height - padTop - padBottom)}
          stroke="#353d36"
          strokeWidth={1}
        />
      ))}
      <text x={4} y={y(max) + 4} fill="#a3ada5" fontSize={11}>
        {max >= 1000 ? `${Math.round(max / 1000)}k` : Math.round(max)}
      </text>
      <text x={4} y={height - padBottom + 4} fill="#a3ada5" fontSize={11}>
        0
      </text>
      {series.map((s) => (
        <polyline
          key={s.name}
          fill="none"
          stroke={s.color}
          strokeWidth={1.6}
          points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
        >
          <title>{s.name}</title>
        </polyline>
      ))}
    </svg>
  );
}
