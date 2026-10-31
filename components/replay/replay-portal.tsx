"use client";
/** Portail Replay — accueil éditorial façon wsva (titre, champ code, aide,
 *  replays récemment soumis) puis page résultat complète après analyse.
 *  Seule destination des données : l'API officielle games-api.warselect.io,
 *  appelée depuis le navigateur ; la soumission publique passe par
 *  /api/replay/submit (modérée, cf. socle soumissions ATLAS). */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, Search, Send, TriangleAlert } from "lucide-react";
import { useBilingual, useI18n } from "@/components/i18n";
import { buildReplayAnalysis, type ReplayAnalysis } from "@/lib/replay/analysis";
import { buildReplayDigest } from "@/lib/replay/digest";
import { ReplayInfoParser } from "@/lib/replay/parser";
import { getGameContext, loadLegacyUnitIds, parseReplayCode } from "@/lib/replay";
import { isReplaySuccess, type Player, type ReplayParseResult } from "@/lib/replay/structure";
import { ReplayResult } from "./replay-result";
import { PlayerDetail } from "./player-detail";
import { ReplayFeedbackWidget } from "./replay-feedback";

interface LoadedReplay {
  result: ReplayParseResult;
  analysis: ReplayAnalysis | null;
  isLegacy: boolean;
}

interface RecentReplay {
  code: string;
  teamSize: number;
  mvpName: string | null;
  modeKey: string;
}

/** Cache mémoire des replays analysés, par code (rafraîchi à la session). */
const replayCache = new Map<string, LoadedReplay>();

