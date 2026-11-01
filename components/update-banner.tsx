"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { T } from "@/components/i18n";
import {
  CHECK_INTERVAL_MS,
  VERSION_ENDPOINT,
  isNewerBuild,
  readBuildId,
  shouldCheckNow,
} from "@/lib/version-check";

// HOTFIX 31/10/2026 (onglets Safari périmés) : quand un onglet ouvert sur la
// version N-1 retrouve ses chunks (préservation deploy/vps/
// preserve-static-assets.sh), il s'hydrate puis détecte ici qu'un build plus
// récent est servi et propose — sans jamais forcer — un rechargement.
// Comportement :
//   - relevé de référence au montage, puis contrôle au retour de visibilité
//     (visibilitychange), à la restauration bfcache (pageshow persisté) et
//     toutes les 15 minutes ;
//   - comparaison du buildId servi (/version.json, cache désactivé) ;
//   - bandeau discret en bas, i18n FR/EN/ZH, cible tactile ≥ 44 px,
//     animation neutralisée sous prefers-reduced-motion ;
//   - silencieux en cas d'échec réseau (retry au prochain déclencheur).
export function UpdateBanner() {
  const [visible, setVisible] = useState(false);
  const baseline = useRef<string | null>(null);
  const inFlight = useRef(false);

  const check = useCallback(async () => {
    if (inFlight.current || !shouldCheckNow(document.visibilityState)) return;
    inFlight.current = true;
    try {
      const res = await fetch(VERSION_ENDPOINT, { cache: "no-store" });
      if (!res.ok) return;
      const fresh = readBuildId((await res.json()) as Record<string, unknown>);
      if (fresh === null) return;
      if (baseline.current === null) {
        baseline.current = fresh; // premier relevé = référence de l'onglet
        return;
      }
      if (isNewerBuild(baseline.current, fresh)) setVisible(true);
    } catch {
      // Hors-ligne / worker en redémarrage : rien à signaler, on réessaiera
      // au prochain déclencheur.
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    // Premier relevé différé en macrotâche : la comparaison aboutit à un
    // setState dans un callback externe (timer), pas synchronement dans
    // l'effet (règle react-hooks/set-state-in-effect) — comportement identique
    // à un appel direct : le relevé de référence est posé dès le montage.
    const firstCheck = setTimeout(() => void check(), 0);
    const onVisibility = () => void check();
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void check(); // retour depuis le bfcache (iOS)
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    const timer = setInterval(() => void check(), CHECK_INTERVAL_MS);
    return () => {
      clearTimeout(firstCheck);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      clearInterval(timer);
    };
  }, [check]);

  if (!visible) return null;
  return (
    <div className="update-banner" role="status" aria-live="polite">
      <T text="有新版本可用。" />
      <button type="button" className="update-banner-reload" onClick={() => location.reload()}>
        <RefreshCw size={15} aria-hidden="true" />
        <T text="重新加载" />
      </button>
    </div>
  );
}
