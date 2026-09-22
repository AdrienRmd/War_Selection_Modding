import { z } from "zod";
import {
  bindings,
  identity,
  sameOrigin,
  limitedBody,
  HttpError,
  json,
  publicMap,
  type MapRecord,
} from "@/lib/atlas-server";
import { featuredRow, getFeaturedMap } from "@/lib/featured-server";
export const dynamic = "force-dynamic";
const metadata = z.object({
  title: z.string().trim().min(2).max(60),
  author: z.string().trim().min(2).max(40),
  summary: z.string().trim().min(10).max(180),
  description: z.string().trim().min(30).max(6000),
  game_version: z.string().trim().min(1).max(60),
  players: z.coerce.number().int().min(1).max(60),
  category: z.enum(["历史战役", "团队对抗", "生存合作", "自定义玩法"]),
  mods: z.string().max(4000),
  map_code: z.string().trim().max(150),
  revision: z.coerce.number().int().min(0),
  rules: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(40),
        value: z.string().trim().min(1).max(140),
      }),
    )
    .max(12)
    .optional(),
});
async function handle(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const uploaded: string[] = [];
  let committed = false;
  let targetId = "";
  try {
    const { id } = await params;
    targetId = id;
    const { user, admin } = await identity();
    if (!user) throw new HttpError(401, "请先登录。");
    const featured = id === "stalingrad";
    if (featured && !admin) throw new HttpError(403, "只有管理员可以编辑斯大林格勒档案。");
    const { DB, BUCKET } = bindings();
    const row = featured
      ? null
      : await DB.prepare("SELECT * FROM maps WHERE id = ?").bind(id).first<MapRecord>();
    if (!featured && (!row || (!admin && row.owner_id !== user.userId)))
      throw new HttpError(404, "没有可编辑的地图。");
    if (req.method === "GET")
      return json(
        featured
          ? await getFeaturedMap()
          : { ...publicMap(row!), revision: row!.revision, status: row!.status, has_file: true },
      );
    sameOrigin(req);
    const bytes = await limitedBody(req, 13 * 1024 * 1024);
    const form = await new Request(req.url, {
      method: "POST",
      headers: { "content-type": req.headers.get("content-type") || "" },
      body: bytes,
    }).formData();
    const values = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string"));
    const input = metadata.parse({
      ...values,
      rules: featured ? JSON.parse(String(form.get("rules") || "[]")) : undefined,
    });
    const old = featured ? await featuredRow() : row;
    if ((old?.revision || 0) !== input.revision)
      throw new HttpError(409, "这份档案已被更新，请另存当前文字后重新加载。");
    let fileKey = old?.file_key || null,
      fileName = old?.file_name || "",
      fileSize = old?.file_size || 0,
      sha = old?.sha256 || "",
      coverKey = old?.cover_key || null,
      coverType = old?.cover_type || null;
    for (const kind of ["file", "cover"] as const) {
      const file = form.get(kind);
      if (!(file instanceof File) || file.size === 0) continue;
      const limit = kind === "file" ? 10 * 1024 * 1024 : 2 * 1024 * 1024;
      if (file.size > limit)
        throw new HttpError(
          400,
          kind === "file" ? "地图包不能超过 10 MB。" : "封面不能超过 2 MB。",
        );
      const content = new Uint8Array(await file.arrayBuffer());
      let mime = "application/zip";
      if (kind === "file") {
        if (
          !file.name.toLowerCase().endsWith(".zip") ||
          content[0] !== 80 ||
          content[1] !== 75 ||
          !((content[2] === 3 && content[3] === 4) || (content[2] === 5 && content[3] === 6))
        )
          throw new HttpError(400, "请选择有效 ZIP 地图包。");
      } else {
        const png =
          content.length > 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => content[i] === v);
        const jpg =
          content.length > 3 && content[0] === 255 && content[1] === 216 && content[2] === 255;
        if (!png && !jpg) throw new HttpError(400, "封面只接受 PNG 或 JPEG。");
        mime = png ? "image/png" : "image/jpeg";
      }
      const key = `edits/${id}/${crypto.randomUUID()}/${kind}`;
      await BUCKET.put(key, content, { httpMetadata: { contentType: mime } });
      uploaded.push(key);
      if (kind === "file") {
        fileKey = key;
        fileName = file.name.replace(/[\x00-\x1f\x7f/\\]/g, "_").slice(0, 120);
        fileSize = file.size;
        sha = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", content)))
          .map((x) => x.toString(16).padStart(2, "0"))
          .join("");
      } else {
        coverKey = key;
        coverType = mime;
      }
    }
    const now = new Date().toISOString();
    const { revision, ...body } = input;
    const result = featured
      ? await DB.prepare(
          "INSERT INTO featured_maps (id,body,revision,updated_at,updated_by,file_key,file_name,file_size,sha256,cover_key,cover_type) VALUES (?,?,1,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body, revision=featured_maps.revision+1, updated_at=excluded.updated_at, updated_by=excluded.updated_by, file_key=excluded.file_key, file_name=excluded.file_name, file_size=excluded.file_size, sha256=excluded.sha256, cover_key=excluded.cover_key, cover_type=excluded.cover_type WHERE featured_maps.revision = ?",
        )
          .bind(
            id,
            JSON.stringify(body),
            now,
            user.userId,
            fileKey,
            fileName,
            fileSize,
            sha,
            coverKey,
            coverType,
            revision,
          )
          .run()
      : await DB.prepare(
          "UPDATE maps SET title=?,author=?,summary=?,description=?,game_version=?,players=?,category=?,mods=?,map_code=?,file_key=?,file_name=?,file_size=?,sha256=?,cover_key=?,cover_type=?,status='pending',feedback='',reviewed_at=NULL,review_token=NULL,revision=revision+1 WHERE id=? AND revision=? AND (status=\'pending\' OR (SELECT COUNT(*) FROM maps AS queue WHERE queue.owner_id=maps.owner_id AND queue.status=\'pending\')<3)",
        )
          .bind(
            input.title,
            input.author,
            input.summary,
            input.description,
            input.game_version,
            input.players,
            input.category,
            input.mods,
            input.map_code,
            fileKey,
            fileName,
            fileSize,
            sha,
            coverKey,
            coverType,
            id,
            revision,
          )
          .run();
    if (result.meta.changes !== 1)
      throw new HttpError(409, "档案已被更新，或已有 3 份待审核稿件；本次修改未保存。");
    committed = true;
    return json({ id, revision: revision + 1, status: featured ? "editorial" : "pending" });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    if (e instanceof z.ZodError || e instanceof SyntaxError)
      return json({ error: "请检查必填字段、人数范围和文字长度。" }, 400);
    console.error("Map editor failed", e instanceof Error ? e.message : "unknown");
    return json({ error: "保存未完成，表单内容仍保留，请稍后重试。" }, 503);
  } finally {
    if (!committed && uploaded.length) {
      try {
        const { DB, BUCKET } = bindings();
        const current = await DB.prepare(
          targetId === "stalingrad"
            ? "SELECT file_key,cover_key FROM featured_maps WHERE id=?"
            : "SELECT file_key,cover_key FROM maps WHERE id=?",
        )
          .bind(targetId)
          .first<{ file_key: string | null; cover_key: string | null }>();
        const orphaned = uploaded.filter(
          (key) => key !== current?.file_key && key !== current?.cover_key,
        );
        if (orphaned.length) await BUCKET.delete(orphaned);
      } catch {
        console.error("Map editor temporary upload cleanup failed");
      }
    }
  }
}
export const GET = handle;
export const PATCH = handle;
