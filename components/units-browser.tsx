"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, X, RefreshCw } from "lucide-react";
import { useI18n, useBilingual } from "@/components/i18n";
import {
  UPDATED_AT_URL,
  countByFaction,
  countUnits,
  factionLabel,
  formatPublishedDate,
  searchUnits,
  shortTag,
  unitDisplayName,
  unitFicheUrl,
  unitImageUrl,
  type DatasetMeta,
  type UnitIndexEntry,
  type UnitsIndex,
} from "@/lib/units";

// Fiche unité (sous-ensemble des champs publiés par wus-data) — chargée à la demande.
interface UnitFiche {
  gameId?: string;
  name?: string;
  description?: string;
  image?: string;
  nation?: { nationId?: number };
  size?: number;
  viewRange?: number;
  health?: number;
  regenerationSpeed?: number;
  threat?: number;
  controllable?: boolean;
  tags?: { name: string }[];
  armorZonal?: { value: number; probability: number }[];
  weapons?: {
    weaponId?: number;
    weaponType?: string;
    rechargePeriod?: number;
    attacksPerAttack?: number;
    distance?: { max?: number; min?: number; stop?: number };
    damage?: { damages?: { type: string; value: number }[] };
  }[];
}

const numberText = (value: number | undefined): string =>
  value === undefined ? "—" : String(value);

