"use client";
import { useState, type ReactNode, type KeyboardEvent } from "react";
import { useI18n } from "@/components/i18n";
import Link from "@/components/site-link";
export type CreationTabKey = "maps" | "mods" | "replays";
/** Onglets de gestion des créations ; `replays` est optionnel (page /replay
 *  uniquement — Chantier B) : l'onglet n'apparaît que si le nœud est fourni. */
export function CreationTabs({
  maps,
  mods,
  replays,
}: {
  maps: ReactNode;
  mods: ReactNode;
  replays?: ReactNode;
}) {
  const { t } = useI18n();
  const tabs = (replays ? ["maps", "mods", "replays"] : ["maps", "mods"]) as CreationTabKey[];
  const [active, setActive] = useState<CreationTabKey>("mods");
  function keys(e: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const pos = tabs.indexOf(active);
    const next =
      e.key === "Home" ? tabs[0] : e.key === "End" ? tabs[tabs.length - 1] : e.key === "ArrowRight" ? tabs[Math.min(tabs.length - 1, pos + 1)] : tabs[Math.max(0, pos - 1)];
    setActive(next);
    document.getElementById("creation-tab-" + next)?.focus();
  }
  return (
    <div className="submission-tabs">
      <div role="tablist" aria-label={t("作品类型")}>
        {tabs.map((key) => (
          <button
            type="button"
            role="tab"
            key={key}
            id={"creation-tab-" + key}
            aria-controls={"creation-panel-" + key}
            aria-selected={active === key}
            tabIndex={active === key ? 0 : -1}
            data-state={active === key ? "active" : "inactive"}
            onClick={() => setActive(key)}
            onKeyDown={keys}
          >
            {key === "maps" ? t("地图") : key === "mods" ? t("Mod 作品") : t("回放投稿")}
          </button>
        ))}
      </div>
      {tabs.map((key) => (
        <div
          role="tabpanel"
          key={key}
          id={"creation-panel-" + key}
          aria-labelledby={"creation-tab-" + key}
          hidden={active !== key}
          tabIndex={0}
        >
          {active === key
            ? key === "maps"
              ? maps
              : key === "mods"
                ? mods
                : (replays ?? null)
            : null}
        </div>
      ))}
    </div>
  );
}
export function CreationSwitch({ active }: { active: "maps" | "mods" }) {
  const { t } = useI18n();
  return (
    <nav className="creation-switch" aria-label={t("作品类型")}>
      <Link href="/submit" aria-current={active === "maps" ? "page" : undefined}>
        {t("提交地图")}
      </Link>
      <Link href="/submit/mod" aria-current={active === "mods" ? "page" : undefined}>
        {t("提交 Mod")}
      </Link>
    </nav>
  );
}
