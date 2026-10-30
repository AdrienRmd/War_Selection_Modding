"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { T } from "@/components/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { displayNameIssue, initialsOf } from "@/lib/profile";

// Formulaire d'édition du profil (SB1) : pseudo + avatar. Le client recopie
// les règles serveur (lib/profile.ts, source unique) pour un retour immédiat,
// mais le serveur revalide tout — jamais confiance au client.

export function ProfileForm({
  initial,
}: {
  initial: { displayName: string; hasAvatar: boolean };
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState(initial.displayName);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const displayName = String(data.get("displayName") || "").trim();
    const avatar = fileRef.current?.files?.[0] || null;
    const removing = removeAvatar && !avatar;
    if (!avatar && !removing && displayName === initial.displayName) {
      setError("没有需要更新的内容。");
      return;
    }
    const issue = displayNameIssue(displayName);
    if (issue) return setError(issue);
    if (avatar) {
      if (avatar.type !== "image/png" && avatar.type !== "image/jpeg")
        return setError("头像只接受 PNG 或 JPEG 图片。");
      if (avatar.size > 2 * 1024 * 1024) return setError("头像不能超过 2 MB。");
    }
    setBusy(true);
    setError("");
    setSaved(false);
    data.set("displayName", displayName);
    if (removing) data.set("removeAvatar", "true");
    try {
      const r = await fetch("/api/account/profile", { method: "PATCH", body: data });
      const d = (await r.json().catch(() => ({}))) as {
        error?: string;
        user?: { displayName: string };
      };
      if (!r.ok) {
        setError(d.error || "修改失败，请稍后重试。");
        setBusy(false);
        return;
      }
      setName(d.user?.displayName ?? displayName);
      setSaved(true);
      setRemoveAvatar(false);
      if (fileRef.current) fileRef.current.value = "";
      setBusy(false);
      // Re-rendu serveur de l'en-tête (nouveau pseudo / avatar).
      router.refresh();
    } catch {
      setError("修改失败，请稍后重试。");
      setBusy(false);
    }
  }

  return (
    <form className="atlas-form panel" onSubmit={submit} noValidate>
      <h2>
        <T text="个人资料" />
      </h2>
      <div className="avatar-row">
        {initial.hasAvatar && !removeAvatar ? (
          <img
            className="avatar-thumb"
            src="/api/account/avatar"
            alt=""
            width={64}
            height={64}
          />
        ) : (
          <span className="avatar-thumb avatar-initials" aria-hidden="true">
            {initialsOf(name)}
          </span>
        )}
        <div className="avatar-fields">
          <label className="avatar-upload">
            <T text="上传头像" />
            <input
              ref={fileRef}
              name="avatar"
              type="file"
              accept="image/png,image/jpeg"
              onChange={() => setRemoveAvatar(false)}
            />
          </label>
          <p className="meta muted">
            <T text="PNG 或 JPEG，不超过 2 MB；重新上传会替换当前头像。" />
          </p>
          {initial.hasAvatar && (
            <label className="avatar-remove">
              <input
                type="checkbox"
                checked={removeAvatar}
                onChange={(e) => setRemoveAvatar(e.target.checked)}
              />{" "}
              <T text="移除头像" />
            </label>
          )}
        </div>
      </div>
      <label>
        <T text="显示名称" />{" "}
        <Input
          name="displayName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={40}
          autoComplete="nickname"
        />
      </label>
      <p className="meta muted">
        <T text="2 到 40 个字符：文字、数字、空格和 _ . - 符号。" />
      </p>
      {error && (
        <div className="notice error" role="alert">
          <T text={error} />
        </div>
      )}
      {saved && (
        <div className="notice" role="status">
          <T text="资料已更新。" />
        </div>
      )}
      <div className="form-submit">
        <Button className="button primary" type="submit" disabled={busy}>
          <T text={busy ? "正在保存…" : "保存修改"} />
        </Button>
      </div>
    </form>
  );
}
