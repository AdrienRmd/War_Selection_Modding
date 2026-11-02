import { identity, json, sameOrigin, limitedBody, HttpError } from "@/lib/atlas-server";
import {
  captureQueue,
  deleteMapCapture,
  listMapCaptures,
  mapCaptureFile,
  moderateMapCapture,
  submitMapCapture,
  withdrawMapCapture,
  CAPTURE_MAX_BYTES,
} from "@/lib/map-captures";

export const dynamic = "force-dynamic";

/** API Captures en jeu (finitions 01/11, chantier 7) — soumises par les
 *  testeurs, modérées comme les replays :
 *  GET    /api/map-captures                  — file de modération (admin) ;
 *  GET    /api/map-captures/<mapId>          — liste publique d'une carte
 *         (publiées ; + propres captures en attente si connecté) ;
 *  GET    /api/map-captures/file/<id>        — image (publiée : publique ;
 *         en attente : propriétaire uniquement) ;
 *  POST   /api/map-captures/<mapId>          — soumission multipart (auth,
 *         PNG/JPEG/WebP ≤ 2 Mo, quotas 3/carte/compte et 5/24 h) ;
 *  PATCH  /api/map-captures/<id>             — admin : publish/reject ;
 *         auteur : withdraw. */
async function route(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    const path = (await ctx.params).path ?? [];
    const { user, admin } = await identity();

    if (req.method === "GET" && path[0] === "queue") {
      if (!admin) throw new HttpError(403, "需要管理员权限。 / Admin access required.");
      return json({ items: await captureQueue() });
    }

    if (req.method === "GET" && path[0] === "file" && path[1]) {
      const file = await mapCaptureFile(path[1], user ? user.userId : null);
      if (!file) return json({ error: "截图不可用。 / Capture unavailable." }, 404);
      return new Response(file.body, {
        headers: {
          "Content-Type": file.contentType,
          "Content-Disposition": "inline",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
          "Cache-Control":
            file.cache === "public" ? "public, max-age=86400" : "private, max-age=60",
        },
      });
    }

    if (req.method === "GET" && path.length === 1 && path[0]) {
      // Cache très court côté navigateur pour la liste publique (les modérations
      // doivent apparaître vite) ; les soumissions authentifiées restent sans cache.
      return json(
        { items: await listMapCaptures(path[0], user ? user.userId : null) },
        200,
        { "Cache-Control": "public, max-age=30" },
      );
    }

    if (req.method === "POST" && path.length === 1 && path[0]) {
      // Corps borné AVANT tout retour d'autorisation (2 Mo + marge multipart).
      const bytes = await limitedBody(req, CAPTURE_MAX_BYTES + 64 * 1024);
      sameOrigin(req);
      if (!user) throw new HttpError(401, "请先登录。 / Please sign in.");
      const form = await new Request(req.url, {
        method: "POST",
        headers: { "content-type": req.headers.get("content-type") || "" },
        body: bytes,
      }).formData();
      const file = form.get("capture");
      const caption = form.get("caption");
      if (!(file instanceof File) || file.size === 0)
        throw new HttpError(400, "请选择一张游戏内截图。 / Pick an in-game capture.");
      const content = new Uint8Array(await file.arrayBuffer());
      return json(
        await submitMapCapture(user.userId, path[0], content, typeof caption === "string" ? caption : null),
        201,
      );
    }

    if (req.method === "PATCH" && path.length === 1 && path[0]) {
      const bytes = await limitedBody(req, 1024);
      sameOrigin(req);
      if (!user) throw new HttpError(401, "请先登录。 / Please sign in.");
      let body: { action?: string; status?: string };
      try {
        body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      } catch {
        throw new HttpError(400, "提交内容不是有效 JSON。 / Body is not valid JSON.");
      }
      if (body.action === "withdraw")
        return json(await withdrawMapCapture(path[0], user.userId));
      if (body.action === "delete") {
        if (!admin) throw new HttpError(403, "需要管理员权限。 / Admin access required.");
        return json(await deleteMapCapture(path[0]));
      }
      if (body.status === "published" || body.status === "rejected") {
        if (!admin) throw new HttpError(403, "需要管理员权限。 / Admin access required.");
        return json(await moderateMapCapture(path[0], body.status));
      }
      throw new HttpError(400, "未知操作。 / Unknown action.");
    }

    return json({ error: "未知路径。 / Unknown path." }, 404);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error("Map captures API failed", e instanceof Error ? e.message : "unknown");
    return json({ error: "暂时无法处理截图请求。 / Captures temporarily unavailable." }, 503);
  }
}

export const GET = route;
export const POST = route;
export const PATCH = route;
