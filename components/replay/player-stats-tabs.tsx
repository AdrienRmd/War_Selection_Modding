"use client";
/** « Player statistics » — détail joueur en onglets (reproduction de la
 *  structure ws-stats.pl : Resources / Units / Defeated / Buildings /
 *  Research, icônes lucide équivalentes à leurs material icons).
 *  Contenu :
 *  - Resources : cartes denses (récolté par ressource, stock final + pic,
 *    efficacité de récolte, territoire, points de villageois) ;
 *  - Units : sections REPLIABLES par catégorie réelle du dataset
 *    (Travailleurs / Mêlée / À distance / Siège / Cavalerie / Blindés /
 *    Aviation / Marine / Faune / Autres — cf. lib/replay/unit-groups.ts),
 *    LIGNE par unité : icône du jeu (/wus-data), nom localisé, nombre
 *    produit (mission 06/11 : « Travailleur 33, Archer 52… », image + nom
 *    + count, PAS de graphique) ;
 *  - Defeated : unités tuées (lignes non fusionnées : la référence ws-stats
 *    liste séparément la même unité tuée chez des factions différentes) et
 *    unités perdues (mêmes lignes) ;
 *  - Buildings : production de bâtiments (Éco déplié en premier, comme la
 *    référence) + bâtiments détruits (tués) par sous-catégorie (onglet
 *    omis si aucun) ;
 *  - Research : liste icône + nom localisé + horloge MM:SS.
 *  Rendu paresseux : seuls l'onglet actif et les sections ouvertes montent
 *  leurs lignes ; toutes les images sont loading="lazy". */
import { useMemo, useState } from "react";
import { Coins, Users, Skull, Home, FlaskConical, ChevronDown } from "lucide-react";
import { useBilingual, useI18n } from "@/components/i18n";
import { playerSeries } from "@/lib/replay/analysis";
import type { Player, PlayerUnitStat, ReplayParseSuccess } from "@/lib/replay/structure";
import {
  BUILDING_SUBGROUP_ORDER,
  UNIT_GROUP_ORDER,
  groupBuildingCounts,
  groupUnitCounts,
  groupUnitRows,
  type BuildingSubgroupId,
  type UnitGroupId,
} from "@/lib/replay/unit-groups";
import {
  compactNumber,
  researchDisplayName,
  researchIconUrl,
  unitDisplayName,
  unitIconUrl,
} from "@/lib/replay/wsva-view";
import { formatMinutesSeconds } from "@/lib/replay/population";

const RESOURCE_META = [
  { icon: "/wus-data/content/images/resource/0.png", zh: "食物", en: "Food" },
  { icon: "/wus-data/content/images/resource/1.png", zh: "木材", en: "Wood" },
  { icon: "/wus-data/content/images/resource/2.png", zh: "铁矿", en: "Iron" },
] as const;

/** Libellés bilingues des groupes — FR via le dictionnaire (clé zh). */
const GROUP_LABELS: Record<UnitGroupId, { zh: string; en: string }> = {
  buildings: { zh: "建筑", en: "Buildings" },
  eco: { zh: "劳作单位", en: "Worker units" },
  melee: { zh: "近战单位", en: "Melee" },
  ranged: { zh: "远程单位", en: "Ranged" },
  siege: { zh: "攻城单位", en: "Siege" },
  cavalry: { zh: "骑兵单位", en: "Cavalry" },
  vehicles: { zh: "装甲单位", en: "Vehicles" },
  air: { zh: "战机单位", en: "Warplanes" },
  fleet: { zh: "战舰单位", en: "Warships" },
  fauna: { zh: "野生生物", en: "Other · wildlife" },
  other: { zh: "其余单位", en: "Other" },
};

/** Sous-sections de l'onglet Buildings — même découpe que ws-stats.pl :
 *  Économie (dépliée en premier) / Population / Défense / Militaire /
 *  Recherche / Autre. */
const BUILDING_SUBGROUP_LABELS: Record<BuildingSubgroupId, { zh: string; en: string }> = {
  eco: { zh: "经济类建筑", en: "Economy" },
  population: { zh: "人口建筑", en: "Population" },
  defense: { zh: "防御类建筑", en: "Defense" },
  military: { zh: "军事建筑", en: "Military" },
  research: { zh: "研究建筑", en: "Research" },
  other: { zh: "其他建筑", en: "Other" },
};

