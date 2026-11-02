"use client";
import { useCallback, useEffect, useState } from "react";
import { Camera, Upload, CheckCircle2, Clock, Trash2 } from "lucide-react";
import { useBilingual } from "@/components/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Section « Captures en jeu » des fiches carte (finitions 01/11, chantier 7).
 * Captures soumises par les testeurs, modérées (pending → published). Le
 * serveur ne peut pas jouer au jeu : la valeur vient des testeurs réels —
 * aucune capture n'est fabriquée. Publiées : vignettes cliquables vers le
 * grand format. En attente (les siennes) : badge + retrait possible.
 * Formulaire d'ajout si connecté : fichier + légende courte.
 */
interface MapCaptureView {
  id: string;
  mapId: string;
  caption: string | null;
  status: string;
  createdAt: string;
  mine?: boolean;
}

export function MapCaptures({ mapId, signedIn }: { mapId: string; signedIn: boolean }) {
  const l = useBilingual();
  const [items, setItems] = useState<MapCaptureView[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [caption, setCaption] = useState("");

  const refresh = useCallback(async () => {
    try {
      // cache:"reload" — la liste est publique mise en cache 30 s ; le
      // rafraîchissement après envoi/retrait DOIT relire le serveur (sinon
      // l'auteur ne voit pas sa propre capture apparaître).
      const r = await fetch(`/api/map-captures/${mapId}`, { cache: "reload" });
      const d = (await r.json()) as { items?: MapCaptureView[]; error?: string };
      if (!r.ok) throw Error(d.error);
      setItems(d.items ?? []);
    } catch {
      setItems([]);
    }
  }, [mapId]);

  useEffect(() => {
    // Récupération initiale inline (pattern replay-moderation) : le setState
    // vit dans la promesse, jamais dans le corps synchrone de l'effet.
    let cancelled = false;
    fetch(`/api/map-captures/${mapId}`)
      .then((r): Promise<{ items?: MapCaptureView[]; error?: string }> => r.json())
      .then((d) => {
        if (!cancelled) setItems(d.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [mapId]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    // currentTarget est remis à null par React dès la première await : on
    // capture le formulaire AVANT tout travail asynchrone (reset + refresh).
    const form = e.currentTarget;
    e.preventDefault();
    if (busy) return;
    const data = new FormData(form);
    const file = data.get("capture");
    if (!(file instanceof File) || file.size === 0) {
      setError(l("请先选择一张截图。", "Pick a capture file first."));
      return;
    }
    setBusy(true);
    setError("");
    setDone(false);
    try {
      const r = await fetch(`/api/map-captures/${mapId}`, {
        method: "POST",
        body: data,
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw Error(d.error);
      setDone(true);
      setCaption("");
      form.reset();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败，请重试。");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(id: string) {
    try {
      const r = await fetch(`/api/map-captures/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "withdraw" }),
      });
      if (r.ok) await refresh();
    } catch {
      /* retrait best-effort : la liste se rafraîchit au prochain passage */
    }
  }

  const published = (items ?? []).filter((c) => c.status === "published");
  const pendingMine = (items ?? []).filter((c) => c.status === "pending" && c.mine);

  return (
    <section className="panel map-captures" aria-label={l("游戏内截图", "In-game captures")}>
      <div className="section-head">
        <h2>
          <Camera size={20} />
          {l("游戏内截图", "In-game captures")}
        </h2>
        <span className="collection-state">
          {l("由测试者提交，审核后公开", "Submitted by testers, shown after review")}
        </span>
      </div>
      <p className="caption">
        {l(
          "在真实对局中拍摄并上传截图，帮助其他玩家了解这张地图的实际体验。提交后先经审核再公开展示。",
          "Upload a shot from a real match to show what this map actually plays like. Captures are reviewed before going public.",
        )}
      </p>
      {items === null ? (
        <p className="caption">{l("正在读取截图…", "Loading captures…")}</p>
      ) : published.length === 0 && pendingMine.length === 0 ? (
        <p>
          {l(
            "这张地图还没有实测截图。如果你测试过它，欢迎上传第一张。",
            "No in-game capture yet. If you have tested this map, upload the first one.",
          )}
        </p>
      ) : (
        <div className="map-captures-grid">
          {published.map((c) => (
            <a key={c.id} href={`/api/map-captures/file/${c.id}`} target="_blank" rel="noreferrer">
              <img src={`/api/map-captures/file/${c.id}`} alt={c.caption || l("游戏内截图", "In-game capture")} loading="lazy" />
              {c.caption ? <span className="map-captures-caption">{c.caption}</span> : null}
            </a>
          ))}
          {pendingMine.map((c) => (
            <div key={c.id} className="map-captures-pending">
              <img src={`/api/map-captures/file/${c.id}`} alt={c.caption || l("待审核截图", "Pending capture")} />
              <span className="map-captures-status">
                <Clock size={13} /> {l("待审核", "Pending review")}
              </span>
              <Button size="sm" variant="ghost" onClick={() => withdraw(c.id)}>
                <Trash2 size={13} />
                {l("撤回", "Withdraw")}
              </Button>
            </div>
          ))}
        </div>
      )}
      {signedIn ? (
        <form className="map-captures-form" onSubmit={submit}>
          <label>
            <span className="sr-only">{l("选择截图", "Choose a capture")}</span>
            <Input type="file" name="capture" accept="image/png,image/jpeg,image/webp" />
          </label>
          <label>
            <span className="sr-only">{l("说明（可选）", "Caption (optional)")}</span>
            <Input
              name="caption"
              maxLength={200}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={l("一句话说明（可选）", "One-line caption (optional)")}
            />
          </label>
          <Button className="button" disabled={busy}>
            <Upload size={15} />
            {busy ? l("上传中…", "Uploading…") : l("上传截图", "Upload capture")}
          </Button>
          {done && (
            <p role="status" className="map-captures-done">
              <CheckCircle2 size={15} /> {l("已提交，审核通过后公开展示。", "Submitted — it will appear once approved.")}
            </p>
          )}
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
        </form>
      ) : (
        <p className="caption">
          {l("登录后即可上传实测截图。", "Sign in to upload your own in-game captures.")}
        </p>
      )}
    </section>
  );
}
