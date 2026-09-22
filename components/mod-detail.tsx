"use client";
import { useState } from "react";
import { ArrowLeft, Layers3, Copy, ArrowUpRight, Download } from "lucide-react";
import Link from "@/components/site-link";
import { Bilingual, useI18n } from "@/components/i18n";
import { UsageBadge } from "@/components/mod-library";
import { kindLabels, type ModEntry } from "@/lib/mod-types";
type SourceRef = {
  author: string;
  url: string;
  codes: { label: string; code: string }[];
  verifiedAt: string;
  testedInGame: boolean;
};
export function ModDetail({ entry: m, reference }: { entry: ModEntry; reference?: SourceRef }) {
  const { locale } = useI18n(),
    l = (z: string, e: string) => (locale !== "zh" ? e : z);
  const [copied, setCopied] = useState(""),
    [copyError, setCopyError] = useState(false);
  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }
  const sections = [
    [l("这个 Mod 做什么？", "What does this mod do?"), m.description, m.description_en],
    [
      l("安装、依赖与加载顺序", "Installation, dependencies & load order"),
      m.instructions,
      m.instructions_en,
    ],
    [l("兼容性与测试边界", "Compatibility & testing limits"), m.compatibility, m.compatibility_en],
  ];
  return (
    <>
      <Link className="back-link" href="/mods">
        <ArrowLeft size={16} />
        {l("Mod 资料库", "Mod library")}
      </Link>
      <div className="mod-title-row">
        <div className="mod-emblem">
          <Layers3 size={34} />
        </div>
        <div>
          <p className="eyebrow">
            {kindLabels[m.kind]?.[locale !== "zh" ? 1 : 0]} / {m.origin.toUpperCase()}
          </p>
          <h1>
            <Bilingual zh={m.title} en={m.title_en} />
          </h1>
          <UsageBadge value={m.usage_status} />
          <p className="mod-source">
            {l("作者 / 署名", "Author / attribution")}: {m.author}
          </p>
        </div>
      </div>
      {m.status !== "approved" && (
        <div className="notice">
          {l(
            "这是未公开稿件，仅作者和管理员可查看。",
            "This submission is private to its author and administrators.",
          )}{" "}
          · {m.status}
        </div>
      )}
      <div className="mod-detail-grid">
        <article className="panel">
          <p>
            <Bilingual zh={m.summary} en={m.summary_en} />
          </p>
          {sections
            .filter(([, z, e]) => z || e)
            .map(([title, z, e]) => (
              <section key={title} className="mod-detail-copy">
                <h2>{title}</h2>
                <p>
                  <Bilingual zh={z} en={e} />
                </p>
              </section>
            ))}
          {reference && (
            <div className="notice">
              <div>
                <strong>
                  {l("外部资料核对", "External source check")} · {reference.verifiedAt}
                </strong>
                <p>
                  {l(
                    "已核对原始来源快照；后续编辑的值不自动视为重新核对。未进行当前游戏实测，也不会修改 GitHub 源码。",
                    "The original source snapshot was checked; edited entry values are not automatically re-verified. This is not a current-game test and does not change the GitHub source.",
                  )}
                </p>
                <a href={reference.url} target="_blank" rel="noreferrer" className="text-link">
                  {l("原始来源", "Original source")} ↗
                </a>
                {reference.codes.length > 0 && (
                  <details className="source-snapshot">
                    <summary>
                      {l("查看核对时的原始发布码", "View codes in the verified source snapshot")}
                    </summary>
                    {reference.codes.map((c) => (
                      <p key={c.code}>
                        {c.label}: <code>{c.code}</code>
                      </p>
                    ))}
                  </details>
                )}
              </div>
            </div>
          )}
          {m.feedback && (
            <div className="review-feedback">
              <strong>{l("审核意见", "Review feedback")}</strong>
              <p>{m.feedback}</p>
            </div>
          )}
        </article>
        <aside className="detail-aside">
          <section className="panel">
            <p className="eyebrow">LOADOUT / ACCESS</p>
            <h2>{l("Mod 码", "Mod codes")}</h2>
            {m.mod_code ? (
              <div className="mod-code-list">
                {m.mod_code
                  .split(/\r?\n/)
                  .filter(Boolean)
                  .map((line, i) => {
                    const code = line.match(/mod-[A-Za-z0-9]+/)?.[0] || "";
                    return (
                      <div className="mod-code-line" key={i}>
                        <small>
                          {line.replace(code, "").replace(/[:：]\s*$/, "") ||
                            l("游戏内加载", "In-game loading")}
                        </small>
                        <code>{code}</code>
                        <button
                          className="button"
                          onClick={() => copy(code)}
                          aria-label={l("复制 ", "Copy ") + code}
                        >
                          <Copy size={14} />
                          {copied === code ? l("已复制", "Copied") : l("复制", "Copy")}
                        </button>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p>
                {l(
                  "暂未提供发布码。请查看源代码或安装说明；不要猜测代码。",
                  "No published code supplied. See the source or installation instructions.",
                )}
              </p>
            )}
            {copyError && (
              <p role="alert">
                {l(
                  "浏览器不允许复制，请手动选择代码。",
                  "Clipboard unavailable; select and copy the code manually.",
                )}
              </p>
            )}
            <p className="bilingual-note">
              {l(
                "组合 Mod 的多个代码请按安装说明配套加载。",
                "For collections, follow the installation instructions for which codes to load together.",
              )}
            </p>
            {m.has_file && (
              <a href={"/api/mods/files/" + m.id} className="button primary mt-5">
                <Download size={17} />
                {l("下载 Mod 文件", "Download mod file")}
              </a>
            )}
            {m.has_file && (
              <p className="checksum">
                {m.file_name} · {(m.file_size / 1024).toFixed(1)} KB
                <br />
                SHA-256: {m.sha256}
              </p>
            )}
            {m.source_url && (
              <a href={m.source_url} target="_blank" rel="noreferrer" className="text-link mt-5">
                {l("查看作者来源", "Visit author source")}
                <ArrowUpRight size={16} />
              </a>
            )}
            {m.license && (
              <p className="bilingual-note">
                {l("许可", "License")}: {m.license}
              </p>
            )}
            {m.game_version && (
              <p className="bilingual-note">
                {l("版本说明", "Version note")}: {m.game_version}
              </p>
            )}
            {m.editable && (
              <Link className="button primary mt-5" href={"/mods/" + m.id + "/edit"}>
                {l("编辑资料与 Mod 码", "Edit details & Mod codes")}
              </Link>
            )}
          </section>
          {m.map_slug && (
            <section className="panel">
              <h2>{l("关联地图", "Related map")}</h2>
              <Link className="text-link" href={"/maps/" + m.map_slug}>
                {l("斯大林格勒", "Stalingrad")} ↗
              </Link>
            </section>
          )}
          <section className="panel">
            <h2>{l("制作自己的数值补丁", "Build your own balance patch")}</h2>
            <p>
              {l(
                "使用原版数据快照修改单位，导出独立 Lua 补丁。",
                "Adjust units using a base-game data snapshot and export a standalone Lua patch.",
              )}
            </p>
            <Link href="/workbench" className="text-link mt-4">
              {l("进入 Mod 工作台", "Open Mod workbench")} ↗
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}
