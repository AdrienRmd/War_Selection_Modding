/** Couche « replays récemment soumis » (Chantier B, 31/10/2026) — D1 table
 *  `replays`, soumission authentifiée après analyse (les champs mode/mvp
 *  viennent du client ; aucun appel serveur vers games-api), listing public
 *  des 5 derniers publiés, modération par le socle existant (admin) et
 *  retrait par l'auteur. Quotas miroir de ceux des cartes : 3 en attente et
 *  5 par 24 h par compte, verrouillés atomiquement dans l'INSERT. */
import { bindings, HttpError } from "@/lib/atlas-server";
import { parseReplayCode } from "@/lib/replay";
import { MATCH_TYPES } from "@/lib/replay/structure";

export const REPLAY_SUBMIT_LIMIT = 3; // soumissions en attente par compte
export const REPLAY_SUBMIT_DAILY = 5; // soumissions par 24 h par compte

const MODE_KEYS = new Set(MATCH_TYPES.values());

export interface ReplayRecord {
  code: string;
  team_size: number;
  mvp_name: string | null;
  mode_key: string;
  owner_id: string;
  status: string;
  created_at: string;
  moderated_at: string | null;
  note: string | null;
}

export interface ReplayRecentItem {
  code: string;
  teamSize: number;
  mvpName: string | null;
  modeKey: string;
}

export interface ReplaySubmissionView extends ReplayRecentItem {
  status: string;
  createdAt: string;
  moderatedAt: string | null;
  note: string | null;
  mine?: boolean;
}

/** Nettoie et valide le corps de soumission. Null → 400. */
export function cleanReplayBody(value: unknown): {
  code: string;
  teamSize: number;
  mvpName: string | null;
  modeKey: string;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const code = parseReplayCode(typeof source.code === "string" ? source.code : null);
  if (!code) return null;
  const teamSize =
    typeof source.teamSize === "number" && Number.isInteger(source.teamSize)
      ? source.teamSize
      : Number.parseInt(String(source.teamSize ?? ""), 10);
  if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 16) return null;
  const modeKey = typeof source.modeKey === "string" && MODE_KEYS.has(source.modeKey) ? source.modeKey : null;
  if (!modeKey) return null;
  let mvpName: string | null = null;
  if (typeof source.mvpName === "string") {
    // Pseudo de jeu : on garde les caractères unicode (émoticônes comprises),
    // on retire uniquement les caractères de contrôle.
    mvpName = source.mvpName.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 40) || null;
  }
  return { code, teamSize, mvpName, modeKey };
}

/** Soumet un replay (auth requis). 409 si déjà publié/en attente, 429 si
 *  quota dépassé (contrôle anticipé + verrou atomique, comme les cartes). */
export async function submitReplay(
  ownerId: string,
  body: unknown,
): Promise<{ item: ReplaySubmissionView }> {
  const cleaned = cleanReplayBody(body);
  if (!cleaned) throw new HttpError(400, "提交内容无效：需要回放代码、模式与队伍规模。 / Invalid submission: replay code, mode and team size required.");
  const { code, teamSize, mvpName, modeKey } = cleaned;
  const db = bindings().DB;

  const existing = await db
    .prepare("SELECT code, status FROM replays WHERE code = ?")
    .bind(code)
    .first<{ code: string; status: string }>();
  if (existing && (existing.status === "published" || existing.status === "pending"))
    throw new HttpError(409, "这个回放已经提交过了。 / This replay has already been submitted.");

  const now = new Date().toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();

  if (existing) {
    // Re-soumission après refus ou retrait : la ligne repasse en attente.
    const changed = await db
      .prepare(
        "UPDATE replays SET team_size=?, mvp_name=?, mode_key=?, status='pending', created_at=?, moderated_at=NULL, note=NULL WHERE code=? AND owner_id=? AND (SELECT COUNT(*) FROM replays WHERE owner_id=? AND status='pending') < ?",
      )
      .bind(teamSize, mvpName, modeKey, now, code, ownerId, ownerId, REPLAY_SUBMIT_LIMIT)
      .run();
    if (changed.meta.changes !== 1)
      throw new HttpError(429, "待审核回放已达上限（3 个）。 / Too many pending submissions (3).");
    return { item: { code, teamSize, mvpName, modeKey, status: "pending", createdAt: now, moderatedAt: null, note: null, mine: true } };
  }

  // Verrou atomique : les quotas sont relus AU MOMENT de l'écriture.
  const inserted = await db
    .prepare(
      "INSERT INTO replays (code, team_size, mvp_name, mode_key, owner_id, status, created_at) SELECT ?, ?, ?, ?, ?, 'pending', ? WHERE (SELECT COUNT(*) FROM replays WHERE owner_id = ? AND status = 'pending') < ? AND (SELECT COUNT(*) FROM replays WHERE owner_id = ? AND created_at > ?) < ?",
    )
    .bind(code, teamSize, mvpName, modeKey, ownerId, now, ownerId, REPLAY_SUBMIT_LIMIT, ownerId, dayAgo, REPLAY_SUBMIT_DAILY)
    .run();
  if (inserted.meta.changes !== 1)
    throw new HttpError(429, "投稿频率已达上限（24 小时内 5 个，或已有 3 个待审核）。 / Submission limit reached (5 per 24h, or 3 pending).");
  return { item: { code, teamSize, mvpName, modeKey, status: "pending", createdAt: now, moderatedAt: null, note: null, mine: true } };
}

