import { identity, sameOrigin, limitedBody, HttpError, json } from "@/lib/atlas-server";
import { listCreatorApplications, moderateCreator, CREATOR_ITEMS_MAX } from "@/lib/creators-server";

export const dynamic = "force-dynamic";

/** GET /api/creators/applications — mes candidatures ; ?scope=admin → file
 *  complète de modération (admin requis, patron des soumissions replays).
 *
 *  PATCH /api/creators/applications — modération admin : { id, action:
 *  publish|reject|withdraw, note?, itemIds? } — itemIds REMPLACE la
 *  sélection manuelle de mods/cartes revendiqués (l'admin peut retirer une
 *  revendication douteuse avant de publier). */
export async function GET(req: Request) {
  try {
    const { user, admin } = await identity();
    if (!user) throw new HttpError(401, "请先登录。 / Please sign in.");
    const adminScope = new URL(req.url).searchParams.get("scope") === "admin";
    if (adminScope && !admin) throw new HttpError(403, "需要管理员权限。 / Admin access required.");
    return json({ items: await listCreatorApplications(user.userId, adminScope) });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error("Creator applications failed", e instanceof Error ? e.message : "unknown");
    return json({ error: "暂时无法读取，请稍后重试。 / Unavailable right now, try again later." }, 503);
  }
}

export async function PATCH(req: Request) {
  try {
    sameOrigin(req);
    const { admin } = await identity();
    if (!admin) throw new HttpError(403, "需要管理员权限。 / Admin access required.");
    const bytes = await limitedBody(req, 8 * 1024);
    let body: unknown;
    try {
      body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
      throw new HttpError(400, "提交内容不是有效 JSON。 / Body is not valid JSON.");
    }
    const source = (body ?? {}) as Record<string, unknown>;
    const id = typeof source.id === "string" ? source.id : "";
    const action = source.action;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      throw new HttpError(400, "创作者 ID 无效。 / Invalid creator id.");
    if (action !== "publish" && action !== "reject" && action !== "withdraw")
      throw new HttpError(400, "动作必须是 publish、reject 或 withdraw。 / Action must be publish, reject or withdraw.");
    const note = typeof source.note === "string" ? source.note : null;
    let itemIds: string[] | null = null;
    if (Array.isArray(source.itemIds)) {
      if (source.itemIds.length > CREATOR_ITEMS_MAX)
        throw new HttpError(400, "最多关联 12 项内容。 / At most 12 associated items.");
      const ids: string[] = [];
      for (const v of source.itemIds) {
        if (typeof v !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/i.test(v))
          throw new HttpError(400, "内容 ID 无效。 / Invalid item id.");
        ids.push(v);
      }
      itemIds = [...new Set(ids)];
    }
    const status = action === "publish" ? "published" : action === "reject" ? "rejected" : "withdrawn";
    return json({ item: await moderateCreator(id, status, note, itemIds) });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error("Creator moderation failed", e instanceof Error ? e.message : "unknown");
    return json({ error: "暂时无法处理，请稍后重试。 / Unavailable right now, try again later." }, 503);
  }
}
