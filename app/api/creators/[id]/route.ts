import { bindings, identity, sameOrigin, HttpError, json } from "@/lib/atlas-server";
import { creatorRow, listCreators } from "@/lib/creators-server";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
// Serves the creator photo. UUID-only ids keep R2 keys and URLs unparsable.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Drain rejected, bounded bodies without retaining bytes, so a reused local
// HTTP/1.1 connection is not reset by an unread small body.
async function drainBody(req: Request) {
  if (!req.body || req.bodyUsed || req.body.locked) return;
  const reader = req.body.getReader();
  try {
    await reader.read();
    await reader.cancel();
  } catch {
    /* Client disconnected; nothing to release. */
  } finally {
    reader.releaseLock();
  }
}
export async function GET(_req: Request, { params }: Context) {
  try {
    const { id } = await params;
    if (!UUID.test(id)) return json({ error: "创作者不存在。" }, 404);
    const row = await creatorRow(id);
    if (!row?.photo_key || !row.photo_type) return json({ error: "此创作者没有头像。" }, 404);
    const object = await bindings().BUCKET.get(row.photo_key);
    if (!object) return json({ error: "头像不可用。" }, 404);
    return new Response(object.body, {
      headers: {
        "Content-Type": row.photo_type,
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return json({ error: "暂时无法读取头像。" }, 503);
  }
}
export async function DELETE(req: Request, { params }: Context) {
  try {
    sameOrigin(req);
    const { user, admin } = await identity();
    if (!user) return json({ error: "请先登录。" }, 401);
    if (!admin) return json({ error: "只有管理员可以维护创作者名单。" }, 403);
    const { id } = await params;
    if (!UUID.test(id)) return json({ error: "创作者不存在。" }, 404);
    const { DB, BUCKET } = bindings();
    const row = await creatorRow(id);
    if (!row) return json({ error: "创作者不存在。" }, 404);
    const changed = await DB.prepare("DELETE FROM creators WHERE id = ?").bind(id).run();
    if (changed.meta.changes !== 1) return json({ error: "移除未完成，请稍后重试。" }, 503);
    if (row.photo_key) {
      try {
        await BUCKET.delete(row.photo_key);
      } catch {
        console.error("Creator photo cleanup failed");
      }
    }
    return json({ removed: id, items: await listCreators() });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error("Creator remove failed", e instanceof Error ? e.message : "unknown");
    return json({ error: "移除未完成，请稍后重试。" }, 503);
  } finally {
    await drainBody(req);
  }
}
