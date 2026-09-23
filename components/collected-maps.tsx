"use client";
import { useState } from "react";
import Link from "@/components/site-link";
import { T, useBilingual, useI18n } from "@/components/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Map, Search, Copy, ArrowUpRight, Pencil, ClipboardList } from "lucide-react";
import { collectionLabels, type CollectedMap } from "@/lib/collection";

export function CopyMapCode({ code }: { code: string }) {
  const { locale, t } = useI18n();
  const l = useBilingual();
  const [state, setState] = useState("");
  return (
    <span className="collection-code">
      <code>{code}</code>
      <Button
        size="sm"
        variant="ghost"
        aria-label={locale === "zh" ? `复制 ${code}` : `${t("Copy")} ${code}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setState("copied");
          } catch {
            setState("failed");
          }
        }}
      >
        <Copy size={15} />
        {state === "copied" ? l("已复制", "Copied") : l("复制", "Copy")}
      </Button>
      {state === "failed" && (
        <small role="status">{l("请选中地图码手动复制。", "Select and copy the code manually.")}</small>
      )}
    </span>
  );
}
export function CollectedMaps({
  items,
  admin = false,
  manage = false,
}: {
  items: CollectedMap[];
  admin?: boolean;
  manage?: boolean;
}) {
  const { locale, t } = useI18n();
  const l = useBilingual();
  const en = locale !== "zh";
  const label = (pair: readonly [string, string] | undefined) =>
    pair ? (locale === "zh" ? pair[0] : t(pair[1])) : "";
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [limit, setLimit] = useState(12);
  const matches = items.filter(
    (m) =>
      [
        m.title,
        m.title_en,
        m.author,
        m.map_code,
        m.summary,
        m.summary_en,
        m.mods,
        m.relation_note,
        m.relation_note_en,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase()) &&
      (filter === "all" ||
        (filter === "named" && !!m.title) ||
        (filter === "unknown" && !m.title) ||
        filter === m.test_status ||
        filter === m.category),
  );
  return (
    <section id="collection" className="collection-section">
      <div className="section-head">
        <div>
          <p className="eyebrow">
            <T text="CURATOR'S COLLECTION /" /> {String(items.length).padStart(2, "0")}
          </p>
          <h2>
            {manage
              ? l("维护收藏地图", "Manage saved maps")
              : l("地图收藏", "Maps worth exploring")}
          </h2>
        </div>
        <span className="collection-count">
          {locale === "zh"
            ? `已收录 ${items.length} 张 · ${items.filter((m) => m.test_status === "untested").length} 张待实测`
            : t(`${items.length} saved · ${items.filter((m) => m.test_status === "untested").length} untested`)}
        </span>
      </div>
      <div className="collection-notice">
        <ClipboardList size={22} />
        <p>
          {l(
            "这里是待探索的地图收藏，不是实测推荐榜。人数和玩法来自原收藏记录，地图码有效性、平衡与所需 Mod 仍需开房确认。",
            "Saved references, not tested recommendations. Rules and player counts are source notes; verify availability, balance and required mods in a private match.",
          )}
        </p>
      </div>
      <div className="collection-toolbar">
        <div className="search-input">
          <Search size={18} />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(12);
            }}
            placeholder={l("搜索全部收藏：名称、作者、地图码…", "Search all saved maps, authors or codes…")}
            aria-label={l("搜索收藏地图", "Search saved maps")}
          />
        </div>
        <select
          aria-label={l("筛选收藏地图", "Filter saved maps")}
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setLimit(12);
          }}
        >
          <option value="all">{l("全部收藏", "All saved maps")}</option>
          <option value="named">{l("已记录名称", "With a recorded name")}</option>
          <option value="unknown">{l("名称待补充", "Name to be added")}</option>
          {(["untested", "working", "issues", "unavailable", "PVE", "PVP"] as const).map((k) => (
            <option key={k} value={k}>
              {label(collectionLabels[k])}
            </option>
          ))}
        </select>
        <span aria-live="polite">
          {locale === "zh"
            ? `${matches.length} 个结果`
            : t(`${matches.length} results`)}
        </span>
      </div>
      <div className="collection-grid">
        {matches.slice(0, limit).map((m) => {
          const title =
            (en && m.title_en ? m.title_en : m.title) || l("名称待补充", "Unidentified map");
          return (
            <article className="collection-card" key={m.id}>
              <Link
                href={`/maps/${m.id}`}
                className="collection-preview"
                aria-label={`${title} ${m.map_code}`}
              >
                {m.images[0] ? (
                  <img
                    src={m.images[0]}
                    alt={locale === "zh" ? `${m.map_code} 的原收藏预览` : `${m.map_code} ${t("saved preview")}`}
                    loading="lazy"
                  />
                ) : (
                  <div className="collection-no-image">
                    <Map size={36} />
                    <span>{l("预览请见原帖", "Preview in source post")}</span>
                  </div>
                )}
                {m.images.length > 0 && m.preview_kind && m.preview_kind !== "map" && (
                  <span className="collection-image-kind">
                    {m.preview_kind === "shared"
                      ? l("同作品参考图", "Shared reference")
                      : l("原帖宣传图", "Source artwork")}
                  </span>
                )}
                <span className={`collection-state state-${m.test_status}`}>
                  {label(collectionLabels[m.test_status])}
                </span>
              </Link>
              <div className="collection-card-body">
                <small>
                  {label(collectionLabels[m.category])}
                  {m.edition
                    ? ` · ${m.edition === "remix" ? l("改编版", "Remix") : m.edition === "original" ? l("原版", "Original") : l("玩法版本", "Variant")}`
                    : ""}
                  {m.visibility === "hidden" ? ` ${l(" · 已隐藏", " · Hidden")}` : ""}
                </small>
                <h3>
                  <Link href={`/maps/${m.id}`}>
                    {title}
                    <ArrowUpRight size={17} />
                  </Link>
                </h3>
                <p>
                  {(en ? m.summary_en || m.summary : m.summary) ||
                    l(
                      "已收录地图码及现有预览，名称、作者与玩法等待补充。",
                      "Saved code and available preview only. Name, author and rules need confirmation.",
                    )}
                </p>
                <div className="collection-meta">
                  <span>{m.author || l("作者待确认", "Author unknown")}</span>
                  <span>
                    {m.players
                      ? locale === "zh"
                        ? `${m.players} 人`
                        : `${m.players} ${t("players")}`
                      : l("人数待确认", "Player count unknown")}
                  </span>
                </div>
                <CopyMapCode code={m.map_code} />
                {admin && (
                  <Link className="collection-edit" href={`/maps/${m.id}/edit`}>
                    <Pencil size={14} />
                    {l("编辑档案", "Edit archive")}
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!matches.length && (
        <p className="notice">{l("没有匹配的收藏地图。", "No matching saved maps.")}</p>
      )}
      {matches.length > limit && (
        <Button variant="outline" className="mt-6" onClick={() => setLimit((n) => n + 12)}>
          {l("再显示 12 张地图", "Show 12 more maps")}
        </Button>
      )}
      <p className="caption collection-footnote">
        {l(
          "原始小地图仅供辨识，不代表当前版本实测结果。地图码不等于 ZIP 文件，未提供的地图包不设置虚假下载。",
          "Original minimaps are reference images, not current-version gameplay proof. A map code is not a downloadable ZIP; no file is fabricated.",
        )}
      </p>
    </section>
  );
}
