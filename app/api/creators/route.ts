import { z } from "zod";
import { bindings, identity, sameOrigin, limitedBody, HttpError, json } from "@/lib/atlas-server";
import { listCreators, nextCreatorPosition } from "@/lib/creators-server";
export const dynamic = "force-dynamic";
const input = z.object({
  name: z.string().trim().min(1).max(60),
  role: z.string().trim().max(60),
});
export async function GET() {
  try {
    return json({ items: await listCreators() });
  } catch {
    return json({ error: "暂时无法读取创作者名单。" }, 503);
  }
}
export async function POST(req: Request) {
  let uploaded: string | null = null;
  let committed = false;
  try {
    const bytes = await limitedBody(req, 4 * 1024 * 1024);
    sameOrigin(req);
    const { user, admin } = await identity();
    if (!user) return json({ error: "请先登录。" }, 401);
    if (!admin) return json({ error: "只有管理员可以维护创作者名单。" }, 403);
    const form = await new Request(req.url, {
      method: "POST",
      headers: { "content-type": req.headers.get("content-type") || "" },
      body: bytes,
    }).formData();
    const parsed = input.safeParse({
      name: form.get("name"),
      role: form.get("role") ?? "",
    });
    if (!parsed.success) return json({ error: "请检查名称（必填，最长 60 字）与职务。" }, 400);
    const photo = form.get("photo");
    if (photo instanceof File && photo.size > 2 * 1024 * 1024)
      return json({ error: "头像不能超过 2 MB。" }, 400);
    const { DB, BUCKET } = bindings();
    const count = await DB.prepare("SELECT COUNT(*) AS n FROM creators").first<{ n: number }>();
    if ((count?.n || 0) >= 24) return json({ error: "创作者名单已满，请先移除成员。" }, 400);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const position = await nextCreatorPosition();
    let photoKey: string | null = null,
      photoType: string | null = null;
    if (photo instanceof File && photo.size > 0) {
      const content = new Uint8Array(await photo.arrayBuffer());
      const png =
        content.length > 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => content[i] === v);
      const jpg =
        content.length > 3 && content[0] === 255 && content[1] === 216 && content[2] === 255;
      if (!png && !jpg) return json({ error: "头像只接受 PNG 或 JPEG。" }, 400);
      photoType = png ? "image/png" : "image/jpeg";
      photoKey = `creators/${id}/photo`;
      await BUCKET.put(photoKey, content, { httpMetadata: { contentType: photoType } });
      uploaded = photoKey;
    }
    const changed = await DB.prepare(
      "INSERT INTO creators (id,name,role,photo_key,photo_type,position,created_at) VALUES (?,?,?,?,?,?,?)",
    )
      .bind(id, parsed.data.name, parsed.data.role, photoKey, photoType, position, now)
      .run();
    if (changed.meta.changes !== 1) return json({ error: "添加未完成，请稍后重试。" }, 503);
    committed = true;
    return json({ created: id, items: await listCreators() });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    if (e instanceof z.ZodError || e instanceof SyntaxError)
      return json({ error: "请检查名称与头像后重试。" }, 400);
    console.error("Creator add failed", e instanceof Error ? e.message : "unknown");
    return json({ error: "添加未完成，请稍后重试。" }, 503);
  } finally {
    if (!committed && uploaded) {
      try {
        await bindings().BUCKET.delete(uploaded);
      } catch {
        console.error("Creator upload cleanup failed");
      }
    }
  }
}
