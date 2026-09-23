import { z } from "zod";
import { bindings, HttpError, isAdmin, json, sameOrigin, limitedBody } from "@/lib/atlas-server";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  checkAndRecordFailure,
  clearedSessionCookie,
  clientIp,
  createSession,
  destroySession,
  DUMMY_HASH,
  emailAttemptKey,
  hashPassword,
  ipAttemptKey,
  isCommonPassword,
  RATE_LIMITS_ENABLED,
  readSessionToken,
  recordSuccess,
  revokeAllSessions,
  revokeOtherSessions,
  sessionCookie,
  sessionUserByToken,
  verifyPassword,
} from "@/lib/auth-server";

export const dynamic = "force-dynamic";

const emailField = z.string().trim().max(254).email().toLowerCase();
const signupInput = z.object({
  email: emailField,
  password: z.string().min(10).max(128),
  displayName: z.string().trim().min(1).max(40),
});
const signinInput = z.object({
  email: emailField,
  password: z.string().min(1).max(128),
});
const changePasswordInput = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(10).max(128),
});

// Persisted rate-limit budgets (auth_attempts table): signin is throttled per
// email and per source IP, signup per source IP. Disabled in dev — see
// RATE_LIMITS_ENABLED in lib/auth-server.ts.
const SIGNIN_EMAIL_BUDGET = { limit: 10, windowMs: 15 * 60 * 1000 };
const SIGNIN_IP_BUDGET = { limit: 30, windowMs: 15 * 60 * 1000 };
const SIGNUP_IP_BUDGET = { limit: 20, windowMs: 60 * 60 * 1000 };

// Existing i18n key (lib/english.ts / lib/french.ts both translate it).
const TOO_MANY_ATTEMPTS_CN = "尝试次数过多，请 15 分钟后再试。";
// i18n keys (lib/english.ts / lib/french.ts both translate them).
const COMMON_PASSWORD_CN = "密码过于常见，请选择更安全的密码。";
const CURRENT_PASSWORD_CN = "当前密码不正确。";

class RateLimitError extends HttpError {
  constructor(public retryAfterSec: number) {
    super(429, TOO_MANY_ATTEMPTS_CN);
  }
}

// Same no-store posture as the other API routes, plus the session cookie.
function jsonWithCookie(data: unknown, cookie: string, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Set-Cookie": cookie,
    },
  });
}

