"use client";
import { T, useI18n } from "@/components/i18n";

import { useCallback, useEffect, useState } from "react";
import Link from "@/components/site-link";
import { Map, ArrowUpRight, Users, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
export type PublicMap = {
  id: string;
  author: string;
  title: string;
  summary: string;
  description: string;
  game_version: string;
  players: number;
  category: string;
  mods: string;
  map_code: string;
  file_name: string;
  file_size: number;
  sha256: string;
  has_cover: boolean;
  created_at: string;
  reviewed_at: string | null;
  status?: string;
  feedback?: string;
  revision?: number;
};
export function CommunityMaps() {
  const { t } = useI18n();
  const [items, setItems] = useState<PublicMap[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [more, setMore] = useState(false),
    [query, setQuery] = useState("");
  const loadMaps = useCallback(
    async (offset = 0): Promise<{ items: PublicMap[]; hasMore: boolean }> => {
      const r = await fetch(`/api/atlas/maps?offset=${offset}`);
      const d = (await r.json()) as { error?: string; items: PublicMap[]; hasMore: boolean };
      if (!r.ok) throw new Error(d.error);
      return { items: d.items, hasMore: d.hasMore };
    },
    [],
  );
  async function fetchMaps(offset = 0) {
    setLoading(true);
    setError("");
    try {
      const d = await loadMaps(offset);
      setItems((a) => (offset ? [...a, ...d.items] : d.items));
      setMore(d.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : "暂时无法加载地图");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    loadMaps()
      .then((d) => {
        setItems(d.items);
        setMore(d.hasMore);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "暂时无法加载地图");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [loadMaps]);
  const visible = items.filter((m) =>
    [m.title, m.author, m.summary, m.category, t(m.title), t(m.summary), t(m.category)]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <section className="community-section">
      <div className="section-head">
        <div>
          <p className="eyebrow">PLAYER SUBMISSIONS</p>
          <h2>
            <T text={"社区战场"} />
          </h2>
        </div>
        <div className="search-input">
          <Search size={18} />
          <Input
            aria-label={t("搜索已加载的玩家地图")}
            placeholder={t("搜索已加载地图、作者…")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      {error ? (
        <div className="notice error" role="alert">
          <T text={error} />{" "}
          <Button onClick={() => fetchMaps()}>
            <T text={"重试"} />
          </Button>
        </div>
      ) : (
        <>
          <div className="community-grid">
            {visible.map((m) => (
              <Link href={`/maps/${m.id}`} className="map-card" key={m.id}>
                <div className="map-card-cover">
                  {m.has_cover ? (
                    <img
                      src={`/api/atlas/files/${m.id}?type=cover`}
                      alt={t(`${m.title} 的投稿封面`)}
                      loading="lazy"
                    />
                  ) : (
                    <Map size={45} />
                  )}
                  <span className="tag">
                    <T text={"已审核"} />
                  </span>
                </div>
                <div className="map-card-body">
                  <small>
                    <T text={m.category} /> / <T text={m.game_version} />
                  </small>
                  <h3>
                    <T text={m.title} />
                    <ArrowUpRight size={20} />
                  </h3>
                  <p>
                    <T text={m.summary} />
                  </p>
                  <div>
                    <span>
                      <Users size={15} /> <T text={m.players} /> <T text={"人"} />
                    </span>
                    <span>
                      <T text={m.author} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {loading && <Skeleton className="h-40 w-full rounded-none mt-4" />}
          {!loading && !items.length && (
            <div className="community-empty">
              <Map size={30} />
              <div>
                <h3>
                  <T text={"这里，为玩家的新战场留一个位置。"} />
                </h3>
                <p>
                  <T text={"尚无已审核的玩家投稿。斯大林格勒是编辑整理档案，不是玩家上传样例。"} />
                </p>
              </div>
              <Link className="button" href="/submit">
                <T text={"提交地图"} /> <ArrowUpRight size={16} />
              </Link>
            </div>
          )}
          {!loading && items.length > 0 && !visible.length && (
            <p className="notice">
              <T text={"当前已加载地图中没有匹配结果。"} />
            </p>
          )}
          {more && (
            <Button
              className="mt-5"
              variant="outline"
              disabled={loading}
              onClick={() => fetchMaps(items.length)}
            >
              <T text={"加载更多地图"} />
            </Button>
          )}
        </>
      )}
    </section>
  );
}
