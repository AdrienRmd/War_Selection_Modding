"use client";
import { useState } from "react";
import { T } from "@/components/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { postAuth } from "@/components/auth/shared";

// Client mirror of the server rules for POST /api/auth/change-password:
// current password 1..128, new password 10..128 and not a common password.
// Server-side errors (wrong current password → 401, common password → 400,
// anonymous caller → 401) arrive as CN i18n keys and render through <T>.
export function ChangePasswordForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") || "");
    const newPassword = String(data.get("newPassword") || "");
    const confirmPassword = String(data.get("confirmPassword") || "");
    const invalid = validateChangePasswordFields({
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (invalid) return setError(invalid);
    setBusy(true);
    setError("");
    setUpdated(false);
    const d = await postAuth("change-password", { currentPassword, newPassword });
    if (d.ok) {
      form.reset();
      setUpdated(true);
      setBusy(false);
      return;
    }
    setError(d.error || "修改失败，请稍后重试。");
    setBusy(false);
  }
  return (
    <form className="atlas-form panel" onSubmit={submit} noValidate>
      <h2>
        <T text="修改密码" />
      </h2>
      <label>
        <T text="当前密码" />{" "}
        <Input
          name="currentPassword"
          type="password"
          required
          minLength={1}
          maxLength={128}
          autoComplete="current-password"
        />
      </label>
      <label>
        <T text="新密码" />{" "}
        <Input
          name="newPassword"
          type="password"
          required
          minLength={10}
          maxLength={128}
          autoComplete="new-password"
        />
      </label>
      <label>
        <T text="确认新密码" />{" "}
        <Input
          name="confirmPassword"
          type="password"
          required
          minLength={10}
          maxLength={128}
          autoComplete="new-password"
        />
      </label>
      <p className="meta muted">
        <T text="密码至少 10 个字符。" />
      </p>
      {error && (
        <div className="notice error" role="alert">
          <T text={error} />
        </div>
      )}
      {updated && (
        <div className="notice" role="status">
          <T text="密码已更新。其他设备的会话已退出。" />
        </div>
      )}
      <div className="form-submit">
        <Button className="button primary" type="submit" disabled={busy}>
          <T text={busy ? "正在更新…" : "更新密码"} />
        </Button>
      </div>
    </form>
  );
}

export function validateChangePasswordFields({
  currentPassword,
  newPassword,
  confirmPassword,
}: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): string | undefined {
  if (!currentPassword) return "请输入当前密码。";
  if (currentPassword.length > 128) return "密码最多 128 个字符。";
  if (newPassword.length < 10) return "新密码至少 10 个字符。";
  if (newPassword.length > 128) return "新密码最多 128 个字符。";
  if (newPassword !== confirmPassword) return "两次输入的新密码不一致。";
  return undefined;
}
