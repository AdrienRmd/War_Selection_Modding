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
    if (!UUID.test(id)) return json({ error: "创作者不存在。 / Creator not found." }, 404);
    const row = await creatorRow(id);
    if (!row) return json({ error: "创作者不存在。 / Creator not found." }, 404);
    // 0015 : une candidature non publiée n'expose sa photo qu'à son auteur
    // ou à un admin (prévisualisation pendant la modération).
    const extended = row as typeof row & { status?: string; user_id?: string | null };
    if (extended.status && extended.status !== "published") {
      const { user, admin } = await identity();
      const owner = !!user && extended.user_id === user.userId;
      if (!owner && !admin) return json({ error: "创作者不存在。 / Creator not found." }, 404);
    }
    if (!row?.photo_key || !row.photo_type) return json({ error: "此创作者没有头像。 / This creator has no photo." }, 404);
    const object = await bindings().BUCKET.get(row.photo_key);
    if (!object) return json({ error: "头像不可用。 / Photo unavailable." }, 404);
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
    return json({ error: "暂时无法读取头像。 / Photo unavailable right now." }, 503);
  }
}
export async function DELETE(req: Request, { params }: Context) {
  try {
    sameOrigin(req);
    const { user, admin } = await identity();
    if (!user) return json({ error: "请先登录。 / Please sign in." }, 401);
    if (!admin) return json({ error: "只有管理员可以维护创作者名单。 / Only administrators manage the creator roster." }, 403);
    const { id } = await params;
    if (!UUID.test(id)) return json({ error: "创作者不存在。 / Creator not found." }, 404);
    const { DB, BUCKET } = bindings();
    const row = await creatorRow(id);
    if (!row) return json({ error: "创作者不存在。 / Creator not found." }, 404);
    // 0015 : la suppression admin retire la ligne PUIS ses liens et
    // associations (la ligne part entièrement) — le changes attendu de la
    // suppression principale est vérifié AVANT de confirmer le succès.
    const [linksRemoved, itemsRemoved, creatorRemoved] = await DB.batch([
      DB.prepare("DELETE FROM creator_links WHERE creator_id = ?").bind(id),
      DB.prepare("DELETE FROM creator_items WHERE creator_id = ?").bind(id),
      DB.prepare("DELETE FROM creators WHERE id = ?").bind(id),
    ]);
    if (creatorRemoved.meta.changes !== 1)
      return json({ error: "移除未完成，请稍后重试。 / Remove failed, try again later." }, 503);
    void linksRemoved;
    void itemsRemoved;
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
    return json({ error: "移除未完成，请稍后重试。 / Remove failed, try again later." }, 503);
  } finally {
    await drainBody(req);
  }
}
