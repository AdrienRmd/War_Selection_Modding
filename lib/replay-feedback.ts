/** Couche « retour d'exactitude » des replays (Replay phase 2, B4) —
 *  widget « Ces données sont-elles exactes ? » sur la page résultat :
 *  3 votes (accurate / mostly / issues), un par (replay, compte),
 *  modifiable, quota simple par compte (10 écritures / 24 h — insertions
 *  et changements d'avis comptent, miroir des quotas de soumission).
 *  Agrégat public par code + récap admin (onglet replays de /admin). */
import { bindings, HttpError } from "@/lib/atlas-server";
import { parseReplayCode } from "@/lib/replay";

export const REPLAY_FEEDBACK_DAILY = 10; // écritures par compte et 24 h

export const FEEDBACK_VOTES = ["accurate", "mostly", "issues"] as const;
export type FeedbackVote = (typeof FEEDBACK_VOTES)[number];

export interface FeedbackCounts {
  accurate: number;
  mostly: number;
  issues: number;
}

export interface FeedbackView extends FeedbackCounts {
  total: number;
  /** Vote courant du compte signé (absent si anonyme ou pas de vote). */
  mine?: FeedbackVote;
}

export interface FeedbackSummaryRow extends FeedbackCounts {
  total: number;
  code: string;
  teamSize: number;
  status: string;
  createdAt: string;
}

export function isFeedbackVote(value: unknown): value is FeedbackVote {
  return value === "accurate" || value === "mostly" || value === "issues";
}

/** Valide le corps {code, vote}. Null → 400 géré par l'appelant. */
export function cleanFeedbackBody(value: unknown): { code: string; vote: FeedbackVote } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const code = parseReplayCode(typeof source.code === "string" ? source.code : null);
  if (!code || !isFeedbackVote(source.vote)) return null;
  return { code, vote: source.vote };
}

/** Enregistre (ou modifie) le vote d'un compte. 404 code invalide géré en
 *  amont ; 429 au-delà du quota 24 h (insertions + changements). */
export async function submitReplayFeedback(
  userId: string,
  body: unknown,
): Promise<FeedbackView> {
  const cleaned = cleanFeedbackBody(body);
  if (!cleaned) throw new HttpError(400, "反馈内容无效：需要回放代码与投票。 / Invalid feedback: replay code and vote required.");
  const { code, vote } = cleaned;
  const db = bindings().DB;
  const now = new Date().toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();

  // Quota simple compté à l'écriture (verrou atomique comme les soumissions)
  // : l'INSERT part d'un SELECT conditionnel — aucune ligne n'est écrite
  // (ni insertion, ni changement d'avis) au-delà de N écritures/24 h.
  const changed = await db
    .prepare(
      `INSERT INTO replay_feedback (code, user_id, vote, created_at, updated_at)
       SELECT ?, ?, ?, ?, ?
       WHERE (SELECT COUNT(*) FROM replay_feedback WHERE user_id = ? AND updated_at > ?) < ?
       ON CONFLICT(code, user_id) DO UPDATE SET vote = excluded.vote, updated_at = excluded.updated_at`,
    )
    .bind(code, userId, vote, now, now, userId, dayAgo, REPLAY_FEEDBACK_DAILY)
    .run();
  if (changed.meta.changes !== 1)
    throw new HttpError(429, "反馈次数已达上限（24 小时内 10 次）。 / Feedback limit reached (10 per 24h).");
  return replayFeedbackView(code, userId);
}

/** Agrégat public d'un code + vote courant du compte (si fourni). */
export async function replayFeedbackView(code: string, userId?: string): Promise<FeedbackView> {
  const db = bindings().DB;
  const rows = await db
    .prepare("SELECT vote, COUNT(*) AS n FROM replay_feedback WHERE code = ? GROUP BY vote")
    .bind(code)
    .all<{ vote: FeedbackVote; n: number }>();
  const counts: FeedbackCounts = { accurate: 0, mostly: 0, issues: 0 };
  for (const row of rows.results ?? []) counts[row.vote] = row.n;
  const view: FeedbackView = {
    ...counts,
    total: counts.accurate + counts.mostly + counts.issues,
  };
  if (userId) {
    const mine = await db
      .prepare("SELECT vote FROM replay_feedback WHERE code = ? AND user_id = ?")
      .bind(code, userId)
      .first<{ vote: FeedbackVote }>();
    if (mine) view.mine = mine.vote;
  }
  return view;
}

/** Récap admin : tous les codes avec au moins un vote, joints aux lignes
 *  replays connues (un vote peut exister pour un code jamais soumis — il
 *  apparaît alors avec des colonnes replays vides, la ligne reste utile au
 *  modérateur pour repérer un contenu signalé). */
export async function replayFeedbackSummary(): Promise<FeedbackSummaryRow[]> {
  const db = bindings().DB;
  const rows = await db
    .prepare(
      `SELECT f.code,
              SUM(CASE WHEN f.vote = 'accurate' THEN 1 ELSE 0 END) AS accurate,
              SUM(CASE WHEN f.vote = 'mostly' THEN 1 ELSE 0 END) AS mostly,
              SUM(CASE WHEN f.vote = 'issues' THEN 1 ELSE 0 END) AS issues,
              COUNT(*) AS total,
              r.team_size AS team_size, r.status AS status, r.created_at AS created_at
       FROM replay_feedback f LEFT JOIN replays r ON r.code = f.code
       GROUP BY f.code
       ORDER BY issues DESC, total DESC, f.code ASC
       LIMIT 200`,
    )
    .all<{
      code: string;
      accurate: number;
      mostly: number;
      issues: number;
      total: number;
      team_size: number | null;
      status: string | null;
      created_at: string | null;
    }>();
  return (rows.results ?? []).map((row) => ({
    code: row.code,
    accurate: row.accurate,
    mostly: row.mostly,
    issues: row.issues,
    total: row.total,
    teamSize: row.team_size ?? 0,
    status: row.status ?? "—",
    createdAt: row.created_at ?? "",
  }));
}
