import { AtlasHeader, AtlasFooter, PageTitle } from "@/components/atlas-shell";
import { T } from "@/components/i18n";
import type { Metadata } from "next";
import { pageMetadata, requestLocale } from "@/lib/page-metadata";
import { translate } from "@/lib/i18n";
import Link from "@/components/site-link";
import { PlayersLadder } from "@/components/replay/players-ladder";
import {
  listSeasons,
  playerStatsForSeason,
  REPLAY_CATEGORIES,
  type PlayerStatsRow,
  type ReplayCategory,
} from "@/lib/replay-stats";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("players");
}

function isCategory(value: string | undefined): value is ReplayCategory {
  return value === "big" || value === "solo";
}

/** Page /players — classement saisonnier des joueurs (Replay phase 2).
 *  Données : agrégation des replays publiés (table player_stats, formule de
 *  points documentée dans lib/replay-stats.ts). Saison par défaut : la plus
 *  récente avec des données ; catégorie par défaut : big team si elle a des
 *  lignes, sinon l'autre. */
export default async function Players({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; cat?: string }>;
}) {
  const params = await searchParams;
  const locale = await requestLocale();
  const seasons = await listSeasons();
  const validSeason = seasons.includes(params.season ?? "") ? params.season! : seasons[0];
  const [big, solo] = await Promise.all([
    playerStatsForSeason(validSeason, "big"),
    playerStatsForSeason(validSeason, "solo"),
  ]);
  const byCategory: Record<ReplayCategory, PlayerStatsRow[]> = { big, solo };
  // Choix explicite respecté (état vide assumé avec message) ; sans choix,
  // big team par défaut — bascule sur l'autre catégorie si elle seule a des
  // lignes (saison fraîche sans grandes équipes publiées).
  const explicit = isCategory(params.cat);
  let active: ReplayCategory = explicit ? (params.cat as ReplayCategory) : "big";
  if (!explicit && byCategory[active].length === 0) active = active === "big" ? "solo" : "big";
  const rows = byCategory[active];
  const lastUpdate = rows.reduce((max, r) => (r.last_played > max ? r.last_played : max), "");
  const other = active === "big" ? "solo" : "big";
  const otherCount = byCategory[other].length;

  return (
    <>
      <AtlasHeader />
      <main className="shell">
        <PageTitle
          eyebrow="PLAYERS LADDER"
          title="玩家排行榜"
          text="每赛季的玩家积分榜：参赛、胜利、MVP 与击杀都折算成积分。数据来自已公开的回放。"
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
                      href={`/players?season=${encodeURIComponent(s)}&cat=${active}`}
                      aria-current={s === validSeason ? "page" : undefined}
                    >
                      {s}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <p className="caption ladder-formula">
              <T text="积分 = 参赛×1 + 胜利×2 + MVP×2 + 击杀÷100（取整）。" />
            </p>
            <p className="caption">
              <Link className="ladder-link" href="/season-statistics">
                <T text="本赛期统计" />
              </Link>
            </p>
          </aside>
          <section className="ladder-main" aria-label={translate("排行榜", locale)}>
            <div className="ladder-toolbar">
              <nav className="cat-tabs" aria-label={translate("队列类型", locale)}>
                {REPLAY_CATEGORIES.map((cat) => (
                  <Link
                    key={cat}
                    className={"cat-tab" + (cat === active ? " active" : "")}
                    href={`/players?season=${encodeURIComponent(validSeason)}&cat=${cat}`}
                    aria-current={cat === active ? "page" : undefined}
                  >
                    {cat === "big" ? <T text="大部队" /> : <T text="单排 / 双排" />}
                    <span className="count">{byCategory[cat].length}</span>
                  </Link>
                ))}
              </nav>
              <p className="caption ladder-updated">
                {lastUpdate
                  ? translate(`数据更新至 ${lastUpdate.slice(0, 10)}。`, locale)
                  : translate("本赛期还没有已公开的回放。", locale)}
              </p>
            </div>
            {rows.length > 0 ? (
              <PlayersLadder rows={rows} hasOtherCategory={otherCount > 0} />
            ) : (
              <div className="empty-surface">
                <h2>
                  <T text="本赛期暂无排名" />
                </h2>
                <p>
                  <T text="回放经管理员公开后，排行榜会自动更新。" />
                </p>
                <Link className="button primary" href="/replay">
                  <T text="提交第一个回放" />
                </Link>
              </div>
            )}
          </section>
        </div>
      </main>
      <AtlasFooter />
    </>
  );
}
