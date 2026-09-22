"use client";
import { useState } from "react";
import { T } from "@/components/i18n";

export function SignOutAllButton() {
  const [busy, setBusy] = useState(false);
  async function signOutAll() {
    if (busy) return;
    setBusy(true);
    await fetch("/api/auth/signout-all", { method: "POST" }).catch(() => undefined);
    window.location.assign("/");
  }
  return (
    <button className="account-link" type="button" onClick={signOutAll} disabled={busy}>
      <T text={"退出所有设备"} />
    </button>
  );
}
