import { bindings, json } from "@/lib/atlas-server";
import { readSessionToken, sessionUserByToken } from "@/lib/auth-server";

// GET /api/account/avatar — sert l'avatar du compte COURANT uniquement
// (session). Aucun identifiant n'est accepté dans l'URL : impossible de
// sonder les avatars d'autres comptes. Cache privé du NAVIGATEUR de
// l'utilisateur 60 s (V3-P2 #4 : la page /account réaffiche l'avatar sans
// re-solliciter l'API à chaque rendu) — `private` interdit tout cache
// partagé, et le contenu reste derrière l'auth session (401 anonyme) ;
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
        "Cache-Control": "private, max-age=60",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return json({ error: "暂时无法读取头像。" }, 503);
  }
}
