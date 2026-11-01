"use client";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { useI18n, useBilingual } from "@/components/i18n";
import { UpdatedDatasetBadge, useDatasetMeta } from "@/components/dataset-badge";
import {
  formatDuration,
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
  countResearches,
  isAgeAdvance,
  isWonder,
  localizedResearchDescription,
  localizedResearchName,
  researchesIndex,
  researchImageUrl,
  researchTypeLabel,
  searchResearches,
  unitDeepLink,
  AGE_ADVANCE_FILTER,
  countInFamily,
  countInSubFilter,
  researchFamilies,
  type ResearchEntry,
  type ResearchFamilyId,
  type ResearchProducer,
  type ResearchesIndex,
} from "@/lib/researches";
import type { CostPair, UnitRequirement } from "@/lib/units";

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
  // Filtres à deux niveaux : famille (Tout / Âge / Militaire / Économie &
  // Empire / Merveille) puis sous-type dans la famille active (optionnel).
  const [family, setFamily] = useState<ResearchFamilyId>("all");
  const [sub, setSub] = useState<string>("all");
  const [selected, setSelected] = useState<ResearchEntry | null>(() =>
    initialGameId === null
      ? null
      : (index.researches.find((r) => r.gameId === initialGameId) ?? null),
  );
  // Badge SB4 : version du dataset publiée (publishedAt + compte), jamais en dur.
  const { meta, failed: metaFailed } = useDatasetMeta();

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

  const activeFamily = useMemo(
    () => researchFamilies.find((f) => f.id === family) ?? researchFamilies[0],
    [family],
  );
  const totalResearches = meta?.counts?.researches ?? countResearches(index.researches);
  const filtered = useMemo(() => {
    const scoped = index.researches.filter(activeFamily.match);
    const narrowed =
      sub === "all"
        ? scoped
        : scoped.filter((r) => (sub === AGE_ADVANCE_FILTER ? isAgeAdvance(r) : r.type === sub));
    return searchResearches(narrowed, query);
  }, [index, activeFamily, sub, query]);

  const badge = (
    <UpdatedDatasetBadge
      testId="researches-updated"
      meta={meta}
      failed={metaFailed}
      count={meta?.counts?.researches ?? countResearches(index.researches)}
      noun="项研究"
    />
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
        <div className="units-factions units-families" role="group" aria-label={t("研究类型")}>
          {researchFamilies.map((f) => (
            <button
              key={f.id}
              type="button"
              className={family === f.id ? "active" : ""}
              aria-pressed={family === f.id}
              onClick={() => {
                setFamily(f.id);
                setSub("all");
              }}
            >
              {l(f.zh, f.en)}
              <span className="units-faction-count">{countInFamily(index.researches, f.id)}</span>
            </button>
          ))}
        </div>
        {activeFamily.sub.length > 1 ? (
          <div
            className="units-factions units-subfamilies"
            role="group"
            aria-label={t("研究子类型")}
          >
            <button
              type="button"
              className={sub === "all" ? "active" : ""}
              aria-pressed={sub === "all"}
              onClick={() => setSub("all")}
            >
              {l("全部", "All")}
              <span className="units-faction-count">
                {countInFamily(index.researches, activeFamily.id)}
              </span>
            </button>
            {activeFamily.sub.map((s) => (
              <button
                key={s.id}
                type="button"
                className={sub === s.id ? "active" : ""}
                aria-pressed={sub === s.id}
                onClick={() => setSub(s.id)}
              >
                {l(s.zh, s.en)}
                <span className="units-faction-count">
                  {countInSubFilter(index.researches, activeFamily.id, s.id)}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <p className="caption units-note">
        {l(
          "研究名称与描述来自游戏官方本地化；解锁与受影响单位来自游戏导出的单位需求数据；费用、时长与前置单位来自产出该研究的建筑（abilities 导出）。",
          "Research names and descriptions come from the official game localization; unlocked and affected units come from exported unit requirements; costs, durations and unit prerequisites come from the producing buildings (exported abilities).",
        )}
      </p>

      {filtered.length === 0 ? (
        <div className="units-empty">
          <span className="units-empty-art" aria-hidden="true">
            <img
              src={researchImageUrl(index.researches[0]?.image ?? "upgrade/9.png")}
              alt=""
              width={104}
              height={104}
              loading="lazy"
            />
          </span>
          <h3>{l("没有找到对应研究。", "No matching researches found.")}</h3>
          <p>
            {l(
              "换个名称或类型试试，或清除筛选查看全部研究。",
              "Try another name or type, or clear the filters to see every research.",
            )}
          </p>
          <button
            type="button"
            className="button"
            onClick={() => {
              setQuery("");
              setFamily("all");
              setSub("all");
            }}
          >
            {l("清除筛选", "Clear filters")}
          </button>
        </div>
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
                        width={160}
                        height={160}
                      />
                    ) : null}
                  </span>
                  <span className="units-card-name">{localizedResearchName(research, locale)}</span>
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
        <div
          className="units-detail-backdrop"
          role="presentation"
          onClick={() => setSelected(null)}
        >
          <div
            className="units-detail archive-corners"
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
                  width={128}
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
                {/* Field Archive V2 : tampon « DOSSIER N° » avec l'index
                    réel de la recherche (gameId du jeu). */}
                <span className="archive-stamp">{t(`档案编号 ${selected.gameId}`)}</span>
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
            <img src={resourceImageUrl(resourceId)} alt="" width={18} height={18} loading="lazy" />
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
            <p className="units-subtitle">
              {l("每行对应一个产出建筑。", "Each row is one producing building.")}
            </p>
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
