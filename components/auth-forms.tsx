"use client";
import { useState } from "react";
import Link from "@/components/site-link";
import { T } from "@/components/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Client mirror of the server zod rules in app/api/auth/[[...path]]/route.ts:
// email trimmed + lowercased, max 254, valid address; password 10..128 on
// signup (1..128 on signin); display name trimmed, 1..40.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESERVED_RETURN_PATHS = ["/signin", "/signup", "/signout", "/callback"];

function safeReturnTo(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (RESERVED_RETURN_PATHS.includes(url.pathname)) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}

async function postAuth(
  action: "signin" | "signup",
  body: Record<string, string>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch(`/api/auth/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = (await r.json().catch(() => ({}))) as { error?: string };
    return { ok: r.ok, error: d.error };
  } catch {
    return { ok: false };
  }
}

function AuthForm({ mode, returnTo }: { mode: "signin" | "signup"; returnTo: string }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") || "")
      .trim()
      .toLowerCase();
    const password = String(data.get("password") || "");
    const displayName = String(data.get("displayName") || "").trim();
    if (!email) return setError("请输入邮箱。");
    if (email.length > 254 || !EMAIL_PATTERN.test(email)) return setError("请输入有效的邮箱地址。");
    if (!password) return setError("请输入密码。");
    if (mode === "signup" && password.length < 10) return setError("密码至少 10 个字符。");
    if (password.length > 128) return setError("密码最多 128 个字符。");
    if (mode === "signup") {
      if (!displayName) return setError("请输入显示名称。");
      if (displayName.length > 40) return setError("显示名称最多 40 个字符。");
    }
    setBusy(true);
    setError("");
    const fallback = mode === "signup" ? "注册失败，请稍后重试。" : "登录失败，请稍后重试。";
    const d = await postAuth(
      mode,
      mode === "signup" ? { email, password, displayName } : { email, password },
    );
    if (d.ok) {
      window.location.assign(safeReturnTo(returnTo));
      return;
    }
    setError(d.error || fallback);
    setBusy(false);
  }
  const signup = mode === "signup";
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
          minLength={signup ? 10 : 1}
          maxLength={128}
          autoComplete={signup ? "new-password" : "current-password"}
        />
      </label>
      {signup && (
        <label>
          <T text={"显示名称"} />{" "}
          <Input name="displayName" required maxLength={40} autoComplete="nickname" />
        </label>
      )}
      {error && (
        <div className="notice error" role="alert">
          <T text={error} />
        </div>
      )}
      <div className="form-submit">
        <Button className="button primary" type="submit" disabled={busy}>
          <T text={busy ? (signup ? "正在注册…" : "正在登录…") : signup ? "创建账号" : "登录"} />
        </Button>
      </div>
      <p className="meta muted">
        {signup ? (
          <>
            <T text={"已有账号？"} />{" "}
            <Link className="text-link" href="/signin">
              <T text={"登录"} />
            </Link>
          </>
        ) : (
          <>
            <T text={"还没有账号？"} />{" "}
            <Link className="text-link" href="/signup">
              <T text={"创建账号"} />
            </Link>
          </>
        )}
      </p>
    </form>
  );
}

export function SignInForm({ returnTo }: { returnTo?: string }) {
  return <AuthForm mode="signin" returnTo={safeReturnTo(returnTo)} />;
}

export function SignUpForm({ returnTo }: { returnTo?: string }) {
  return <AuthForm mode="signup" returnTo={safeReturnTo(returnTo)} />;
}
