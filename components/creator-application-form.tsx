"use client";
/** Formulaire « Devenir créateur » (mission 07/11) — tout compte connecté
 *  peut candidater : nom affiché (unique), présentation courte, photo
 *  optionnelle (PNG/JPEG ≤ 2 MB, sniffée côté serveur), réseaux sociaux en
 *  whitelist (une plateforme par lien, URL https stricte), revendication de
 *  cartes/mods publiés du site (≤ 12 — le rapprochement automatique par
 *  compte couvre déjà ses propres contenus). Soumission multipart → statut
 *  « en attente » ; PUBLICATION UNIQUEMENT après modération admin.
 *  Le composant liste aussi mes candidatures (statut, note, retrait). */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useBilingual } from "@/components/i18n";
import SiteLink from "@/components/site-link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Plus, Trash2, Send, LogOut } from "lucide-react";

const PLATFORMS = [
  { id: "youtube", zh: "YouTube 频道", en: "YouTube channel" },
  { id: "youtube-gaming", zh: "YouTube Gaming", en: "YouTube Gaming" },
  { id: "twitch", zh: "Twitch 直播", en: "Twitch stream" },
  { id: "discord", zh: "Discord 服务器", en: "Discord server" },
  { id: "x", zh: "X（Twitter）", en: "X (Twitter)" },
  { id: "tiktok", zh: "TikTok", en: "TikTok" },
  { id: "instagram", zh: "Instagram", en: "Instagram" },
] as const;

const PLACEHOLDER_URL: Record<string, string> = {
  youtube: "https://www.youtube.com/@…",
  "youtube-gaming": "https://gaming.youtube.com/…",
  twitch: "https://www.twitch.tv/…",
  discord: "https://discord.gg/…",
  x: "https://x.com/…",
  tiktok: "https://www.tiktok.com/@…",
  instagram: "https://www.instagram.com/…",
};

interface Claimable {
  maps: Array<{ id: string; title: string; author: string }>;
  mods: Array<{ id: string; title: string }>;
}

interface ApplicationView {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  note: string | null;
  has_photo: boolean;
  links: Array<{ platform: string; url: string }>;
}

const STATUS_KEYS: Record<string, { zh: string; en: string }> = {
  pending: { zh: "等待审核", en: "Pending review" },
  published: { zh: "已公开", en: "Published" },
  rejected: { zh: "已拒绝", en: "Rejected" },
  withdrawn: { zh: "已撤回", en: "Withdrawn" },
};