/** Agrège les compteurs d'unités d'un map du parser (somme par gameId). */
function countUnits(map?: Map<string, PlayerUnitStat[]>): Map<string, number> {
  const out = new Map<string, number>();
  for (const stats of map?.values() ?? []) {
    for (const stat of stats) {
      out.set(stat.id, (out.get(stat.id) ?? 0) + stat.number);
    }
  }
  return out;
}

/** Lignes d'unités tuées SANS fusion : une ligne par (faction victime,
 *  gameId) — la référence ws-stats ne fusionne pas les mêmes unités tuées
 *  chez des factions différentes. Repli fusionné si la ventilation par
 *  faction est absente (anciens replays). */
function killedRows(
  player: Player,
): Array<readonly [rowKey: string, gameId: string, count: number]> {
  const rows: Array<readonly [string, string, number]> = [];
  if (player.unitsKilledByFaction && player.unitsKilledByFaction.length > 0) {
    for (const [entryIndex, entry] of player.unitsKilledByFaction.entries()) {
      for (const [gameId, count] of countUnits(entry.units)) {
        if (count > 0) rows.push([`${entryIndex}:${gameId}`, gameId, count]);
      }
    }
    if (rows.length > 0) return rows;
  }
  for (const [gameId, count] of countUnits(player.unitsKilledPlain)) {
    if (count > 0) rows.push([gameId, gameId, count]);
  }
  return rows;
}

type TabId = "resources" | "units" | "defeated" | "buildings" | "research";

