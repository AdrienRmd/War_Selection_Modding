import {
  identity,
  ingestSecret,
  json,
  sameOrigin,
  limitedBody,
  HttpError,
  timingSafeEqualSecrets,
} from "@/lib/atlas-server";
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
import { ingestAutoReplay } from "@/lib/replay-submissions";
export const dynamic = "force-dynamic";

/** API Replay :
 *  POST /api/replay/ingest — récolte automatique (mission 07/11) :
 *  réservé au crawler localhost (secret X-Ingest-Secret ≥ 16 caractères,
 *  variable d'env INGEST_SECRET — absent → 503 ; invalide → 403
 *  journalisé). Corps { code, source:'auto', teamSize, modeKey, mvpName,
 *  digest } validé serveur (cleanReplayBody/cleanDigest) → 201 publié
 *  d'office + stats agrégées ; 409 si le code est déjà connu
 *  (idempotence stricte, tout statut — un replay modéré ne revient pas).
 *  POST /api/replay/submit (Chantier B) :
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
      // V3 (01/11) : 32 768 o — le digest v2 (médailles, unités par âge,
      // records d'âge par joueur, borné côté client et cleanDigest) mesure
      // ~11 Ko sur un 8v8 réel ; pire cas 32 joueurs ≈ 30 Ko.
      const bytes = await limitedBody(req, 32768);
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

    if (req.method === "POST" && action === "ingest") {
      // Le corps est borné avant toute vérification (drain).
      const bytes = await limitedBody(req, 512 * 1024);
      const secret = ingestSecret();
      if (!secret) {
        console.warn("[replay-ingest] refus : INGEST_SECRET non configuré (503)");
        return json(
          { error: "回放采集未启用：缺少 INGEST_SECRET。 / Replay ingest disabled: INGEST_SECRET missing." },
          503,
        );
      }
      const provided = req.headers.get("X-Ingest-Secret");
      // Temps constant sur digests de longueur fixe (revue 07/11) : aucune
      // early-return sur la longueur/le préfixe du secret fourni.
      if (typeof provided !== "string" || !(await timingSafeEqualSecrets(provided, secret))) {
        console.warn("[replay-ingest] refus : secret invalide (403)");
        return json({ error: "回放采集密钥无效。 / Invalid ingest secret." }, 403);
      }
      // Appel réservé localhost en pratique : la vérification d'origine ne
      // s'applique pas (le crawler ne partage pas la session navigateur),
      // le secret longue durée EST l'authentification.
      let body: unknown = null;
      try {
        body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      } catch {
        return json({ error: "提交内容不是有效 JSON。 / Body is not valid JSON." }, 400);
      }
      const result = await ingestAutoReplay(body);
      return json(result, 201);
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
