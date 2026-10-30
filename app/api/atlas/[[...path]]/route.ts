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
import { ownMaps } from "@/lib/account-server";
import { mapCodeLooksPlausible, mapTestStates } from "@/lib/map-code";
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
      // SB5 : les cartes publiées par code seul n'ont pas d'objet R2 — message
      // distinct de la couverture manquante (file_key = "" par défaute).
      if (!key)
        throw new HttpError(404, cover ? "没有封面。" : "该地图未提供 ZIP 包，请使用游戏内分享码。");
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
      // Scope owner : même source que le hub /account (lib/account-server.ts),
      // les compteurs affichés et cette liste ne peuvent pas diverger.
      const r =
        mode === "admin"
          ? await DB.prepare(
              "SELECT * FROM maps WHERE status != 'withdrawn' ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 100",
            ).all<MapRecord>()
          : { results: await ownMaps(user.userId) };
      // SB5-c/D6 — file de modération : avertissements (jamais blocage) sur
      // les codes de partage : format invraisemblable vs `map-XXXXXXXX`, et
      // doublon du code sur une autre carte déjà approuvée (variantes
      // d'éditions légitimes). Une seule requête groupée bornée à 100.
      const flags = new Map<string, { code_implausible: boolean; code_duplicate: boolean }>();
      if (mode === "admin") {
        const dup = await DB.prepare(
          "SELECT a.map_code AS code FROM maps a JOIN maps b ON a.map_code = b.map_code AND a.id != b.id WHERE a.status = 'approved' AND b.status != 'withdrawn' AND a.map_code != '' GROUP BY a.map_code LIMIT 100",
        ).all<{ code: string }>();
        const duplicates = new Set(dup.results.map((row) => row.code));
        for (const m of r.results)
          if (m.map_code)
            flags.set(m.id, {
              code_implausible: !mapCodeLooksPlausible(m.map_code),
              code_duplicate: duplicates.has(m.map_code),
            });
      }
      return json({
        items: r.results.map((m) => ({
          ...publicMap(m),
          status: m.status,
          feedback: m.feedback,
          revision: m.revision,
          ...(flags.get(m.id) || {}),
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
      // SB5 : code de partage OU ZIP — au moins l'un des deux (comme les
      // mods : code OU fichier). Le refus est serveur, donc toute requête
      // directe contournant le formulaire est couverte.
      const hasFile =
        file instanceof File &&
        file.size >= 4 &&
        file.name.toLowerCase().endsWith(".zip") &&
        file.size <= 10 * 1024 * 1024;
      if (file instanceof File && file.size > 0 && !hasFile)
        throw new HttpError(400, "地图包必须是 10 MB 以内的 ZIP 文件。");
      if (!hasFile && !input.map_code)
        throw new HttpError(400, "请填写游戏内分享码，或上传地图 ZIP 包（至少一项）。");
      let fileBytes: Uint8Array<ArrayBuffer> | null = null;
      if (hasFile) {
        fileBytes = new Uint8Array(await (file as File).arrayBuffer());
        if (
          fileBytes[0] !== 80 ||
          fileBytes[1] !== 75 ||
          !((fileBytes[2] === 3 && fileBytes[3] === 4) || (fileBytes[2] === 5 && fileBytes[3] === 6))
        )
          throw new HttpError(400, "文件不是有效的 ZIP 格式。请重新打包。");
      }
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
      const sha = fileBytes
        ? Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", fileBytes)))
            .map((n) => n.toString(16).padStart(2, "0"))
            .join("")
        : "";
      const attempt = crypto.randomUUID();
      const key = fileBytes ? `submissions/${id}/${attempt}/map.zip` : "";
      const coverKey = coverBytes ? `submissions/${id}/${attempt}/cover` : null;
      const now = new Date().toISOString();
      // Both objects are tracked so a failure between or after the puts can
      // never strand a half-uploaded pair in R2 (see finally below).
      if (fileBytes) {
        await BUCKET.put(key, fileBytes, { httpMetadata: { contentType: "application/zip" } });
        uploaded.push(key);
      }
      if (coverBytes && coverKey) {
        await BUCKET.put(coverKey, coverBytes, { httpMetadata: { contentType: coverType! } });
        uploaded.push(coverKey);
      }
      try {
        // SB7 : instantané « créateur vérifié » — match EXACT (pas de fuzzy)
        // entre l'auteur saisi et le displayName du compte propriétaire,
        // figé à l'écriture. Aucune réécriture rétroactive des lignes
        // existantes (la migration 0008 pose 0 par défaute).
        const authorVerified = input.author.trim() === user.displayName.trim() ? 1 : 0;
        const r = await DB.prepare(
          "INSERT INTO maps (id, owner_id, author, title, summary, description, game_version, players, category, mods, map_code, status, file_name, file_key, file_size, sha256, cover_key, cover_type, created_at, author_verified) SELECT ?,?,?,?,?,?,?,?,?,?,?,'pending',?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM maps WHERE owner_id = ? AND status = 'pending') < 3 AND (SELECT COUNT(*) FROM maps WHERE owner_id = ? AND created_at > ?) < 5",
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
            fileBytes ? (file as File).name.replace(/[\x00-\x1f\x7f/\\]/g, "_").slice(0, 120) : "",
            key,
            fileBytes ? (file as File).size : 0,
            sha,
            coverKey,
            coverType,
            now,
            authorVerified,
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
    if (action === "test-status" && path[1] && req.method === "PATCH") {
      // SB6 — statut de test déclaré par l'auteur après publication (vocabulaire
      // collection : untested/working/issues/unavailable). Surplomb admin possible.
      // Ne repasse JAMAIS la carte en modération : seul le statut de test, ses
      // notes, sa date et la révision bougent. L'instantané test_updated_at /
      // test_set_by forme l'historique simple ; un surpassement admin est en
      // plus journalisé dans reviews (action test_status) comme les décisions
      // de modération.
      if (!user) throw new HttpError(401, "请先登录。");
      const body = z
        .object({
          status: z.enum(mapTestStates),
          tested_at: z.string().trim().max(10).default(""),
          game_version: z.string().trim().max(100).default(""),
          notes: z.string().trim().max(4000),
          revision: z.number().int().min(0),
        })
        .parse(JSON.parse(new TextDecoder().decode(await limitedBody(req, 12000))));
      if (
        body.tested_at &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(body.tested_at) ||
          body.tested_at > new Date().toISOString().slice(0, 10))
      )
        throw new HttpError(400, "测试日期无效或晚于今天。");
      if (body.status !== "untested" && (!body.tested_at || !body.notes))
        throw new HttpError(400, "更新实测状态前，请填写测试日期和测试记录。");
      const m = await DB.prepare("SELECT * FROM maps WHERE id = ?")
        .bind(path[1])
        .first<MapRecord>();
      if (!m || m.status !== "approved") throw new HttpError(404, "仅已发布的地图可以更新测试状态。");
      if (!admin && m.owner_id !== user.userId)
        throw new HttpError(403, "只有地图作者或管理员可以更新测试状态。");
      const now = new Date().toISOString();
      const token = crypto.randomUUID();
      const statements = [
        DB.prepare(
          "UPDATE maps SET test_status = ?, test_updated_at = ?, test_set_by = ?, test_notes = ?, game_version = ?, revision = revision + 1, review_token = ? WHERE id = ? AND revision = ? AND status = 'approved'",
        ).bind(
          body.status,
          now,
          admin ? "admin" : "author",
          body.notes,
          body.game_version || m.game_version,
          token,
          m.id,
          body.revision,
        ),
      ];
      if (admin && m.test_set_by !== (admin ? "admin" : "author"))
        // Surpassement admin sur une déclaration existante → journal reviews.
        statements.push(
          DB.prepare(
            "INSERT INTO reviews (id,map_id,reviewer_id,action,feedback,checklist,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM maps WHERE id = ? AND review_token = ?)",
          ).bind(
            token,
            m.id,
            user.userId,
            "test_status",
            `${body.status} · ${body.notes}`.slice(0, 2000),
            "[]",
            now,
            m.id,
            token,
          ),
        );
      const r = await DB.batch(statements);
      if (r[0].meta.changes !== 1) throw new HttpError(409, "档案已被更新，请刷新后重试。");
      return json({ id: m.id, test_status: body.status, test_updated_at: now, revision: body.revision + 1 });
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
