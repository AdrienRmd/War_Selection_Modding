"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/site-link";
import { Search, Download, Upload, Copy, Check, RotateCcw, Plus, ArrowRight, ArrowLeft, AlertTriangle, FileCode2, Save, Info } from "lucide-react";
import { useI18n, useBilingual } from "@/components/i18n";
import { DatasetBadge } from "@/components/dataset-badge";
import { Button } from "@/components/ui/button";
import {
  isSimpleCatalog,
  readSimpleProject,
  simpleLua,
  simpleProjectJSON,
  validateSimpleDraft,
  SIMPLE_CATALOG_GZ_URL,
  SIMPLE_CATALOG_URL,
  type ImportedProject,
  type SimpleCatalog,
  type SimpleDraft,
  type SimpleField,
  type SimpleGroup,
  type SimpleUnit,
} from "@/lib/simple-workbench";
import {
  countByGroup,
  localizedGroupLabel,
  localizedNationLabel,
  localizedUnitName,
  searchUnits,
  unitGroups,
  unitImageUrl,
  unitGroupKey,
  type UnitIndexEntry,
  type UnitsIndex,
} from "@/lib/units";

const GROUPS: { id: SimpleGroup; zh: string; en: string }[] = [
  { id: "construction", zh: "建造", en: "Construction" },
  { id: "combat", zh: "战斗", en: "Combat" },
  { id: "economy", zh: "经济", en: "Economy" },
];

const formatNumber = (v: number) =>
  Number.isInteger(v) ? String(v) : String(Number(v.toFixed(4)));

function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
const filename = (name: string) =>
  "ws-atlas-" + (name.replace(/[^\p{L}\p{N}_-]/gu, "-").slice(0, 55) || "simple-mod");

async function fetchSimpleCatalog(signal: AbortSignal): Promise<SimpleCatalog> {
  // Comme l'atelier expert : gzip si le navigateur le permet, sinon JSON brut.
  if (typeof DecompressionStream !== "undefined") {
    const response = await fetch(SIMPLE_CATALOG_GZ_URL, { signal });
    if (response.ok) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      const stream =
        bytes[0] === 0x1f && bytes[1] === 0x8b
          ? new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))
          : new Blob([bytes]).stream();
      return new Response(stream).json() as Promise<SimpleCatalog>;
    }
  }
  const response = await fetch(SIMPLE_CATALOG_URL, { signal });
  if (!response.ok) throw Error();
  return response.json() as Promise<SimpleCatalog>;
}