export function UnitsBrowser({ index }: { index: UnitsIndex }) {
  const { locale, t } = useI18n();
  const l = useBilingual();
  const [query, setQuery] = useState("");
  const [faction, setFaction] = useState("all");
  const [selected, setSelected] = useState<UnitIndexEntry | null>(null);
  const [ficheCache, setFicheCache] = useState<Record<string, UnitFiche>>({});
  const [ficheErrorId, setFicheErrorId] = useState<string | null>(null);
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

  // Fiche à la demande (une seule unité) : cache + annulation, état dérivé.
  useEffect(() => {
    if (!selected || ficheCache[selected.id] || ficheErrorId === selected.id) return;
    const controller = new AbortController();
    fetch(unitFicheUrl(selected.id), { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((fiche: unknown) => {
        if (typeof fiche !== "object" || fiche === null) throw new Error("bad fiche");
        setFicheCache((cache) => ({ ...cache, [selected.id]: fiche as UnitFiche }));
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setFicheErrorId(selected.id);
      });
    return () => controller.abort();
  }, [selected, ficheCache, ficheErrorId]);

  const perFaction = useMemo(() => countByFaction(index.units), [index]);
  const totalUnits = meta?.counts?.units ?? countUnits(index.units);
  const fiche = selected ? ficheCache[selected.id] : undefined;
  const ficheFailed = !!selected && ficheErrorId === selected.id;
  const ficheLoading = !!selected && !fiche && !ficheFailed;
  const filtered = useMemo(() => {
    const scoped = faction === "all" ? index.units : index.units.filter((u) => u.faction === faction);
    return searchUnits(scoped, query);
  }, [index, faction, query]);

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
          <p className="caption">{t(`共 ${totalUnits} 个单位`)}</p>
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
            className={faction === "all" ? "active" : ""}
            aria-pressed={faction === "all"}
            onClick={() => setFaction("all")}
          >
            {l("全部", "All")}
            <span className="units-faction-count">{countUnits(index.units)}</span>
          </button>
          {index.factions.map((f) => {
            const label = factionLabel(f);
            return (
              <button
                key={f}
                type="button"
                className={faction === f ? "active" : ""}
                aria-pressed={faction === f}
                onClick={() => setFaction(f)}
              >
                {l(label.zh, label.en)}
                <span className="units-faction-count">{perFaction[f] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="caption units-note">
        {l(
          "名称为游戏导出的原始键，尚未本地化；图片与数值来自公开数据集。",
          "Names are raw game export keys, not yet localized; images and stats come from the public dataset.",
        )}
      </p>

      {filtered.length === 0 ? (
        <p className="notice">{l("没有找到对应单位。", "No matching units found.")}</p>
      ) : (
        <ul className="units-grid">
          {filtered.map((unit) => (
            <li key={unit.id} className="units-card">
              <button type="button" onClick={() => setSelected(unit)} aria-label={unitDisplayName(unit)}>
                <span className="units-thumb">
                  {unit.image ? (
                    <img
                      src={unitImageUrl(unit.image)}
                      alt={unitDisplayName(unit)}
                      loading="lazy"
                      width={96}
                      height={96}
                    />
                  ) : null}
                </span>
                <span className="units-card-name">{unitDisplayName(unit)}</span>
                <code className="units-card-id">{unit.id}</code>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <div className="units-detail-backdrop" role="presentation" onClick={() => setSelected(null)}>
          <div
            className="units-detail"
            role="dialog"
            aria-modal="true"
            aria-label={unitDisplayName(selected)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="units-detail-head">
              {selected.image ? (
                <img
                  className="units-detail-image"
                  src={unitImageUrl(selected.image)}
                  alt={unitDisplayName(selected)}
                  width={96}
                  height={96}
                />
              ) : null}
              <div className="units-detail-title">
                <h3>{unitDisplayName(selected)}</h3>
                <code>{selected.id}</code>
              </div>
              <button type="button" className="units-close" onClick={() => setSelected(null)}>
                <X size={16} />
                <span>{l("关闭", "Close")}</span>
              </button>
            </div>

            {ficheLoading ? (
              <p className="notice subtle">{l("载入单位数据…", "Loading unit data…")}</p>
            ) : ficheFailed ? (
              <p className="notice error">
                {l("单位数据暂时无法加载", "Unit data unavailable")}.{" "}
                <button type="button" className="units-retry" onClick={() => setFicheErrorId(null)}>
                  <RefreshCw size={13} /> {l("重试", "Retry")}
                </button>
              </p>
            ) : fiche ? (
              <UnitFicheView fiche={fiche} />
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function UnitFicheView({ fiche }: { fiche: UnitFiche }) {
  const l = useBilingual();
  const stats: [string, string][] = [
    [l("血量", "Health"), numberText(fiche.health)],
    [l("视野", "View range"), numberText(fiche.viewRange)],
    [l("体型", "Size"), numberText(fiche.size)],
    [l("恢复速度", "Regeneration"), numberText(fiche.regenerationSpeed)],
    [l("威胁", "Threat"), numberText(fiche.threat)],
    [l("国家编号", "Nation ID"), fiche.nation?.nationId === undefined ? "—" : String(fiche.nation.nationId)],
    [l("可控", "Controllable"), fiche.controllable === undefined ? "—" : fiche.controllable ? l("是", "Yes") : l("否", "No")],
  ];
  const weapons = fiche.weapons ?? [];
  const armor = fiche.armorZonal ?? [];
  const tags = (fiche.tags ?? []).map((tag) => shortTag(tag.name)).filter((tag) => tag !== "genericUnitTag");

  return (
    <div className="units-fiche">
      <p className="caption">
        {l("原始名称", "Raw name")}: <code className="units-raw">{fiche.name ?? "—"}</code>
      </p>
      <dl className="units-stats">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {weapons.length > 0 ? (
        <div className="units-block">
          <h4>{l("武器", "Weapons")}</h4>
          <ul>
            {weapons.map((weapon, i) => {
              const damages = (weapon.damage?.damages ?? []).filter((d) => d.value > 0);
              return (
                <li key={weapon.weaponId ?? i}>
                  <code>{shortTag(weapon.weaponType ?? "")}</code>
                  {damages.length > 0 ? (
                    <span>
                      {damages.map((d, j) => (
                        <span key={j} className="units-damage">
                          {shortTag(d.type)} <b>{d.value}</b>
                        </span>
                      ))}
                    </span>
                  ) : null}
                  <span className="units-weapon-meta">
                    {l("装填", "Reload")} {numberText(weapon.rechargePeriod)} · {l("射程", "Range")}{" "}
                    {numberText(weapon.distance?.min)}–{numberText(weapon.distance?.max)}
                    {weapon.attacksPerAttack && weapon.attacksPerAttack > 1
                      ? ` · ${l("每次攻击发射", "Shots per attack")} ${weapon.attacksPerAttack}`
                      : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {armor.length > 0 ? (
        <div className="units-block">
          <h4>{l("护甲分布", "Armor spread")}</h4>
          <p className="units-armor">
            {armor.map((zone, i) => (
              <span key={i}>
                {zone.value} × {zone.probability}%
              </span>
            ))}
          </p>
        </div>
      ) : null}

      {tags.length > 0 ? (
        <div className="units-block">
          <h4>{l("标签", "Tags")}</h4>
          <p className="units-tags">
            {tags.map((tag) => (
              <code key={tag}>{tag}</code>
            ))}
          </p>
        </div>
      ) : null}

      {fiche.description ? (
        <details className="units-raw-details">
          <summary>{l("原始导出字段", "Raw export fields")}</summary>
          <code>{fiche.description}</code>
        </details>
      ) : null}
    </div>
  );
}
