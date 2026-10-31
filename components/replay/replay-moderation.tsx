"use client";
/** Modération / suivi des replays soumis — liste (admin : toute la file ;
 *  auteur : ses soumissions) avec publier / refuser (+ note) / retirer.
 *  Réutilise les patterns de mod-dashboard (filtre de statut, rafraîchissement). */
import { useCallback, useEffect, useState } from "react";
import { useBilingual } from "@/components/i18n";
import { Button } from "@/components/ui/button";

interface ReplaySubmissionView {
  code: string;
  teamSize: number;
  mvpName: string | null;
  modeKey: string;
  status: string;
  createdAt: string;
  moderatedAt: string | null;
  note: string | null;
}

const STATUS_LABELS: Record<string, { zh: string; en: string }> = {
  pending: { zh: "待审核", en: "Pending" },
  published: { zh: "已公开", en: "Published" },
  rejected: { zh: "已拒绝", en: "Rejected" },
  withdrawn: { zh: "已撤回", en: "Withdrawn" },
};

async function getReplays(admin: boolean, signal?: AbortSignal): Promise<ReplaySubmissionView[]> {
  const r = await fetch("/api/replay/submissions" + (admin ? "?scope=admin" : ""), { signal });
  const d = (await r.json()) as { error?: string; items?: ReplaySubmissionView[] };
  if (!r.ok) throw Error(d.error);
  return d.items ?? [];
}

export function ReplayModeration({ admin = false }: { admin?: boolean }) {
  const l = useBilingual();
  const [items, setItems] = useState<ReplaySubmissionView[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setItems(await getReplays(admin));
    } catch (e) {
      setError(e instanceof Error ? e.message : l("无法加载", "Unable to load"));
    } finally {
      setBusy(false);
    }
  }, [admin, l]);

  useEffect(() => {
    const c = new AbortController();
    getReplays(admin, c.signal)
      .then((data) => setItems(data))
      .catch(() => undefined)
      .finally(() => setBusy(false));
    return () => c.abort();
  }, [admin]);

  async function moderate(code: string, status: "published" | "rejected" | "withdrawn") {
    setBusy(true);
    try {
      const r = await fetch(`/api/replay/${encodeURIComponent(code)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: status === "rejected" ? l("不符合收录标准。", "Does not meet the listing criteria.") : null }),
      });
      if (!r.ok) {
        const d = (await r.json()) as { error?: string };
        setError(d.error ?? l("操作失败。", "Action failed."));
      }
      await refresh();
    } catch {
      setError(l("操作失败。", "Action failed."));
      setBusy(false);
    }
  }

  return (
    <section className="replay-mod" aria-label={l("回放投稿管理", "Replay submissions")}>
      <div className="mod-controls">
        <h3>
          {l("回放投稿", "Replay submissions")}{" "}
          <span className="caption">
            ({items.filter((i) => i.status === "pending").length} {l("待审核", "pending")})
          </span>
        </h3>
        <Button variant="outline" onClick={() => void refresh()} disabled={busy}>
          {l("刷新", "Refresh")}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="notice error">
          {error}
        </p>
      ) : null}
      {busy && items.length === 0 ? (
        <p role="status">{l("正在加载…", "Loading…")}</p>
      ) : items.length === 0 ? (
        <p className="caption">
          {l("暂无回放投稿。在回放分析页提交后，会出现在这里等待审核。", "No replay submissions yet. Submit one from the replay analyzer and it will wait here for review.")}
        </p>
      ) : (
        <ul className="replay-mod-list">
          {items.map((item) => (
            <li key={item.code} className="replay-mod-item">
              <div>
                <a className="rp-mono" href={`/replay?code=rep-${encodeURIComponent(item.code)}`}>
                  rep-{item.code}
                </a>
                <span className="rp-recent-mode">
                  {" "}
                  {item.teamSize > 0 ? `${item.teamSize}v${item.teamSize}` : item.modeKey}
                  {item.mvpName ? ` · ${item.mvpName}` : ""}
                </span>
                <span className="rp-player-meta">
                  {" "}
                  · {new Date(item.createdAt).toLocaleString()} ·{" "}
                  {l(
                    STATUS_LABELS[item.status]?.zh ?? item.status,
                    STATUS_LABELS[item.status]?.en ?? item.status,
                  )}
                  {item.note ? ` — ${item.note}` : ""}
                </span>
              </div>
              <div className="replay-mod-actions">
                {admin && item.status === "pending" ? (
                  <>
                    <Button size="sm" onClick={() => void moderate(item.code, "published")}>
                      {l("公开", "Publish")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void moderate(item.code, "rejected")}>
                      {l("拒绝", "Reject")}
                    </Button>
                  </>
                ) : null}
                {item.status === "published" || item.status === "pending" ? (
                  <Button size="sm" variant="outline" onClick={() => void moderate(item.code, "withdrawn")}>
                    {l("撤回", "Withdraw")}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
