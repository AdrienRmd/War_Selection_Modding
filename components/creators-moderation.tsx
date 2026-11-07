"use client";
/** File de modération des candidatures « créateur » (mission 07/11) —
 *  patron des soumissions replays : chaque candidature en attente est
 *  présentée avec la photo, la bio, les réseaux, le compte demandeur et
 *  les revendications de cartes/mods (avec leur auteur réel, pour repérer
 *  une revendication douteuse). Actions admin : publier / rejeter (+note) /
 *  retirer ; décocher une revendication AVANT publication la retire
 *  (itemIds remplace la sélection). Les profils publiés restent listés
 *  dans le gestionnaire de bannière existant (creators-manager). */
import { useEffect, useState } from "react";
import { useBilingual } from "@/components/i18n";
import SiteLink from "@/components/site-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, LogOut } from "lucide-react";

interface ApplicationView {
  id: string;
  name: string;
  bio: string;
  has_photo: boolean;
  status: string;
  createdAt: string;
  moderatedAt: string | null;
  note: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  links: Array<{ platform: string; url: string }>;
  items: Array<{ kind: "map" | "mod"; id: string; title: string | null; ownerName: string | null }>;
}

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  "youtube-gaming": "YouTube Gaming",
  twitch: "Twitch",
  discord: "Discord",
  x: "X",
  tiktok: "TikTok",
  instagram: "Instagram",
};

const STATUS_KEYS: Record<string, { zh: string; en: string }> = {
  pending: { zh: "等待审核", en: "Pending" },
  published: { zh: "已公开", en: "Published" },
  rejected: { zh: "已拒绝", en: "Rejected" },
  withdrawn: { zh: "已撤回", en: "Withdrawn" },
};