export function CreatorApplicationForm({ defaultName }: { defaultName: string }) {
  const l = useBilingual();
  const [name, setName] = useState(defaultName.slice(0, 60));
  const [bio, setBio] = useState("");
  const [links, setLinks] = useState<Array<{ platform: string; url: string }>>([]);
  const [claimable, setClaimable] = useState<Claimable | null>(null);
  const [claimedMaps, setClaimedMaps] = useState<Set<string>>(new Set());
  const [claimedMods, setClaimedMods] = useState<Set<string>>(new Set());
  const [apps, setApps] = useState<ApplicationView[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);

  const canSubmit = useMemo(
    () => name.trim().length >= 1 && !busy && !apps?.some((a) => a.status === "pending"),
    [name, busy, apps],
  );

  useEffect(() => {
    fetch("/api/creators/apply")
      .then((r) => (r.ok ? (r.json() as Promise<Claimable | null>) : null))
      .then((d) => setClaimable(d))
      .catch(() => setClaimable(null));
    refreshApplications();
  }, []);

  function refreshApplications() {
    fetch("/api/creators/applications")
      .then((r) => (r.ok ? (r.json() as Promise<{ items?: ApplicationView[] }>) : { items: [] }))
      .then((d) => setApps(d.items ?? []))
      .catch(() => setApps([]));
  }

  function toggleClaim(store: Set<string>, id: string, set: (s: Set<string>) => void) {
    const next = new Set(store);
    if (next.has(id)) next.delete(id);
    else if (claimedMaps.size + claimedMods.size < 12) next.add(id);
    set(next);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    const element = e.currentTarget;
    setBusy(true);
    setMessage("");
    setOk(false);
    try {
      const application = {
        name: name.trim(),
        bio: bio.trim(),
        links: links.filter((x) => x.platform && x.url.trim()),
        mapIds: [...claimedMaps],
        modIds: [...claimedMods],
      };
      const form = new FormData();
      form.set("application", JSON.stringify(application));
      const photo = element.querySelector<HTMLInputElement>('input[type="file"]')?.files?.[0];
      if (photo) form.set("photo", photo);
      const r = await fetch("/api/creators/apply", { method: "POST", body: form });
      const d = (await r.json()) as { error?: string; warning?: string };
      if (!r.ok) throw new Error(d.error || l("提交未完成", "Submission failed"));
      setOk(true);
      setMessage(
        d.warning
          ? l("申请已提交（头像未保存：只接受 PNG 或 JPEG，最大 2 MB）。", "Application submitted (photo not saved: PNG or JPEG only, max 2 MB).")
          : l("申请已提交，等待审核。", "Application submitted, pending review."),
      );
      setBio("");
      setLinks([]);
      setClaimedMaps(new Set());
      setClaimedMods(new Set());
      element.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach((i) => (i.value = ""));
      refreshApplications();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : l("提交未完成", "Submission failed"));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/creators/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error || l("撤回未完成", "Withdraw failed"));
      setOk(true);
      setMessage(l("已撤回创作者档案。", "Creator profile withdrawn."));
      refreshApplications();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : l("撤回未完成", "Withdraw failed"));
      setOk(false);
    } finally {
      setBusy(false);
    }
  }

  const pendingExists = apps?.some((a) => a.status === "pending");
  const published = apps?.find((a) => a.status === "published");

  return (
    <section className="collection-management creator-apply">
      {published ? (
        <p className="notice success">
          {l("你的创作者档案已公开：", "Your creator profile is live:")}{" "}
          <SiteLink className="name-link" href={`/createurs/${published.id}`}>{l("查看档案", "View profile")}</SiteLink>
        </p>
      ) : null}
      {pendingExists ? (
        <p role="status" className="notice">
          {l("你已有一份待审申请，审核通过或撤回后才能重新提交。", "You already have a pending application; withdraw it or wait for review before applying again.")}
        </p>
      ) : null}
      <form className="atlas-form creator-apply-form" onSubmit={submit}>
        <label>
          {l("创作者名称（必填，全站唯一）", "Creator name (required, unique site-wide)")}
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            required
            aria-label={l("创作者名称", "Creator name")}
          />
        </label>
        <label>
          {l("简介（500 字以内）", "Short bio (max 500 characters)")}
          <textarea
            className="creator-bio-input"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={500}
            rows={4}
            aria-label={l("简介", "Short bio")}
          />
        </label>
        <fieldset className="creator-links-editor">
          <legend>{l("社交网络（最多 6 个，https 白名单域名）", "Social networks (max 6, https whitelisted domains)")}</legend>
          {links.map((link, i) => (
            <div className="creator-link-row" key={i}>
              <select
                value={link.platform}
                aria-label={l("平台", "Platform")}
                onChange={(e) =>
                  setLinks((prev) => prev.map((x, j) => (j === i ? { ...x, platform: e.target.value } : x)))
                }
              >
                {PLATFORMS.filter((p) => p.id === link.platform || !links.some((x) => x.platform === p.id)).map((p) => (
                  <option key={p.id} value={p.id}>
                    {l(p.zh, p.en)}
                  </option>
                ))}
              </select>
              <Input
                type="url"
                inputMode="url"
                placeholder={PLACEHOLDER_URL[link.platform] ?? "https://…"}
                value={link.url}
                onChange={(e) => setLinks((prev) => prev.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                aria-label={l("链接地址", "Link URL")}
              />
              <Button type="button" variant="outline" onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))}>
                <Trash2 size={15} aria-hidden="true" />
                <span className="visually-hidden">{l("删除链接", "Remove link")}</span>
              </Button>
            </div>
          ))}
          {links.length < 6 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const free = PLATFORMS.find((p) => !links.some((x) => x.platform === p.id));
                if (free) setLinks((prev) => [...prev, { platform: free.id, url: "" }]);
              }}
            >
              <Plus size={15} /> {l("添加链接", "Add a link")}
            </Button>
          ) : null}
        </fieldset>
        <label className="upload-box">
          <ImageIcon size={26} />
          <strong>{l("头像（可选）", "Photo (optional)")}</strong>
          <span>{l("PNG / JPEG · 最大 2 MB", "PNG / JPEG · max 2 MB")}</span>
          <Input type="file" name="photo" accept="image/png,image/jpeg" />
        </label>
        {claimable && (claimable.maps.length > 0 || claimable.mods.length > 0) ? (
          <fieldset className="creator-claims">
            <legend>
              {l("关联地图与 Mod（可选，最多 12 项，需管理员确认）", "Associate maps & mods (optional, max 12, admin-confirmed)")}
            </legend>
            {claimable.maps.length > 0 ? (
              <div className="creator-claims-group">
                <span className="label-text">{l("地图", "Maps")}</span>
                <ul>
                  {claimable.maps.map((m) => (
                    <li key={m.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={claimedMaps.has(m.id)}
                          onChange={() => toggleClaim(claimedMaps, m.id, setClaimedMaps)}
                        />
                        <span>
                          {m.title} <small className="label-text">{m.author}</small>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {claimable.mods.length > 0 ? (
              <div className="creator-claims-group">
                <span className="label-text">{l("Mod", "Mod")}</span>
                <ul>
                  {claimable.mods.map((m) => (
                    <li key={m.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={claimedMods.has(m.id)}
                          onChange={() => toggleClaim(claimedMods, m.id, setClaimedMods)}
                        />
                        <span>{m.title}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </fieldset>
        ) : null}
        <Button type="submit" disabled={!canSubmit}>
          <Send size={16} /> {l("提交申请", "Submit application")}
        </Button>
      </form>

      {apps && apps.length ? (
        <div className="creator-my-applications">
          <h3>{l("我的申请", "My applications")}</h3>
          <ul>
            {apps.map((a) => (
              <li key={a.id}>
                <strong>{a.name}</strong>
                <span className={`tag label-text creator-status-${a.status}`}>
                  {l(STATUS_KEYS[a.status]?.zh ?? a.status, STATUS_KEYS[a.status]?.en ?? a.status)}
                </span>
                {a.note ? <small className="label-text">{a.note}</small> : null}
                {a.status === "published" ? (
                  <SiteLink className="name-link" href={`/createurs/${a.id}`}>{l("查看档案", "View profile")}</SiteLink>
                ) : null}
                {a.status === "pending" || a.status === "published" ? (
                  <Button type="button" variant="outline" disabled={busy} onClick={() => withdraw(a.id)}>
                    <LogOut size={15} /> {l("撤回", "Withdraw")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {busy ? (
        <p role="status">{l("处理中…", "Working…")}</p>
      ) : null}
      {message ? (
        <p role={ok ? "status" : "alert"} className={ok ? "notice success" : "notice error"}>
          {message}
        </p>
      ) : null}
    </section>
  );
}
