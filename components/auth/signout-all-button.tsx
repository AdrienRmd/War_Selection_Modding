"use client";
import { useState } from "react";
import { T } from "@/components/i18n";

export function SignOutAllButton({
  role,
  className = "account-link",
}: {
  /** role="menuitem" quand le bouton vit dans un menu déroulant du header. */
  role?: "menuitem";
  /** Classe de style : account-link seul, ou nav-menu-item dans le menu. */
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  async function signOutAll() {
    if (busy) return;
    setBusy(true);
    await fetch("/api/auth/signout-all", { method: "POST" }).catch(() => undefined);
    window.location.assign("/");
  }
  return (
    <button className={className} type="button" role={role} onClick={signOutAll} disabled={busy}>
      <T text={"退出所有设备"} />
    </button>
  );
}