export function SimpleWorkbench({ index }: { index: UnitsIndex }) {
  const { t, locale } = useI18n();
  const b = useBilingual();
  const [catalog, setCatalog] = useState<SimpleCatalog | null>(null),
    [loadError, setLoadError] = useState(false),
    [retry, setRetry] = useState(0);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SimpleDraft>({});
  const [name, setName] = useState(() => t("我的平衡调整"));
  const [group, setGroup] = useState<SimpleGroup>("construction");
  const [advanced, setAdvanced] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imported, setImported] = useState<ImportedProject | null>(null);
  const [importError, setImportError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const c = new AbortController();
    fetchSimpleCatalog(c.signal)
      .then((d) => {
        if (!isSimpleCatalog(d)) throw Error();
        setCatalog(d);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setLoadError(true);
      });
    return () => c.abort();
  }, [retry]);

  const byId = useMemo(() => {
    const map = new Map<string, UnitIndexEntry>();
    for (const u of index.units) map.set(u.id, u);
    return map;
  }, [index]);
  const editable = useMemo(
    () => new Set(catalog?.units.map((u) => u.id) ?? []),
    [catalog],
  );
  const unitsInDraft = useMemo(
    () => Object.keys(draft).filter((id) => Object.keys(draft[id]).length),
    [draft],
  );
  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;
  const selectedCatalogUnit = useMemo(
    () => catalog?.units.find((u) => u.id === selectedId) ?? null,
    [catalog, selectedId],
  );
  const unitName = (u: UnitIndexEntry) => localizedUnitName(u, locale);

  // Validation + export (moteur v6 réutilisé tel quel).
  const checked = useMemo(() => {
    if (!catalog) return { edits: [], error: "" };
    try {
      return { edits: validateSimpleDraft(catalog, draft), error: "" };
    } catch (e) {
      return { edits: [], error: e instanceof Error ? e.message : "Invalid" };
    }
  }, [catalog, draft]);
  const error =
    checked.error || (!name.trim() ? t("请填写 Mod 名称。") : "");
  const luaCode = useMemo(
    () =>
      !error && checked.edits.length && catalog
        ? simpleLua(catalog, draft, name.trim())
        : "",
    [catalog, checked, draft, error, name],
  );

  useEffect(() => {
    if (!unitsInDraft.length) return;
    const fn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [unitsInDraft.length]);

  function setField(unitId: string, field: SimpleField, text: string) {
    setDraft((old) => {
      const unit = { ...(old[unitId] ?? {}) };
      if (
        text.trim() &&
        Number.isFinite(Number(text)) &&
        Math.round(Number(text) * field.scale) === field.raw
      )
        delete unit[field.key]; // revenu à la valeur d'origine : pas de modif
      else unit[field.key] = text;
      const next = { ...old, [unitId]: unit };
      if (!Object.keys(unit).length) delete next[unitId];
      return next;
    });
  }
  function resetField(unitId: string, fieldKey: string) {
    setDraft((old) => {
      const unit = { ...(old[unitId] ?? {}) };
      delete unit[fieldKey];
      const next = { ...old, [unitId]: unit };
      if (!Object.keys(unit).length) delete next[unitId];
      return next;
    });
  }
  function pickUnit(id: string) {
    setSelectedId(id);
    setStep(2);
    setGroup("construction");
  }
  async function importFile(file?: File) {
    if (!file || !catalog) return;
    setImportError("");
    try {
      if (file.size > 1024 * 1024) throw Error(t("工程文件不能超过 1 MB。"));
      const p = readSimpleProject(await file.text(), catalog);
      setImported(p);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Import failed");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  function applyImported() {
    if (!imported) return;
    setDraft(imported.draft);
    setName(imported.name);
    const first = Object.keys(imported.draft)[0];
    if (first) {
      setSelectedId(first);
      setStep(2);
    } else setStep(1);
    setImported(null);
  }

  if (!catalog && step === 2)
    return (
      <main className="shell simple-shell">
        <SimpleHeader count={null} />
        {loadError ? <LoadErrorBanner onRetry={() => { setLoadError(false); setRetry((n) => n + 1); }} /> : null}
        <p className="simple-empty">{t("正在加载单位数据…")}</p>
      </main>
    );

  return (
    <main className="shell simple-shell">
      <SimpleHeader count={catalog?.units.length ?? null} version={catalog?.provenance.gameVersion} />
      {loadError ? <LoadErrorBanner onRetry={() => { setLoadError(false); setRetry((n) => n + 1); }} /> : null}
      <ol className="simple-steps" data-testid="sw-steps">
        {[
          { n: 1, zh: "① 选择单位", en: "① Choose a unit", hintZh: "搜索并选择一个要修改的游戏单位。", hintEn: "Search and pick the game unit you want to change." },
          { n: 2, zh: "② 修改数值", en: "② Change values", hintZh: "左边是游戏当前值，在右边填入你的新值。", hintEn: "The current game value is on the left; type your new value on the right." },
          { n: 3, zh: "③ 导出 Mod", en: "③ Export the mod", hintZh: "检查改动摘要，下载 Lua 代码或保存工程文件。", hintEn: "Review the summary, then download the Lua code or save the project file." },
        ].map((s) => (
          <li
            key={s.n}
            className={step === s.n ? "active" : step > s.n ? "done" : ""}
            aria-current={step === s.n ? "step" : undefined}
          >
            <button
              type="button"
              onClick={() => s.n < step || (s.n === 2 && (selectedId || unitsInDraft.length)) ? setStep(s.n as 1 | 2 | 3) : undefined}
              disabled={s.n > step && !(s.n === 2 && (selectedId || unitsInDraft.length))}
            >
              {b(s.zh, s.en)}
            </button>
            <p>{b(s.hintZh, s.hintEn)}</p>
          </li>
        ))}
      </ol>

      {step === 1 && (
        <StepChoose
          index={index}
          editable={editable}
          resolved={catalog !== null}
          unitName={unitName}
          locale={locale}
          onPick={pickUnit}
        />
      )}

      {step === 2 && (
        <StepEdit
          index={index}
          indexUnit={selected}
          catalogUnit={selectedCatalogUnit}
          draft={draft}
          group={group}
          setGroup={setGroup}
          advanced={advanced}
          setAdvanced={setAdvanced}
          locale={locale}
          onField={setField}
          onReset={resetField}
          onAddUnit={() => setStep(1)}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
          draftCount={unitsInDraft.length}
          onPickOther={pickUnit}
          editedUnitIds={unitsInDraft}
        />
      )}

      {step === 3 && catalog && (
        <StepExport
          catalog={catalog}
          index={index}
          draft={draft}
          name={name}
          setName={setName}
          error={error}
          luaCode={luaCode}
          editedUnitIds={unitsInDraft}
          locale={locale}
          copied={copied}
          setCopied={setCopied}
          onBack={() => setStep(2)}
          onUnit={pickUnit}
        />
      )}

      <section className="simple-import" aria-label={t("导入已有工程")}>
        <h2>{t("导入已有工程")}</h2>
        <p>
          {t(
            "导入此前保存的简易模式工程：如果游戏数据在创建后发生了变化，会显示每项的差异并提议更新。",
          )}
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="simple-file"
          data-testid="sw-import-input"
          aria-label={t("选择工程 JSON 文件")}
          onChange={(e) => importFile(e.target.files?.[0])}
        />
        <Button variant="outline" onClick={() => fileInput.current?.click()}>
          <Upload size={15} /> {t("选择工程文件…")}
        </Button>
        {importError && (
          <p role="alert" className="simple-error">
            {importError}
          </p>
        )}
      </section>

      {imported && (
        <ImportPanel
          imported={imported}
          locale={locale}
          unitName={(id) => {
            const entry = byId.get(id);
            return entry
              ? localizedUnitName(entry, locale === "zh" ? "zh" : locale === "en" ? "en" : "fr")
              : id;
          }}
          onApply={applyImported}
          onClose={() => setImported(null)}
        />
      )}
    </main>
  );
}

function LoadErrorBanner({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="simple-alert">
      <p>{t("数据暂时无法加载，请重试。")}</p>
      <Button onClick={onRetry}>{t("重新加载")}</Button>
    </div>
  );
}

function SimpleHeader({ count, version }: { count: number | null; version?: string }) {
  const { t } = useI18n();
  const b = useBilingual();
  return (
    <header className="simple-head">
      <div>
        <p className="caption">WAR SELECTION · SIMPLE MOD WORKBENCH</p>
        <h1>{t("简易 Mod 工作台")}</h1>
        <p className="simple-lede">
          {b(
            "三步做出你的第一个平衡 Mod：选择单位、修改数值、导出代码。数据来自当前同步版本，原值始终可见。",
            "Build your first balance mod in three steps: pick a unit, change values, export the code. Values come from the current synchronized dataset; original values always stay visible.",
          )}
        </p>
      </div>
      <div className="simple-head-side">
        {count !== null && (
          <DatasetBadge testId="simple-count">
            {t(`数据 ${version ?? ""} · ${count} 个可修改单位`)}
          </DatasetBadge>
        )}
        <Link href="/workbench" className="simple-switch">
          <SlidersIcon /> {t("需要完整参数？使用专家工作台")}
        </Link>
      </div>
    </header>
  );
}
function SlidersIcon() {
  return <FileCode2 size={14} aria-hidden="true" />;
}

// --- Étape 1 : choisir -------------------------------------------------------------

function StepChoose({
  index,
  editable,
  resolved,
  unitName,
  locale,
  onPick,
}: {
  index: UnitsIndex;
  editable: Set<string>;
  /** Faux tant que le catalogue généré n'est pas chargé (SSR : cartes actives). */
  resolved: boolean;
  unitName: (u: UnitIndexEntry) => string;
  locale: "zh" | "en" | "fr";
  onPick: (id: string) => void;
}) {
  const { t } = useI18n();
  const b = useBilingual();
  const [query, setQuery] = useState("");
  const [groupKey, setGroupKey] = useState("all");
  const groups = useMemo(() => unitGroups(index), [index]);
  const perGroup = useMemo(() => countByGroup(index.units), [index.units]);
  const filtered = useMemo(() => {
    const scoped =
      groupKey === "all" ? index.units : index.units.filter((u) => unitGroupKey(u) === groupKey);
    return searchUnits(scoped, query);
  }, [index, groupKey, query]);

  return (
    <section aria-label={t("第一步：选择单位")} data-testid="sw-step-choose">
      <div className="units-toolbar">
        <div className="search-input units-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("搜索单位名称…（中文 / EN / FR）")}
            aria-label={t("搜索单位")}
            data-testid="sw-search"
          />
        </div>
      </div>
      <div className="units-groups" role="tablist" aria-label={t("按时代筛选")}>
        <button
          role="tab"
          aria-selected={groupKey === "all"}
          className={groupKey === "all" ? "on" : ""}
          onClick={() => setGroupKey("all")}
        >
          {b("全部时代", "All ages")} · {index.units.length}
        </button>
        {groups.map((g) => (
          <button
            key={g.key}
            role="tab"
            aria-selected={groupKey === g.key}
            className={groupKey === g.key ? "on" : ""}
            onClick={() => setGroupKey(g.key)}
          >
            {localizedGroupLabel(index, g, locale) || g.key}{" "}
            · {perGroup[g.key] ?? 0}
          </button>
        ))}
      </div>
      {filtered.length === 0 && <p className="simple-empty">{t("没有匹配的单位。")}</p>}
      <ul className="simple-cards">
        {filtered.map((u) => {
          const canEdit = !resolved || editable.has(u.id);
          return (
            <li key={u.id}>
              <button
                type="button"
                className="simple-card"
                data-testid="sw-unit-card"
                data-unit-id={u.id}
                data-editable={canEdit ? "1" : "0"}
                disabled={!canEdit}
                onClick={() => onPick(u.id)}
              >
                {u.image ? (
                  <img src={unitImageUrl(u.image)} alt="" loading="lazy" />
                ) : (
                  <span className="simple-card-noimg" aria-hidden="true">?</span>
                )}
                <span className="simple-card-name">{unitName(u)}</span>
                <span className="simple-card-nation">
                  {localizedNationLabel(index, u.nationId ?? 0, locale === "zh" ? "zh" : locale === "en" ? "en" : "fr") ?? ""}
                </span>
                {!canEdit && <span className="simple-card-lock">{b("暂不可改", "Not editable")}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// --- Étape 2 : modifier ------------------------------------------------------------

function StepEdit({
  index,
  indexUnit,
  catalogUnit,
  draft,
  group,
  setGroup,
  advanced,
  setAdvanced,
  locale,
  onField,
  onReset,
  onAddUnit,
  onNext,
  onBack,
  draftCount,
  onPickOther,
  editedUnitIds,
}: {
  index: UnitsIndex;
  indexUnit: UnitIndexEntry | null;
  catalogUnit: SimpleUnit | null;
  draft: SimpleDraft;
  group: SimpleGroup;
  setGroup: (g: SimpleGroup) => void;
  advanced: boolean;
  setAdvanced: (v: boolean) => void;
  locale: string;
  onField: (unitId: string, field: SimpleField, text: string) => void;
  onReset: (unitId: string, fieldKey: string) => void;
  onAddUnit: () => void;
  onNext: () => void;
  onBack: () => void;
  draftCount: number;
  onPickOther: (id: string) => void;
  editedUnitIds: string[];
}) {
  const { t } = useI18n();
  const b = useBilingual();
  if (!catalogUnit || !indexUnit)
    return (
      <section data-testid="sw-step-edit">
        <p>{t("请先选择一个单位。")}</p>
        <Button onClick={onBack}>{b("返回选择", "Back to choosing")}</Button>
      </section>
    );
  const label = (f: SimpleField) =>
    locale === "zh" ? f.label : locale === "en" ? f.labelEn : f.labelFr;
  const help = (f: SimpleField) =>
    locale === "zh" ? f.help : locale === "en" ? f.helpEn : f.helpFr;
  const unitDraft = draft[catalogUnit.id] ?? {};
  const shown = catalogUnit.fields.filter(
    (f) => f.group === group && (advanced || !f.advanced),
  );

  return (
    <section aria-label={t("第二步：修改数值")} data-testid="sw-step-edit">
      <div className="simple-unit-head">
        {indexUnit.image ? (
          <img src={unitImageUrl(indexUnit.image)} alt="" />
        ) : null}
        <div>
          <h2>{localizedUnitName(indexUnit, locale === "zh" ? "zh" : locale === "en" ? "en" : "fr")}</h2>
          <p className="caption">
            {localizedNationLabel(index, indexUnit.nationId ?? 0, locale === "zh" ? "zh" : locale === "en" ? "en" : "fr") ?? ""} · slot #{catalogUnit.slot}
          </p>
        </div>
        <div className="simple-unit-actions">
          <Button variant="outline" size="sm" onClick={onAddUnit}>
            <Plus size={14} /> {b("添加其他单位", "Add another unit")}
          </Button>
        </div>
      </div>

      {editedUnitIds.length > 1 && (
        <div className="simple-edited-units">
          <span>{t("已修改：")}</span>
          {editedUnitIds.map((id) => (
            <button
              key={id}
              type="button"
              className={id === catalogUnit.id ? "on" : ""}
              onClick={() => onPickOther(id)}
            >
              {id}
            </button>
          ))}
        </div>
      )}

      <div className="simple-groups" role="tablist">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            role="tab"
            aria-selected={group === g.id}
            className={group === g.id ? "on" : ""}
            onClick={() => setGroup(g.id)}
          >
            {b(g.zh, g.en)}
          </button>
        ))}
        <label className="simple-advanced">
          <input
            type="checkbox"
            checked={advanced}
            onChange={(e) => setAdvanced(e.target.checked)}
          />{" "}
          {b("显示高级参数", "Show advanced fields")}
        </label>
      </div>

      {shown.length === 0 && (
        <p className="simple-empty">{b("该主题下没有可修改的参数。", "No editable fields in this theme.")}</p>
      )}
      <ul className="simple-fields">
        {shown.map((f) => {
          const text = unitDraft[f.key] ?? "";
          const changed = Object.hasOwn(unitDraft, f.key);
          const invalid =
            changed &&
            (text.trim() === "" ||
              !Number.isFinite(Number(text)) ||
              Number(text) < f.min ||
              Number(text) > f.max);
          return (
            <li
              key={f.key}
              className={"simple-field" + (changed ? " changed" : "") + (f.advanced ? " adv" : "")}
              data-field={f.key}
            >
              <div className="simple-field-label">
                <strong>{label(f)}</strong>
                {f.advanced && <em className="simple-adv-tag">{b("高级", "advanced")}</em>}
                <small>{help(f)}</small>
              </div>
              <div className="simple-field-values">
                <span className="simple-before" title={t("游戏当前值")}>
                  {f.kind === "boolean" ? (f.value ? t("开") : t("关")) : formatNumber(f.value)}
                </span>
                <span aria-hidden="true">→</span>
                <input
                  inputMode="decimal"
                  value={text}
                  placeholder={String(f.value)}
                  aria-label={label(f)}
                  data-testid="sw-field-input"
                  data-field={f.key}
                  className={invalid ? "invalid" : ""}
                  onChange={(e) => onField(catalogUnit.id, f, e.target.value)}
                />
                {changed && (
                  <button
                    type="button"
                    className="simple-reset"
                    onClick={() => onReset(catalogUnit.id, f.key)}
                    aria-label={t("恢复原值")}
                    title={t("恢复原值")}
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="simple-nav">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft size={15} /> {b("上一步", "Back")}
        </Button>
        <Button onClick={onNext} disabled={!draftCount} data-testid="sw-next">
          {b("下一步：导出", "Next: export")} <ArrowRight size={15} />
        </Button>
      </div>
    </section>
  );
}

// --- Étape 3 : exporter ------------------------------------------------------------

function StepExport({
  catalog,
  index,
  draft,
  name,
  setName,
  error,
  luaCode,
  editedUnitIds,
  locale,
  copied,
  setCopied,
  onBack,
  onUnit,
}: {
  catalog: SimpleCatalog;
  index: UnitsIndex;
  draft: SimpleDraft;
  name: string;
  setName: (v: string) => void;
  error: string;
  luaCode: string;
  editedUnitIds: string[];
  locale: string;
  copied: boolean;
  setCopied: (v: boolean) => void;
  onBack: () => void;
  onUnit: (id: string) => void;
}) {
  const { t } = useI18n();
  const b = useBilingual();
  const byId = useMemo(() => {
    const map = new Map<string, UnitIndexEntry>();
    for (const u of index.units) map.set(u.id, u);
    return map;
  }, [index]);
  const rows = useMemo(() => {
    const out: { unitId: string; unitName: string; field: SimpleField; before: number; after: number }[] = [];
    for (const unitId of editedUnitIds) {
      const cu = catalog.units.find((u) => u.id === unitId);
      const entry = byId.get(unitId);
      if (!cu || !entry) continue;
      for (const [fieldKey, text] of Object.entries(draft[unitId])) {
        const field = cu.fields.find((f) => f.key === fieldKey);
        if (!field) continue;
        out.push({
          unitId,
          unitName: localizedUnitName(entry, locale === "zh" ? "zh" : locale === "en" ? "en" : "fr"),
          field,
          before: field.value,
          after: Number(text),
        });
      }
    }
    return out;
  }, [catalog, byId, draft, editedUnitIds, locale]);
  const label = (f: SimpleField) => (locale === "zh" ? f.label : locale === "en" ? f.labelEn : f.labelFr);

  return (
    <section aria-label={t("第三步：导出")} data-testid="sw-step-export">
      <div className="simple-name">
        <label htmlFor="simple-mod-name">{b("Mod 名称", "Mod name")}</label>
        <input
          id="simple-mod-name"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          data-testid="sw-name"
        />
      </div>

      <h2>{b("改动摘要", "Change summary")}</h2>
      {rows.length === 0 ? (
        <p className="simple-empty">{b("还没有改动。回到第二步修改数值。", "No changes yet. Go back to step 2 to edit values.")}</p>
      ) : (
        <div className="simple-summary-wrap">
          <table className="simple-summary" data-testid="sw-summary">
            <thead>
              <tr>
                <th>{b("单位", "Unit")}</th>
                <th>{b("参数", "Field")}</th>
                <th>{b("原值", "Before")}</th>
                <th>{b("新值", "After")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.unitId + ":" + r.field.key}>
                  <td>
                    <button type="button" className="simple-summary-unit" onClick={() => onUnit(r.unitId)}>
                      {r.unitName}
                    </button>
                  </td>
                  <td>{label(r.field)}</td>
                  <td>{r.field.kind === "boolean" ? (r.before ? t("开") : t("关")) : formatNumber(r.before)}</td>
                  <td>
                    <strong>{r.field.kind === "boolean" ? (r.after ? t("开") : t("关")) : formatNumber(r.after)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error ? (
        <p role="alert" className="simple-error">
          {error}
        </p>
      ) : (
        <>
          <h2>{b("导出", "Export")}</h2>
          <div className="simple-actions">
            <Button
              data-testid="sw-download-lua"
              onClick={() => download(luaCode, filename(name) + ".lua", "text/plain;charset=utf-8")}
            >
              <Download size={15} /> {b("下载 Lua 代码", "Download Lua code")}
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(luaCode);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                } catch {
                  /* clipboard indisponible : le champ ci-dessous reste copiable */
                }
              }}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}{" "}
              {copied ? b("已复制", "Copied") : b("复制代码", "Copy code")}
            </Button>
            <Button
              variant="outline"
              data-testid="sw-download-json"
              onClick={() =>
                download(
                  simpleProjectJSON(catalog, draft, name.trim() || "mod"),
                  filename(name) + ".json",
                  "application/json",
                )
              }
            >
              <Save size={15} /> {b("保存工程 JSON", "Save project JSON")}
            </Button>
          </div>
          <textarea
            readOnly
            className="simple-lua"
            data-testid="sw-lua"
            aria-label={t("Lua 代码")}
            value={luaCode}
            onFocus={(e) => e.currentTarget.select()}
          />
          <p className="simple-usage">
            <Info size={14} aria-hidden="true" />{" "}
            {b(
              "在游戏里新建一个玩法 Mod，粘贴这段代码并保存，然后开一局私人测试验证效果。",
              "In the game, create a gameplay mod, paste this code, save, then start a private match to check the result.",
            )}
          </p>
        </>
      )}
      <div className="simple-nav">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft size={15} /> {b("上一步", "Back")}
        </Button>
      </div>
    </section>
  );
}

// --- Panneau d'import / obsolescence ------------------------------------------------

function ImportPanel({
  imported,
  locale,
  unitName,
  onApply,
  onClose,
}: {
  imported: ImportedProject;
  locale: string;
  unitName: (id: string) => string;
  onApply: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const b = useBilingual();
  const label = (s: { label: string; labelEn: string; labelFr: string }) =>
    locale === "zh" ? s.label : locale === "en" ? s.labelEn : s.labelFr;
  return (
    <div className="simple-import-panel" role="alertdialog" aria-label={t("工程导入结果")} data-testid="sw-import-panel">
      <div className="simple-import-head">
        <AlertTriangle size={18} aria-hidden="true" />
        <h2>{b("工程已读取", "Project loaded")}</h2>
        <button type="button" className="simple-close" onClick={onClose} aria-label={t("关闭")}>
          ×
        </button>
      </div>
      {imported.datasetChanged && (
        <p className="simple-warn">
          {t(
            `该工程创建于数据版本 ${imported.dataset.gameVersion}，当前版本不同；下面逐项核对差异。`,
          )}
        </p>
      )}
      {imported.missing.length > 0 && (
        <p className="simple-warn">
          {t(`${imported.missing.length} 项改动对应的参数在新数据中已不存在，已忽略。`)}
        </p>
      )}
      {imported.stale.length > 0 ? (
        <>
          <p className="simple-warn">
            {b(
              "游戏数据在工程创建后发生了变化——以下参数的原值已更新。你的修改值保持不变，重新导出即基于当前数据。",
              "Game data changed since this project was created — the original values below were updated. Your modified values are kept; re-exporting rebases them on current data.",
            )}
          </p>
          <div className="simple-summary-wrap">
            <table className="simple-summary stale" data-testid="sw-stale-table">
              <thead>
                <tr>
                  <th>{b("参数", "Field")}</th>
                  <th>{b("创建时", "At creation")}</th>
                  <th>{b("现在（游戏）", "Now (game)")}</th>
                  <th>{b("你的修改", "Your value")}</th>
                </tr>
              </thead>
              <tbody>
                {imported.stale.map((s) => (
                  <tr key={s.unit + ":" + s.fieldKey}>
                    <td>
                      {unitName(s.unit)} · {label(s)}
                    </td>
                    <td>{formatNumber(s.wasValue)}</td>
                    <td>
                      <strong>{formatNumber(s.nowValue)}</strong>
                    </td>
                    <td>{formatNumber(s.modValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="simple-nav">
            <Button onClick={onApply} data-testid="sw-apply-update">
              <Check size={15} /> {b("加载并更新到当前数据", "Load and update to current data")}
            </Button>
          </div>
        </>
      ) : (
        <div className="simple-nav">
          <Button onClick={onApply}>
            <Check size={15} /> {b("加载这些修改", "Load these changes")}
          </Button>
        </div>
      )}
    </div>
  );
}