const TABS: Array<{ id: TabId; icon: typeof Coins; zh: string; en: string }> = [
  { id: "resources", icon: Coins, zh: "资源", en: "Resources" },
  { id: "units", icon: Users, zh: "生产单位", en: "Units built" },
  { id: "defeated", icon: Skull, zh: "击杀单位", en: "Units killed" },
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
  const killed = useMemo(() => killedRows(player), [player]);
  const killedGroups = useMemo(() => groupUnitRows(killed), [killed]);
  const lost = useMemo(() => {
    const merged = new Map<string, number>();
    for (const [gameId, count] of countUnits(player.unitsLostPlain)) {
      merged.set(gameId, (merged.get(gameId) ?? 0) + count);
    }
    for (const entry of player.unitsLostByFaction ?? []) {
      for (const [gameId, count] of countUnits(entry.units)) {
        merged.set(gameId, (merged.get(gameId) ?? 0) + count);
      }
    }
    return merged;
  }, [player]);
  const lostGroups = useMemo(
    () => groupUnitCounts([...lost.entries()].filter(([, n]) => n > 0)),
    [lost],
  );
  const researches = useMemo(
    () => [...(player.researches ?? [])].sort((a, b) => a.takenTime - b.takenTime),
    [player],
  );

  const buildingCounts = useMemo(
    () => [...(createdGroups.get("buildings") ?? [])].map((u) => [u.gameId, u.count] as [string, number]),
    [createdGroups],
  );
  const buildingSubgroups = useMemo(() => groupBuildingCounts(buildingCounts), [buildingCounts]);
  const destroyedBuildingCounts = useMemo(
    () =>
      [...(killedGroups.get("buildings") ?? [])].map(
        (u) => [u.gameId, u.count] as [string, number],
      ),
    [killedGroups],
  );
  const destroyedBuildingSubgroups = useMemo(
    () => groupBuildingCounts(destroyedBuildingCounts),
    [destroyedBuildingCounts],
  );
  const hasBuildings = (createdGroups.get("buildings")?.length ?? 0) > 0;
  const visibleTabs = TABS.filter(
    (t) => t.id !== "buildings" || hasBuildings || destroyedBuildingCounts.length > 0,
  );

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
        <UnitGroupSections
          groups={UNIT_GROUP_ORDER.filter((g) => createdGroups.has(g)).map((g) => [g, createdGroups.get(g)!] as const)}
          labels={GROUP_LABELS}
        />
      ) : null}

      {tab === "defeated" ? (
        <div className="player-stats-defeated">
          <UnitGroupSections
            groups={UNIT_GROUP_ORDER.filter((g) => killedGroups.has(g)).map((g) => [g, killedGroups.get(g)!] as const)}
            labels={GROUP_LABELS}
            title={l("歼灭的单位", "Units defeated")}
          />
          <UnitGroupSections
            groups={UNIT_GROUP_ORDER.filter((g) => lostGroups.has(g)).map((g) => [g, lostGroups.get(g)!] as const)}
            labels={GROUP_LABELS}
            title={l("损失的单位", "Units lost")}
          />
        </div>
      ) : null}

      {tab === "buildings" && (hasBuildings || destroyedBuildingCounts.length > 0) ? (
        <div className="player-stats-defeated">
          {hasBuildings ? (
            <UnitGroupSections
              groups={BUILDING_SUBGROUP_ORDER.filter((g) => buildingSubgroups.has(g)).map(
                (g) => [g, buildingSubgroups.get(g)!] as const,
              )}
              labels={BUILDING_SUBGROUP_LABELS}
              title={l("建造的建筑", "Buildings built")}
              defaultOpenFirst
            />
          ) : null}
          {destroyedBuildingCounts.length > 0 ? (
            <UnitGroupSections
              groups={BUILDING_SUBGROUP_ORDER.filter((g) => destroyedBuildingSubgroups.has(g)).map(
                (g) => [g, destroyedBuildingSubgroups.get(g)!] as const,
              )}
              labels={BUILDING_SUBGROUP_LABELS}
              title={l("摧毁的建筑", "Buildings destroyed")}
            />
          ) : null}
        </div>
      ) : null}

      {tab === "research" ? (
        <ul className="player-stats-rows player-stats-research-rows">
          {researches.map((research, index) => {
            const icon = researchIconUrl(research.id);
            return (
              <li className="player-stats-unit-row" key={`${research.id}-${index}`}>
                <img
                  className="player-stats-unit-icon"
                  src={icon || "/icons/sparkles.png"}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                />
                <span className="player-stats-unit-name">
                  {researchDisplayName(research.id, locale) || `#${research.id}`}
                </span>
                <span className="player-stats-unit-count cell-strong cell-mono">
                  {formatMinutesSeconds(research.takenTime / 1000)}
                </span>
              </li>
            );
          })}
          {researches.length === 0 ? (
            <li className="label-text">{l("本局没有完成研究。", "No research completed this game.")}</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

/** Sections repliables par catégorie — LIGNES rendues seulement si ouvertes
 *  (icône d'expansion chevron, équivalent lucide du expand_more de la
 *  référence ; groupe déplié : Économie des bâtiments, comme ws-stats).
 *  Générique sur la clé (groupe d'unités OU sous-catégorie de bâtiment). */
function UnitGroupSections({
  groups,
  labels,
  title,
  defaultOpenFirst = false,
}: {
  groups: ReadonlyArray<
    readonly [string, ReadonlyArray<{ gameId: string; count: number }>]
  >;
  labels: Record<string, { zh: string; en: string }>;
  title?: string;
  /** Déplier le premier groupe par défaut (Éco des bâtiments, référence). */
  defaultOpenFirst?: boolean;
}) {
  const l = useBilingual();
  const { locale } = useI18n();
  const [open, setOpen] = useState<Set<string>>(() => (defaultOpenFirst && groups.length > 0 ? new Set([groups[0][0]]) : new Set()));
  const toggle = (group: string) =>
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
        const label = labels[group] ?? { zh: group, en: group };
        return (
          <div key={group} className="player-stats-group" data-group={group}>
            <button
              type="button"
              className="player-stats-group-toggle"
              aria-expanded={isOpen}
              onClick={() => toggle(group)}
            >
              <ChevronDown className={`player-stats-chevron${isOpen ? " player-stats-chevron-open" : ""}`} aria-hidden="true" />
              <span>{l(label.zh, label.en)}</span>
              <span className="label-text player-stats-group-count">
                {l("${types} 种 · ${total} 个", "${types} types · ${total} units")
                  .replace("${types}", String(units.length))
                  .replace("${total}", String(total))}
              </span>
            </button>
            {isOpen ? (
              <ul className="player-stats-rows">
                {units.map((unit) => (
                  <li
                    className="player-stats-unit-row"
                    key={"rowKey" in unit ? (unit.rowKey as string) : unit.gameId}
                  >
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
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
