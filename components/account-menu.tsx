"use client";
import { usePathname } from "next/navigation";
import { T } from "@/components/i18n";
import { HeaderMenu } from "@/components/header-menu";
import Link from "@/components/site-link";
import { SignOutAllButton } from "@/components/auth/signout-all-button";
import { initialsOf } from "@/lib/profile";

/** Menu « Compte » du header : avatar + nom du compte, entrées de gestion
 *  de compte et de déconnexion. L'entrée d'administration n'apparaît que
 *  pour les administrateurs (décorrélation du rendu serveur). */
export function AccountMenu({
  displayName,
  avatarKey,
  admin,
  signOutHref,
}: {
  displayName: string;
  avatarKey: string | null;
  admin: boolean;
  /** URL de déconnexion (chatGPTSignOutPath), calculée côté serveur. */
  signOutHref: string;
}) {
  const path = usePathname() || "/";
  const isActive = (href: string) => path.startsWith(href);
  return (
    <HeaderMenu
      ariaLabel="账户菜单"
      align="end"
      active={isActive("/account") || isActive("/submissions") || (admin && isActive("/admin"))}
      trigger={
        <>
          {avatarKey ? (
            <img className="header-avatar" src="/api/account/avatar" alt="" width={28} height={28} />
          ) : (
            <span className="header-avatar header-initials" aria-hidden="true">
              {initialsOf(displayName)}
            </span>
          )}
          <span className="account-name">{displayName}</span>
        </>
      }
    >
      <Link
        role="menuitem"
        className="nav-menu-item"
        href="/account"
        aria-current={isActive("/account") ? "page" : undefined}
      >
        <T text="我的账号" />
      </Link>
      <Link
        role="menuitem"
        className="nav-menu-item"
        href="/submissions"
        aria-current={isActive("/submissions") ? "page" : undefined}
      >
        <T text="我的创作" />
      </Link>
      {admin ? (
        <Link
          role="menuitem"
          className="nav-menu-item"
          href="/admin"
          aria-current={isActive("/admin") ? "page" : undefined}
        >
          <T text="管理" />
        </Link>
      ) : null}
      <a role="menuitem" className="nav-menu-item" href={signOutHref} target="_top">
        <T text="退出登录" />
      </a>
      <SignOutAllButton role="menuitem" className="nav-menu-item" />
    </HeaderMenu>
  );
}
