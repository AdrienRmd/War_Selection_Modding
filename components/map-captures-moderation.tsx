"use client";
/** Modération des captures en jeu (finitions 01/11, chantier 7) — file admin
 *  (pending d'abord), publier / refuser, aperçu réel de l'image. Même esprit
 *  que replay-moderation : liste rafraîchie après chaque action. */
import { useCallback, useEffect, useState } from "react";
import { useBilingual } from "@/components/i18n";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RefreshCw } from "lucide-react";

interface MapCaptureView {
  id: string;
  mapId: string;
  caption: string | null;
  status: string;
  createdAt: string;
}

const STATUS_LABELS: Record<string, { zh: string; en: string }> = {
  pending: { zh: "待审核", en: "Pending" },
  published: { zh: "已公开", en: "Published" },
  rejected: { zh: "已拒绝", en: "Rejected" },
  withdrawn: { zh: "已撤回", en: "Withdrawn" },
};

export function MapCapturesModeration() {
  const l = useBilingual();
  const [items, setItems] = useState<MapCaptureView[] | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/map-captures/queue");
      const d = (await r.json()) as { items?: MapCaptureView[]; error?: string };
      if (!r.ok) throw Error(d.error);
      setItems(d.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "unavailable");
      setItems([]);
    }
  }, []);

  useEffect(() => {
    // Récupération initiale inline (pattern replay-moderation) : le setState
    // vit dans la promesse, jamais dans le corps synchrone de l'effet.
    let cancelled = false;
    fetch("/api/map-captures/queue")
      .then((r): Promise<{ items?: MapCaptureView[]; error?: string }> => r.json())
      .then((d) => {
        if (!cancelled) setItems(d.items ?? []);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "unavailable");
          setItems([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function moderate(id: string, status: "published" | "rejected") {
    try {
      const r = await fetch(`/api/map-captures/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) {
        const d = (await r.json()) as { error?: string };
        throw Error(d.error);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "unavailable");
    }
  }

  const pendingFirst = (items ?? []).slice().sort(
    (a, b) => Number(b.status === "pending") - Number(a.status === "pending"),
  );

  return (
    <section className="panel captures-moderation" aria-label={l("截图审核", "Capture moderation")}>
      <div className="section-head">
        <h2>{l("游戏内截图审核", "In-game capture moderation")}</h2>
        <Button size="sm" variant="ghost" onClick={() => void refresh()}>
          <RefreshCw size={14} />
          {l("刷新", "Refresh")}
        </Button>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {items === null ? (
        <p className="caption">{l("正在读取审核队列…", "Loading the moderation queue…")}</p>
      ) : pendingFirst.length === 0 ? (
        <p className="caption">
          {l("暂无截图待处理。", "No captures in the queue.")}
        </p>
      ) : (
        <ul className="captures-moderation-list">
          {pendingFirst.map((c) => (
            <li key={c.id}>
              <a href={`/api/map-captures/file/${c.id}`} target="_blank" rel="noreferrer">
                <img src={`/api/map-captures/file/${c.id}`} alt={c.caption || c.mapId} loading="lazy" />
              </a>
              <div className="captures-moderation-meta">
                <span>
                  {l("地图", "Map")}: <code>{c.mapId}</code>
                </span>
                {c.caption ? <span className="muted">{c.caption}</span> : null}
                <span className="muted">
                  {new Date(c.createdAt).toISOString().slice(0, 16).replace("T", " ")} ·{" "}
                  {STATUS_LABELS[c.status] ? l(STATUS_LABELS[c.status].zh, STATUS_LABELS[c.status].en) : c.status}
                </span>
                {c.status === "pending" ? (
                  <span className="captures-moderation-actions">
                    <Button size="sm" className="button" onClick={() => moderate(c.id, "published")}>
                      <CheckCircle2 size={14} /> {l("公开", "Publish")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => moderate(c.id, "rejected")}>
                      <XCircle size={14} /> {l("拒绝", "Reject")}
                    </Button>
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