export function CreatorsModeration() {
  const l = useBilingual();
  const [items, setItems] = useState<ApplicationView[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [kept, setKept] = useState<Record<string, Set<string>>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    fetch("/api/creators/applications?scope=admin")
      .then((r) => (r.ok ? (r.json() as Promise<{ items?: ApplicationView[] }>) : { items: [] }))
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]));
  }, []);

  async function moderate(id: string, action: "publish" | "reject" | "withdraw") {
    if (busy) return;
    setBusy(true);
    setMessage("");
    setOk(false);
    try {
      const body: Record<string, unknown> = { id, action };
      const note = (notes[id] ?? "").trim();
      if (note) body.note = note;
      if (action === "publish" && kept[id]) body.itemIds = [...kept[id]!];
      const r = await fetch("/api/creators/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = (await r.json()) as { error?: string; item?: ApplicationView };
      if (!r.ok) throw new Error(d.error || l("操作未完成", "Action failed"));
      setItems((prev) => (prev ?? []).map((x) => (x.id === id ? { ...x, ...d.item, ownerName: x.ownerName, ownerEmail: x.ownerEmail } : x)));
      setOk(true);
      setMessage(
        action === "publish"
          ? l("创作者档案已公开。", "Creator profile published.")
          : action === "reject"
            ? l("申请已拒绝。", "Application rejected.")
            : l("创作者档案已撤回。", "Creator profile withdrawn."),
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : l("操作未完成", "Action failed"));
    } finally {
      setBusy(false);
    }
  }

  if (items === null)
    return (
      <p role="status" className="notice">
        {l("正在读取创作者申请…", "Loading creator applications…")}
      </p>
    );

  const pending = items.filter((x) => x.status === "pending");
  const rest = items.filter((x) => x.status !== "pending");

  return (
    <section className="collection-management creators-moderation">
      <div>
        <h2>{l("创作者申请", "Creator applications")}</h2>
        <p>
          {l(
            "公开一份创作者档案前必须人工审核：核对身份、社交链接与所关联的作品。",
            "Every creator profile is reviewed by a human before going live: identity, social links and associated works.",
          )}
        </p>
      </div>
      {pending.length === 0 ? (
        <p className="notice">{l("没有待审的创作者申请。", "No pending creator applications.")}</p>
      ) : (
        <ul className="creators-queue">
          {pending.map((app) => {
            const keptSet = kept[app.id] ?? new Set(app.items.map((i) => i.id));
            return (
              <li key={app.id} className="creators-queue-item panel">
                <div className="creators-queue-head">
                  {app.has_photo ? (
                    <img className="creator-avatar" src={`/api/creators/${app.id}`} alt="" width={56} height={56} />
                  ) : (
                    <span className="creator-avatar creator-initial" aria-hidden="true">
                      {app.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <strong>{app.name}</strong>
                    <p className="label-text">
                      {l("申请人：", "Applicant: ")}
                      {app.ownerName ?? "?"}
                      {app.ownerEmail ? ` (${app.ownerEmail})` : ""}
                    </p>
                  </div>
                </div>
                {app.bio ? <p className="creators-queue-bio">{app.bio}</p> : null}
                {app.links.length ? (
                  <ul className="creators-links">
                    {app.links.map((link) => (
                      <li key={link.platform}>
                        <a className="creators-link-chip" href={link.url} target="_blank" rel="noopener noreferrer nofollow">
                          {PLATFORM_LABELS[link.platform] ?? link.platform}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {app.items.length ? (
                  <div className="creators-queue-claims">
                    <span className="label-text">{l("关联内容（取消勾选即从档案移除）：", "Associated content (uncheck to exclude):")}</span>
                    <ul>
                      {app.items.map((item) => (
                        <li key={`${item.kind}-${item.id}`}>
                          <label>
                            <input
                              type="checkbox"
                              checked={keptSet.has(item.id)}
                              onChange={() => {
                                const next = new Set(kept[app.id] ?? app.items.map((i) => i.id));
                                if (next.has(item.id)) next.delete(item.id);
                                else next.add(item.id);
                                setKept((prev) => ({ ...prev, [app.id]: next }));
                              }}
                            />
                            <span>
                              {item.kind === "map" ? l("地图", "Map") : l("Mod", "Mod")} · {item.title ?? item.id}
                              {item.ownerName ? <small className="label-text"> — {item.ownerName}</small> : null}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="creators-queue-actions">
                  <Input
                    placeholder={l("审核备注（可选）", "Moderation note (optional)")}
                    value={notes[app.id] ?? ""}
                    maxLength={300}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [app.id]: e.target.value }))}
                    aria-label={l("审核备注", "Moderation note")}
                  />
                  <Button type="button" disabled={busy} onClick={() => moderate(app.id, "publish")}>
                    <Check size={15} /> {l("公开档案", "Publish")}
                  </Button>
                  <Button type="button" variant="outline" disabled={busy} onClick={() => moderate(app.id, "reject")}>
                    <X size={15} /> {l("拒绝", "Reject")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {rest.length ? (
        <details className="creators-queue-rest">
          <summary>
            {l(`已处理的申请（${rest.length} 份）`, `${rest.length} processed application(s)`)}
          </summary>
          <ul>
            {rest.map((app) => (
              <li key={app.id}>
                <strong>{app.name}</strong>
                <span className={`tag label-text creator-status-${app.status}`}>
                  {l(STATUS_KEYS[app.status]?.zh ?? app.status, STATUS_KEYS[app.status]?.en ?? app.status)}
                </span>
                {app.status === "published" ? (
                  <SiteLink className="name-link" href={`/createurs/${app.id}`}>{l("查看档案", "View profile")}</SiteLink>
                ) : null}
                {app.note ? <small className="label-text">{app.note}</small> : null}
                <Button type="button" variant="outline" disabled={busy} onClick={() => moderate(app.id, "withdraw")}>
                  <LogOut size={14} /> {l("撤回", "Withdraw")}
                </Button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {message ? (
        <p role={ok ? "status" : "alert"} className={ok ? "notice success" : "notice error"}>
          {message}
        </p>
      ) : null}
    </section>
  );
}
