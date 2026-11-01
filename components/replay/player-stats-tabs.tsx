"use client";
/** « Player statistics » — détail joueur en onglets (reproduction de la
 *  structure ws-stats.pl : Resources / Units / Defeated / Buildings /
 *  Research, icônes lucide équivalentes à leurs material icons).
 *  Contenu :
 *  - Resources : cartes denses (récolté par ressource, stock final + pic,
 *    efficacité de récolte, territoire, points de villageois) — séries du
 *    parser existantes ;
 *  - Units : sections REPLIABLES par catégorie réelle du dataset (Eco /
 *    Mêlée / Distance / Cavalerie / Blindés / Aviation / Marine / Autres —
 *    cf. lib/replay/unit-groups.ts ; pas de « Siège » : aucun marqueur
 *    public, les armes de siège sont fusionnées dans Distance), tuile par
 *    unité : icône du jeu (/wus-data), nom localisé, nombre produit ;
 *  - Defeated : unités tuées et perdues (mêmes tuiles) ;
 *  - Buildings : production de bâtiments (onglet omis si aucun) ;
 *  - Research : recherches avec icône, nom localisé et horloge.
 *  Rendu paresseux : seuls l'onglet actif et les sections ouvertes montent
 *  leurs tuiles ; toutes les images sont loading="lazy". */
import { useMemo, useState } from "react";
import { Coins, Users, Skull, Home, FlaskConical, ChevronDown } from "lucide-react";
import { useBilingual, useI18n } from "@/components/i18n";
import { playerSeries } from "@/lib/replay/analysis";
import type { Player, PlayerUnitStat, ReplayParseSuccess } from "@/lib/replay/structure";
import { UNIT_GROUP_ORDER, groupUnitCounts, type UnitGroupId } from "@/lib/replay/unit-groups";
import {
  compactNumber,
  formatClock,
  researchDisplayName,
  researchIconUrl,
  unitDisplayName,
  unitIconUrl,
} from "@/lib/replay/wsva-view";

const RESOURCE_META = [
  { icon: "/wus-data/content/images/resource/0.png", zh: "食物", en: "Food" },
  { icon: "/wus-data/content/images/resource/1.png", zh: "木材", en: "Wood" },
  { icon: "/wus-data/content/images/resource/2.png", zh: "铁矿", en: "Iron" },
] as const;

const GROUP_LABELS: Record<UnitGroupId, { zh: string; en: string }> = {
  buildings: { zh: "建筑", en: "Buildings" },
  eco: { zh: "经济", en: "Eco" },
  melee: { zh: "近战", en: "Melee" },
  ranged: { zh: "远程", en: "Ranged" },
  cavalry: { zh: "骑兵", en: "Cavalry" },
  vehicles: { zh: "装甲", en: "Vehicles" },
  air: { zh: "航空", en: "Aviation" },
  fleet: { zh: "舰船", en: "Fleet" },
  other: { zh: "其他", en: "Other" },
};

/** Agrège les compteurs d'unités d'un map du parser. Structure
 *  NESTED : clé externe = catégorie (ex. « unitCategoryLand »), la valeur
 *  liste des PlayerUnitStat dont `id` est le gameId — on somme par gameId
 *  (même motif qu'analysis.countUnits). */
function countUnits(map?: Map<string, PlayerUnitStat[]>): Map<string, number> {
  const out = new Map<string, number>();
  for (const stats of map?.values() ?? []) {
    for (const stat of stats) {
      out.set(stat.id, (out.get(stat.id) ?? 0) + stat.number);
    }
  }
  return out;
}

type TabId = "resources" | "units" | "defeated" | "buildings" | "research";

const TABS: Array<{ id: TabId; icon: typeof Coins; zh: string; en: string }> = [
  { id: "resources", icon: Coins, zh: "资源", en: "Resources" },
  { id: "units", icon: Users, zh: "单位", en: "Units" },
  { id: "defeated", icon: Skull, zh: "歼灭", en: "Defeated" },
  { id: "buildings", icon: Home, zh: "建筑", en: "Buildings" },
  { id: "research", icon: FlaskConical, zh: "研究", en: "Research" },
];

