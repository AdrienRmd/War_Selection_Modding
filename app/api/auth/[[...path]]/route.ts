import { z } from "zod";
import { bindings, HttpError, sameOrigin, limitedBody } from "@/lib/atlas-server";
import {
  clearedSessionCookie,
  createSession,
  destroySession,
  getSessionUser,
  hashPassword,
  isAuthThrottled,
  readSessionToken,
  recordAuthFailure,
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

function isSecure(req: Request): boolean {
  return new URL(req.url).protocol === "https:";
}

async function readJson(req: Request): Promise<unknown> {
  return JSON.parse(new TextDecoder().decode(await limitedBody(req, 4096)));
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Well-formed dummy hash (16-byte salt, 32-byte hash) burned for unknown
// emails so response timing does not reveal whether the address exists.
const DUMMY_HASH = `pbkdf2$120000$${"A".repeat(22)}$${"A".repeat(43)}`;

async function route(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    const path = (await ctx.params).path || [];
    const action = path[0];
    const secure = isSecure(req);
    if (req.method !== "GET") sameOrigin(req);

    if (action === "me" && req.method === "GET") {
      const user = await getSessionUser();
      return Response.json(
        { user },
        {
          headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
        },
      );
    }

    if (action === "signup" && req.method === "POST") {
      const input = signupInput.parse(await readJson(req));
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
      if (isAuthThrottled(input.email))
        throw new HttpError(429, "尝试次数过多，请 15 分钟后再试。");
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
        recordAuthFailure(input.email);
        await delay(300);
        throw new HttpError(401, "邮箱或密码不正确。");
      }
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
