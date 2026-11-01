"use client";
import { useEffect, useState } from "react";
import Link from "@/components/site-link";
import { useBilingual } from "@/components/i18n";
import { Copy, Gamepad2, Play, Hammer, X } from "lucide-react";

/**
 * Guide « Installer un mod ou une carte — 3 étapes » (finitions 01/11,
 * chantier 6). Procédure SOURCÉE, pas inventée :
 *  1. copier le code de partage — boutons Copier des fiches carte
 *     (collected-map-detail : « Copiez le code puis ouvrez-le via l'entrée de
 *     partage de cartes du jeu ») et des pages Mod (mod-detail : « Mod codes /
 *     In-game loading ») ;
 *  2. ouvrir dans le jeu l'entrée correspondante (partage de cartes pour une
 *     carte, chargement de mods pour un mod) — libellés volontairement
 *     identiques aux libellés existants du site, aucun nom de menu du jeu
 *     inventé ;
 *  3. coller le code et lancer une partie privée pour tester (les mods Lua de
 *     l'atelier : « dans le jeu, créer un nouveau mod de gameplay, coller,
 *     enregistrer, relancer une partie privée » — WORKBENCH-NOTES.md).
 * Repliable : la préférence « fermé » est persistée (localStorage, leçon 16),
 * réappliquée après hydratation (zéro écart SSR/client).
 */
export function InstallGuide({ page }: { page: "maps" | "mods" }) {
  const l = useBilingual();
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const stored = window.localStorage.getItem(`atlas.install-guide.${page}`);
    const apply = window.setTimeout(() => {
      setDismissed(stored === "closed");
      setReady(true);
    }, 0);
    return () => window.clearTimeout(apply);
  }, [page]);
  if (dismissed) return null;
  const close = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(`atlas.install-guide.${page}`, "closed");
    } catch {
      /* stockage indisponible : le guide reviendra, rien à persister */
    }
  };
  const steps = [
    {
      icon: <Copy size={18} />,
      zh: "从档案页复制分享码（地图或 Mod）。",
      en: "Copy the share code from the archive entry (map or mod).",
    },
    {
      icon: <Gamepad2 size={18} />,
      zh: "在游戏里打开对应入口：地图用地图分享，Mod 用 Mod 加载。",
      en: "In War Selection, open the matching entry: map sharing for maps, mod loading for mods.",
    },
    {
      icon: <Play size={18} />,
      zh: "粘贴代码并确认，开一局私房测试。",
      en: "Paste the code, confirm, and start a private match to try it.",
    },
  ];
  return (
    <aside
      className={`install-guide${ready ? "" : " install-guide-pending"}`}
      aria-label={l("安装指南", "Installation guide")}
    >
      <div className="install-guide-head">
        <p className="install-guide-title">
          {l("安装地图或 Mod — 三步", "Install a map or mod — 3 steps")}
        </p>
        <button
          type="button"
          className="install-guide-close"
          aria-label={l("收起指南", "Close the guide")}
          onClick={close}
        >
          <X size={15} />
        </button>
      </div>
      <ol className="install-guide-steps">
        {steps.map((s, i) => (
          <li key={i}>
            <span className="install-guide-icon" aria-hidden="true">
              {s.icon}
            </span>
            <span>{l(s.zh, s.en)}</span>
          </li>
        ))}
      </ol>
      <Link className="install-guide-cta" href="/workbench/simple">
        <Hammer size={15} />
        {l("自己做一张？简单工坊 — 三步导出", "Build your own? Simple workbench — 3-step export")}
      </Link>
    </aside>
  );
}
