/** Captures en jeu soumises par les testeurs (finitions 01/11, chantier 7) —
 *  D1 table `map_captures` (migration 0014, additive ; backup .wrangler/state
 *  préalable), images R2 `map-captures/<mapId>/<id>`.
 *
 *  Réutilise les pipelines existants :
 *   - images : même validation que creators/avatar (sniff magique PNG/JPEG/
 *     WebP, ≤ 2 Mo, R2 put + rollback delete si l'écriture D1 échoue) ;
 *   - modération : mêmes états que les replays soumis (pending → published /
 *     rejected, retrait auteur → withdrawn), quotas miroir (3 en attente PAR
 *     CARTE ET PAR COMPTE, 5 par 24 h par compte) verrouillés atomiquement
 *     dans l'INSERT ;
 *   - aucune stat de jeu n'est inventée : la valeur vient des testeurs réels.
 */
import { bindings, HttpError } from "@/lib/atlas-server";
import { collectionSeed } from "@/lib/collection";

export const CAPTURES_PER_MAP_AUTHOR = 3; // en attente + publiées, par carte et compte
export const CAPTURE_DAILY = 5; // soumissions par 24 h par compte
export const CAPTURE_MAX_BYTES = 2 * 1024 * 1024;

export interface MapCaptureRow {
  id: string;
  map_id: string;
  owner_id: string;
  storage_key: string;
  content_type: string;
  caption: string | null;
  status: string;
  created_at: string;
  moderated_at: string | null;
}

export interface MapCaptureView {
  id: string;
  mapId: string;
  caption: string | null;
  status: string;
  createdAt: string;
  mine?: boolean;
}

/** Sniff magique comme creators/avatar : PNG, JPEG ou WebP (types servis par
 *  le jeu en capture d'écran). Null → refus (aucune confiance en l'extension
 *  ou au Content-Type du client). */