const toView = (r: ReplayRecord, mine = false): ReplaySubmissionView => ({
  code: r.code,
  teamSize: r.team_size,
  mvpName: r.mvp_name,
  modeKey: r.mode_key,
  status: r.status,
  createdAt: r.created_at,
  moderatedAt: r.moderated_at,
  note: r.note,
  mine,
});

/** Listing public : derniers replays publiés (défaut 5, plafond 20). */
export async function recentReplays(limitRaw: string | null): Promise<ReplayRecentItem[]> {
  const limit = Math.min(20, Math.max(1, Number.parseInt(limitRaw ?? "5", 10) || 5));
  const result = await bindings()
    .DB.prepare("SELECT * FROM replays WHERE status = 'published' ORDER BY created_at DESC, code ASC LIMIT ?")
    .bind(limit)
    .all<ReplayRecord>();
  return (result.results ?? []).map((r) => ({
    code: r.code,
    teamSize: r.team_size,
    mvpName: r.mvp_name,
    modeKey: r.mode_key,
  }));
}

/** File de modération (admin) ou mes soumissions (auteur). */
export async function listReplaySubmissions(
  ownerId: string,
  admin: boolean,
  adminScope: boolean,
): Promise<ReplaySubmissionView[]> {
  const db = bindings().DB;
  if (adminScope) {
    if (!admin) throw new HttpError(403, "需要管理员权限。 / Admin access required.");
    const result = await db
      .prepare("SELECT * FROM replays ORDER BY created_at DESC, code ASC LIMIT 200")
      .all<ReplayRecord>();
    return (result.results ?? []).map((r) => toView(r));
  }
  const result = await db
    .prepare("SELECT * FROM replays WHERE owner_id = ? ORDER BY created_at DESC, code ASC LIMIT 100")
    .bind(ownerId)
    .all<ReplayRecord>();
  return (result.results ?? []).map((r) => toView(r, true));
}

/** Modération admin : published / rejected (+ note). */
export async function moderateReplay(
  code: string,
  status: "published" | "rejected",
  note: string | null,
): Promise<ReplaySubmissionView> {
  const cleanNote = note?.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 300) || null;
  const db = bindings().DB;
  const now = new Date().toISOString();
  const changed = await db
    .prepare("UPDATE replays SET status=?, moderated_at=?, note=? WHERE code=?")
    .bind(status, now, cleanNote, code)
    .run();
  if (changed.meta.changes !== 1) throw new HttpError(404, "回放不存在。 / Replay not found.");
  const row = await db.prepare("SELECT * FROM replays WHERE code = ?").bind(code).first<ReplayRecord>();
  if (!row) throw new HttpError(404, "回放不存在。 / Replay not found.");
  return toView(row);
}

/** Retrait par l'auteur : pending/published → withdrawn. */
export async function withdrawReplay(code: string, ownerId: string): Promise<ReplaySubmissionView> {
  const db = bindings().DB;
  const now = new Date().toISOString();
  const changed = await db
    .prepare("UPDATE replays SET status='withdrawn', moderated_at=? WHERE code=? AND owner_id=? AND status IN ('pending','published')")
    .bind(now, code, ownerId)
    .run();
  if (changed.meta.changes !== 1) throw new HttpError(404, "找不到可撤回的回放。 / No withdrawable replay found.");
  const row = await db.prepare("SELECT * FROM replays WHERE code = ?").bind(code).first<ReplayRecord>();
  if (!row) throw new HttpError(404, "回放不存在。 / Replay not found.");
  return toView(row, true);
}
