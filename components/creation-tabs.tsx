"use client";
import { useState, type ReactNode, type KeyboardEvent } from "react";
import { useI18n } from "@/components/i18n";
import Link from "@/components/site-link";
export function CreationTabs({ maps, mods }: { maps: ReactNode; mods: ReactNode }) {
  const { locale } = useI18n();
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
      <div role="tablist" aria-label={locale !== "zh" ? "Creation type" : "作品类型"}>
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
            {key === "maps"
              ? locale !== "zh"
                ? "Maps"
                : "地图"
              : locale !== "zh"
                ? "Mods"
                : "Mod 作品"}
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
  const { locale } = useI18n();
  return (
    <nav className="creation-switch" aria-label={locale !== "zh" ? "Creation type" : "作品类型"}>
      <Link href="/submit" aria-current={active === "maps" ? "page" : undefined}>
        {locale !== "zh" ? "Submit a map" : "提交地图"}
      </Link>
      <Link href="/submit/mod" aria-current={active === "mods" ? "page" : undefined}>
        {locale !== "zh" ? "Submit a mod" : "提交 Mod"}
      </Link>
    </nav>
  );
}
