import { getFeaturedMap, featuredRow } from "@/lib/featured-server";
import { bindings, json } from "@/lib/atlas-server";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const type = new URL(req.url).searchParams.get("asset");
    if (!type) return json(await getFeaturedMap());
    if (!["file", "cover"].includes(type)) return json({ error: "文件不存在" }, 404);
    const row = await featuredRow();
    const key = type === "cover" ? row?.cover_key : row?.file_key;
    if (!key) return json({ error: "作者尚未上传此文件。" }, 404);
    const object = await bindings().BUCKET.get(key);
    if (!object) return json({ error: "文件不可用。" }, 404);
    return new Response(object.body, {
      headers: {
        "Content-Type": type === "cover" ? row!.cover_type! : "application/zip",
        "Content-Disposition":
          type === "cover"
            ? "inline"
            : `attachment; filename="stalingrad.zip"; filename*=UTF-8''${encodeURIComponent(row!.file_name)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return json({ error: "暂时无法读取地图档案。" }, 503);
  }
}
