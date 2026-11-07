import {
  bindings,
  identity,
  sameOrigin,
  limitedBody,
  HttpError,
  json,
} from "@/lib/atlas-server";
import {
  applyCreator,
  claimableItems,
  putCreatorPhoto,
  sniffCreatorPhoto,
} from "@/lib/creators-server";

export const dynamic = "force-dynamic";

/** POST /api/creators/apply — candidature « devenir créateur » (auth).
 *  Multipart : champ « application » (JSON validé côté serveur : nom, bio,
 *  réseaux whitelist https, revendications d'items publiés) + « photo »
 *  optionnelle PNG/JPEG ≤ 2 MB. Quotas : 1 en attente max, 2 par 24 h
 *  (verrou atomique dans l'INSERT). Rien n'est publié sans modération admin.
 *
 *  GET /api/creators/apply — items revendicables pour le formulaire
 *  (cartes/mods publiés du site, plafonnés). */
export async function GET() {
  try {
    const { user } = await identity();
    return json(await claimableItems(user?.userId ?? null));
  } catch (e) {
    console.error("Claimable items failed", e instanceof Error ? e.message : "unknown");
    return json({ error: "暂时无法读取，请稍后重试。 / Unavailable right now, try again later." }, 503);
  }
}

export async function POST(req: Request) {
  try {
    const bytes = await limitedBody(req, 4 * 1024 * 1024);
    sameOrigin(req);
    const { user } = await identity();
    if (!user) throw new HttpError(401, "请先登录。 / Please sign in.");
    const form = await new Request(req.url, {
      method: "POST",
      headers: { "content-type": req.headers.get("content-type") || "" },
      body: bytes,
    }).formData();
    let body: unknown = null;
    let applicationInvalid = false;
    const rawApplication = form.get("application");
    if (typeof rawApplication === "string" && rawApplication) {
      try {
        body = JSON.parse(rawApplication);
      } catch {
        applicationInvalid = true;
      }
    }
    if (applicationInvalid || body === null)
      throw new HttpError(400, "申请内容不是有效 JSON。 / Application body is not valid JSON.");
    const result = await applyCreator(user.userId, body);
    const photo = form.get("photo");
    if (photo instanceof File && photo.size > 0) {
      const content = new Uint8Array(await photo.arrayBuffer());
      const type = sniffCreatorPhoto(content, photo.size);
      if (type) {
        await putCreatorPhoto(result.item.id, content, type);
        await bindings()
          .DB.prepare("UPDATE creators SET photo_key = ?, photo_type = ? WHERE id = ? AND user_id = ?")
          .bind(`creators/${result.item.id}/photo`, type, result.item.id, user.userId)
          .run();
        result.item.has_photo = true;
      } else {
        // Photo invalide : la candidature est enregistrée SANS image — la
        // réponse porte l'avertissement (affiché par le formulaire).
        return json(
          {
            ...result,
            warning:
              "头像只接受 PNG 或 JPEG（≤ 2 MB），已按无头像保存。 / Photo must be PNG or JPEG (≤ 2 MB); saved without photo.",
          },
          201,
        );
      }
    }
    return json(result, 201);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error("Creator apply failed", e instanceof Error ? e.message : "unknown");
    return json({ error: "暂时无法处理，请稍后重试。 / Unavailable right now, try again later." }, 503);
  }
}
