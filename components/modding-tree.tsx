"use client";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CloudDownload,
  Copy,
  Loader2,
  Search,
} from "lucide-react";
import { useBilingual, useI18n } from "@/components/i18n";
import { UpdatedDatasetBadge, useDatasetMeta } from "@/components/dataset-badge";
import {
  PATH_INDEX_URL,
  breadcrumbOf,
  capMapSize,
  childPath,
  hasInlineChildren,
  isExpandableNode,
  isLazyNode,
  resolveDeepLink,
  sanitizeChildren,
  searchPaths,
  countMatches,
  segmentsOf,
  treeFileUrl,
  type ModdingHome,
  type ModdingMeta,
  type ModdingNode,
  type ModdingPathIndex,
} from "@/lib/modding";

const CHILDREN_PAGE = 150;
const SEARCH_LIMIT = 60;
const UPDATED_BADGE = "modding-updated";

// --- Cache de session --------------------------------------------------------
// Module : survit aux remontées du composant dans la session. sessionStorage :
// survit aux navigations pleine page (garde-fou quota, ~60 nœuds <64 Ko).
// V3-P2 #9 : le cache module est borné (40 entrées, FIFO) — les gros nœuds
// (fichiers tree jusqu'à plusieurs Mo) ne peuvent plus y accumuler de la
// mémoire sans limite pendant une longue session de navigation.
const NODE_CACHE_MAX = 40;
const nodeCache = new Map<string, ModdingNode[]>();
const inflight = new Map<string, Promise<ModdingNode[]>>();
const SESSION_PREFIX = "ws-modding-node:";
const sessionKeys: string[] = [];

function cacheChildren(path: string, children: ModdingNode[]): void {
  nodeCache.set(path, children);
  capMapSize(nodeCache, NODE_CACHE_MAX);
}

