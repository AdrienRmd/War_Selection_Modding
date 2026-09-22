"use client";
import { useState } from "react";
import Link from "@/components/site-link";
import { T } from "@/components/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { postAuth, safeReturnTo, validateSignupFields } from "@/components/auth/shared";

export function SignUpForm({ returnTo }: { returnTo?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") || "")
      .trim()
      .toLowerCase();
    const password = String(data.get("password") || "");
    const displayName = String(data.get("displayName") || "").trim();
    const invalid = validateSignupFields({ email, password, displayName });
    if (invalid) return setError(invalid);
    setBusy(true);
    setError("");
    const d = await postAuth("signup", { email, password, displayName });
    if (d.ok) {
      window.location.assign(safeReturnTo(returnTo));
      return;
    }
    setError(d.error || "注册失败，请稍后重试。");
    setBusy(false);
  }
  return (
    <form className="atlas-form panel" onSubmit={submit} noValidate>
      <label>
        <T text={"邮箱"} />{" "}
        <Input
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="you@example.com"
        />
      </label>
      <label>
        <T text={"密码"} />{" "}
        <Input
          name="password"
          type="password"
          required
          minLength={10}
          maxLength={128}
          autoComplete="new-password"
        />
      </label>
      <label>
        <T text={"显示名称"} />{" "}
        <Input name="displayName" required maxLength={40} autoComplete="nickname" />
      </label>
      {error && (
        <div className="notice error" role="alert">
          <T text={error} />
        </div>
      )}
      <div className="form-submit">
        <Button className="button primary" type="submit" disabled={busy}>
          <T text={busy ? "正在注册…" : "创建账号"} />
        </Button>
      </div>
      <p className="meta muted">
        <T text={"已有账号？"} />{" "}
        <Link className="text-link" href="/signin">
          <T text={"登录"} />
        </Link>
      </p>
    </form>
  );
}
