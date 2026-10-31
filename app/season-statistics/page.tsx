import { AtlasHeader, AtlasFooter, PageTitle } from "@/components/atlas-shell";
import { T } from "@/components/i18n";
import type { Metadata } from "next";
import { pageMetadata, requestLocale } from "@/lib/page-metadata";
import { translate } from "@/lib/i18n";
import Link from "@/components/site-link";
import {
  aggregateSeasonStats,
  listSeasons,
  replayResultsForSeason,
} from "@/lib/replay-stats";
import { unitsIndex, type UnitLocalizedNames } from "@/lib/units";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("seasonStats");
}

/** Libellé d'un mode de match localisé (clés zh du dictionnaire). */
const MODE_LABELS: Record<string, string> = {
  replayMatchTypeTeamMatch: "团队赛",
  replayMatchTypeFFA: "混战",
  replayMatchTypeArmageddon: "末日审判",
  replayMatchTypeSurvival: "生存",
  replayMatchTypeCustom: "自定义",
  replayMatchTypeRank1: "排位 1v1",
  replayMatchTypeRank2: "排位 2v2",
  replayMatchTypeSandbox: "沙盒",
  replayMatchTypeTOW: "TOW",
  replayMatchTypeMafia: "Mafia",
};

const durationLabel = (seconds: number, locale: string): string => {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return `${rest} min`;
  return locale === "fr" ? `${hours} h ${String(rest).padStart(2, "0")}` : `${hours}h${String(rest).padStart(2, "0")}`;
};

/** Nom d'unité localisé depuis l'index embarqué (WarSelection/1/worker →
 *  « Worker » / « Travailleur » / « 工人 »), repli sur l'identifiant court. */
function unitLabel(unitId: string, locale: string): string {
  const short = unitId.replace(/^WarSelection\//, "");
  const entry = unitsIndex.units.find((u) => u.id === short);
  const names = entry?.names as UnitLocalizedNames | undefined;
  if (!names) return short.split("/").pop() ?? short;
  const pick = locale === "fr" ? names.fr : locale === "en" ? names.en : (names.cn ?? names.tw);
  return pick ?? names.en ?? short.split("/").pop() ?? short;
}

/** Page /season-statistics — cartes stats épurées de la saison : replays
 *  publiés, joueurs, durée moyenne, modes populaires, régions serveur et
 *  top unités produites (digests agrégés). Même DA que le classement. */
export default async function SeasonStatistics({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const params = await searchParams;
  const locale = await requestLocale();
  const seasons = await listSeasons();
  const validSeason = seasons.includes(params.season ?? "") ? params.season! : seasons[0];
  const rows = await replayResultsForSeason(validSeason);
  const stats = aggregateSeasonStats(validSeason, rows);
  const maxMode = Math.max(1, ...stats.modes.map((m) => m.count));

  return (
    <>
      <AtlasHeader />
      <main className="shell">
        <PageTitle
          eyebrow="SEASON STATISTICS"
          title="赛期统计"
          text="已公开回放汇总：流行模式、平均时长、服务器地区与产量最高的单位。"
        />
        <div className="ladder-layout">
          <aside className="ladder-side">
            <p className="site-footer-title">
              <T text="赛季" />
            </p>
            <nav aria-label={translate("赛季", locale)}>
              <ul className="season-list">
                {seasons.map((s) => (
                  <li key={s}>
                    <Link
                      className={"season-chip" + (s === validSeason ? " active" : "")}
                      href={`/season-statistics?season=${encodeURIComponent(s)}`}
                      aria-current={s === validSeason ? "page" : undefined}
                    >
                      {s}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <p className="caption">
              <Link className="ladder-link" href="/players">
                <T text="玩家排行榜" />
              </Link>
            </p>
          </aside>
          <section className="ladder-main" aria-label={translate("赛期统计", locale)}>
            {stats.replays === 0 ? (
              <div className="empty-surface">
                <h2>
                  <T text="本赛期还没有已公开的回放。" />
                </h2>
                <Link className="button primary" href="/replay">
                  <T text="提交第一个回放" />
                </Link>
              </div>
            ) : (
              <>
                <div className="stat-cards">
                  <div className="stat-card">
                    <span className="stat-value">{stats.replays}</span>
                    <span className="stat-label">
                      <T text="已公开回放" />
                    </span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-value">{stats.players}</span>
                    <span className="stat-label">
                      <T text="上榜玩家" />
                    </span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-value">
                      {stats.avgDurationS !== null ? durationLabel(stats.avgDurationS, locale) : "—"}
                    </span>
                    <span className="stat-label">
                      <T text="平均时长" />
                    </span>
                  </div>
                </div>

                <div className="stat-columns">
                  <div className="panel stat-panel">
                    <h2>
                      <T text="流行模式" />
                    </h2>
                    <ul className="stat-bars">
                      {stats.modes.map((mode) => (
                        <li key={mode.modeKey}>
                          <span className="bar-label">
                            {translate(MODE_LABELS[mode.modeKey] ?? mode.modeKey, locale)}
                          </span>
                          <span
                            className="bar-track"
                            aria-hidden="true"
                          >
                            <span
                              className="bar-fill"
                              style={{ width: `${Math.round((mode.count / maxMode) * 100)}%` }}
                            />
                          </span>
                          <span className="bar-value">{mode.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="panel stat-panel">
                    <h2>
                      <T text="服务器地区" />
                    </h2>
                    {stats.regions.length > 0 ? (
                      <ul className="stat-bars">
                        {stats.regions.map((region) => (
                          <li key={region.region}>
                            <span className="bar-label">{region.region}</span>
                            <span className="bar-value">{region.count}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="caption">
                        <T text="暂无地区数据。" />
                      </p>
                    )}
                    {stats.maps.length > 0 ? (
                      <>
                        <h2>
                          <T text="自定义地图" />
                        </h2>
                        <ul className="stat-bars">
                          {stats.maps.map((map) => (
                            <li key={map.mapCode}>
                              <span className="bar-label">{map.mapCode}</span>
                              <span className="bar-value">{map.count}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="panel stat-panel">
                  <h2>
                    <T text="产量最高的单位" />
                  </h2>
                  <ol className="unit-ranks">
                    {stats.topUnits.map((unit, index) => (
                      <li key={unit.unitId}>
                        <span className="unit-rank">{index + 1}</span>
                        <span className="unit-name">{unitLabel(unit.unitId, locale)}</span>
                        <span className="unit-count">{unit.count.toLocaleString("en-US")}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <p className="caption ladder-updated">
                  {stats.lastStarted
                    ? translate(`数据更新至 ${stats.lastStarted.slice(0, 10)}。`, locale)
                    : null}
                </p>
              </>
            )}
          </section>
        </div>
      </main>
      <AtlasFooter />
    </>
  );
}
