import { identity, json, sameOrigin, limitedBody, HttpError } from "@/lib/atlas-server";
import { parseReplayCode } from "@/lib/replay";
import {
  listReplaySubmissions,
  moderateReplay,
  moderateWithdrawReplay,
  recentReplays,
  submitReplay,
  withdrawReplay,
} from "@/lib/replay-submissions";
import { rebuildPlayerStats } from "@/lib/replay-stats";
import {
  replayFeedbackSummary,
  replayFeedbackView,
  submitReplayFeedback,
} from "@/lib/replay-feedback";
export const dynamic = "force-dynamic";

/** API Replay (Chantier B) :
 *  GET  /api/replay/recent?limit=5        — listing public (publiés) ;
 *  GET  /api/replay/submissions[?scope=admin] — mes soumissions / file admin ;
 *  POST /api/replay/submit                — soumission (auth, quotas, digest
 *       statistique optionnel → replay_results) ;
 *  PATCH /api/replay/<code>               — modération admin (published /
 *       rejected + note) ou retrait auteur (withdrawn) ;
 *  POST /api/replay/stats-rebuild         — recalcul défensif des stats
 *       joueurs (admin) : player_stats = f(replays publiés, digests) ;
 *  POST /api/replay/feedback              — vote « données exactes ? »
 *       (auth, quota 10/24 h, modifiable) ;
 *  GET  /api/replay/feedback?code=        — agrégat public du code ;
 *  GET  /api/replay/feedback-summary      — récap admin (onglet replays). */
async function route(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    const path = (await ctx.params).path ?? [];
    const action = path[0] ?? "";
    const { user, admin } = await identity();
    const url = new URL(req.url);

    if (req.method === "GET" && (action === "" || action === "recent"))
      // Listing public de replays publiés : cache court (60 s) navigateur /
      // CDN. Les autres branches (soumissions authentifiées) restent no-store.
      return json({ items: await recentReplays(url.searchParams.get("limit")) }, 200, {
        "Cache-Control": "public, max-age=60",
      });

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

    if (req.method === "POST" && action === "feedback") {
      // Consomme le corps borné AVANT tout retour d'autorisation.
      const bytes = await limitedBody(req, 1024);
      sameOrigin(req);
      if (!user) throw new HttpError(401, "请先登录。 / Please sign in.");
      let body: unknown;
      try {
        body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      } catch {
        throw new HttpError(400, "提交内容不是有效 JSON。 / Body is not valid JSON.");
      }
      return json({ item: await submitReplayFeedback(user.userId, body) }, 201);
    }

    if (req.method === "GET" && action === "feedback") {
      const code = parseReplayCode(url.searchParams.get("code"));
      if (!code) throw new HttpError(400, "回放代码无效。 / Invalid replay code.");
      // L'agrégat est public ; le vote courant n'est inclus que signé.
      return json({ item: await replayFeedbackView(code, user?.userId) });
    }

    if (req.method === "GET" && action === "feedback-summary") {
      if (!user) throw new HttpError(401, "请先登录。 / Please sign in.");
      if (!admin) throw new HttpError(403, "需要管理员权限。 / Admin access required.");
      return json({ items: await replayFeedbackSummary() });
    }

    if (req.method === "POST" && action === "stats-rebuild") {
      sameOrigin(req);
      if (!user) throw new HttpError(401, "请先登录。 / Please sign in.");
      if (!admin) throw new HttpError(403, "需要管理员权限。 / Admin access required.");
      const result = await rebuildPlayerStats();
      return json({ ok: true, ...result });
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
      // Code revalidé (préfixe rep- optionnel, 11 alphanumériques) : jamais
      // de valeur arbitraire poussée jusqu'à la base.
      const code = parseReplayCode(action);
      if (!code) throw new HttpError(400, "回放代码无效。 / Invalid replay code.");
      if (body.status === "withdrawn") {
        if (admin) {
          // L'admin peut retirer n'importe quelle ligne via le même verbe.
          return json({ item: await moderateWithdrawReplay(code) });
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

export const GET = route;
export const POST = route;
export const PATCH = route;
