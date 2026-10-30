import { z } from "zod";
import { bindings, HttpError, json, limitedBody, sameOrigin } from "@/lib/atlas-server";
import {
  checkAndRecordFailure,
  clearedSessionCookie,
  RATE_LIMITS_ENABLED,
  readSessionToken,
  sessionUserByToken,
} from "@/lib/auth-server";
import {
  ACCOUNT_DELETE_BUDGET,
  accountAttemptKeys,
  accountDeleteAttemptKey,
  deletionRateLimited,
  purgeObjects,
} from "@/lib/deletion";
import { avatarKeyFor } from "@/lib/profile";

// DELETE /api/account — suppression de compte self-service (SB4-b).
// Garde-fous identiques aux autres mutations du site : corps borné et consommé
// AVANT toute réponse d'erreur, CSRF sameOrigin, session serveur, throttling
// persisté (5 tentatives/heure/compte), confirmation par saisie du pseudo exact.
// L'identité vient TOUJOURS de la session : aucun identifiant client (userId,
// email…) n'est lu dans le corps — impossible de cibler le compte d'autrui.
//
// Politique arbitrée (orchestrateur) :
//  - créations PUBLIÉES conservées : lignes et nom d'auteur historique
//    inchangés (« pas de réécriture du nom affiché »), author_verified → 0
//    (le badge « créateur vérifié » disparaît, le compte qui l'appuyait n'existe
//    plus) ;
//  - soumissions NON publiées (pending/rejected/withdrawn) purgées : lignes +
//    reviews + objets R2 (ZIP, couvertures) ;
//  - sessions purgées (tous appareils), avatar purgé, ligne users purgée,
//    compteurs de throttling portant l'email purgés (l'email ne réapparaît
//    nulle part).

export const dynamic = "force-dynamic";

// Secure flag: trust X-Forwarded-Proto from the Apache proxy first (req.url
// is plain http at the origin), then fall back to the request URL scheme.
// Même logique que app/api/auth.
function isSecure(req: Request): boolean {
  if (req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https") return true;
  return new URL(req.url).protocol === "https:";
}

export async function DELETE(req: Request) {
  try {
    // Corps borné et consommé avant tout refus (pattern change-password),
    // puis garde CSRF — dans le try pour renvoyer le 403 en JSON.
    const bytes = await limitedBody(req, 4096);
    sameOrigin(req);
    const token = readSessionToken(req);
    const user = await sessionUserByToken(token);
    if (!user || !token) throw new HttpError(401, "请先登录。");

    if (RATE_LIMITS_ENABLED) {
      const verdict = await checkAndRecordFailure(
        accountDeleteAttemptKey(user.userId),
        ACCOUNT_DELETE_BUDGET.limit,
        ACCOUNT_DELETE_BUDGET.windowMs,
      );
      if (!verdict.allowed)
        return deletionRateLimited(verdict.retryAfterSec, "操作过于频繁，请稍后再试。");
    }

    const input = z
      .object({ confirm: z.string().trim().min(1).max(80) })
      .parse(JSON.parse(new TextDecoder().decode(bytes)));
    if (input.confirm !== user.displayName.trim())
      throw new HttpError(400, "确认输入与账号昵称不一致。");

    const { DB } = bindings();
    // Objets R2 à purger : fichiers des créations non publiées + avatar.
    const pendingMaps = await DB.prepare(
      "SELECT id, file_key, cover_key FROM maps WHERE owner_id = ? AND status != 'approved'",
    )
      .bind(user.userId)
      .all<{ id: string; file_key: string; cover_key: string | null }>();
    const pendingMods = await DB.prepare(
      "SELECT id, file_key FROM community_mods WHERE owner_id = ? AND origin = 'community' AND status != 'approved'",
    )
      .bind(user.userId)
      .all<{ id: string; file_key: string | null }>();
    const keys = [
      ...pendingMaps.results.flatMap((m) => [m.file_key, m.cover_key]),
      ...pendingMods.results.flatMap((m) => (m.file_key ? [m.file_key] : [])),
      avatarKeyFor(user.userId),
    ].filter((key): key is string => !!key);

    // Lot transactionnel D1 : soit tout est purgé, soit rien. Ordre FK :
    // reviews avant parents, sessions avant users.
    const attempts = accountAttemptKeys(user.userId, user.email);
    await DB.batch([
      DB.prepare(
        "UPDATE maps SET author_verified = 0 WHERE owner_id = ? AND status = 'approved'",
      ).bind(user.userId),
      DB.prepare(
        "DELETE FROM reviews WHERE map_id IN (SELECT id FROM maps WHERE owner_id = ? AND status != 'approved')",
      ).bind(user.userId),
      DB.prepare("DELETE FROM maps WHERE owner_id = ? AND status != 'approved'").bind(
        user.userId,
      ),
      DB.prepare(
        "DELETE FROM mod_reviews WHERE mod_id IN (SELECT id FROM community_mods WHERE owner_id = ? AND origin = 'community' AND status != 'approved')",
      ).bind(user.userId),
      DB.prepare(
        "DELETE FROM community_mods WHERE owner_id = ? AND origin = 'community' AND status != 'approved'",
      ).bind(user.userId),
      DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.userId),
      DB.prepare("DELETE FROM auth_attempts WHERE attempt_key IN (?, ?, ?, ?)").bind(...attempts),
      DB.prepare("DELETE FROM users WHERE id = ?").bind(user.userId),
    ]);

    // Journal minimal, sans PII (uuid + compteurs uniquement).
    console.log(
      "account deleted",
      JSON.stringify({
        userId: user.userId,
        maps_purged: pendingMaps.results.length,
        mods_purged: pendingMods.results.length,
      }),
    );

    // Purge R2 post-commit, best effort (un objet orphelin restant est
    // invisible ; une erreur ici ne doit pas masquer la suppression réussie).
    await purgeObjects(keys);

    return Response.json(
      { ok: true },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "Set-Cookie": clearedSessionCookie(isSecure(req)),
        },
      },
    );
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    if (e instanceof z.ZodError) return json({ error: "请求格式有误。" }, 400);
    if (e instanceof SyntaxError) return json({ error: "请求格式有误。" }, 400);
    console.error("Account deletion failed", e instanceof Error ? e.message : "unknown");
    return json({ error: "删除未完成，请稍后重试。" }, 503);
  }
}
