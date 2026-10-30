"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { T } from "@/components/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

// SB4 — suppression de compte self-service. Confirmation en 2 temps AVEC
// saisie : le dialogue exige le pseudo exact du compte (dernier garde-fou
// contre un clic accidentel), le serveur revérifie session + saisie — ce
// composant ne transmet JAMAIS d'identifiant, seulement la chaîne saisie.
// Le pseudo attendu est rendu tel quel (contenu du compte, jamais traduit).
export function DeleteAccountForm({ displayName }: { displayName: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const matched = confirm.trim().length > 0 && confirm.trim() === displayName.trim();
  async function remove() {
    if (busy || !matched) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: confirm.trim() }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error);
      // Session morte côté serveur + cookie effacé : retour accueil en
      // rechargement complet pour purger tout état client.
      window.location.assign("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除未完成，请稍后重试。");
      setBusy(false);
    }
  }
  return (
    <section className="panel deletion-zone">
      <h3>
        <T text="删除账号" />
      </h3>
      <p className="meta muted">
        <T text="此操作不可撤销。删除账号后：" />
      </p>
      <ul className="account-delete-effects">
        <li>
          <T text="永久删除所有待审核与未发布的地图、Mod 及其文件（含 ZIP、封面）。" />
        </li>
        <li>
          <T text="已发布的作品继续公开展示，作者名保持不变，但不再带“已验证创作者”标记。" />
        </li>
        <li>
          <T text="清除全部登录会话，所有设备立即退出登录。" />
        </li>
        <li>
          <T text="删除头像与账号记录（邮箱不再保留）。" />
        </li>
      </ul>
      {error && (
        <p role="alert" className="notice error">
          <T text={error} />
        </p>
      )}
      <div className="review-buttons">
        <AlertDialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setConfirm("");
          }}
        >
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={busy}>
              <Trash2 size={16} /> <T text="删除账号" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>
              <T text="永久删除账号？" />
            </AlertDialogTitle>
            <AlertDialogDescription>
              <T text="此操作不可撤销。删除账号后：" />
              <br />
              <T text="永久删除所有待审核与未发布的地图、Mod 及其文件（含 ZIP、封面）。" />
              <br />
              <T text="已发布的作品继续公开展示，作者名保持不变，但不再带“已验证创作者”标记。" />
            </AlertDialogDescription>
            <label className="confirm-field">
              <T text={`输入昵称「${displayName}」以确认：`} />
              <Input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="当前昵称"
                aria-invalid={!matched && confirm.trim().length > 0}
              />
            </label>
            <AlertDialogFooter>
              <AlertDialogCancel>
                <T text="取消" />
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={remove}
                disabled={busy || !matched}
              >
                <T text="确认永久删除账号" />
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}
