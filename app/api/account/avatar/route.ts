import { bindings, json } from "@/lib/atlas-server";
import { readSessionToken, sessionUserByToken } from "@/lib/auth-server";

// GET /api/account/avatar — sert l'avatar du compte COURANT uniquement
// (session). Aucun identifiant n'est accepté dans l'URL : impossible de
// sonder les avatars d'autres comptes. Cache privé et jamais partagé,
// CSP sandbox + nosniff comme les autres lectures R2 du site.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await sessionUserByToken(readSessionToken(req));
    if (!user) return json({ error: "请先登录。" }, 401);
    if (!user.avatarKey || !user.avatarType) return json({ error: "尚未设置头像。" }, 404);
    const object = await bindings().BUCKET.get(user.avatarKey);
    if (!object) return json({ error: "头像不可用。" }, 404);
    return new Response(object.body, {
      headers: {
        "Content-Type": user.avatarType,
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return json({ error: "暂时无法读取头像。" }, 503);
  }
}
