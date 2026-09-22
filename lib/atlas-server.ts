import { env } from "cloudflare:workers";
import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
export type MapRecord = {
  id: string;
  owner_id: string;
  author: string;
  title: string;
  summary: string;
  description: string;
  game_version: string;
  players: number;
  category: string;
  mods: string;
  map_code: string;
  status: string;
  file_name: string;
  file_key: string;
  file_size: number;
  sha256: string;
  cover_key: string | null;
  cover_type: string | null;
  created_at: string;
  reviewed_at: string | null;
  feedback: string;
  revision: number;
};
type Bindings = { DB: D1Database; BUCKET: R2Bucket; ADMIN_EMAILS?: string };
export function bindings() {
  const e = env as unknown as Bindings;
  if (!e.DB || !e.BUCKET) throw new Error("Storage bindings unavailable");
  return e;
}
export function isAdmin(u: ChatGPTUser | null) {
  return (
    !!u &&
    ((env as unknown as Bindings).ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .includes(u.email.toLowerCase())
  );
}
export async function identity() {
  const user = await getChatGPTUser();
  return { user, admin: isAdmin(user) };
}
export function publicMap(m: MapRecord) {
  return {
    id: m.id,
    author: m.author,
    title: m.title,
    summary: m.summary,
    description: m.description,
    game_version: m.game_version,
    players: m.players,
    category: m.category,
    mods: m.mods,
    map_code: m.map_code,
    created_at: m.created_at,
    reviewed_at: m.reviewed_at,
    file_name: m.file_name,
    file_size: m.file_size,
    sha256: m.sha256,
    has_cover: !!m.cover_key,
  };
}
export async function approvedMaps(offset = 0) {
  const r = await bindings()
    .DB.prepare(
      "SELECT * FROM maps WHERE status = 'approved' ORDER BY reviewed_at DESC, id DESC LIMIT 25 OFFSET ?",
    )
    .bind(offset)
    .all<MapRecord>();
  return { items: r.results.slice(0, 24).map(publicMap), hasMore: r.results.length > 24 };
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  // Behind the trusted reverse proxy the worker is reached over plain HTTP,
  // so req.url carries the origin-internal scheme; the browser-facing one
  // only arrives via X-Forwarded-Proto (first hop of the chain, set by the
  // proxy). Without that header (local dev, direct loopback traffic) req.url
  // stays authoritative.
  const url = new URL(req.url);
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const expectedOrigin = forwardedProto ? `${forwardedProto}://${url.host}` : url.origin;
  if (!origin || origin !== expectedOrigin)
    throw new HttpError(403, "请求来源校验失败，请刷新页面后重试。");
}
export async function limitedBody(req: Request, limit: number) {
  const n = Number(req.headers.get("content-length"));
  if (n > limit) throw new HttpError(413, "文件过大，请按页面限制压缩后重试。");
  if (!req.body) throw new HttpError(400, "没有收到请求内容。");
  const reader = req.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limit) {
        await reader.cancel();
        throw new HttpError(413, "文件过大，请压缩后重试。");
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(total);
  let p = 0;
  for (const v of parts) {
    result.set(v, p);
    p += v.length;
  }
  return result;
}
export const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
