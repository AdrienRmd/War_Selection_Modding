"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { T } from "@/components/i18n";
import { Button } from "@/components/ui/button";
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

// SB4 — suppression définitive d'une de SES créations (carte ou mod).
// Confirmation explicite en 2 temps : le dialogue NOMME l'élément (titre) et
// décrit la purge irréversible — jamais de suppression par simple clic. Ce
// composant n'est qu'une affordance : la propriété est revérifiée côté
// serveur à chaque requête (401 anonyme / 403 tiers), quelle que soit la page
// d'où vient le clic. La révision affichée accompagne la requête : une
// création modifiée entre-temps répond 409 au lieu d'être supprimée à l'aveugle.
export function DeleteCreation({
  kind,
  id,
  title,
  revision,
  onDone,
}: {
  kind: "map" | "mod";
  id: string;
  title: string;
  revision: number;
  onDone: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/${kind === "map" ? "atlas" : "mods"}/submissions/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error);
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作未完成，请重试。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" disabled={busy}>
            <Trash2 size={16} /> <T text="永久删除" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>
            {/* V3-P2 #6 : clé template unique (fragments séparés
                « 永久删除「 + titre + 」？ » non composables en en/fr). */}
            <T text={`永久删除「${title}」？`} />
          </AlertDialogTitle>
          <AlertDialogDescription>
            <T
              text={
                kind === "map"
                  ? "该操作不可撤销：地图档案、ZIP 包、封面与审核记录将被彻底删除，发布页面立即消失。"
                  : "该操作不可撤销：Mod 资料、上传文件与审核记录将被彻底删除，公开页面立即消失。"
              }
            />
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <T text="取消" />
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove} disabled={busy}>
              <T text="确认删除" />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && (
        <p role="alert" className="notice error">
          <T text={error} />
        </p>
      )}
    </>
  );
}
