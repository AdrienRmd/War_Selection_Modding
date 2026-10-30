"use client";
import { T, useI18n } from "@/components/i18n";

import { useState } from "react";
import { FlaskConical, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { mapTestStates, mapTestLabels, type MapTestState } from "@/lib/map-code";

// SB6 — statut de test déclaré par l'auteur (après publication), surplombable
// par l'admin. Ne repasse PAS la carte en modération : PATCH dédié
// /api/atlas/test-status/<id> (révision incrémentée, jamais de re-review).
export function TestStatusPanel({
  mapId,
  initial,
}: {
  mapId: string;
  initial: {
    test_status: string;
    test_notes: string;
    revision: number;
    game_version: string;
  };
}) {
  const { t } = useI18n();
  const [status, setStatus] = useState<MapTestState>(
    (mapTestStates as readonly string[]).includes(initial.test_status)
      ? (initial.test_status as MapTestState)
      : "untested",
  ),
    [testedAt, setTestedAt] = useState(""),
    [gameVersion, setGameVersion] = useState(initial.game_version || ""),
    [notes, setNotes] = useState(initial.test_notes || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [revision, setRevision] = useState(initial.revision || 0);
  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const r = await fetch(`/api/atlas/test-status/${mapId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          tested_at: testedAt,
          game_version: gameVersion,
          notes,
          revision,
        }),
      });
      const d = (await r.json()) as { error?: string; revision: number };
      if (!r.ok) throw new Error(d.error);
      setRevision(d.revision);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel test-status-panel">
      <FlaskConical size={24} />
      <h2>
        <T text={"申报测试状态"} />
      </h2>
      <p className="caption">
        <T
          text={
            "只更新测试状态，不重新进入审核。选择实际测试后的结果：未测试就保持“待实测”。"
          }
        />
      </p>
      <label>
        <T text={"测试状态"} />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as MapTestState)}
          aria-label={t("测试状态")}
        >
          {mapTestStates.map((s) => (
            <option key={s} value={s}>
              {t(mapTestLabels[s][0])}
            </option>
          ))}
        </select>
      </label>
      <div className="test-status-fields">
        <label>
          <T text={"测试日期"} />
          <Input
            type="date"
            value={testedAt}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setTestedAt(e.target.value)}
          />
        </label>
        <label>
          <T text={"实测游戏版本"} />
          <Input
            maxLength={100}
            value={gameVersion}
            onChange={(e) => setGameVersion(e.target.value)}
            placeholder={t("填写实际测试客户端版本")}
          />
        </label>
      </div>
      <label>
        <T text={"测试记录"} />
        <Textarea
          rows={3}
          maxLength={4000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("状态不是“待实测”时必填：测试人数、时长、发现的问题。")}
        />
      </label>
      {error && (
        <p className="notice error" role="alert">
          <T text={error} />
        </p>
      )}
      {saved && (
        <p className="notice success" role="status">
          <CheckCircle2 size={18} /> <T text={"测试状态已更新。"} />
        </p>
      )}
      <div className="form-submit">
        <Button className="button primary" onClick={save} disabled={busy}>
          <T text={busy ? "正在保存…" : "保存测试状态"} />
        </Button>
      </div>
    </section>
  );
}
