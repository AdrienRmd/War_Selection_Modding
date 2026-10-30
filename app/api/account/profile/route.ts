import { bindings, HttpError, json, limitedBody, sameOrigin } from "@/lib/atlas-server";
import {
  checkAndRecordFailure,
  RATE_LIMITS_ENABLED,
  readSessionToken,
  sessionUserByToken,
} from "@/lib/auth-server";
import {
  avatarKeyFor,
  displayNameIssue,
  inspectAvatar,
  normalizeAccountLocale,
  PROFILE_PATCH_BUDGET,
  profileAttemptKey,
} from "@/lib/profile";

// PATCH /api/account/profile — édition du profil par le titulaire (SB1).
// Authentifié session uniquement, garde CSRF sameOrigin identique aux autres
// mutations du site, throttling persisté via auth_attempts (10PATCH/min/compte).
// Corps JSON (pseudo, locale) OU multipart (avatar en plus). L'identité vient
// TOUJOURS de la session serveur : aucune donnée client (userId, email…) n'est
// lue dans le corps.

export const dynamic = "force-dynamic";

const TOO_MANY_PROFILE_CN = "修改过于频繁，请 1 分钟后再试。";
const REMOVE_AVATAR = "true";

export async function PATCH(req: Request) {
  let uploaded: string | null = null;
  let committed = false;
  try {
    // Corps borné et consommé AVANT toute réponse d'erreur (pattern
    // change-password : un corps non lu peut reset une connexion réutilisée).
    const bytes = await limitedBody(req, 3 * 1024 * 1024);
    sameOrigin(req);
    const token = readSessionToken(req);
    const user = await sessionUserByToken(token);
    if (!user || !token) throw new HttpError(401, "请先登录。");

    if (RATE_LIMITS_ENABLED) {
      const verdict = await checkAndRecordFailure(
        profileAttemptKey(user.userId),
        PROFILE_PATCH_BUDGET.limit,
        PROFILE_PATCH_BUDGET.windowMs,
      );
      if (!verdict.allowed)
        return Response.json(
          { error: TOO_MANY_PROFILE_CN },
          {
            status: 429,
            headers: {
              "Cache-Control": "no-store",
              "X-Content-Type-Options": "nosniff",
              "Retry-After": String(Math.max(1, verdict.retryAfterSec)),
            },
          },
        );
    }

    const contentType = req.headers.get("content-type") || "";
    let displayName: string | null = null;
    let locale: string | null = null;
    let avatar: File | null = null;
    let removeAvatar = false;
    if (contentType.startsWith("multipart/form-data")) {
      const form = await new Request(req.url, {
        method: "POST",
        headers: { "content-type": contentType },
        body: bytes,
      }).formData();
      const nameValue = form.get("displayName");
      if (typeof nameValue === "string" && nameValue !== "") displayName = nameValue;
      const localeValue = form.get("locale");
      if (typeof localeValue === "string" && localeValue !== "") locale = localeValue;
      const candidate = form.get("avatar");
      if (candidate instanceof File && candidate.size > 0) avatar = candidate;
      removeAvatar = form.get("removeAvatar") === REMOVE_AVATAR;
    } else if (contentType.startsWith("application/json")) {
      const body = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
      if (typeof body.displayName === "string" && body.displayName !== "")
        displayName = body.displayName;
      if (typeof body.locale === "string" && body.locale !== "") locale = body.locale;
    } else {
      throw new HttpError(400, "请求格式有误。");
    }

    if (avatar && removeAvatar)
      throw new HttpError(400, "不能同时上传新头像和移除头像。");

    const sets: string[] = [];
    const args: unknown[] = [];
    if (displayName !== null) {
      const issue = displayNameIssue(displayName);
      if (issue) throw new HttpError(400, issue);
      sets.push("display_name = ?");
      args.push(displayName.trim());
    }
    if (locale !== null) {
      // SB2 : préférence de langue du compte (zh/en/fr, additive colonne 0007).
      const normalized = normalizeAccountLocale(locale);
      if (!normalized) throw new HttpError(400, "界面语言只能是中文、英文或法语。");
      sets.push("locale = ?");
      args.push(normalized);
    }

    const { DB, BUCKET } = bindings();
    const key = avatarKeyFor(user.userId);
    if (avatar) {
      if (avatar.size > 2 * 1024 * 1024) throw new HttpError(400, "头像不能超过 2 MB。");
      const inspection = inspectAvatar(new Uint8Array(await avatar.arrayBuffer()));
      if ("error" in inspection) throw new HttpError(400, inspection.error);
      // Stockage AVANT la mise à jour D1 ; en cas d'échec ultérieur le finally
      // supprime l'objet (pattern creators). La clé étant constante par
      // utilisateur, le remplacement écrase (et donc purge) l'ancien objet.
      await BUCKET.put(key, inspection.bytes, {
        httpMetadata: { contentType: inspection.type },
      });
      uploaded = key;
      sets.push("avatar_key = ?", "avatar_type = ?");
      args.push(key, inspection.type);
    } else if (removeAvatar) {
      sets.push("avatar_key = NULL", "avatar_type = NULL");
    }

    if (sets.length === 0) throw new HttpError(400, "没有需要更新的内容。");
    args.push(user.userId);
    const changed = await DB.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...args)
      .run();
    if (changed.meta.changes !== 1) throw new HttpError(503, "修改未完成，请稍后重试。");
    committed = true;

    // Retrait : purge de l'objet R2 après la mise à jour D1 (best effort — la
    // ligne ne référence déjà plus la clé).
    if (removeAvatar && user.avatarKey) {
      try {
        await BUCKET.delete(key);
      } catch {
        console.error("Avatar removal cleanup failed");
      }
    }

    const row = await DB.prepare(
      "SELECT display_name, avatar_key, avatar_type, locale FROM users WHERE id = ?",
    )
      .bind(user.userId)
      .first<{
        display_name: string;
        avatar_key: string | null;
        avatar_type: string | null;
        locale: string | null;
      }>();
    return json({
      ok: true,
      user: {
        displayName: row?.display_name ?? user.displayName,
        hasAvatar: !!row?.avatar_key,
        avatarType: row?.avatar_type ?? null,
        locale: row?.locale ?? null,
      },
    });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    if (e instanceof SyntaxError) return json({ error: "请求格式有误。" }, 400);
    console.error("Profile patch failed", e instanceof Error ? e.message : "unknown");
    return json({ error: "修改未完成，请稍后重试。" }, 503);
  } finally {
    if (!committed && uploaded) {
      try {
        await bindings().BUCKET.delete(uploaded);
      } catch {
        console.error("Avatar upload cleanup failed");
      }
    }
  }
}
