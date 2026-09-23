"use client";
import { useState, type ReactNode, type KeyboardEvent } from "react";
import { useI18n } from "@/components/i18n";
import Link from "@/components/site-link";
export function CreationTabs({ maps, mods }: { maps: ReactNode; mods: ReactNode }) {
  const { t } = useI18n();
  const [active, setActive] = useState<"maps" | "mods">("mods");
  function keys(e: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const next =
      e.key === "Home" ? "maps" : e.key === "End" ? "mods" : active === "maps" ? "mods" : "maps";
    setActive(next);
    document.getElementById("creation-tab-" + next)?.focus();
  }
  return (
    <div className="submission-tabs">
      <div role="tablist" aria-label={t("作品类型")}>
        {(["maps", "mods"] as const).map((key) => (
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
            {key === "maps" ? t("地图") : t("Mod 作品")}
          </button>
        ))}
      </div>
      {(["maps", "mods"] as const).map((key) => (
        <div
          role="tabpanel"
          key={key}
          id={"creation-panel-" + key}
          aria-labelledby={"creation-tab-" + key}
          hidden={active !== key}
          tabIndex={0}
        >
          {active === key ? (key === "maps" ? maps : mods) : null}
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