export function ReplayPortal({
  initialCode = "",
  signedIn = false,
}: {
  initialCode?: string;
  signedIn?: boolean;
}) {
  const { t } = useI18n();
  const l = useBilingual();
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LoadedReplay | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [recent, setRecent] = useState<RecentReplay[] | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "sending" | "ok" | "exists" | "error">(
    "idle",
  );
  const resultAnchor = useRef<HTMLDivElement | null>(null);

  const analyze = useCallback(
    async (rawInput: string, scroll = true) => {
      const normalized = parseReplayCode(rawInput);
      if (!normalized) {
        setError(
          l(
            "回放代码格式不对：需要 rep- 后跟 11 个字符，区分大小写。",
            "Invalid replay code: 11 characters after rep-, case-sensitive.",
          ),
        );
        setData(null);
        return;
      }
      setCode(normalized);
      setError(null);
      setSubmitState("idle");
      const cached = replayCache.get(normalized);
      if (cached) {
        setData(cached);
        setSelectedPlayer(null);
        return;
      }
      setLoading(true);
      try {
        // Seule destination de données : l'API officielle War Selection.
        const response = await fetch(
          `https://games-api.warselect.io/getByReplay?code=${encodeURIComponent(normalized)}`,
        );
        if (!response.ok) {
          setError(
            l(
              `游戏官方接口返回错误（HTTP ${response.status}），请稍后再试。`,
              `The official game API responded with HTTP error ${response.status}. Try again later.`,
            ),
          );
          return;
        }
        const json = (await response.json()) as {
          error?: number;
          description?: string;
          data?: { extraData?: Record<string, string> };
        };
        if (json.error === 2) {
          setError(
            l(
              "回放不存在（代码可能已过期）。",
              "Replay does not exist (the code may have expired).",
            ),
          );
          return;
        }
        if (json.error === 5) {
          setError(
            l(
              "回放代码不正确：需要 11 个字符，区分大小写。",
              "Incorrect replay code: 11 characters, case-sensitive.",
            ),
          );
          return;
        }
        if (json.error === 6) {
          setError(
            l(
              "游戏官方接口维护中，可能持续数小时，请稍后再试。",
              "The official game API is under maintenance (may last hours). Try again later.",
            ),
          );
          return;
        }
        if (json.error !== 0) {
          setError(
            l(
              `游戏官方接口返回错误（${json.error}）：${json.description ?? ""}`,
              `Official game API error (${json.error}): ${json.description ?? ""}`,
            ),
          );
          return;
        }
        const isLegacy = json.data?.extraData?.["7"] == null;
        const [context, legacyUnitIds] = await Promise.all([
          getGameContext(),
          isLegacy ? loadLegacyUnitIds() : Promise.resolve(undefined),
        ]);
        const result = new ReplayInfoParser(context, normalized, legacyUnitIds).parse(json);
        if (!isReplaySuccess(result)) {
          setError(
            l(
              `无法解析这份回放数据：${result.message}`,
              `Cannot parse this replay data: ${result.message}`,
            ),
          );
          return;
        }
        const loaded: LoadedReplay = {
          result,
          analysis: buildReplayAnalysis(result),
          isLegacy,
        };
        if (replayCache.size >= 20) {
          replayCache.delete(replayCache.keys().next().value as string);
        }
        replayCache.set(normalized, loaded);
        setData(loaded);
        setSelectedPlayer(null);
        if (scroll) {
          window.history.replaceState(null, "", `/replay?code=${encodeURIComponent(normalized)}`);
          resultAnchor.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } catch {
        setError(
          l(
            "无法连接游戏官方接口，请检查网络后重试。",
            "Cannot reach the official game API. Check your connection and retry.",
          ),
        );
      } finally {
        setLoading(false);
      }
    },
    [l],
  );

  // Code initial dans l'URL (?code=) : analyse automatique (différée d'un
  // tick : pas de setState synchrone dans le corps de l'effet).
  useEffect(() => {
    if (!initialCode) return;
    const id = setTimeout(() => void analyze(initialCode, false), 0);
    return () => clearTimeout(id);
  }, [initialCode, analyze]);

  // Replays récemment soumis (section publique, masquée si l'API manque).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/replay/recent")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("unavailable"))))
      .then((raw: unknown) => {
        const d = (raw ?? {}) as { items?: RecentReplay[] };
        if (!cancelled && Array.isArray(d.items) && d.items.length > 0) setRecent(d.items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const modeLabel = useMemo(() => {
    const labels: Record<string, { zh: string; en: string }> = {
      replayMatchTypeTeamMatch: { zh: "团队赛", en: "Team match" },
      replayMatchTypeFFA: { zh: "混战", en: "Free for all" },
      replayMatchTypeArmageddon: { zh: "末日审判", en: "Armageddon" },
      replayMatchTypeSurvival: { zh: "生存", en: "Survival" },
      replayMatchTypeCustom: { zh: "自定义", en: "Custom" },
    };
    return (key: string) => {
      const label = labels[key];
      return label ? l(label.zh, label.en) : key;
    };
  }, [l]);

  async function submitReplay() {
    if (!data || !isReplaySuccess(data.result) || !data.analysis) return;
    const mvp = [...data.result.players].sort((a, b) => (b.mvpScore ?? 0) - (a.mvpScore ?? 0))[0];
    setSubmitState("sending");
    try {
      const r = await fetch("/api/replay/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: data.result.match.replayCode,
          teamSize: data.analysis.verdict.teamSize,
          mvpName: mvp?.nickname ?? null,
          modeKey: data.analysis.verdict.modeKey,
          // Digest statistique (saisons/classement) — validé côté serveur.
          digest: buildReplayDigest(
            data.result as Extract<ReplayParseResult, { error: 0 }>,
            data.analysis,
          ),
        }),
      });
      if (r.status === 409) {
        setSubmitState("exists");
        return;
      }
      setSubmitState(r.ok ? "ok" : "error");
    } catch {
      setSubmitState("error");
    }
  }

  const success = data && isReplaySuccess(data.result) && data.analysis ? data : null;

  return (
    <section className="replay-wsva" aria-label={t("回放分析")}>
      <header className="rp-hero">
        <p className="rp-hero-mark" aria-hidden="true">
          <img src="/atlas-emblem-96.png" alt="" width={30} height={30} loading="lazy" />
          <span>WS ATLAS · REPLAY</span>
        </p>
        <h1>{l("你这一局，打得究竟怎么样？", "How well did you really play?")}</h1>
        <p className="rp-hero-help">
          {l(
            "在游戏的回放列表或结算画面中找到代码。代码区分大小写。",
            "Find the code in the game's replay list or at the end of a game. It is case-sensitive.",
          )}
        </p>
        <form
          className="rp-form"
          onSubmit={(e) => {
            e.preventDefault();
            void analyze(code);
          }}
        >
          <div className="search-input rp-code-input">
            <Search size={16} aria-hidden="true" />
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="rep-XXXXXXXXXXX"
              aria-label={l("回放代码", "Replay code")}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <button type="submit" className="button primary rp-submit-main" disabled={loading}>
            {loading ? l("分析中…", "Analyzing…") : l("显示回放", "Show replay")}
          </button>
        </form>
        <p className="rp-hero-note">
          {l(
            "分析只调用游戏官方接口。支持带 rep- 前缀或纯代码。",
            "Analysis only calls the official game API. The rep- prefix is optional.",
          )}
        </p>
      </header>

      {loading ? (
        <p className="rp-status" role="status">
          <Clock size={15} aria-hidden="true" />{" "}
          {l("正在获取并解析回放…", "Fetching and parsing the replay…")}
        </p>
      ) : null}

      {error ? (
        <p className="rp-status rp-error" role="alert">
          <TriangleAlert size={15} aria-hidden="true" /> {error}
        </p>
      ) : null}

      <div ref={resultAnchor} />

      {success ? (
        <>
          <ReplayResult
            data={success.result as Extract<ReplayParseResult, { error: 0 }>}
            analysis={success.analysis!}
            isLegacy={success.isLegacy}
            onOpenPlayer={(playerId) =>
              setSelectedPlayer(
                (success.result.players ?? []).find((p) => p.id === playerId) ?? null,
              )
            }
          />
          <div className="rp-share">
            {signedIn ? (
              submitState === "ok" ? (
                <p className="rp-share-done" role="status">
                  {l(
                    "已提交，等待审核后会出现在最近列表中。",
                    "Submitted — it will appear in the recent list after review.",
                  )}
                </p>
              ) : submitState === "exists" ? (
                <p className="rp-share-done" role="status">
                  {l("这个回放已经提交过了。", "This replay has already been submitted.")}
                </p>
              ) : (
                <button
                  type="button"
                  className="button rp-share-button"
                  onClick={() => void submitReplay()}
                  disabled={submitState === "sending"}
                >
                  <Send size={14} aria-hidden="true" />
                  {submitState === "sending"
                    ? l("提交中…", "Submitting…")
                    : l("提交这个回放", "Submit this replay")}
                </button>
              )
            ) : (
              <a className="button rp-share-button" href="/signin?next=%2Freplay">
                {l("登录以提交这个回放", "Sign in to submit this replay")}
              </a>
            )}
            {submitState === "error" ? (
              <p className="rp-status rp-error" role="alert">
                {l("提交失败，请稍后再试。", "Submission failed. Try again later.")}
              </p>
            ) : null}
            <ReplayFeedbackWidget
              code={(success.result as Extract<ReplayParseResult, { error: 0 }>).match.replayCode}
              signedIn={signedIn}
            />
          </div>
        </>
      ) : null}

      {selectedPlayer ? (
        <PlayerDetail player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
      ) : null}

      {recent && recent.length > 0 ? (
        <section className="rp-recent">
          <h2>{l("最近提交的 5 个回放", "5 recently submitted replays")}</h2>
          <ul>
            {recent.slice(0, 5).map((item) => (
              <li key={item.code}>
                <button
                  type="button"
                  className="rp-recent-code"
                  onClick={() => void analyze(`rep-${item.code}`)}
                >
                  rep-{item.code}
                </button>
                <span className="rp-recent-mode">
                  {item.teamSize > 0
                    ? `${item.teamSize}v${item.teamSize}`
                    : modeLabel(item.modeKey)}
                </span>
                <span className="rp-recent-author">· {item.mvpName ?? "—"}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
