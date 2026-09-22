"use client";
import { useState } from "react";
import Link from "@/components/site-link";
import { T } from "@/components/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { postAuth, safeReturnTo, validateSigninFields } from "@/components/auth/shared";

export function SignInForm({ returnTo }: { returnTo?: string }) {
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
    const invalid = validateSigninFields({ email, password });
    if (invalid) return setError(invalid);
    setBusy(true);
    setError("");
    const d = await postAuth("signin", { email, password });
    if (d.ok) {
      window.location.assign(safeReturnTo(returnTo));
      return;
    }
    setError(d.error || "登录失败，请稍后重试。");
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
          minLength={1}
          maxLength={128}
          autoComplete="current-password"
        />
      </label>
      {error && (
        <div className="notice error" role="alert">
          <T text={error} />
        </div>
      )}
      <div className="form-submit">
        <Button className="button primary" type="submit" disabled={busy}>
          <T text={busy ? "正在登录…" : "登录"} />
        </Button>
      </div>
      <p className="meta muted">
        <T text={"还没有账号？"} />{" "}
        <Link className="text-link" href="/signup">
          <T text={"创建账号"} />
        </Link>
      </p>
    </form>
  );
}
