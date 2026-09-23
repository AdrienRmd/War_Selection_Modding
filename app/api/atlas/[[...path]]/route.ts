import { z } from "zod";
import {
  bindings,
  identity,
  publicMap,
  approvedMaps,
  HttpError,
  sameOrigin,
  limitedBody,
  json,
  type MapRecord,
} from "@/lib/atlas-server";
export const dynamic = "force-dynamic";
const uuid = z.string().uuid();
const fields = z.object({
  title: z.string().trim().min(2).max(60),
  author: z.string().trim().min(2).max(40),
  summary: z.string().trim().min(10).max(180),
  description: z.string().trim().min(30).max(6000),
  game_version: z.string().trim().min(1).max(60),
  players: z.coerce.number().int().min(1).max(60),
  category: z.enum(["历史战役", "团队对抗", "生存合作", "自定义玩法"]),
  mods: z.string().max(4000),
  map_code: z.string().trim().max(150),
  rights: z.literal("true"),
});
const checks = ["ownership", "files", "gameplay", "description"] as const;
// Drain rejected, bounded uploads without retaining bytes. Returning with an
// unread/cancelled small body can reset a reused local HTTP/1.1 connection.
// Same pattern as app/api/mods/[[...path]]/route.ts; the cap mirrors this
// route's 13 MB limitedBody bound.
async function discardUnusedBody(req: Request) {
  if (!req.body || req.bodyUsed || req.body.locked) return;
  const reader = req.body.getReader();
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 13 * 1024 * 1024) {
        await reader.cancel();
        break;
      }
    }
  } catch {
    /* Client disconnected; preserve the original response. */
  } finally {
    reader.releaseLock();
  }
}
async function route(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  // R2 objects written for the in-flight submission; removed in the finally
  // block unless the DB row committed and references them.
  const uploaded: string[] = [];
  let committed = false;
  let submissionId = "";
  try {
    const path = (await ctx.params).path || [];
    const action = path[0];
    const { user, admin } = await identity();
    if (req.method !== "GET") sameOrigin(req);
    if (action === "me" && req.method === "GET")
      return json({
        signedIn: !!user,
        admin,
        // Sessions never carry a fullName (always null), so this response is
        // the same for every signed-in user.
        displayName: "玩家",
        email: user?.email || null,
      });
    if (action === "maps" && req.method === "GET") {
      if (path[1]) {
        const m = await bindings()
          .DB.prepare("SELECT * FROM maps WHERE id = ? AND status = 'approved'")
          .bind(path[1])
          .first<MapRecord>();
        if (!m) throw new HttpError(404, "地图尚未发布或已下架。");
        return json(publicMap(m));
      }
      const url = new URL(req.url);
      const offset = Math.min(10000, Math.max(0, Number(url.searchParams.get("offset")) || 0));
      return json(await approvedMaps(Math.floor(offset)));
    }
    if (action === "files" && path[1] && req.method === "GET") {
      const { DB, BUCKET } = bindings();
      const m = await DB.prepare("SELECT * FROM maps WHERE id = ?")
        .bind(path[1])
        .first<MapRecord>();
      if (!m || (m.status !== "approved" && m.owner_id !== user?.userId && !admin))
        throw new HttpError(404, "文件不可用。");
      const cover = new URL(req.url).searchParams.get("type") === "cover";
      const key = cover ? m.cover_key : m.file_key;
      if (!key) throw new HttpError(404, "没有封面。");
      const obj = await BUCKET.get(key);
      if (!obj) throw new HttpError(404, "文件未找到。");
      return new Response(obj.body, {
        headers: {
          "Content-Type": cover ? m.cover_type! : "application/zip",
          "Content-Disposition": cover
            ? "inline"
            : `attachment; filename="map.zip"; filename*=UTF-8''${encodeURIComponent(m.file_name)}`,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      });
    }
    if (!user) throw new HttpError(401, "请先使用 ChatGPT 登录。");
    const { DB, BUCKET } = bindings();
    if (action === "submissions" && req.method === "GET") {
      const mode = new URL(req.url).searchParams.get("scope");
      if (mode === "admin" && !admin) throw new HttpError(403, "此账号没有审核权限。");
      const r =
        mode === "admin"
          ? await DB.prepare(
              "SELECT * FROM maps WHERE status != 'withdrawn' ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 100",
            ).all<MapRecord>()
          : await DB.prepare(
              "SELECT * FROM maps WHERE owner_id = ? ORDER BY created_at DESC LIMIT 100",
            )
              .bind(user.userId)
              .all<MapRecord>();
      return json({
        items: r.results.map((m) => ({
          ...publicMap(m),
          status: m.status,
          feedback: m.feedback,
          revision: m.revision,
        })),
        limit: 100,
      });
    }
    if (action === "submissions" && req.method === "POST") {
      const id = uuid.parse(req.headers.get("x-submission-id"));
      submissionId = id;
      const exists = await DB.prepare("SELECT id, owner_id FROM maps WHERE id = ?")
        .bind(id)
        .first<{ id: string; owner_id: string }>();
      if (exists) {
        if (exists.owner_id !== user.userId) throw new HttpError(409, "投稿编号冲突，请刷新。");
        return json({ id, status: "received" });
      }
      const since = new Date(Date.now() - 86400000).toISOString();
      const counts = await DB.prepare(
        "SELECT SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending, SUM(CASE WHEN created_at > ? THEN 1 ELSE 0 END) AS daily FROM maps WHERE owner_id = ?",
      )
        .bind(since, user.userId)
        .first<{ pending: number; daily: number }>();
      if ((counts?.pending || 0) >= 3 || (counts?.daily || 0) >= 5)
        throw new HttpError(429, "每人最多 3 份待审核稿件，24 小时内最多 5 次投稿。请等待审核。");
      if (!req.headers.get("content-type")?.startsWith("multipart/form-data"))
        throw new HttpError(400, "请使用投稿表单上传。");
      const bytes = await limitedBody(req, 13 * 1024 * 1024);
      const form = await new Request(req.url, {
        method: "POST",
        headers: { "content-type": req.headers.get("content-type")! },
        body: bytes,
      }).formData();
      const input = fields.parse(Object.fromEntries(form.entries()));
      const file = form.get("file");
      const cover = form.get("cover");
      if (
        !(file instanceof File) ||
        !file.name.toLowerCase().endsWith(".zip") ||
        file.size < 4 ||
        file.size > 10 * 1024 * 1024
      )
        throw new HttpError(400, "地图包必须是 10 MB 以内的 ZIP 文件。");
      const fileBytes = new Uint8Array(await file.arrayBuffer());
      if (
        fileBytes[0] !== 80 ||
        fileBytes[1] !== 75 ||
        !((fileBytes[2] === 3 && fileBytes[3] === 4) || (fileBytes[2] === 5 && fileBytes[3] === 6))
      )
        throw new HttpError(400, "文件不是有效的 ZIP 格式。请重新打包。");
      let coverBytes: Uint8Array | null = null;
      let coverType: string | null = null;
      if (cover instanceof File && cover.size) {
        if (cover.size > 2 * 1024 * 1024) throw new HttpError(400, "封面不能超过 2 MB。");
        coverBytes = new Uint8Array(await cover.arrayBuffer());
        if (
          coverBytes.length >= 8 &&
          [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => coverBytes![i] === v)
        )
          coverType = "image/png";
        else if (coverBytes[0] === 255 && coverBytes[1] === 216 && coverBytes[2] === 255)
          coverType = "image/jpeg";
        else throw new HttpError(400, "封面仅支持 PNG 或 JPEG 图片。");
      }
      const sha = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", fileBytes)))
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
      const attempt = crypto.randomUUID();
      const key = `submissions/${id}/${attempt}/map.zip`;
      const coverKey = coverBytes ? `submissions/${id}/${attempt}/cover` : null;
      const now = new Date().toISOString();
      // Both objects are tracked so a failure between or after the puts can
      // never strand a half-uploaded pair in R2 (see finally below).
      await BUCKET.put(key, fileBytes, { httpMetadata: { contentType: "application/zip" } });
      uploaded.push(key);
      if (coverBytes && coverKey) {
        await BUCKET.put(coverKey, coverBytes, { httpMetadata: { contentType: coverType! } });
        uploaded.push(coverKey);
      }
      try {
        const r = await DB.prepare(
          "INSERT INTO maps (id, owner_id, author, title, summary, description, game_version, players, category, mods, map_code, status, file_name, file_key, file_size, sha256, cover_key, cover_type, created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,'pending',?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM maps WHERE owner_id = ? AND status = 'pending') < 3 AND (SELECT COUNT(*) FROM maps WHERE owner_id = ? AND created_at > ?) < 5",
        )
          .bind(
            id,
            user.userId,
            input.author,
            input.title,
            input.summary,
            input.description,
            input.game_version,
            input.players,
            input.category,
            input.mods,
            input.map_code,
            file.name.replace(/[\x00-\x1f\x7f/\\]/g, "_").slice(0, 120),
            key,
            file.size,
            sha,
            coverKey,
            coverType,
            now,
            user.userId,
            user.userId,
            since,
          )
          .run();
        if (r.meta.changes !== 1) throw new HttpError(429, "已达到投稿限额，请稍后再试。");
      } catch (e) {
        const saved = await DB.prepare("SELECT file_key FROM maps WHERE id = ? AND owner_id = ?")
          .bind(id, user.userId)
          .first<{ file_key: string }>();
        if (!saved || saved.file_key !== key)
          await BUCKET.delete([key, ...(coverKey ? [coverKey] : [])]);
        if (!saved) throw e;
      }
      committed = true;
      return json({ id, status: "pending" }, 201);
    }
    if (action === "review" && path[1] && req.method === "PATCH") {
      if (!admin) throw new HttpError(403, "此账号没有审核权限。");
      const body = z
        .object({
          status: z.enum(["approved", "rejected"]),
          feedback: z.string().trim().min(5).max(2000),
          revision: z.number().int().min(0),
          checks: z.array(z.enum(["ownership", "files", "gameplay", "description"])),
        })
        .parse(JSON.parse(new TextDecoder().decode(await limitedBody(req, 12000))));
      const m = await DB.prepare("SELECT * FROM maps WHERE id = ?")
        .bind(path[1])
        .first<MapRecord>();
      if (!m || m.status === "withdrawn") throw new HttpError(404, "稿件不存在或已撤回。");
      if (body.status === "approved" && checks.some((c) => !body.checks.includes(c)))
        throw new HttpError(400, "发布前必须完成全部四项人工检查。");
      if (m.revision !== body.revision)
        throw new HttpError(409, "稿件已被其他操作更新，请刷新后重试。");
      const token = crypto.randomUUID(),
        now = new Date().toISOString();
      const r = await DB.batch([
        DB.prepare(
          "UPDATE maps SET status = ?, feedback = ?, reviewed_at = ?, revision = revision + 1, review_token = ? WHERE id = ? AND revision = ? AND status != 'withdrawn'",
        ).bind(body.status, body.feedback, now, token, m.id, body.revision),
        DB.prepare(
          "INSERT INTO reviews (id,map_id,reviewer_id,action,feedback,checklist,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM maps WHERE id = ? AND review_token = ?)",
        ).bind(
          token,
          m.id,
          user.userId,
          body.status,
          body.feedback,
          JSON.stringify(body.checks),
          now,
          m.id,
          token,
        ),
      ]);
      if (r[0].meta.changes !== 1) throw new HttpError(409, "稿件状态已变化，请刷新。");
      return json({ id: m.id, status: body.status });
    }
    if (action === "withdraw" && path[1] && req.method === "POST") {
      const r = await DB.prepare(
        "UPDATE maps SET status = 'withdrawn', revision = revision + 1 WHERE id = ? AND owner_id = ? AND status != 'withdrawn'",
      )
        .bind(path[1], user.userId)
        .run();
      if (r.meta.changes !== 1) throw new HttpError(404, "稿件不存在或已撤回。");
      return json({ status: "withdrawn" });
    }
    throw new HttpError(404, "接口不存在。");
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    if (e instanceof z.ZodError)
      return json({ error: "表单字段不完整或超出限制，请检查输入。" }, 400);
    if (e instanceof SyntaxError) return json({ error: "请求格式有误。" }, 400);
    console.error("Atlas request failed", e instanceof Error ? e.message : "Unknown failure");
    return json({ error: "服务暂时不可用，输入内容仍保留。请稍后重试。" }, 503);
  } finally {
    if (!committed && uploaded.length) {
      // Conservative cleanup (pattern of app/api/editor/[id]/route.ts): drop
      // only the uploaded objects no committed row references. On any
      // uncertainty — DB error, raced insert, unknown state — keep the
      // objects rather than delete something possibly referenced.
      try {
        const { DB, BUCKET } = bindings();
        const current = submissionId
          ? await DB.prepare("SELECT file_key, cover_key FROM maps WHERE id = ?")
              .bind(submissionId)
              .first<{ file_key: string | null; cover_key: string | null }>()
          : null;
        const orphaned = uploaded.filter(
          (candidate) => candidate !== current?.file_key && candidate !== current?.cover_key,
        );
        if (orphaned.length) await BUCKET.delete(orphaned);
      } catch {
        /* Best effort only; never mask the original response. */
      }
    }
    await discardUnusedBody(req);
  }
}
export { route as GET, route as POST, route as PATCH };