// Secure flag: trust X-Forwarded-Proto from the Apache proxy first (req.url
// is plain http at the origin), then fall back to the request URL scheme.
function isSecure(req: Request): boolean {
  if (req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https") return true;
  return new URL(req.url).protocol === "https:";
}

// Throws a 429 (with Retry-After) when the key's budget is exhausted.
async function enforceRateLimit(
  key: string,
  budget: { limit: number; windowMs: number },
): Promise<void> {
  if (!RATE_LIMITS_ENABLED) return;
  const verdict = await checkAndRecordFailure(key, budget.limit, budget.windowMs);
  if (!verdict.allowed) throw new RateLimitError(verdict.retryAfterSec);
}

async function readJson(req: Request): Promise<unknown> {
  return JSON.parse(new TextDecoder().decode(await limitedBody(req, 4096)));
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function route(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    const path = (await ctx.params).path || [];
    const action = path[0];
    const secure = isSecure(req);
    if (req.method !== "GET") sameOrigin(req);

    if (action === "me" && req.method === "GET") {
      // Same identity source as the server-rendered header (identity()), so
      // { user } keeps its original shape and isAdmin mirrors ADMIN_EMAILS.
      const user = await getChatGPTUser();
      return Response.json(
        { user, isAdmin: isAdmin(user) },
        {
          headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
        },
      );
    }

    if (action === "signup" && req.method === "POST") {
      const input = signupInput.parse(await readJson(req));
      const ipKey = ipAttemptKey(clientIp(req));
      await enforceRateLimit(ipKey, SIGNUP_IP_BUDGET);
      if (isCommonPassword(input.password)) throw new HttpError(400, COMMON_PASSWORD_CN);
      const { DB } = bindings();
      const exists = await DB.prepare("SELECT id FROM users WHERE email = ?")
        .bind(input.email)
        .first<{ id: string }>();
      if (exists) throw new HttpError(409, "该邮箱已注册，请直接登录。");
      const id = crypto.randomUUID();
      const passwordHash = await hashPassword(input.password);
      try {
        await DB.prepare(
          "INSERT INTO users (id, email, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
        )
          .bind(id, input.email, input.displayName, passwordHash, Date.now())
          .run();
      } catch (e) {
        if (e instanceof Error && e.message.includes("UNIQUE"))
          throw new HttpError(409, "该邮箱已注册，请直接登录。");
        throw e;
      }
      // No recordSuccess() on the IP key on purpose: the 20 signups/hour/IP
      // budget must also bound successes, not only failures (otherwise a
      // burst of valid signups resets the window after each account). Only
      // the signin flow clears its buckets on success.
      const token = await createSession(id);
      return jsonWithCookie(
        {
          user: { userId: id, displayName: input.displayName, email: input.email, fullName: null },
        },
        sessionCookie(token, secure),
        201,
      );
    }

    if (action === "signin" && req.method === "POST") {
      const input = signinInput.parse(await readJson(req));
      const emailKey = emailAttemptKey(input.email);
      const ipKey = ipAttemptKey(clientIp(req));
      // Throttle per compromised-credential target AND per source IP; both
      // budgets consume an attempt on every signin request.
      if (RATE_LIMITS_ENABLED) {
        const [emailVerdict, ipVerdict] = await Promise.all([
          checkAndRecordFailure(emailKey, SIGNIN_EMAIL_BUDGET.limit, SIGNIN_EMAIL_BUDGET.windowMs),
          checkAndRecordFailure(ipKey, SIGNIN_IP_BUDGET.limit, SIGNIN_IP_BUDGET.windowMs),
        ]);
        const blocked = [emailVerdict, ipVerdict].find((v) => !v.allowed);
        if (blocked)
          throw new RateLimitError(Math.max(emailVerdict.retryAfterSec, ipVerdict.retryAfterSec));
      }
      const row = await bindings()
        .DB.prepare("SELECT id, display_name, email, password_hash FROM users WHERE email = ?")
        .bind(input.email)
        .first<{ id: string; display_name: string; email: string; password_hash: string }>();
      // Burn the same PBKDF2 work for unknown emails so response timing does
      // not reveal whether the address exists.
      const ok = row
        ? await verifyPassword(input.password, row.password_hash)
        : await verifyPassword(input.password, DUMMY_HASH);
      if (!row || !ok) {
        // The consumed attempts stay counted; no cleanup on failure.
        await delay(300);
        throw new HttpError(401, "邮箱或密码不正确。");
      }
      // Successful signin resets both budgets.
      await Promise.all([recordSuccess(emailKey), recordSuccess(ipKey)]);
      const token = await createSession(row.id);
      return jsonWithCookie(
        {
          user: { userId: row.id, displayName: row.display_name, email: row.email, fullName: null },
        },
        sessionCookie(token, secure),
      );
    }

    if (action === "signout" && req.method === "POST") {
      const token = readSessionToken(req);
      if (token) await destroySession(token);
      return jsonWithCookie({ ok: true }, clearedSessionCookie(secure));
    }

    // "Sign out everywhere": requires a live session, revokes every session
    // of the user (all devices) and clears the cookie. The UI button is
    // wired by a separate agent against POST /api/auth/signout-all.
    if (action === "signout-all" && req.method === "POST") {
      const user = await sessionUserByToken(readSessionToken(req));
      if (!user) throw new HttpError(401, "请先登录。");
      await revokeAllSessions(user.userId);
      return jsonWithCookie({ ok: true }, clearedSessionCookie(secure));
    }

    // "Change password": requires a live session, verifies the current
    // password, rehashes with the current PBKDF2 setting and revokes every
    // OTHER session of the user; the calling device stays signed in. The
    // bounded body is consumed before any rejection so an early 401/400 never
    // leaves an unread body that would reset a reused keep-alive connection
    // under local Wrangler (see VALIDATION.md — same fix as the mods route).
    if (action === "change-password" && req.method === "POST") {
      const bytes = await limitedBody(req, 4096);
      const token = readSessionToken(req);
      const user = await sessionUserByToken(token);
      if (!user || !token) throw new HttpError(401, "请先登录。");
      const input = changePasswordInput.parse(JSON.parse(new TextDecoder().decode(bytes)));
      if (isCommonPassword(input.newPassword)) throw new HttpError(400, COMMON_PASSWORD_CN);
      const row = await bindings()
        .DB.prepare("SELECT password_hash FROM users WHERE id = ?")
        .bind(user.userId)
        .first<{ password_hash: string }>();
      if (!row || !(await verifyPassword(input.currentPassword, row.password_hash)))
        throw new HttpError(401, CURRENT_PASSWORD_CN);
      const passwordHash = await hashPassword(input.newPassword);
      await bindings()
        .DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
        .bind(passwordHash, user.userId)
        .run();
      await revokeOtherSessions(user.userId, token);
      return json({ ok: true });
    }

    if (!action) {
      const token = readSessionToken(req);
      const user = await sessionUserByToken(token);
      return Response.json(
        { user },
        { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
      );
    }

    throw new HttpError(404, "接口不存在。");
  } catch (e) {
    if (e instanceof RateLimitError)
      return Response.json(
        { error: e.message },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Retry-After": String(Math.max(1, e.retryAfterSec)),
          },
        },
      );
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
    if (e instanceof z.ZodError)
      return Response.json({ error: "表单字段不完整或超出限制，请检查输入。" }, { status: 400 });
    if (e instanceof SyntaxError)
      return Response.json({ error: "请求格式有误。" }, { status: 400 });
    console.error("Auth request failed", e instanceof Error ? e.message : "Unknown failure");
    return Response.json({ error: "服务暂时不可用，请稍后重试。" }, { status: 503 });
  }
}

export { route as GET, route as POST };
