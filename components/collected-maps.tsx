"use client";
import { useEffect, useState } from "react";
import Link from "@/components/site-link";
import { T, useBilingual, useI18n } from "@/components/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Map, Search, Copy, ArrowUpRight, Pencil, ClipboardList } from "lucide-react";
import { collectionLabels, type CollectedMap } from "@/lib/collection";
import { mapName, mapNote, mapSearchExtra } from "@/lib/collection-i18n";

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
  const label = (pair: readonly [string, string] | undefined) =>
    pair ? (locale === "zh" ? pair[0] : t(pair[1])) : "";
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [playerFilter, setPlayerFilter] = useState("all"),
    // Tri du listing (finitions 01/11) : « recent » (défaut) = ordre d'import
    // décroissant — collected_at est uniforme (2026-09-22, date d'import), ce
    // n'est PAS un signal de fraîcheur par carte ; la mention discrète sous la
    // barre l'assume. Persisté en localStorage (leçon 16), lu APRÈS montage
    // pour éviter tout écart d'hydratation SSR/client.
    [sort, setSort] = useState<"recent" | "az" | "tested">("recent"),
    [limit, setLimit] = useState(12);
  // Préférence de tri persistée (leçon 16) : lue APRÈS l'hydratation via
  // callback asynchrone — jamais pendant le rendu initial (le HTML serveur
  // rend toujours le tri par défaut « recent », aucun écart d'hydratation).
  useEffect(() => {
    const saved = window.localStorage.getItem("atlas.maps.sort");
    const apply = window.setTimeout(() => {
      if (saved === "az" || saved === "tested" || saved === "recent") setSort(saved);
    }, 0);
    return () => window.clearTimeout(apply);
  }, []);
  const applySort = (value: "recent" | "az" | "tested") => {
    setSort(value);
    try {
      window.localStorage.setItem("atlas.maps.sort", value);
    } catch {
      /* stockage indisponible (navigation privée) : tri non persisté */
    }
  };
  // Filtre « Joueurs : NvN » (finitions 01/11) — construit sur les formats
  // RÉELS des données servies : champ players, N = players/2 équipes quand il
  // est pair. Les cartes sans nombre (et les comptes impairs — équipes
  // asymétriques, ex. 15) ne forment pas de groupe NvN et restent dans
  // « Tous ». L'entrée « Non renseigné » n'apparaît que si la volumétrie est
  // significative (≥ 10 fiches).
  const playerFormats = (() => {
    // NB : lucide-react exporte une icône `Map` qui masque le constructeur
    // global dans ce module — comptage via objet, pas `new Map()`.
    const counts: Record<number, number> = {};
    let unknown = 0;
    for (const m of items) {
      if (m.players == null) unknown++;
      else if (m.players % 2 === 0 && m.players >= 2) {
        const n = m.players / 2;
        counts[n] = (counts[n] ?? 0) + 1;
      }
    }
    const teams = Object.entries(counts)
      .map(([k, v]) => [Number(k), v] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    return { teams, unknown };
  })();
  const playerMatch = (m: CollectedMap) =>
    playerFilter === "all" ||
    (playerFilter === "none" ? m.players == null : m.players === Number(playerFilter) * 2);
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
        // Recherche trilingue (chantier 4c) : le dictionnaire ajoute les
        // noms/notes FR et les corrections EN au corpus cherchable.
        mapSearchExtra(m),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase()) &&
      (filter === "all" ||
        (filter === "named" && !!m.title) ||
        (filter === "unknown" && !m.title) ||
        filter === m.test_status ||
        filter === m.category) &&
      playerMatch(m),
  );
  // Tri appliquée au rendu (finitions 01/11) : récent = ordre d'import
  // décroissant (source_order) ; A→Z = locale du visiteur sur le titre
  // affiché (repli sur le code de partage si la fiche n'a pas de nom) ;
  // testées d'abord = tout statut ≠ « 待实测 » avant les non testées,
  // à statut égal par ordre d'import décroissant.
  const sortedMatches = (() => {
    const list = [...matches];
    if (sort === "az") {
      const coll = locale === "zh" ? "zh-Hans-CN" : locale;
      const titleOf = (m: CollectedMap) => mapName(m, locale);
      list.sort((a, b) => titleOf(a).localeCompare(titleOf(b), coll, { numeric: true }));
    } else if (sort === "tested") {
      list.sort(
        (a, b) =>
          Number(a.test_status === "untested") - Number(b.test_status === "untested") ||
          b.source_order - a.source_order,
      );
    } else {
      list.sort((a, b) => b.source_order - a.source_order);
    }
    return list;
  })();
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
        <select
          aria-label={l("按人数筛选", "Filter by player count")}
          value={playerFilter}
          onChange={(e) => {
            setPlayerFilter(e.target.value);
            setLimit(12);
          }}
        >
          <option value="all">{l("人数：全部", "Players: all")}</option>
          {playerFormats.teams.map(([n, count]) => (
            <option key={n} value={String(n)}>
              {`${n}v${n} · ${count}`}
            </option>
          ))}
          {playerFormats.unknown >= 10 && (
            <option value="none">
              {`${l("人数待确认", "Player count unknown")} · ${playerFormats.unknown}`}
            </option>
          )}
        </select>
        <select
          aria-label={l("排序方式", "Sort order")}
          value={sort}
          onChange={(e) => {
            applySort(e.target.value as "recent" | "az" | "tested");
            setLimit(12);
          }}
        >
          <option value="recent">{l("最新收录", "Recently added")}</option>
          <option value="az">{l("名称 A→Z", "Name A→Z")}</option>
          <option value="tested">{l("已实测优先", "Tested first")}</option>
        </select>
        <span aria-live="polite">
          {locale === "zh"
            ? `${matches.length} 个结果`
            : t(`${matches.length} results`)}
        </span>
      </div>
      {sort === "recent" && (
        <p className="caption collection-sort-note">
          {l("按收录导入顺序展示。", "Shown by collection import order.")}
        </p>
      )}
      <div className="collection-grid">
        {sortedMatches.slice(0, limit).map((m) => {
          // Nom public trilingue (dictionnaire → données → défaut « Carte <code> »
          // localisé) — plus jamais « Nom à compléter » en front public.
          const title = mapName(m, locale);
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
                  {mapNote(m, locale) ||
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
