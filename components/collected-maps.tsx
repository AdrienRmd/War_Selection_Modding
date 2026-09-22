"use client";
import { useState } from "react";
import Link from "@/components/site-link";
import { useI18n } from "@/components/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Map, Search, Copy, ArrowUpRight, Pencil, ClipboardList } from "lucide-react";
import { collectionLabels, type CollectedMap } from "@/lib/collection";

export function CopyMapCode({ code }: { code: string }) {
  const { locale } = useI18n();
  const [state, setState] = useState("");
  return (
    <span className="collection-code">
      <code>{code}</code>
      <Button
        size="sm"
        variant="ghost"
        aria-label={locale !== "zh" ? `Copy ${code}` : `复制 ${code}`}
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
        {state === "copied"
          ? locale !== "zh"
            ? "Copied"
            : "已复制"
          : locale !== "zh"
            ? "Copy"
            : "复制"}
      </Button>
      {state === "failed" && (
        <small role="status">
          {locale !== "zh" ? "Select and copy the code manually." : "请选中地图码手动复制。"}
        </small>
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
  const { locale } = useI18n();
  const en = locale !== "zh";
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
            CURATOR&apos;S COLLECTION / {String(items.length).padStart(2, "0")}
          </p>
          <h2>
            {manage
              ? en
                ? "Manage saved maps"
                : "维护收藏地图"
              : en
                ? "Maps worth exploring"
                : "地图收藏"}
          </h2>
        </div>
        <span className="collection-count">
          {en
            ? `${items.length} saved · ${items.filter((m) => m.test_status === "untested").length} untested`
            : `已收录 ${items.length} 张 · ${items.filter((m) => m.test_status === "untested").length} 张待实测`}
        </span>
      </div>
      <div className="collection-notice">
        <ClipboardList size={22} />
        <p>
          {en
            ? "Saved references, not tested recommendations. Rules and player counts are source notes; verify availability, balance and required mods in a private match."
            : "这里是待探索的地图收藏，不是实测推荐榜。人数和玩法来自原收藏记录，地图码有效性、平衡与所需 Mod 仍需开房确认。"}
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
            placeholder={
              en ? "Search all saved maps, authors or codes…" : "搜索全部收藏：名称、作者、地图码…"
            }
            aria-label={en ? "Search saved maps" : "搜索收藏地图"}
          />
        </div>
        <select
          aria-label={en ? "Filter saved maps" : "筛选收藏地图"}
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setLimit(12);
          }}
        >
          <option value="all">{en ? "All saved maps" : "全部收藏"}</option>
          <option value="named">{en ? "With a recorded name" : "已记录名称"}</option>
          <option value="unknown">{en ? "Name to be added" : "名称待补充"}</option>
          {(["untested", "working", "issues", "unavailable", "PVE", "PVP"] as const).map((k) => (
            <option key={k} value={k}>
              {collectionLabels[k][en ? 1 : 0]}
            </option>
          ))}
        </select>
        <span aria-live="polite">
          {en ? `${matches.length} results` : `${matches.length} 个结果`}
        </span>
      </div>
      <div className="collection-grid">
        {matches.slice(0, limit).map((m) => {
          const title =
            (en && m.title_en ? m.title_en : m.title) || (en ? "Unidentified map" : "名称待补充");
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
                    alt={
                      en ? `Original saved preview for ${m.map_code}` : `${m.map_code} 的原收藏预览`
                    }
                    loading="lazy"
                  />
                ) : (
                  <div className="collection-no-image">
                    <Map size={36} />
                    <span>{en ? "Preview in source post" : "预览请见原帖"}</span>
                  </div>
                )}
                {m.images.length > 0 && m.preview_kind && m.preview_kind !== "map" && (
                  <span className="collection-image-kind">
                    {m.preview_kind === "shared"
                      ? en
                        ? "Shared reference"
                        : "同作品参考图"
                      : en
                        ? "Source artwork"
                        : "原帖宣传图"}
                  </span>
                )}
                <span className={`collection-state state-${m.test_status}`}>
                  {collectionLabels[m.test_status][en ? 1 : 0]}
                </span>
              </Link>
              <div className="collection-card-body">
                <small>
                  {collectionLabels[m.category][en ? 1 : 0]}
                  {m.edition
                    ? ` · ${m.edition === "remix" ? (en ? "Remix" : "改编版") : m.edition === "original" ? (en ? "Original" : "原版") : en ? "Variant" : "玩法版本"}`
                    : ""}
                  {m.visibility === "hidden" ? (en ? " · Hidden" : " · 已隐藏") : ""}
                </small>
                <h3>
                  <Link href={`/maps/${m.id}`}>
                    {title}
                    <ArrowUpRight size={17} />
                  </Link>
                </h3>
                <p>
                  {(en ? m.summary_en || m.summary : m.summary) ||
                    (en
                      ? "Saved code and available preview only. Name, author and rules need confirmation."
                      : "已收录地图码及现有预览，名称、作者与玩法等待补充。")}
                </p>
                <div className="collection-meta">
                  <span>{m.author || (en ? "Author unknown" : "作者待确认")}</span>
                  <span>
                    {m.players
                      ? `${m.players}${en ? " players" : " 人"}`
                      : en
                        ? "Player count unknown"
                        : "人数待确认"}
                  </span>
                </div>
                <CopyMapCode code={m.map_code} />
                {admin && (
                  <Link className="collection-edit" href={`/maps/${m.id}/edit`}>
                    <Pencil size={14} />
                    {en ? "Edit archive" : "编辑档案"}
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!matches.length && (
        <p className="notice">{en ? "No matching saved maps." : "没有匹配的收藏地图。"}</p>
      )}
      {matches.length > limit && (
        <Button variant="outline" className="mt-6" onClick={() => setLimit((n) => n + 12)}>
          {en ? "Show 12 more maps" : "再显示 12 张地图"}
        </Button>
      )}
      <p className="caption collection-footnote">
        {en
          ? "Original minimaps are reference images, not current-version gameplay proof. A map code is not a downloadable ZIP; no file is fabricated."
          : "原始小地图仅供辨识，不代表当前版本实测结果。地图码不等于 ZIP 文件，未提供的地图包不设置虚假下载。"}
      </p>
    </section>
  );
}
