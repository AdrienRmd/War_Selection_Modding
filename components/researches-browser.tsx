"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { useI18n, useBilingual } from "@/components/i18n";
import {
  UPDATED_AT_URL,
  formatDuration,
  formatPublishedDate,
  formatStatNumber,
  localizedResourceLabel,
  localizedUnitName,
  researchDeepLink,
  resourceImageUrl,
  unitImageUrl,
  upgradeImageUrl,
  unitsIndex,
  type UnitIndexEntry,
} from "@/lib/units";
import {
  countAgeAdvances,
  countByType,
  countResearches,
  isAgeAdvance,
  isWonder,
  localizedResearchDescription,
  localizedResearchName,
  researchesIndex,
  researchImageUrl,
  researchTypeLabel,
  searchResearches,
  typesInUse,
  unitDeepLink,
  type DatasetMeta,
  type ResearchEntry,
  type ResearchProducer,
  type ResearchesIndex,
} from "@/lib/researches";
import type { CostPair, UnitRequirement } from "@/lib/units";

/** Filtre « Avancées d'âge » : valeur sentinel dédiée dans la barre de types. */
const AGE_FILTER = "age-advance";

export function ResearchesBrowser({
  index,
  initialGameId = null,
}: {
  index: ResearchesIndex;
  /** Lien profond /researches?research=<gameId> : fiche ouverte dès le SSR. */
  initialGameId?: number | null;
}) {
  const { locale, t } = useI18n();
  const l = useBilingual();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [selected, setSelected] = useState<ResearchEntry | null>(() =>
    initialGameId === null
      ? null
      : (index.researches.find((r) => r.gameId === initialGameId) ?? null),
  );
  const [meta, setMeta] = useState<DatasetMeta | null>(null);
  const [metaFailed, setMetaFailed] = useState(false);

  // Badge SB4 : version du dataset publiée (publishedAt + compte), jamais en dur.
  useEffect(() => {
    let alive = true;
    fetch(UPDATED_AT_URL)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        if (!alive) return;
        if (typeof data !== "object" || data === null) throw new Error("bad meta");
        setMeta(data as DatasetMeta);
      })
      .catch(() => alive && setMetaFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  // Lookup id → unité pour libeller les liens (nom localisé, repli id).
  const unitsById = useMemo(() => {
    const map = new Map<string, UnitIndexEntry>();
    for (const unit of unitsIndex.units) map.set(unit.id, unit);
    return map;
  }, []);
  const unitLabel = (unitId: string): string => {
    const unit = unitsById.get(unitId);
    return unit ? localizedUnitName(unit, locale) : unitId;
  };

  const perType = useMemo(() => countByType(index.researches), [index]);
  const ageAdvanceCount = useMemo(() => countAgeAdvances(index.researches), [index]);
  const totalResearches = meta?.counts?.researches ?? countResearches(index.researches);
  const activeTypes = useMemo(() => typesInUse(index), [index]);
  const filtered = useMemo(() => {
    const scoped =
      type === "all"
        ? index.researches
        : type === AGE_FILTER
          ? index.researches.filter(isAgeAdvance)
          : index.researches.filter((r) => r.type === type);
    return searchResearches(scoped, query);
  }, [index, type, query]);

  const badge = metaFailed ? (
    <span className="units-badge" data-badge="researches-updated">
      {l("数据版本暂时不可用", "Dataset version unavailable")}
    </span>
  ) : meta ? (
    <span className="units-badge" data-badge="researches-updated">
      {t(
        `数据更新于 ${formatPublishedDate(meta.publishedAt ?? "", locale)}，共 ${meta.counts?.researches ?? countResearches(index.researches)} 项研究`,
      )}
    </span>
  ) : (
    <span className="units-badge units-badge-loading" data-badge="researches-updated">
      {l("正在读取数据版本…", "Reading dataset version…")}
    </span>
  );

  return (
    <section className="units-section researches-section" aria-label={t("科技档案")}>
      <div className="section-head compact">
        <div>
          <h2>{t("科技档案")}</h2>
          <p className="caption">{t(`共 ${totalResearches} 项研究`)}</p>
        </div>
        {badge}
      </div>

      <div className="units-toolbar">
        <div className="search-input units-search">
          <Search size={16} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={l("搜索研究…", "Search researches…")}
            aria-label={l("搜索研究", "Search researches")}
          />
        </div>
        <div className="units-factions" role="group" aria-label={t("研究类型")}>
          <button
            type="button"
            className={type === "all" ? "active" : ""}
            aria-pressed={type === "all"}
            onClick={() => setType("all")}
          >
            {l("全部", "All")}
            <span className="units-faction-count">{countResearches(index.researches)}</span>
          </button>
          <button
            type="button"
            className={type === AGE_FILTER ? "active" : ""}
            aria-pressed={type === AGE_FILTER}
            onClick={() => setType(AGE_FILTER)}
          >
            {l("时代进阶", "Age advances")}
            <span className="units-faction-count">{ageAdvanceCount}</span>
          </button>
          {activeTypes.map((researchType) => {
            const label = researchTypeLabel(researchType.name);
            return (
              <button
                key={researchType.name}
                type="button"
                className={type === researchType.name ? "active" : ""}
                aria-pressed={type === researchType.name}
                onClick={() => setType(researchType.name)}
              >
                {l(label.zh, label.en)}
                <span className="units-faction-count">{perType[researchType.name] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="caption units-note">
        {l(
          "研究名称与描述来自游戏官方本地化；解锁与受影响单位来自游戏导出的单位需求数据；费用、时长与前置单位来自产出该研究的建筑（abilities 导出）。",
          "Research names and descriptions come from the official game localization; unlocked and affected units come from exported unit requirements; costs, durations and unit prerequisites come from the producing buildings (exported abilities).",
        )}
      </p>

      {filtered.length === 0 ? (
        <p className="notice">{l("没有找到对应研究。", "No matching researches found.")}</p>
      ) : (
        <ul className="units-grid">
          {filtered.map((research) => {
            const label = researchTypeLabel(research.type);
            return (
              <li key={research.gameId} className="units-card">
                <button
                  type="button"
                  onClick={() => setSelected(research)}
                  aria-label={localizedResearchName(research, locale)}
                >
                  <span className="units-thumb">
                    {research.image ? (
                      <img
                        src={researchImageUrl(research.image)}
                        alt={localizedResearchName(research, locale)}
                        loading="lazy"
                        width={96}
                        height={96}
                      />
                    ) : null}
                  </span>
                  <span className="units-card-name">
                    {localizedResearchName(research, locale)}
                  </span>
                  <span className="research-card-flags">
                    {isWonder(research) ? (
                      <span className="research-flag research-flag-wonder">{t("奇观")}</span>
                    ) : null}
                    {isAgeAdvance(research) ? (
                      <span className="research-flag research-flag-age">{t("时代进阶")}</span>
                    ) : null}
                  </span>
                  <code className="units-card-id">
                    #{research.gameId} · {l(label.zh, label.en)}
                  </code>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected ? (
        <div className="units-detail-backdrop" role="presentation" onClick={() => setSelected(null)}>
          <div
            className="units-detail"
            role="dialog"
            aria-modal="true"
            aria-label={localizedResearchName(selected, locale)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="units-detail-head">
              {selected.image ? (
                <img
                  className="units-detail-image"
                  src={researchImageUrl(selected.image)}
                  alt={localizedResearchName(selected, locale)}
                  width={96}
                  height={96}
                />
              ) : null}
              <div className="units-detail-title">
                <h3>{localizedResearchName(selected, locale)}</h3>
                <span className="research-card-flags">
                  {isWonder(selected) ? (
                    <span className="research-flag research-flag-wonder">{t("奇观")}</span>
                  ) : null}
                  {isAgeAdvance(selected) ? (
                    <span className="research-flag research-flag-age">{t("时代进阶")}</span>
                  ) : null}
                </span>
                <code>
                  {l("游戏编号", "Game ID")} #{selected.gameId}
                </code>
              </div>
              <button type="button" className="units-close" onClick={() => setSelected(null)}>
                <X size={16} />
                <span>{l("关闭", "Close")}</span>
              </button>
            </div>

            <ResearchDetail research={selected} unitLabel={unitLabel} unitsById={unitsById} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Puce d'unité cliquable (bâtiment producteur / prérequis), image + nom localisé. */
function UnitChip({
  unitId,
  unitsById,
}: {
  unitId: string;
  unitsById: Map<string, UnitIndexEntry>;
}) {
  const { locale } = useI18n();
  const unit = unitsById.get(unitId);
  return (
    <a className="research-chip" href={unitDeepLink(unitId)}>
      {unit?.image ? (
        <img src={unitImageUrl(unit.image)} alt="" width={18} height={18} loading="lazy" />
      ) : null}
      {unit ? localizedUnitName(unit, locale) : unitId}
    </a>
  );
}

/** Coût d'une voie : puces ressource (image + nom officiel + quantité localisée). */
function ResearchCostChips({ costs }: { costs: CostPair[] }) {
  const { locale } = useI18n();
  const visible = costs.filter(([, value]) => value > 0);
  if (visible.length === 0) return null;
  return (
    <span className="units-costs">
      {visible.map(([resourceId, value]) => {
        const name = localizedResourceLabel(unitsIndex, resourceId, locale);
        return (
          <span key={resourceId} className="units-cost">
            <img
              src={resourceImageUrl(resourceId)}
              alt=""
              width={18}
              height={18}
              loading="lazy"
            />
            {name ? <span>{name}</span> : null}
            <b>{formatStatNumber(value, locale)}</b>
          </span>
        );
      })}
    </span>
  );
}

/** Prérequis d'unités d'une voie : puces cliquables (× quantité min, ≤ si plafond). */
function ResearchRequirementChips({
  requirements,
  unitsById,
}: {
  requirements: UnitRequirement[];
  unitsById: Map<string, UnitIndexEntry>;
}) {
  const { locale } = useI18n();
  return (
    <span className="research-links">
      {requirements.map(([unitId, quantity, max]) => {
        const unit = unitsById.get(unitId);
        return (
          <a key={`${unitId}-${quantity}`} className="research-chip" href={unitDeepLink(unitId)}>
            {unit?.image ? (
              <img src={unitImageUrl(unit.image)} alt="" width={18} height={18} loading="lazy" />
            ) : null}
            {unit ? localizedUnitName(unit, locale) : unitId}
            <span className="units-qty">
              {max ? "≤" : "×"} {formatStatNumber(quantity, locale)}
            </span>
          </a>
        );
      })}
    </span>
  );
}

/** Recherches exigées par une voie : puces cliquables vers /researches. */
function RequiredResearchChips({
  gameIds,
  researchName,
}: {
  gameIds: number[];
  researchName: (gameId: number) => string;
}) {
  return (
    <span className="research-links">
      {gameIds.map((gameId) => (
        <a key={gameId} className="research-chip" href={researchDeepLink(gameId)}>
          <img src={upgradeImageUrl(gameId)} alt="" width={18} height={18} loading="lazy" />
          {researchName(gameId)}
        </a>
      ))}
    </span>
  );
}

function ResearchDetail({
  research,
  unitLabel,
  unitsById,
}: {
  research: ResearchEntry;
  unitLabel: (unitId: string) => string;
  unitsById: Map<string, UnitIndexEntry>;
}) {
  const l = useBilingual();
  const { locale } = useI18n();
  const typeLabel = researchTypeLabel(research.type);
  const description = localizedResearchDescription(research, locale);
  const unlocks = research.unlocks ?? [];
  const affects = research.affects ?? [];
  const producers: ResearchProducer[] = research.producers ?? [];
  // Libellé d'une recherche requise (nom localisé, repli #gameId).
  const researchName = (gameId: number): string => {
    const entry = researchesIndex.researches.find((r) => r.gameId === gameId);
    return entry ? localizedResearchName(entry, locale) : `#${gameId}`;
  };
  // Prérequis par voie : seules les voies qui en ont sont listées, chacune
  // accompagnée de son bâtiment source (données dérivées affichées telles
  // quelles — aucune fusion entre voies).
  const waysWithRequirements = producers.filter(
    (way) => (way.reqU?.length ?? 0) > 0 || (way.reqR?.length ?? 0) > 0,
  );

  return (
    <div className="units-fiche">
      <dl className="units-stats">
        <div>
          <dt>{l("类型", "Type")}</dt>
          <dd>{l(typeLabel.zh, typeLabel.en)}</dd>
        </div>
        <div>
          <dt>{l("游戏编号", "Game ID")}</dt>
          <dd>#{research.gameId}</dd>
        </div>
      </dl>

      {description ? (
        <div className="units-block">
          <h4>{l("描述", "Description")}</h4>
          <p className="research-description">{description}</p>
        </div>
      ) : null}

      {producers.length > 0 ? (
        <div className="units-block">
          <h4>{l("研究途径", "Researched via")}</h4>
          <p className="research-links">
            {producers.map((way) => (
              <UnitChip key={way.by} unitId={way.by} unitsById={unitsById} />
            ))}
          </p>
        </div>
      ) : null}

      {producers.length > 0 ? (
        <div className="units-block">
          <h4>{l("研究费用与时长", "Cost & duration")}</h4>
          {producers.length > 1 ? (
            <p className="units-subtitle">{l("每行对应一个产出建筑。", "Each row is one producing building.")}</p>
          ) : null}
          <ul className="research-ways">
            {producers.map((way) => (
              <li key={way.by}>
                <p className="units-source-line">
                  <UnitChip unitId={way.by} unitsById={unitsById} />
                  <ResearchCostChips costs={way.cost} />
                </p>
                {way.t !== undefined ? (
                  <p className="units-weapon-meta">
                    {l("时长", "Duration")} {formatDuration(way.t, locale)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {waysWithRequirements.length > 0 ? (
        <div className="units-block">
          <h4>{l("前置条件", "Prerequisites")}</h4>
          <ul className="research-ways">
            {waysWithRequirements.map((way) => (
              <li key={way.by}>
                <p className="units-source-line">
                  <UnitChip unitId={way.by} unitsById={unitsById} />
                </p>
                {way.reqU && way.reqU.length > 0 ? (
                  <ResearchRequirementChips requirements={way.reqU} unitsById={unitsById} />
                ) : null}
                {way.reqR && way.reqR.length > 0 ? (
                  <p className="units-source-line">
                    <span className="units-cost-label">{l("前置研究", "Required research")}</span>
                    <RequiredResearchChips gameIds={way.reqR} researchName={researchName} />
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {unlocks.length > 0 ? (
        <div className="units-block">
          <h4>{l("解锁单位", "Unlocks units")}</h4>
          <p className="research-links">
            {unlocks.map((unitId) => (
              <a key={`u-${unitId}`} className="research-chip" href={unitDeepLink(unitId)}>
                {unitLabel(unitId)}
              </a>
            ))}
          </p>
        </div>
      ) : null}

      {affects.length > 0 ? (
        <div className="units-block">
          <h4>{l("受影响单位", "Affected units")}</h4>
          <p className="research-links">
            {affects.map((unitId) => (
              <a key={`a-${unitId}`} className="research-chip" href={unitDeepLink(unitId)}>
                {unitLabel(unitId)}
              </a>
            ))}
          </p>
        </div>
      ) : null}

      <details className="units-raw-details">
        <summary>{l("原始导出字段", "Raw export fields")}</summary>
        <code>{`<*upgrade${research.gameId}#0> · type=${research.type}`}</code>
      </details>
    </div>
  );
}
