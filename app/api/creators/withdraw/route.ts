import { identity, sameOrigin, limitedBody, HttpError, json } from "@/lib/atlas-server";
import { withdrawCreator } from "@/lib/creators-server";

export const dynamic = "force-dynamic";

/** POST /api/creators/withdraw — retrait de son profil créateur par
 *  l'auteur ({ id }) : pending/published → withdrawn (le profil public
 *  disparaît ; une nouvelle candidature reste possible après refus/retrait). */
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const { user } = await identity();
    if (!user) throw new HttpError(401, "请先登录。 / Please sign in.");
    const bytes = await limitedBody(req, 2048);
    let body: unknown;
    try {
      body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
      throw new HttpError(400, "提交内容不是有效 JSON。 / Body is not valid JSON.");
    }
    const id = typeof (body as Record<string, unknown> | null)?.id === "string" ? ((body as Record<string, unknown>).id as string) : "";
    if (!id) throw new HttpError(400, "缺少创作者 ID。 / Missing creator id.");
    return json(await withdrawCreator(id, user.userId));
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error("Creator withdraw failed", e instanceof Error ? e.message : "unknown");
    return json({ error: "暂时无法处理，请稍后重试。 / Unavailable right now, try again later." }, 503);
  }
}
