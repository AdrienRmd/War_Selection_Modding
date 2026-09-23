"use client";
import { useState, type FormEvent } from "react";
import Link from "@/components/site-link";
import { useBilingual, useI18n } from "@/components/i18n";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  collectionBody,
  collectionCategories,
  collectionTestStates,
  collectionLabels,
  type CollectedMap,
  type CollectionBody,
} from "@/lib/collection";
export function CollectedMapEditor({ initial }: { initial: CollectedMap }) {
  const { locale, t } = useI18n();
  const l = useBilingual();
  const en = locale !== "zh";
  const label = (pair: readonly [string, string] | undefined) =>
    pair ? (locale === "zh" ? pair[0] : t(pair[1])) : "";
  const [body, setBody] = useState<CollectionBody>(() => collectionBody(initial)),
    [revision, setRevision] = useState(initial.revision),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [ok, setOk] = useState(false);
  function field<K extends keyof CollectionBody>(key: K, value: CollectionBody[K]) {
    setBody((b) => ({ ...b, [key]: value }));
    setMessage("");
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setOk(false);
    try {
      const r = await fetch(`/api/collection/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, revision }),
      });
      const d = (await r.json()) as { error?: string; revision: number };
      if (!r.ok) throw new Error(d.error || "保存失败");
      setRevision(d.revision);
      setOk(true);
      setMessage(l("档案已保存。", "Archive saved."));
    } catch (e) {
      setMessage(
        e instanceof Error
          ? t(e.message)
          : en
            ? "Save failed; your draft is retained."
            : "保存失败，草稿已保留。",
      );
    } finally {
      setBusy(false);
    }
  }
  const lines: {
    key: keyof CollectionBody;
    zh: string;
    en: string;
    max: number;
    area?: boolean;
  }[] = [
    { key: "title", zh: "原地图名称", en: "Original map title", max: 120 },
    {
      key: "title_en",
      zh: "英文展示名称（可留空）",
      en: "English display title (optional)",
      max: 160,
    },
    {
      key: "author",
      zh: "原作者（不确定可留空）",
      en: "Original author (leave blank if unknown)",
      max: 100,
    },
    { key: "summary", zh: "中文简述", en: "Chinese summary", max: 500, area: true },
    { key: "summary_en", zh: "英文简述", en: "English summary", max: 700, area: true },
    {
      key: "description",
      zh: "中文玩法与规则",
      en: "Chinese gameplay notes",
      max: 10000,
      area: true,
    },
    {
      key: "description_en",
      zh: "英文玩法与规则",
      en: "English gameplay notes",
      max: 14000,
      area: true,
    },
    {
      key: "mods",
      zh: "所需 Mod（未知留空）",
      en: "Required mods (blank if unknown)",
      max: 4000,
      area: true,
    },
    { key: "mods_en", zh: "英文 Mod 说明", en: "English mod notes", max: 5000, area: true },
  ];
  return (
    <form onSubmit={submit} className="panel collection-editor">
      <Link className="back-link" href={`/maps/${initial.id}`}>
        {l("← 返回地图档案", "← Return to archive")}
      </Link>
      <p className="notice">
        {en
          ? "Only record what you know. Collection status is separate from gameplay testing. Titles, authors and player counts can remain unknown."
          : "只填写已知信息。收录不代表实测；名称、作者、人数不确定时可以留空。"}
      </p>
      <label>
        {l("原地图码（档案固定标识）", "Original map code (stable archive identity)")}
        <Input readOnly value={initial.map_code} />
      </label>
      <div className="collection-editor-fields">
        {lines.map(({ key, zh, en: labelEn, max, area }) => (
          <label key={key} className={area ? "wide" : ""}>
            {locale === "zh" ? zh : t(labelEn)}
            {area ? (
              <Textarea
                value={String(body[key] ?? "")}
                maxLength={max}
                rows={key.startsWith("description") ? 7 : 3}
                onChange={(e) => field(key, e.target.value as never)}
              />
            ) : (
              <Input
                value={String(body[key] ?? "")}
                maxLength={max}
                onChange={(e) => field(key, e.target.value as never)}
              />
            )}
          </label>
        ))}
        <label>
          {l("地图人数（原记录）", "Player count (source notes)")}
          <Input
            type="number"
            min={1}
            max={64}
            value={body.players ?? ""}
            onChange={(e) =>
              field("players", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </label>
        <label>
          {l("地图类型", "Map type")}
          <select
            value={body.category}
            onChange={(e) => field("category", e.target.value as CollectionBody["category"])}
          >
            {collectionCategories.map((k) => (
              <option key={k} value={k}>
                {label(collectionLabels[k])}
              </option>
            ))}
          </select>
        </label>
      </div>
      <h2>{l("实测与公开状态", "Testing and visibility")}</h2>
      <div className="collection-editor-fields">
        <label>
          {l("测试状态", "Test status")}
          <select
            value={body.test_status}
            onChange={(e) => field("test_status", e.target.value as CollectionBody["test_status"])}
          >
            {collectionTestStates.map((k) => (
              <option key={k} value={k}>
                {label(collectionLabels[k])}
              </option>
            ))}
          </select>
        </label>
        <label>
          {l("公开收藏", "Public collection")}
          <select
            value={body.visibility}
            onChange={(e) => field("visibility", e.target.value as "listed" | "hidden")}
          >
            <option value="listed">{l("已收录 · 公开", "Listed")}</option>
            <option value="hidden">{l("隐藏（可恢复）", "Hidden (reversible)")}</option>
          </select>
        </label>
        <label>
          {l("实测游戏版本", "Game version tested")}
          <Input
            maxLength={100}
            value={body.game_version}
            onChange={(e) => field("game_version", e.target.value)}
          />
        </label>
        <label>
          {l("测试日期", "Test date")}
          <Input
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={body.tested_at}
            onChange={(e) => field("tested_at", e.target.value)}
          />
        </label>
        <label className="wide">
          {l("中文实测记录", "Chinese test notes")}
          <Textarea
            rows={4}
            maxLength={4000}
            value={body.test_notes}
            onChange={(e) => field("test_notes", e.target.value)}
          />
        </label>
        <label className="wide">
          {l("英文实测记录", "English test notes")}
          <Textarea
            rows={4}
            maxLength={5000}
            value={body.test_notes_en}
            onChange={(e) => field("test_notes_en", e.target.value)}
          />
        </label>
      </div>
      <p className="caption">
        {en
          ? "A tested state requires a date, game version and test notes. Hiding an entry removes it from the public catalog; original reference screenshots are not private uploads."
          : "标记实测结果需填写日期、游戏版本与实测记录。隐藏会将档案移出公开目录；原始参考截图不属于私密上传文件。"}
      </p>
      {message && (
        <p role="status" className={`notice ${ok ? "" : "error"}`}>
          {message}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? l("保存中…", "Saving…") : l("保存地图档案", "Save archive")}
      </Button>
    </form>
  );
}
