import { bindings, identity, json, sameOrigin, limitedBody, HttpError } from "@/lib/atlas-server";
import {
  listReplaySubmissions,
  moderateReplay,
  recentReplays,
  submitReplay,
  withdrawReplay,
} from "@/lib/replay-submissions";
export const dynamic = "force-dynamic";

/** API Replay (Chantier B) :
 *  GET  /api/replay/recent?limit=5        — listing public (publiés) ;
 *  GET  /api/replay/submissions[?scope=admin] — mes soumissions / file admin ;
 *  POST /api/replay/submit                — soumission (auth, quotas) ;
 *  PATCH /api/replay/<code>               — modération admin (published /
 *       rejected + note) ou retrait auteur (withdrawn). */
async function route(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    const path = (await ctx.params).path ?? [];
    const action = path[0] ?? "";
    const { user, admin } = await identity();
    const url = new URL(req.url);

    if (req.method === "GET" && (action === "" || action === "recent"))
      return json({ items: await recentReplays(url.searchParams.get("limit")) });

    if (req.method === "GET" && action === "submissions") {
      if (!user) throw new HttpError(401, "请先登录。 / Please sign in.");
      const adminScope = url.searchParams.get("scope") === "admin";
      return json({ items: await listReplaySubmissions(user.userId, admin, adminScope) });
    }

    if (req.method === "POST" && action === "submit") {
      // Consomme le corps borné AVANT tout retour d'autorisation.
      const bytes = await limitedBody(req, 4096);
      sameOrigin(req);
      if (!user) throw new HttpError(401, "请先登录。 / Please sign in.");
      let body: unknown;
      try {
        body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      } catch {
        throw new HttpError(400, "提交内容不是有效 JSON。 / Submission is not valid JSON.");
      }
      return json(await submitReplay(user.userId, body), 201);
    }

    if (req.method === "PATCH" && action) {
      const bytes = await limitedBody(req, 4096);
      sameOrigin(req);
      if (!user) throw new HttpError(401, "请先登录。 / Please sign in.");
      let body: { status?: unknown; note?: unknown };
      try {
        body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as typeof body;
      } catch {
        throw new HttpError(400, "提交内容不是有效 JSON。 / Body is not valid JSON.");
      }
      const code = action.replace(/^rep-/, "");
      if (body.status === "withdrawn") {
        if (admin) {
          // L'admin peut retirer n'importe quelle ligne via le même verbe.
          return json({ item: await moderateWithdraw(code) });
        }
        return json({ item: await withdrawReplay(code, user.userId) });
      }
      if (body.status === "published" || body.status === "rejected") {
        if (!admin) throw new HttpError(403, "需要管理员权限。 / Admin access required.");
        const note = typeof body.note === "string" ? body.note : null;
        return json({ item: await moderateReplay(code, body.status, note) });
      }
      throw new HttpError(400, "未知状态。 / Unknown status.");
    }

    throw new HttpError(404, "接口不存在。 / Unknown endpoint.");
  } catch (e) {
    return json(
      { error: e instanceof HttpError ? e.message : "暂时无法处理请求。 / Temporary failure." },
      e instanceof HttpError ? e.status : 503,
    );
  }
}

/** Retrait admin (toute ligne, tout statut). */
async function moderateWithdraw(code: string) {
  const db = bindings().DB;
  const now = new Date().toISOString();
  const changed = await db
    .prepare("UPDATE replays SET status='withdrawn', moderated_at=? WHERE code=?")
    .bind(now, code)
    .run();
  if (changed.meta.changes !== 1) throw new HttpError(404, "回放不存在。 / Replay not found.");
  const row = await db.prepare("SELECT * FROM replays WHERE code = ?").bind(code).first();
  return row;
}

export const GET = route;
export const POST = route;
export const PATCH = route;
