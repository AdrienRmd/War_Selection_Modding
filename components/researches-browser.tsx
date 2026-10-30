"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { useI18n, useBilingual } from "@/components/i18n";
import { UPDATED_AT_URL, formatPublishedDate, localizedUnitName, unitsIndex } from "@/lib/units";
import {
  countByType,
  countResearches,
  localizedResearchDescription,
  localizedResearchName,
  researchImageUrl,
  researchTypeLabel,
  searchResearches,
  typesInUse,
  unitDeepLink,
  type DatasetMeta,
  type ResearchEntry,
  type ResearchesIndex,
} from "@/lib/researches";

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
    const map = new Map<string, (typeof unitsIndex.units)[number]>();
    for (const unit of unitsIndex.units) map.set(unit.id, unit);
    return map;
  }, []);
  const unitLabel = (unitId: string): string => {
    const unit = unitsById.get(unitId);
    return unit ? localizedUnitName(unit, locale) : unitId;
  };

  const perType = useMemo(() => countByType(index.researches), [index]);
  const totalResearches = meta?.counts?.researches ?? countResearches(index.researches);
  const activeTypes = useMemo(() => typesInUse(index), [index]);
  const filtered = useMemo(() => {
    const scoped =
      type === "all" ? index.researches : index.researches.filter((r) => r.type === type);
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
          "研究名称与描述来自游戏官方本地化；解锁与受影响单位来自游戏导出的单位需求数据。数据集不含研究费用与时长。",
          "Research names and descriptions come from the official game localization; unlocked and affected units come from the exported unit requirements. The dataset does not include research costs or durations.",
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
                <code>
                  {l("游戏编号", "Game ID")} #{selected.gameId}
                </code>
              </div>
              <button type="button" className="units-close" onClick={() => setSelected(null)}>
                <X size={16} />
                <span>{l("关闭", "Close")}</span>
              </button>
            </div>

            <ResearchDetail research={selected} unitLabel={unitLabel} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ResearchDetail({
  research,
  unitLabel,
}: {
  research: ResearchEntry;
  unitLabel: (unitId: string) => string;
}) {
  const l = useBilingual();
  const { locale } = useI18n();
  const typeLabel = researchTypeLabel(research.type);
  const description = localizedResearchDescription(research, locale);
  const unlocks = research.unlocks ?? [];
  const affects = research.affects ?? [];

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