function sessionGet(path: string): ModdingNode[] | null {
  try {
    const raw = sessionStorage.getItem(SESSION_PREFIX + path);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ModdingNode[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function sessionSet(path: string, children: ModdingNode[]): void {
  try {
    if (JSON.stringify(children).length > 65536) return; // gros nœuds : hors session
    sessionStorage.setItem(SESSION_PREFIX + path, JSON.stringify(children));
    sessionKeys.push(path);
    while (sessionKeys.length > 60) sessionStorage.removeItem(SESSION_PREFIX + sessionKeys.shift());
  } catch {
    // quota dépassé / mode privé : le cache module suffit.
  }
}

function fetchChildren(path: string): Promise<ModdingNode[]> {
  const cached = nodeCache.get(path);
  if (cached) return Promise.resolve(cached);
  const running = inflight.get(path);
  if (running) return running;
  const pending = fetch(treeFileUrl(path))
    .then((res) =>
      res.ok ? (res.json() as Promise<unknown>) : Promise.reject(new Error(String(res.status))),
    )
    .then((raw: unknown) => {
      // V3-P2 #8 : validation défensive avant tout usage — un JSON inattendu
      // (HTML d'erreur, objet, entrée sans k) devient un échec de chargement
      // géré par l'UI (failedPaths), pas un crash au rendu.
      const children = sanitizeChildren(raw);
      if (!children) throw new Error("bad children payload");
      cacheChildren(path, children);
      sessionSet(path, children);
      inflight.delete(path);
      return children;
    })
    .catch((error: unknown) => {
      inflight.delete(path);
      throw error;
    });
  inflight.set(path, pending);
  return pending;
}

function loadChildren(path: string): Promise<ModdingNode[]> {
  const cached = nodeCache.get(path);
  if (cached) return Promise.resolve(cached);
  const stored = sessionGet(path);
  if (stored) {
    cacheChildren(path, stored);
    return Promise.resolve(stored);
  }
  return fetchChildren(path);
}

// Index des chemins : chargé UNE fois, seulement à la première recherche.
let indexCache: ModdingPathIndex | null = null;
let indexInflight: Promise<ModdingPathIndex> | null = null;

function fetchPathIndex(): Promise<ModdingPathIndex> {
  if (indexCache) return Promise.resolve(indexCache);
  if (indexInflight) return indexInflight;
  indexInflight = fetch(PATH_INDEX_URL)
    .then((res) =>
      res.ok ? (res.json() as Promise<unknown>) : Promise.reject(new Error(String(res.status))),
    )
    .then((raw: unknown) => {
      const data = raw as ModdingPathIndex;
      indexCache = data;
      indexInflight = null;
      return data;
    })
    .catch((error: unknown) => {
      indexInflight = null;
      throw error;
    });
  return indexInflight;
}

export function ModdingTreeBrowser({
  home,
  meta,
  initialPath = "",
}: {
  home: ModdingHome;
  meta: ModdingMeta;
  /** Lien profond /modding?path=gameplay.root.unitType.5 (SSR : fil d'Ariane). */
  initialPath?: string;
}) {
  const { t } = useI18n();
  const l = useBilingual();
  const homeChildren = useMemo(() => home.ch ?? [], [home]);
  const [childrenByParent, setChildrenByParent] = useState<Map<string, ModdingNode[]>>(
    () => new Map([["", homeChildren]]),
  );
  const [openPaths, setOpenPaths] = useState<Set<string>>(() => new Set());
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [pendingPaths, setPendingPaths] = useState<Set<string>>(() => new Set());
  const [failedPaths, setFailedPaths] = useState<Set<string>>(() => new Set());
  const [resolveMissing, setResolveMissing] = useState<string | null>(null);
  const [limits, setLimits] = useState<Map<string, number>>(() => new Map());
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Badge SB4/SB6 : version du dataset publiée (publishedAt + compte), jamais en dur.
  const { meta: datasetMeta, failed: datasetFailed } = useDatasetMeta();

  // Recherche : état local + index chargé à la demande.
  const [query, setQuery] = useState("");
  const [indexState, setIndexState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [indexData, setIndexData] = useState<ModdingPathIndex | null>(null);
  const ensureIndex = useCallback(() => {
    if (indexCache) {
      setIndexData(indexCache);
      setIndexState("ready");
      return;
    }
    setIndexState((state) => (state === "idle" ? "loading" : state));
    fetchPathIndex()
      .then((data) => {
        setIndexData(data);
        setIndexState("ready");
      })
      .catch(() => setIndexState("error"));
  }, []);

  const syncUrl = useCallback((path: string) => {
    if (typeof window === "undefined") return;
    const url = path ? `/modding?path=${encodeURIComponent(path)}` : "/modding";
    window.history.replaceState(null, "", url);
  }, []);

  const mergeLevels = useCallback((levels: Map<string, ModdingNode[]>) => {
    setChildrenByParent((prev) => {
      const next = new Map(prev);
      for (const [path, children] of levels) next.set(path, children);
      return next;
    });
  }, []);

  const resolve = useCallback(
    async (path: string) => {
      setCurrentPath(path);
      setResolveMissing(null);
      syncUrl(path);
      if (!segmentsOf(path).length) {
        setOpenPaths(new Set());
        return;
      }
      try {
        const result = await resolveDeepLink(homeChildren, path, loadChildren);
        mergeLevels(result.levels);
        setOpenPaths(new Set(result.levels.keys()));
        if (result.missingAt !== null) setResolveMissing(result.missingAt);
      } catch {
        setResolveMissing(path);
      }
    },
    [homeChildren, mergeLevels, syncUrl],
  );

  // Montée : résout le lien profond (SSR a déjà rendu le fil d'Ariane). La
  // résolution est différée d'un micro-tick : les setState arrivent après le
  // premier rendu hydraté, jamais de façon synchrone dans l'effet.
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (alive && initialPath) resolve(initialPath);
    });
    return () => {
      alive = false;
    };
  }, [initialPath, resolve]);

  const toggle = useCallback(
    async (node: ModdingNode, path: string) => {
      setCurrentPath(path);
      setResolveMissing(null);
      syncUrl(path);
      if (openPaths.has(path)) {
        setOpenPaths((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
        return;
      }
      setOpenPaths((prev) => new Set(prev).add(path));
      if (hasInlineChildren(node) || !isLazyNode(node)) return;
      if (childrenByParent.has(path)) return;
      setPendingPaths((prev) => new Set(prev).add(path));
      setFailedPaths((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
      try {
        const children = await loadChildren(path);
        setChildrenByParent((prev) => new Map(prev).set(path, children));
      } catch {
        setFailedPaths((prev) => new Set(prev).add(path));
        setOpenPaths((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
      } finally {
        setPendingPaths((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
      }
    },
    [childrenByParent, openPaths, syncUrl],
  );

  const copyPath = useCallback((path: string) => {
    setCopiedPath(path);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedPath(null), 1500);
    const fallback = () => {
      try {
        const area = document.createElement("textarea");
        area.value = path;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
      } catch {
        // presse-papiers indisponible : l'icône reste « copié » sans garantie.
      }
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(path).catch(fallback);
    } else {
      fallback();
    }
  }, []);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const badge = (
    <UpdatedDatasetBadge
      testId={UPDATED_BADGE}
      meta={datasetMeta}
      failed={datasetFailed}
      count={datasetMeta?.counts?.treeFiles ?? meta.pathCount}
      noun="个参数节点"
    />
  );

  const queryResults = useMemo(
    () => (indexData && query.trim() ? searchPaths(indexData.paths, query, SEARCH_LIMIT) : []),
    [indexData, query],
  );
  const queryTotal = useMemo(
    () => (indexData && query.trim() ? countMatches(indexData.paths, query) : 0),
    [indexData, query],
  );
  const crumbs = useMemo(() => breadcrumbOf(currentPath), [currentPath]);

  const showMore = useCallback((parentPath: string) => {
    setLimits((prev) =>
      new Map(prev).set(parentPath, (prev.get(parentPath) ?? CHILDREN_PAGE) + 500),
    );
  }, []);

  const jumpTo = useCallback(
    (path: string) => {
      setQuery("");
      void resolve(path);
    },
    [resolve],
  );

  return (
    <section className="units-section modding-section" aria-label={t("参数树")}>
      <div className="section-head compact">
        <div>
          <h2>{t("参数树")}</h2>
          <p className="caption">{t(`共 ${meta.pathCount} 条可搜索路径`)}</p>
        </div>
        {badge}
      </div>

      <div className="units-toolbar">
        <div className="search-input units-search">
          <Search size={16} />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              ensureIndex();
            }}
            onFocus={ensureIndex}
            onKeyDown={(e) => {
              if (e.key === "Enter" && queryResults.length > 0) {
                e.preventDefault();
                jumpTo(queryResults[0]);
              }
            }}
            placeholder={l("搜索路径…", "Search paths…")}
            aria-label={l("搜索节点路径", "Search node paths")}
          />
        </div>
      </div>
      <p className="caption units-note">
        {l(
          "输入片段如 unitType.5 或 defaultFormation，点击结果直达节点。",
          "Type a fragment such as unitType.5 or defaultFormation, then click a result to jump straight to the node.",
        )}
      </p>

      {indexState === "loading" ? (
        <p className="caption" data-modding-index="loading">
          {l("正在载入路径索引…", "Loading path index…")}
        </p>
      ) : null}
      {indexState === "error" ? (
        <p className="notice" data-modding-index="error">
          {l("路径索引暂时不可用", "Path index unavailable")}{" "}
          <button type="button" className="modding-inline-action" onClick={ensureIndex}>
            {l("重试", "Try again")}
          </button>
        </p>
      ) : null}
      {indexState === "ready" && query.trim() && queryResults.length === 0 ? (
        <p className="notice">{l("没有匹配的路径。", "No matching paths.")}</p>
      ) : null}
      {queryResults.length > 0 ? (
        <div className="modding-search-block" data-modding-index="results">
          <p className="caption modding-search-meta">
            {t(`共 ${queryTotal} 条匹配，显示前 ${queryResults.length} 条`)}
          </p>
          <ul className="modding-search-results">
            {queryResults.map((path) => (
              <li key={path}>
                <a
                  href={`/modding?path=${encodeURIComponent(path)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    jumpTo(path);
                  }}
                >
                  {path}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <nav
        className="modding-breadcrumb"
        aria-label={t("路径导航")}
        data-modding-path={currentPath}
      >
        <a
          href="/modding"
          onClick={(e) => {
            e.preventDefault();
            jumpTo("");
          }}
        >
          {t("参数树")}
        </a>
        {crumbs.map((crumb, index) => (
          <Fragment key={crumb.path}>
            <span className="modding-crumb-sep" aria-hidden="true">
              /
            </span>
            {index === crumbs.length - 1 ? (
              <span className="modding-crumb-current">{crumb.key}</span>
            ) : (
              <a
                href={`/modding?path=${encodeURIComponent(crumb.path)}`}
                onClick={(e) => {
                  e.preventDefault();
                  jumpTo(crumb.path);
                }}
              >
                {crumb.key}
              </a>
            )}
          </Fragment>
        ))}
      </nav>

      {resolveMissing !== null ? (
        <p className="notice modding-missing">
          {l("路径未找到或不可展开", "Path not found or cannot be expanded")}:{" "}
          <code>{resolveMissing}</code>
        </p>
      ) : null}

      <div className="modding-tree">
        <NodeRows
          nodes={homeChildren}
          parentPath=""
          depth={0}
          currentPath={currentPath}
          openPaths={openPaths}
          pendingPaths={pendingPaths}
          failedPaths={failedPaths}
          childrenByParent={childrenByParent}
          limits={limits}
          largeSizes={indexData?.large}
          copiedPath={copiedPath}
          onToggle={toggle}
          onShowMore={showMore}
          onCopy={copyPath}
        />
      </div>
    </section>
  );
}

function NodeRows({
  nodes,
  parentPath,
  depth,
  currentPath,
  openPaths,
  pendingPaths,
  failedPaths,
  childrenByParent,
  limits,
  largeSizes,
  copiedPath,
  onToggle,
  onShowMore,
  onCopy,
}: {
  nodes: ModdingNode[];
  parentPath: string;
  depth: number;
  currentPath: string;
  openPaths: ReadonlySet<string>;
  pendingPaths: ReadonlySet<string>;
  failedPaths: ReadonlySet<string>;
  childrenByParent: ReadonlyMap<string, ModdingNode[]>;
  limits: ReadonlyMap<string, number>;
  largeSizes: Record<string, number> | undefined;
  copiedPath: string | null;
  onToggle: (node: ModdingNode, path: string) => void;
  onShowMore: (parentPath: string) => void;
  onCopy: (path: string) => void;
}) {
  const l = useBilingual();
  const limit = limits.get(parentPath) ?? CHILDREN_PAGE;
  const visible = nodes.slice(0, limit);
  return (
    <ul className="modding-nodes">
      {visible.map((node) => (
        <NodeRow
          key={node.k}
          node={node}
          path={childPath(parentPath, node.k)}
          depth={depth}
          currentPath={currentPath}
          openPaths={openPaths}
          pendingPaths={pendingPaths}
          failedPaths={failedPaths}
          childrenByParent={childrenByParent}
          limits={limits}
          largeSizes={largeSizes}
          copiedPath={copiedPath}
          onToggle={onToggle}
          onShowMore={onShowMore}
          onCopy={onCopy}
        />
      ))}
      {nodes.length > limit ? (
        <li className="modding-more">
          <button type="button" onClick={() => onShowMore(parentPath)}>
            {l(`显示更多（共 ${nodes.length} 个子节点）`, `Show more (${nodes.length} children)`)}
          </button>
        </li>
      ) : null}
    </ul>
  );
}

function NodeRow({
  node,
  path,
  depth,
  currentPath,
  openPaths,
  pendingPaths,
  failedPaths,
  childrenByParent,
  limits,
  largeSizes,
  copiedPath,
  onToggle,
  onShowMore,
  onCopy,
}: {
  node: ModdingNode;
  path: string;
  depth: number;
  currentPath: string;
  openPaths: ReadonlySet<string>;
  pendingPaths: ReadonlySet<string>;
  failedPaths: ReadonlySet<string>;
  childrenByParent: ReadonlyMap<string, ModdingNode[]>;
  limits: ReadonlyMap<string, number>;
  largeSizes: Record<string, number> | undefined;
  copiedPath: string | null;
  onToggle: (node: ModdingNode, path: string) => void;
  onShowMore: (parentPath: string) => void;
  onCopy: (path: string) => void;
}) {
  const l = useBilingual();
  const expandable = isExpandableNode(node);
  const lazy = isLazyNode(node);
  const open = openPaths.has(path);
  const pending = pendingPaths.has(path);
  const failed = failedPaths.has(path);
  const children = expandable ? (node.ch ?? childrenByParent.get(path) ?? []) : [];
  const childCount = hasInlineChildren(node) ? node.ch!.length : childrenByParent.get(path)?.length;
  const largeBytes = largeSizes?.[path];
  const value = typeof node.v === "string" ? node.v : null;
  const rowStyle = { "--modding-indent": `${Math.min(depth, 10) * 14 + 8}px` } as CSSProperties;

  return (
    <li className="modding-node">
      <div
        className="modding-row"
        data-open={open || undefined}
        data-current={path === currentPath || undefined}
        data-lazy={lazy || undefined}
      >
        <button
          type="button"
          className="modding-row-main"
          style={rowStyle}
          disabled={!expandable}
          aria-expanded={expandable ? open : undefined}
          aria-label={expandable ? l("展开或折叠", "Expand or collapse") : undefined}
          onClick={() => expandable && onToggle(node, path)}
        >
          {expandable ? (
            <ChevronRight size={14} className="modding-toggle" aria-hidden="true" />
          ) : (
            <span className="modding-toggle modding-leaf-dot" aria-hidden="true" />
          )}
          <span className="modding-key">{node.k}</span>
          {node.tp ? <span className="modding-type">{node.tp}</span> : null}
          {value !== null ? (
            <span className="modding-value" title={value}>
              {value}
            </span>
          ) : null}
          {expandable && childCount !== undefined ? (
            <span className="modding-child-count">{childCount}</span>
          ) : null}
          {expandable && childCount === undefined ? (
            <span className="modding-child-count" aria-hidden="true">
              …
            </span>
          ) : null}
        </button>
        {lazy ? (
          <CloudDownload
            size={13}
            className="modding-lazy-icon"
            aria-label={l("按需加载", "Loads on demand")}
          />
        ) : null}
        {largeBytes !== undefined ? (
          <AlertTriangle
            size={13}
            className="modding-large-icon"
            aria-label={l(
              `大文件节点（约 ${(largeBytes / 1048576).toFixed(1)} MB），加载可能较慢`,
              `Large node (≈ ${(largeBytes / 1048576).toFixed(1)} MB), loading may be slow`,
            )}
          />
        ) : null}
        <button
          type="button"
          className="modding-copy"
          onClick={() => onCopy(path)}
          aria-label={copiedPath === path ? l("已复制", "Copied") : l("复制路径", "Copy path")}
          title={l("复制路径", "Copy path")}
        >
          {copiedPath === path ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>

      {open ? (
        pending ? (
          <p className="modding-loading">
            <Loader2 size={14} className="modding-spin" aria-hidden="true" />
            {l("正在加载节点…", "Loading node…")}
          </p>
        ) : failed ? (
          <p className="modding-error">
            <AlertTriangle size={14} aria-hidden="true" />
            {l("节点加载失败", "Failed to load this node")}
            <button
              type="button"
              className="modding-inline-action"
              onClick={() => onToggle(node, path)}
            >
              {l("重试", "Try again")}
            </button>
          </p>
        ) : children.length > 0 ? (
          <NodeRows
            nodes={children}
            parentPath={path}
            depth={depth + 1}
            currentPath={currentPath}
            openPaths={openPaths}
            pendingPaths={pendingPaths}
            failedPaths={failedPaths}
            childrenByParent={childrenByParent}
            limits={limits}
            largeSizes={largeSizes}
            copiedPath={copiedPath}
            onToggle={onToggle}
            onShowMore={onShowMore}
            onCopy={onCopy}
          />
        ) : (
          <p className="modding-empty">{l("（空）", "(empty)")}</p>
        )
      ) : null}
    </li>
  );
}
