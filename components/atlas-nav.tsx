"use client";
import { usePathname } from "next/navigation";
import { T, useI18n } from "@/components/i18n";
import { HeaderMenu } from "@/components/header-menu";
import Link from "@/components/site-link";

/** Groupe « Archives » : données de jeu publiées (cartes, unités, recherches, replay, modding). */
const ARCHIVES_ITEMS = [
  { href: "/maps", name: "地图档案" },
  { href: "/units", name: "单位档案" },
  { href: "/researches", name: "科技档案" },
  { href: "/replay", name: "回放分析" },
  { href: "/modding", name: "参数档案" },
];

/** Groupe « Mods » : bibliothèque communautaire et atelier de création. */
const MODS_ITEMS = [
  { href: "/mods", name: "Mod 资料库" },
  { href: "/workbench", name: "Mod 工作台" },
];

export function AtlasNav() {
  const { t } = useI18n();
  const path = usePathname() || "/";
  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);
  return (
    <nav aria-label={t("主导航")}>
      <HeaderMenu
        ariaLabel="档案"
        trigger={<span className="nav-menu-label">{t("档案")}</span>}
        active={ARCHIVES_ITEMS.some((i) => isActive(i.href))}
      >
        {ARCHIVES_ITEMS.map((i) => (
          <Link
            key={i.href}
            role="menuitem"
            className="nav-menu-item"
            href={i.href}
            aria-current={isActive(i.href) ? "page" : undefined}
          >
            <T text={i.name} />
          </Link>
        ))}
      </HeaderMenu>
      {/* Replay phase 2 : entrée directe « Classement » — visible sans ouvrir
          le menu Archives, entre Archives et Mods. */}
      <Link
        href="/players"
        aria-current={isActive("/players") || isActive("/season-statistics") ? "page" : undefined}
      >
        {t("玩家排行榜")}
      </Link>
      <HeaderMenu
        ariaLabel="Mod"
        trigger={<span className="nav-menu-label">{t("Mod")}</span>}
        active={MODS_ITEMS.some((i) => isActive(i.href))}
      >
        {MODS_ITEMS.map((i) => (
          <Link
            key={i.href}
            role="menuitem"
            className="nav-menu-item"
            href={i.href}
            aria-current={isActive(i.href) ? "page" : undefined}
          >
            <T text={i.name} />
          </Link>
        ))}
      </HeaderMenu>
    </nav>
  );
}
