"use client";

// Client mirror of the server zod rules in app/api/auth/[[...path]]/route.ts:
// email trimmed + lowercased, max 254, valid address; password 10..128 on
// signup (1..128 on signin); display name trimmed, 1..40.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESERVED_RETURN_PATHS = ["/signin", "/signup", "/signout", "/callback"];

export function safeReturnTo(value: string | undefined): string {
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

export async function postAuth(
  action: "signin" | "signup" | "change-password",
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

export interface AuthFields {
  email: string;
  password: string;
  displayName?: string;
}

export function validateSigninFields({ email, password }: AuthFields): string | undefined {
  if (!email) return "请输入邮箱。";
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return "请输入有效的邮箱地址。";
  if (!password) return "请输入密码。";
  if (password.length > 128) return "密码最多 128 个字符。";
  return undefined;
}

export function validateSignupFields({
  email,
  password,
  displayName,
}: AuthFields): string | undefined {
  const common = validateSigninFields({ email, password });
  if (common) return common;
  if (password.length < 10) return "密码至少 10 个字符。";
  if (!displayName) return "请输入显示名称。";
  if (displayName.length > 40) return "显示名称最多 40 个字符。";
  return undefined;
}