export function sniffImageType(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  if (bytes.length > 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
    return "image/png";
  if (bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  if (
    bytes.length > 11 &&
    bytes[0] === 82 &&
    bytes[1] === 73 &&
    bytes[2] === 70 &&
    bytes[3] === 70 &&
    bytes[8] === 87 &&
    bytes[9] === 69 &&
    bytes[10] === 66 &&
    bytes[11] === 80
  )
    return "image/webp";
  return null;
}

const toView = (r: MapCaptureRow, viewerId: string | null): MapCaptureView => ({
  id: r.id,
  mapId: r.map_id,
  caption: r.caption,
  status: r.status,
  createdAt: r.created_at,
  mine: viewerId === r.owner_id || undefined,
});

/** Soumet une capture (auth requis) : la carte doit exister dans la
 *  collection (seeds + overrides D1), l'image est validée par magie,
 *  l'INSERT porte les quotas atomiquement ; l'objet R2 est purgé si la
 *  ligne n'est pas créée. */
export async function submitMapCapture(
  ownerId: string,
  mapId: string,
  bytes: Uint8Array,
  caption: string | null,
): Promise<{ item: MapCaptureView }> {
  if (!collectionSeed(mapId)) throw new HttpError(404, "收藏中找不到这张地图。 / Map not found in the collection.");
  if (bytes.length === 0 || bytes.length > CAPTURE_MAX_BYTES)
    throw new HttpError(400, "截图须为 2 MB 以内的 PNG/JPEG/WebP。 / Capture must be PNG/JPEG/WebP under 2 MB.");
  const contentType = sniffImageType(bytes);
  if (!contentType)
    throw new HttpError(400, "截图只接受 PNG、JPEG 或 WebP。 / Only PNG, JPEG or WebP captures are accepted.");
  const cleanCaption =
    caption?.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200) || null;

  const id = crypto.randomUUID();
  const storageKey = `map-captures/${mapId}/${id}`;
  const now = new Date().toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const { DB, BUCKET } = bindings();

  // Verrou atomique miroir des replays : quotas relus AU MOMENT de l'écriture
  // (3 en attente + publiées par carte et compte, 5 par 24 h par compte).
  const inserted = await DB.prepare(
    "INSERT INTO map_captures (id, map_id, owner_id, storage_key, content_type, caption, status, created_at) SELECT ?, ?, ?, ?, ?, ?, 'pending', ? WHERE (SELECT COUNT(*) FROM map_captures WHERE owner_id = ? AND map_id = ? AND status IN ('pending','published')) < ? AND (SELECT COUNT(*) FROM map_captures WHERE owner_id = ? AND created_at > ?) < ?",
  )
    .bind(id, mapId, ownerId, storageKey, contentType, cleanCaption, now, ownerId, mapId, CAPTURES_PER_MAP_AUTHOR, ownerId, dayAgo, CAPTURE_DAILY)
    .run();
  if (inserted.meta.changes !== 1)
    throw new HttpError(429, "投稿频率已达上限（每张地图 3 张、每 24 小时 5 张）。 / Limit reached (3 per map, 5 per 24h).");

  try {
    await BUCKET.put(storageKey, bytes, { httpMetadata: { contentType } });
  } catch {
    // R2 indisponible : la ligne ne doit pas référencer un objet absent.
    await DB.prepare("DELETE FROM map_captures WHERE id = ? AND owner_id = ?").bind(id, ownerId).run();
    throw new HttpError(503, "暂时无法保存截图，请稍后重试。 / Storage unavailable, try again soon.");
  }
  return {
    item: { id, mapId, caption: cleanCaption, status: "pending", createdAt: now, mine: true },
  };
}

/** Liste publique d'une carte : publiées (chronologiques) +, si un viewer est
 *  fourni, ses propres captures en attente (marquées mine). */
export async function listMapCaptures(mapId: string, viewerId: string | null): Promise<MapCaptureView[]> {
  const rows = await bindings()
    .DB.prepare(
      "SELECT * FROM map_captures WHERE map_id = ? AND (status = 'published' OR (owner_id = ? AND status = 'pending')) ORDER BY created_at DESC, id ASC LIMIT 60",
    )
    .bind(mapId, viewerId ?? "")
    .all<MapCaptureRow>();
  return (rows.results ?? []).map((r) => toView(r, viewerId));
}

/** File de modération (admin) : toutes captures non retirées, récentes d'abord. */
export async function captureQueue(): Promise<MapCaptureView[]> {
  const rows = await bindings()
    .DB.prepare(
      "SELECT * FROM map_captures WHERE status != 'withdrawn' ORDER BY created_at DESC, id ASC LIMIT 80",
    )
    .all<MapCaptureRow>();
  return (rows.results ?? []).map((r) => toView(r, null));
}

/** Modération admin : published / rejected. Retourne le statut final. */
export async function moderateMapCapture(
  id: string,
  status: "published" | "rejected",
): Promise<{ status: string }> {
  const changed = await bindings()
    .DB.prepare(
      "UPDATE map_captures SET status = ?, moderated_at = ? WHERE id = ? AND status = 'pending'",
    )
    .bind(status, new Date().toISOString(), id)
    .run();
  if (changed.meta.changes !== 1)
    throw new HttpError(409, "只有待审核的截图可以操作。 / Only pending captures can be moderated.");
  return { status };
}

/** Retrait par l'auteur : pending → withdrawn (les publiées se retirent aussi
 *  — même règle que les replays). */
export async function withdrawMapCapture(id: string, ownerId: string): Promise<{ status: string }> {
  const changed = await bindings()
    .DB.prepare(
      "UPDATE map_captures SET status = 'withdrawn', moderated_at = ? WHERE id = ? AND owner_id = ? AND status IN ('pending','published')",
    )
    .bind(new Date().toISOString(), id, ownerId)
    .run();
  if (changed.meta.changes !== 1)
    throw new HttpError(409, "只能撤回自己的截图。 / You can only withdraw your own captures.");
  return { status: "withdrawn" };
}

/** Suppression dure (admin) : ligne + objet R2 — nettoyage de modération
 *  (règle du site : un objet R2 n'est purgé que si plus aucune ligne ne le
 *  référence). */
export async function deleteMapCapture(id: string): Promise<{ deleted: true }> {
  const row = await bindings()
    .DB.prepare("SELECT storage_key FROM map_captures WHERE id = ?")
    .bind(id)
    .first<{ storage_key: string }>();
  if (!row) throw new HttpError(404, "截图不存在。 / Capture not found.");
  await bindings().DB.prepare("DELETE FROM map_captures WHERE id = ?").bind(id).run();
  await bindings().BUCKET.delete(row.storage_key);
  return { deleted: true };
}

/** Lecture du fichier pour le endpoint public : publiée → tout le monde ;
 *  en attente → propriétaire uniquement ; refusée/retirée → personne. */
export async function mapCaptureFile(
  id: string,
  viewerId: string | null,
): Promise<{ body: ReadableStream; contentType: string; cache: "public" | "private" } | null> {
  const row = await bindings()
    .DB.prepare("SELECT * FROM map_captures WHERE id = ?")
    .bind(id)
    .first<MapCaptureRow>();
  if (!row) return null;
  if (row.status === "pending" && viewerId !== row.owner_id) return null;
  if (row.status !== "published" && row.status !== "pending") return null;
  const object = await bindings().BUCKET.get(row.storage_key);
  if (!object) return null;
  return {
    body: object.body,
    contentType: row.content_type,
    cache: row.status === "published" ? "public" : "private",
  };
}
