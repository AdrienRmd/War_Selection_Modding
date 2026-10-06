"use client";
import { useState, type FormEvent } from "react";
import { useBilingual } from "@/components/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Image as ImageIcon, Trash2, UserPlus } from "lucide-react";
import type { Creator } from "@/lib/creators-server";
function initials(name: string) {
  const clean = name.trim();
  return clean ? clean.slice(0, 2) : "?";
}
export function CreatorsManager({ initial }: { initial: Creator[] | null }) {
  const l = useBilingual();
  const [items, setItems] = useState<Creator[] | null>(initial),
    [name, setName] = useState(""),
    [role, setRole] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [ok, setOk] = useState(false);
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const element = e.currentTarget;
    const form = new FormData(element);
    setBusy(true);
    setMessage("");
    setOk(false);
    try {
      const r = await fetch("/api/creators", { method: "POST", body: form }),
        d = (await r.json()) as { error?: string; items?: Creator[] };
      if (!r.ok) throw new Error(d.error || l("添加未完成", "Add failed"));
      setItems(d.items || []);
      setName("");
      setRole("");
      element
        .querySelectorAll<HTMLInputElement>('input[type="file"]')
        .forEach((i) => (i.value = ""));
      setOk(true);
      setMessage(l("创作者已添加。", "Creator added."));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : l("添加未完成", "Add failed"));
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    setOk(false);
    try {
      const r = await fetch(`/api/creators/${id}`, { method: "DELETE" }),
        d = (await r.json()) as { error?: string; items?: Creator[] };
      if (!r.ok) throw new Error(d.error || l("移除未完成", "Remove failed"));
      setItems(d.items || []);
      setOk(true);
      setMessage(l("创作者已移除。", "Creator removed."));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : l("移除未完成", "Remove failed"));
    } finally {
      setBusy(false);
    }
  }
  if (items === null)
    return (
      <p role="alert" className="notice error">
        {l(
          "创作者名单暂时无法读取，请稍后重试。",
          "The creator list is unavailable. Please try again later.",
        )}
      </p>
    );
  return (
    <section className="collection-management creators-management">
      <div>
        <h2>{l("创作者名单", "Creator roster")}</h2>
        <p>
          {l(
            "首页红色横幅按此名单显示。添加名称、职务与头像，或移除成员。",
            "The homepage red banner mirrors this roster. Add a name, role and photo, or remove a member.",
          )}
        </p>
      </div>
      <form className="atlas-form creators-form" onSubmit={add}>
        <label>
          {l("名称（必填）", "Name (required)")}
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            required
            aria-label={l("创作者名称", "Creator name")}
          />
        </label>
        <label>
          {l("职务（可选）", "Role (optional)")}
          <Input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            maxLength={60}
            placeholder={l("例如：创始人、地图作者", "e.g. Founder, map author")}
            aria-label={l("创作者职务", "Creator role")}
          />
        </label>
        <label className="upload-box">
          <ImageIcon size={26} />
          <strong>{l("头像（可选）", "Photo (optional)")}</strong>
          <span>{l("PNG / JPEG · 最大 2 MB", "PNG / JPEG · max 2 MB")}</span>
          <Input type="file" name="photo" accept="image/png,image/jpeg" />
        </label>
        <Button type="submit" disabled={busy || !name.trim()}>
          <UserPlus size={16} /> {l("添加到横幅", "Add to banner")}
        </Button>
      </form>
      {items.length ? (
        <ul className="creators-admin-list">
          {items.map((c) => (
            <li key={c.id}>
              {c.has_photo ? (
                <img className="creator-avatar" src={`/api/creators/${c.id}`} alt={c.name} />
              ) : (
                <span className="creator-avatar creator-initial" aria-hidden="true">
                  {initials(c.name)}
                </span>
              )}
              <div className="creators-admin-meta">
                <strong>{c.name}</strong>
                {c.role && <small>{c.role}</small>}
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={busy}>
                    <Trash2 size={15} /> {l("移除", "Remove")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogTitle>{l("移除此创作者？", "Remove this creator?")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {l(
                      "将从首页红色横幅移除该成员并删除其头像，此操作不可撤销。",
                      "The member disappears from the homepage red banner and their photo is deleted. This cannot be undone.",
                    )}
                  </AlertDialogDescription>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{l("取消", "Cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove(c.id)}>
                      {l("确认移除", "Remove")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </li>
          ))}
        </ul>
      ) : (
        <p className="notice">
          {l("名单为空：横幅暂不显示。", "The roster is empty: the banner stays hidden.")}
        </p>
      )}
      {busy && <p role="status">{l("处理中…", "Working…")}</p>}
      {message && (
        <p role={ok ? "status" : "alert"} className={ok ? "notice success" : "notice error"}>
          {message}
        </p>
      )}
    </section>
  );
}
