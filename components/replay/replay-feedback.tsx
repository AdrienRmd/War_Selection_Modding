"use client";
/** Widget « Ces données sont-elles exactes ? » (Replay phase 2, B4) —
 *  3 votes (Exactes / À peu près / Je vois des problèmes) sur la page
 *  résultat d'un replay. Auth requise pour voter (sinon lien de connexion),
 *  vote modifiable, agrégat public rafraîchi après vote, quota 10/24 h
 *  côté API (429 affiché proprement). */
import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, CircleHelp, TriangleAlert } from "lucide-react";
import { useBilingual } from "@/components/i18n";

interface FeedbackCounts {
  accurate: number;
  mostly: number;
  issues: number;
  total: number;
  mine?: "accurate" | "mostly" | "issues";
}

const CHOICES = [
  { vote: "accurate", zh: "准确", en: "Accurate" },
  { vote: "mostly", zh: "大致准确", en: "Close enough" },
  { vote: "issues", zh: "我看到问题", en: "I see problems" },
] as const;

export function ReplayFeedbackWidget({
  code,
  signedIn,
}: {
  code: string;
  signedIn: boolean;
}) {
  const l = useBilingual();
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<FeedbackCounts | null>(null);

  // Agrégat public (+ vote courant si signé) dès l'affichage du résultat.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/replay/feedback?code=${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("unavailable"))))
      .then((raw: unknown) => {
        const data = raw as { item?: FeedbackCounts };
        if (!cancelled && data.item) {
          setCounts(data.item);
          if (data.item.mine) setState("done");
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [code]);

  const vote = useCallback(
    async (value: FeedbackCounts["mine"]) => {
      setState("sending");
      setError(null);
      try {
        const r = await fetch("/api/replay/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, vote: value }),
        });
        if (r.status === 429) {
          setState("error");
          setError(l("反馈次数已达上限（24 小时内 10 次）。", "Feedback limit reached (10 per 24h)."));
          return;
        }
        if (!r.ok) {
          setState("error");
          setError(l("提交失败，请稍后再试。", "Submission failed. Try again later."));
          return;
        }
        const raw = (await r.json()) as { item?: FeedbackCounts };
        if (raw.item) setCounts(raw.item);
        setState("done");
      } catch {
        setState("error");
        setError(l("提交失败，请稍后再试。", "Submission failed. Try again later."));
      }
    },
    [code, l],
  );

  const bar = (count: number) =>
    counts && counts.total > 0 ? Math.round((count / counts.total) * 100) : 0;

  return (
    <section className="rp-feedback" aria-label={l("数据准确性反馈", "Replay data feedback")}>
      <p className="rp-feedback-q">{l("这些数据准确吗？", "How accurate is this data?")}</p>
      {signedIn ? (
        <div className="rp-feedback-actions" role="group" aria-label={l("投票", "Vote")}>
          {CHOICES.map((choice) => (
            <button
              key={choice.vote}
              type="button"
              className="rp-feedback-btn"
              data-vote={choice.vote}
              aria-pressed={counts?.mine === choice.vote}
              disabled={state === "sending"}
              onClick={() => void vote(choice.vote)}
            >
              {choice.vote === "accurate" ? (
                <BadgeCheck size={15} aria-hidden="true" />
              ) : choice.vote === "mostly" ? (
                <CircleHelp size={15} aria-hidden="true" />
              ) : (
                <TriangleAlert size={15} aria-hidden="true" />
              )}
              {l(choice.zh, choice.en)}
            </button>
          ))}
        </div>
      ) : (
        <a className="button rp-feedback-signin" href="/signin?next=%2Freplay">
          {l("登录后反馈数据准确性", "Sign in to rate this data")}
        </a>
      )}
      <p className="rp-feedback-status" role="status">
        {state === "sending" ? l("提交中…", "Submitting…") : null}
        {state === "done" && counts?.mine
          ? l(
              "已记录，谢谢！可以随时修改你的评价。",
              "Recorded, thanks! You can change your rating at any time.",
            )
          : null}
        {state === "error" && error ? error : null}
      </p>
      {counts && counts.total > 0 ? (
        <p className="rp-feedback-counts">
          <span className="rp-feedback-count accurate">
            {l("准确", "Accurate")} {counts.accurate}
          </span>
          <span className="rp-feedback-count mostly">
            {l("大致准确", "Close enough")} {counts.mostly}
          </span>
          <span className="rp-feedback-count issues">
            {l("我看到问题", "I see problems")} {counts.issues}
          </span>
          <span className="rp-feedback-share" aria-hidden="true">
            {bar(counts.accurate)}% · {bar(counts.mostly)}% · {bar(counts.issues)}%
          </span>
        </p>
      ) : null}
    </section>
  );
}