export function PlayerStatsTabs({
  result,
  player,
}: {
  result: ReplayParseSuccess;
  player: Player;
}) {
  const l = useBilingual();
  const { locale } = useI18n();
  const [tab, setTab] = useState<TabId>("resources");
  const fmt = (value: number) => compactNumber(value, locale);

  const series = (name: string) => playerSeries(result, name, player) ?? [];
  const last = (values: number[]) => (values.length > 0 ? values[values.length - 1] : 0);
  const peak = (values: number[]) => values.reduce((m, v) => Math.max(m, v), 0);
  const avg = (values: number[]) =>
    values.length > 0 ? values.reduce((a, v) => a + v, 0) / values.length : 0;

  const created = useMemo(() => countUnits(player.unitsCreated), [player]);
  const createdGroups = useMemo(
    () => groupUnitCounts([...created.entries()].filter(([, n]) => n > 0)),
    [created],
  );
  const killed = useMemo(() => {
    if (player.unitsKilledPlain && player.unitsKilledPlain.size > 0) {
      return countUnits(player.unitsKilledPlain);
    }
    const merged = new Map<string, number>();
    for (const entry of player.unitsKilledByFaction ?? []) {
      for (const [gameId, count] of countUnits(entry.units)) {
        merged.set(gameId, (merged.get(gameId) ?? 0) + count);
      }
    }
    return merged;
  }, [player]);
  const lost = useMemo(() => {
    if (player.unitsLostPlain && player.unitsLostPlain.size > 0) {
      return countUnits(player.unitsLostPlain);
    }
    const merged = new Map<string, number>();
    for (const entry of player.unitsLostByFaction ?? []) {
      for (const [gameId, count] of countUnits(entry.units)) {
        merged.set(gameId, (merged.get(gameId) ?? 0) + count);
      }
    }
    return merged;
  }, [player]);
  const killedGroups = useMemo(
    () => groupUnitCounts([...killed.entries()].filter(([, n]) => n > 0)),
    [killed],
  );
  const lostGroups = useMemo(
    () => groupUnitCounts([...lost.entries()].filter(([, n]) => n > 0)),
    [lost],
  );
  const researches = useMemo(
    () => [...(player.researches ?? [])].sort((a, b) => a.takenTime - b.takenTime),
    [player],
  );

  const hasBuildings = (createdGroups.get("buildings")?.length ?? 0) > 0;
  const visibleTabs = TABS.filter((t) => t.id !== "buildings" || hasBuildings);

  return (
    <div className="player-stats" data-testid="player-stats">
      <div className="chip-group player-stats-tabs" role="tablist" aria-label={l("玩家统计", "Player statistics")}>
        {visibleTabs.map(({ id, icon: Icon, zh, en }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`chip chip-with-icon player-stats-tab${tab === id ? " chip-active" : ""}`}
            onClick={() => setTab(id)}
          >
            <Icon className="player-stats-tab-icon" aria-hidden="true" />
            {l(zh, en)}
          </button>
        ))}
      </div>

      {tab === "resources" ? (
        <div className="player-stats-cards">
          {RESOURCE_META.map((meta, k) => {
            const collected = last(series(["replayDatasetFoodCollected", "replayDatasetWoodCollected", "replayDatasetIronCollected"][k]));
            const stock = last(series(["replayDatasetFoodNow", "replayDatasetWoodNow", "replayDatasetIronNow"][k]));
            const peakStock = peak(series(["replayDatasetFoodNow", "replayDatasetWoodNow", "replayDatasetIronNow"][k]));
            return (
              <div key={k} className="stat-tile player-stats-tile">
                <span className="player-stats-tile-head">
                  <img className="icon icon-sm" src={meta.icon} alt={l(meta.zh, meta.en)} loading="lazy" />
                  {l(meta.zh, meta.en)}
                </span>
                <span className="player-stats-tile-rows">
                  <span className="player-stats-tile-row">
                    <span className="label-text">{l("已采集", "Collected")}</span>
                    <span className="cell-strong">{fmt(collected)}</span>
                  </span>
                  <span className="player-stats-tile-row">
                    <span className="label-text">{l("现有储备", "Current stock")}</span>
                    <span>{fmt(stock)}</span>
                  </span>
                  <span className="player-stats-tile-row">
                    <span className="label-text">{l("储备峰值", "Peak stock")}</span>
                    <span>{fmt(peakStock)}</span>
                  </span>
                </span>
              </div>
            );
          })}
          <div className="stat-tile player-stats-tile">
            <span className="player-stats-tile-head">
              <img className="icon icon-sm" src="/icons/worker.png" alt="" aria-hidden="true" loading="lazy" />
              {l("采集效率", "Gather efficiency")}
            </span>
            <span className="player-stats-tile-value">{Math.round(avg(series("replayDatasetGatherEfficiency")))}%</span>
          </div>
          <div className="stat-tile player-stats-tile">
            <span className="player-stats-tile-head">
              <img className="icon icon-sm" src="/icons/map.png" alt="" aria-hidden="true" loading="lazy" />
              {l("领土", "Territory")}
            </span>
            <span className="player-stats-tile-value">{fmt(last(series("replayDatasetLandPoints")))}</span>
          </div>
          <div className="stat-tile player-stats-tile">
            <span className="player-stats-tile-head">
              <img className="icon icon-sm" src="/icons/worker.png" alt="" aria-hidden="true" loading="lazy" />
              {l("村民", "Workers")}
            </span>
            <span className="player-stats-tile-value">{fmt(last(series("replayDatasetWorkerPoints")))}</span>
          </div>
        </div>
      ) : null}

      {tab === "units" ? (
        <UnitGroupSections groups={UNIT_GROUP_ORDER.filter((g) => createdGroups.has(g)).map((g) => [g, createdGroups.get(g)!] as const)} />
      ) : null}

      {tab === "defeated" ? (
        <div className="player-stats-defeated">
          <UnitGroupSections
            groups={UNIT_GROUP_ORDER.filter((g) => killedGroups.has(g)).map((g) => [g, killedGroups.get(g)!] as const)}
            title={l("歼灭的单位", "Units defeated")}
          />
          <UnitGroupSections
            groups={UNIT_GROUP_ORDER.filter((g) => lostGroups.has(g)).map((g) => [g, lostGroups.get(g)!] as const)}
            title={l("损失的单位", "Units lost")}
          />
        </div>
      ) : null}

      {tab === "buildings" && hasBuildings ? (
        <UnitGroupSections
          groups={[["buildings", createdGroups.get("buildings")!] as const]}
        />
      ) : null}

      {tab === "research" ? (
        <div className="table-scroll">
          <table className="units-table player-stats-research">
            <thead>
              <tr>
                <th scope="col">{l("研究", "Research")}</th>
                <th scope="col" className="cell-number">{l("完成时间", "Completed at")}</th>
              </tr>
            </thead>
            <tbody>
              {researches.map((research, index) => {
                const icon = researchIconUrl(research.id);
                return (
                  <tr key={`${research.id}-${index}`}>
                    <td>
                      <span className="value-pairs">
                        {icon ? (
                          <img
                            className="icon icon-md research-image"
                            src={icon}
                            alt=""
                            aria-hidden="true"
                            loading="lazy"
                          />
                        ) : null}
                        <span>{researchDisplayName(research.id, locale) || `#${research.id}`}</span>
                      </span>
                    </td>
                    <td className="cell-number cell-mono">{formatClock(research.takenTime)}</td>
                  </tr>
                );
              })}
              {researches.length === 0 ? (
                <tr>
                  <td colSpan={2} className="label-text">{l("本局没有完成研究。", "No research completed this game.")}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

/** Sections repliables par catégorie — tuiles rendues seulement si ouvertes. */
function UnitGroupSections({
  groups,
  title,
}: {
  groups: ReadonlyArray<
    readonly [UnitGroupId, ReadonlyArray<{ gameId: string; count: number }>]
  >;
  title?: string;
}) {
  const l = useBilingual();
  const { locale } = useI18n();
  const [open, setOpen] = useState<Set<UnitGroupId>>(new Set());
  const toggle = (group: UnitGroupId) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

  return (
    <div className="player-stats-groups">
      {title ? <h4 className="player-stats-groups-title">{title}</h4> : null}
      {groups.map(([group, units]) => {
        const total = units.reduce((a, u) => a + u.count, 0);
        const isOpen = open.has(group);
        return (
          <div key={group} className="player-stats-group" data-group={group}>
            <button
              type="button"
              className="player-stats-group-toggle"
              aria-expanded={isOpen}
              onClick={() => toggle(group)}
            >
              <ChevronDown className={`player-stats-chevron${isOpen ? " player-stats-chevron-open" : ""}`} aria-hidden="true" />
              <span>{l(GROUP_LABELS[group].zh, GROUP_LABELS[group].en)}</span>
              <span className="label-text player-stats-group-count">
                {l("${types} 种 · ${total} 个", "${types} types · ${total} units")
                  .replace("${types}", String(units.length))
                  .replace("${total}", String(total))}
              </span>
            </button>
            {isOpen ? (
              <div className="player-stats-unit-grid">
                {units.map((unit) => (
                  <span key={unit.gameId} className="player-stats-unit-tile">
                    <img
                      className="player-stats-unit-icon"
                      src={unitIconUrl(unit.gameId)}
                      alt={unitDisplayName(unit.gameId, locale)}
                      title={unitDisplayName(unit.gameId, locale)}
                      loading="lazy"
                    />
                    <span className="player-stats-unit-name" title={unitDisplayName(unit.gameId, locale)}>
                      {unitDisplayName(unit.gameId, locale)}
                    </span>
                    <span className="player-stats-unit-count cell-strong">{unit.count}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
