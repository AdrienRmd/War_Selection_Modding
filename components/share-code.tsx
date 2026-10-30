"use client";
import { T } from "@/components/i18n";

import { useState } from "react";
import { Copy, Check, KeyRound } from "lucide-react";

// SB5 — code de partage en évidence sur la fiche publique, copie en un clic
// (même pattern que les Mod codes de /mods : presse-papiers + repli manuel).
export function ShareCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false),
    [failed, setFailed] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setFailed(false);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setFailed(true);
    }
  }
  return (
    <div className="share-code-box">
      <div className="share-code-head">
        <KeyRound size={16} />
        <span>
          <T text={"游戏内分享码"} />
        </span>
      </div>
      <code className="share-code-value" data-testid="share-code">
        <T text={code} />
      </code>
      <button className="button primary copy-code" type="button" onClick={copy}>
        {copied ? <Check size={16} /> : <Copy size={16} />}
        <T text={copied ? "已复制到剪贴板" : "复制分享码"} />
      </button>
      {failed && (
        <p role="alert" className="caption">
          <T text={"浏览器不允许复制，请手动选择代码。"} />
        </p>
      )}
    </div>
  );
}
