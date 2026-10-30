"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { useI18n, useBilingual } from "@/components/i18n";
import {
  UPDATED_AT_URL,
  categoryLabel,
  countByGroup,
  countUnits,
  damageTypeLabel,
  formatDuration,
  formatPublishedDate,
  formatStatNumber,
  localizedGroupLabel,
  localizedNationLabel,
  localizedResourceLabel,
  localizedTagLabel,
  localizedUnitDescription,
  localizedUnitName,
  researchDeepLink,
  resourceImageUrl,
  searchUnits,
  shortTag,
  sourceTypeLabel,
  unitDeepLink,
  unitGroupKey,
  unitGroups,
  unitImageUrl,
  upgradeImageUrl,
  weaponTypeLabel,
  type CostPair,
  type DatasetMeta,
  type UnitGroup,
  type UnitIndexEntry,
  type UnitRequirement,
  type UnitsIndex,
  type WorkEntity,
} from "@/lib/units";
import { localizedResearchName, researchesIndex } from "@/lib/researches";

export function UnitsBrowser({
  index,
  initialUnitId,
}: {
  index: UnitsIndex;
  /** Lien profond /units?unit=<id> : fiche rendue côté serveur dès le HTML initial. */
  initialUnitId?: string;
}) {
  const { locale, t } = useI18n();
  const l = useBilingual();
  const unitName = (unit: UnitIndexEntry) => localizedUnitName(unit, locale);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    initialUnitId && index.units.some((u) => u.id === initialUnitId) ? initialUnitId : null,
  );
  const [meta, setMeta] = useState<DatasetMeta | null>(null);
  const [metaFailed, setMetaFailed] = useState(false);

  // Badge SB6 : version du dataset publiée (publishedAt + compte), jamais en dur.
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

  const unitsById = useMemo(() => {
    const map = new Map<string, UnitIndexEntry>();
    for (const unit of index.units) map.set(unit.id, unit);
    return map;
  }, [index]);
  const groups = useMemo(() => unitGroups(index), [index]);
  const perGroup = useMemo(() => countByGroup(index.units), [index]);
  const selected = selectedId ? (unitsById.get(selectedId) ?? null) : null;

  const filtered = useMemo(() => {
    const scoped =
      group === "all" ? index.units : index.units.filter((u) => unitGroupKey(u) === group);
    return searchUnits(scoped, query);
  }, [index, group, query]);

  const badge = metaFailed ? (
    <span className="units-badge" data-badge="units-updated">
      {l("数据版本暂时不可用", "Dataset version unavailable")}
    </span>
  ) : meta ? (
    <span className="units-badge" data-badge="units-updated">
      {t(
        `数据更新于 ${formatPublishedDate(meta.publishedAt ?? "", locale)}，共 ${meta.counts?.units ?? countUnits(index.units)} 个单位`,
      )}
    </span>
  ) : (
    <span className="units-badge units-badge-loading" data-badge="units-updated">
      {l("正在读取数据版本…", "Reading dataset version…")}
    </span>
  );

  return (
    <section className="units-section" aria-label={t("单位档案")}>
      <div className="section-head compact">
        <div>
          <h2>{t("单位档案")}</h2>
          <p className="caption">{t(`共 ${countUnits(index.units)} 个单位`)}</p>
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
            placeholder={l("输入单位 ID 或名称…", "Enter a unit ID or name…")}
            aria-label={l("搜索单位", "Search units")}
          />
        </div>
        <div className="units-factions" role="group" aria-label={t("单位分类")}>
          <button
            type="button"
            className={group === "all" ? "active" : ""}
            aria-pressed={group === "all"}
            onClick={() => setGroup("all")}
          >
            {l("全部", "All")}
            <span className="units-faction-count">{countUnits(index.units)}</span>
          </button>
          {groups.map((g: UnitGroup) => (
            <button
              key={g.key}
              type="button"
              className={group === g.key ? "active" : ""}
              aria-pressed={group === g.key}
              onClick={() => setGroup(g.key)}
            >
              {localizedGroupLabel(index, g, locale) ?? l("其他单位", "Other units")}
              <span className="units-faction-count">{perGroup[g.key] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="caption units-note">
        {l(
          "名称、阵营（时代）与描述来自游戏官方本地化（中文 / English / Français），个别缺失时回退为原始键；数值与图片来自公开数据集。",
          "Names, factions (ages) and descriptions come from the official game localization (Chinese / English / French) with a fallback to raw export keys; stats and images come from the public dataset.",
        )}
      </p>

      {filtered.length === 0 ? (
        <p className="notice">{l("没有找到对应单位。", "No matching units found.")}</p>
      ) : (
        <ul className="units-grid">
          {filtered.map((unit) => (
            <li key={unit.id} className="units-card">
              <button
                type="button"
                onClick={() => setSelectedId(unit.id)}
                aria-label={unitName(unit)}
              >
                <span className="units-thumb">
                  {unit.image ? (
                    <img
                      src={unitImageUrl(unit.image)}
                      alt={unitName(unit)}
                      loading="lazy"
                      width={96}
                      height={96}
                    />
                  ) : null}
                </span>
                <span className="units-card-name">{unitName(unit)}</span>
                <code className="units-card-id">{unit.id}</code>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <div
          className="units-detail-backdrop"
          role="presentation"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="units-detail"
            role="dialog"
            aria-modal="true"
            aria-label={unitName(selected)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="units-detail-head">
              {selected.image ? (
                <img
                  className="units-detail-image"
                  src={unitImageUrl(selected.image)}
                  alt={unitName(selected)}
                  width={96}
                  height={96}
                />
              ) : null}
              <div className="units-detail-title">
                <h3>{unitName(selected)}</h3>
                <UnitSubtitle unit={selected} index={index} />
                <code>{selected.id}</code>
              </div>
              <button type="button" className="units-close" onClick={() => setSelectedId(null)}>
                <X size={16} />
                <span>{l("关闭", "Close")}</span>
              </button>
            </div>
            <UnitFicheBody unit={selected} index={index} unitsById={unitsById} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Sous-titre de l'en-tête : nation/âge officiel localisé · catégorie. */
function UnitSubtitle({ unit, index }: { unit: UnitIndexEntry; index: UnitsIndex }) {
  const { locale } = useI18n();
  const l = useBilingual();
  const nation =
    unit.nationId !== undefined
      ? localizedNationLabel(index, unit.nationId, locale)
      : undefined;
  const category = unit.s?.category ? categoryLabel(unit.s.category) : undefined;
  if (!nation && !category) return null;
  return (
    <p className="units-subtitle">
      {nation ?? ""}
      {nation && category ? " · " : ""}
      {category ? l(category.zh, category.en) : ""}
    </p>
  );
}

function UnitFicheBody({
  unit,
  index,
  unitsById,
}: {
  unit: UnitIndexEntry;
  index: UnitsIndex;
  unitsById: Map<string, UnitIndexEntry>;
}) {
  const { locale } = useI18n();
  const l = useBilingual();
  const s = unit.s;

  // Recherches liées : index inverse de lib/researches-index.json (production
  // requise / effets gameplay) + programmes officiels (applicableResearches).
  const researchesById = useMemo(() => {
    const map = new Map<number, (typeof researchesIndex.researches)[number]>();
    for (const research of researchesIndex.researches) map.set(research.gameId, research);
    return map;
  }, []);
  const inverse = useMemo(() => {
    const requiredBy = new Map<string, number[]>();
    const affectedBy = new Map<string, number[]>();
    for (const research of researchesIndex.researches) {
      for (const target of research.unlocks ?? []) {
        requiredBy.set(target, [...(requiredBy.get(target) ?? []), research.gameId]);
      }
      for (const target of research.affects ?? []) {
        affectedBy.set(target, [...(affectedBy.get(target) ?? []), research.gameId]);
      }
    }
    return { requiredBy, affectedBy };
  }, []);
  const requiredResearch = [...new Set(inverse.requiredBy.get(unit.id) ?? [])].sort((a, b) => a - b);
  const affectedResearch = [...new Set(inverse.affectedBy.get(unit.id) ?? [])].sort((a, b) => a - b);
  const linkedPrograms = s?.researchIds ?? [];
  const researchLabel = (gameId: number): string => {
    const research = researchesById.get(gameId);
    return research ? localizedResearchName(research, locale) : `#${gameId}`;
  };

  const description = localizedUnitDescription(unit, locale);

  // Caractéristiques : chaque ligne n'apparaît que si la donnée existe.
  const stats: [string, string][] = [];
  const pushNumber = (label: string, value: number | undefined, suffix = "") => {
    if (value === undefined) return;
    stats.push([label, `${formatStatNumber(value, locale)}${suffix}`]);
  };
  pushNumber(l("血量", "Health"), s?.health);
  pushNumber(l("视野", "View range"), s?.viewRange);
  pushNumber(l("体型", "Size"), s?.size);
  pushNumber(l("威胁", "Threat"), s?.threat);
  pushNumber(l("储存加成", "Storage bonus"), s?.storageMultiplier, "%");
  pushNumber(l("击杀价值", "Kill value"), s?.killValue);
  if (s?.controllable !== undefined) {
    stats.push([l("可控", "Controllable"), s.controllable ? l("是", "Yes") : l("否", "No")]);
  }

  const armorZonal = s?.armorZonal ?? [];
  const armorTyped = s?.armorTyped ?? [];
  const sources = s?.sources ?? [];
  const build = s?.build;
  const works = s?.works ?? [];
  const weapons = s?.weapons ?? [];
  const tags = (s?.tags ?? []).filter((tag) => tag !== "genericUnitTag");

  return (
    <div className="units-fiche">
      {description ? (
        <div className="units-block units-description">
          <p className="research-description">{description}</p>
        </div>
      ) : null}

      {stats.length > 0 ? (
        <div className="units-block">
          <h4>{l("基础特征", "Characteristics")}</h4>
          <dl className="units-stats">
            {stats.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {armorZonal.length > 0 || armorTyped.length > 0 ? (
        <div className="units-block">
          <h4>{l("护甲", "Armor")}</h4>
          {armorZonal.length > 0 ? (
            <p className="units-armor">
              {armorZonal.map(([value, probability], i) => (
                <span key={`z${i}`}>
                  {l("区域护甲", "Zonal armor")} {formatStatNumber(value, locale)} × {probability}%
                </span>
              ))}
            </p>
          ) : null}
          {armorTyped.length > 0 ? (
            <p className="units-armor">
              {armorTyped.map(([type, probability], i) => {
                const label = damageTypeLabel(type);
                return (
                  <span key={`t${i}`}>
                    {label ? l(label.zh, label.en) : localizedTagLabel(index, type, locale)} ×{" "}
                    {probability}%
                  </span>
                );
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      {sources.length > 0 || build ? (
        <div className="units-block">
          <h4>{l("建造", "Construction")}</h4>
          <ul>
            {sources.map((source, i) => {
              const type = sourceTypeLabel(source.type);
              const builder = unitsById.get(source.by);
              return (
                <li key={i}>
                  <p className="units-source-line">
                    {type ? <span className="units-cost-label">{l(type.zh, type.en)}</span> : null}
                    <a className="research-chip" href={unitDeepLink(source.by)}>
                      {builder?.image ? (
                        <img
                          src={unitImageUrl(builder.image)}
                          alt=""
                          width={20}
                          height={20}
                          loading="lazy"
                        />
                      ) : null}
                      {builder ? localizedUnitName(builder, locale) : source.by}
                    </a>
                  </p>
                  <CostChips index={index} costs={source.cost} />
                  <RequirementChips requirements={source.reqU} unitsById={unitsById} />
                  <ResearchChips
                    gameIds={source.reqR}
                    label={researchLabel}
                    title={l("前置研究", "Required research")}
                  />
                </li>
              );
            })}
            {build ? (
              <li>
                <CostLine label={l("初始成本", "Initial cost")}>
                  <CostChips index={index} costs={build.init} />
                </CostLine>
                <CostLine label={l("完整成本", "Full cost")}>
                  <CostChips index={index} costs={build.full} />
                </CostLine>
                <CostLine label={l("修缮成本", "Repair cost")}>
                  <CostChips index={index} costs={build.heal} />
                </CostLine>
                <RequirementChips requirements={build.reqU} unitsById={unitsById} />
                <ResearchChips
                  gameIds={build.reqR}
                  label={researchLabel}
                  title={l("前置研究", "Required research")}
                />
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {works.length > 0 ? (
        <div className="units-block">
          <h4>{l("工作项目", "Works")}</h4>
          <ul>
            {works.map((work, i) => (
              <li key={i}>
                <p className="units-source-line">
                  <span className="units-cost-label">{l("产出", "Output")}</span>
                  <WorkEntityChip
                    entity={work.entity}
                    unitsById={unitsById}
                    label={researchLabel}
                  />
                </p>
                <CostChips index={index} costs={work.cost} />
                {work.t !== undefined ? (
                  <p className="units-weapon-meta">
                    {l("时长", "Duration")} {formatDuration(work.t, locale)}
                  </p>
                ) : null}
                <RequirementChips requirements={work.reqU} unitsById={unitsById} />
                <ResearchChips
                  gameIds={work.reqR}
                  label={researchLabel}
                  title={l("前置研究", "Required research")}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {weapons.length > 0 ? (
        <div className="units-block">
          <h4>{l("武器", "Weapons")}</h4>
          <ul>
            {weapons.map((weapon, i) => {
              const typeLabel = weapon.type ? weaponTypeLabel(weapon.type) : undefined;
              const damages = weapon.damage ?? [];
              const rangeParts =
                weapon.min !== undefined || weapon.max !== undefined
                  ? `${weapon.min !== undefined ? formatStatNumber(weapon.min, locale) : "?"}–${weapon.max !== undefined ? formatStatNumber(weapon.max, locale) : "?"}`
                  : "";
              return (
                <li key={i}>
                  <code>{typeLabel ? l(typeLabel.zh, typeLabel.en) : shortTag(weapon.type ?? "")}</code>
                  {damages.length > 0 ? (
                    <span>
                      {damages.map(([type, value], j) => {
                        const label = damageTypeLabel(type);
                        return (
                          <span key={j} className="units-damage">
                            {label ? l(label.zh, label.en) : localizedTagLabel(index, type, locale)}{" "}
                            <b>{formatStatNumber(value, locale)}</b>
                          </span>
                        );
                      })}
                    </span>
                  ) : null}
                  <span className="units-weapon-meta">
                    {weapon.recharge !== undefined
                      ? `${l("装填", "Reload")} ${formatDuration(weapon.recharge, locale)} · `
                      : ""}
                    {rangeParts ? `${l("射程", "Range")} ${rangeParts}` : ""}
                    {weapon.attacks && weapon.attacks > 1
                      ? ` · ${l("每次攻击发射", "Shots per attack")} ${weapon.attacks}`
                      : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {tags.length > 0 ? (
        <div className="units-block">
          <h4>{l("标签", "Tags")}</h4>
          <p className="units-tags">
            {tags.map((tag) => (
              <code key={tag}>{localizedTagLabel(index, tag, locale)}</code>
            ))}
          </p>
        </div>
      ) : null}

      {requiredResearch.length > 0 || affectedResearch.length > 0 || linkedPrograms.length > 0 ? (
        <div className="units-block">
          <h4>{l("相关研究", "Related research")}</h4>
          {requiredResearch.length > 0 ? (
            <ResearchRow
              title={l("生产所需研究", "Required for production")}
              gameIds={requiredResearch}
              label={researchLabel}
            />
          ) : null}
          {affectedResearch.length > 0 ? (
            <ResearchRow
              title={l("影响此单位的研究", "Researches affecting this unit")}
              gameIds={affectedResearch}
              label={researchLabel}
            />
          ) : null}
          {linkedPrograms.length > 0 ? (
            <ResearchRow
              title={l("关联研究程序", "Linked research programs")}
              gameIds={linkedPrograms}
              label={researchLabel}
            />
          ) : null}
        </div>
      ) : null}

      <details className="units-raw-details">
        <summary>{l("原始导出字段", "Raw export fields")}</summary>
        <code>{unit.name}</code>
      </details>
    </div>
  );
}

/** Ligne libellée + contenu (coûts init/complet/réparation, etc.). */
function CostLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="units-source-line">
      <span className="units-cost-label">{label}</span>
      {children}
    </p>
  );
}

/** Coûts en ressources : icône officielle + nom localisé + valeur, lignes à 0 masquées. */
function CostChips({ index, costs }: { index: UnitsIndex; costs: CostPair[] | undefined }) {
  const { locale } = useI18n();
  const visible = (costs ?? []).filter(([, value]) => value > 0);
  if (visible.length === 0) return null;
  return (
    <span className="units-costs">
      {visible.map(([resourceId, value]) => {
        const name = localizedResourceLabel(index, resourceId, locale);
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

/** Prérequis d'unités : puces cliquables vers les fiches (× quantité, ≤ si plafond). */
function RequirementChips({
  requirements,
  unitsById,
}: {
  requirements: UnitRequirement[] | undefined;
  unitsById: Map<string, UnitIndexEntry>;
}) {
  const { locale } = useI18n();
  const list = requirements ?? [];
  if (list.length === 0) return null;
  return (
    <span className="units-costs">
      {list.map(([unitId, quantity, max], i) => {
        const unit = unitsById.get(unitId);
        return (
          <a key={`${unitId}-${i}`} className="research-chip" href={unitDeepLink(unitId)}>
            {unit?.image ? (
              <img
                src={unitImageUrl(unit.image)}
                alt=""
                width={20}
                height={20}
                loading="lazy"
              />
            ) : null}
            {unit ? localizedUnitName(unit, locale) : unitId}
            <span className="units-qty">
              {max ? "≤" : "×"} {quantity}
            </span>
          </a>
        );
      })}
    </span>
  );
}

/** Recherches requises (puces cliquables vers /researches?research=<gameId>). */
function ResearchChips({
  gameIds,
  label,
  title,
}: {
  gameIds: number[] | undefined;
  label: (gameId: number) => string;
  title: string;
}) {
  const list = gameIds ?? [];
  if (list.length === 0) return null;
  return (
    <span className="units-costs">
      <span className="units-cost-label">{title}</span>
      {list.map((gameId) => (
        <a key={gameId} className="research-chip" href={researchDeepLink(gameId)}>
          <img src={upgradeImageUrl(gameId)} alt="" width={18} height={18} loading="lazy" />
          {label(gameId)}
        </a>
      ))}
    </span>
  );
}

function ResearchRow({
  title,
  gameIds,
  label,
}: {
  title: string;
  gameIds: number[];
  label: (gameId: number) => string;
}) {
  return (
    <div className="units-research-row">
      <p className="units-cost-label">{title}</p>
      <p className="research-links">
        {gameIds.map((gameId) => (
          <a key={gameId} className="research-chip" href={researchDeepLink(gameId)}>
            <img src={upgradeImageUrl(gameId)} alt="" width={18} height={18} loading="lazy" />
            {label(gameId)}
          </a>
        ))}
      </p>
    </div>
  );
}

/** Entité produite par un travail : recherche (icône upgrade) ou unité. */
function WorkEntityChip({
  entity,
  unitsById,
  label,
}: {
  entity: WorkEntity;
  unitsById: Map<string, UnitIndexEntry>;
  label: (gameId: number) => string;
}) {
  const { locale } = useI18n();
  if (entity.kind === "research") {
    return (
      <a className="research-chip" href={researchDeepLink(entity.gameId)}>
        <img
          src={upgradeImageUrl(entity.gameId)}
          alt=""
          width={20}
          height={20}
          loading="lazy"
        />
        {label(entity.gameId)}
      </a>
    );
  }
  const unit = unitsById.get(entity.id);
  return (
    <a className="research-chip" href={unitDeepLink(entity.id)}>
      {unit?.image ? (
        <img
          src={unitImageUrl(unit.image)}
          alt=""
          width={20}
          height={20}
          loading="lazy"
        />
      ) : null}
      {unit ? localizedUnitName(unit, locale) : entity.id}
    </a>
  );
}
