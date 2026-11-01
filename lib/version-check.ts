// Logique pure du détecteur de « nouvelle version disponible » (HOTFIX
// 31/10/2026, onglets Safari périmés). Extraite du composant client pour
// être testée unitairement (tests/update-banner.test.ts).
//
// Principe : /version.json (généré à chaque build par scripts/write-version.mjs)
// expose le buildId du build servi (uuid tiré par `vinext build`, cf.
// dist/server/BUILD_ID). Le client relève ce buildId au chargement, puis le
// re-relève au retour de visibilité / restauration bfcache / toutes les
// 15 min. Un buildId différent = un nouveau déploiement est servi → bandeau
// discret proposant le rechargement (JAMAIS de rechargement forcé).

/** Endpoint statique servi par le worker (cache désactivé côté client). */
export const VERSION_ENDPOINT = "/version.json";

/** Rythme du contrôle périodique : 15 minutes. */
export const CHECK_INTERVAL_MS = 15 * 60 * 1000;

export interface VersionPayload {
  buildId?: unknown;
  commit?: unknown;
  builtAt?: unknown;
}

/** Extrait un buildId exploitable d'une réponse /version.json (défensif). */
export function readBuildId(payload: VersionPayload | null | undefined): string | null {
  const id = payload?.buildId;
  return typeof id === "string" && id.trim() !== "" ? id : null;
}

/**
 * Un relevé frais diffère-t-il du relevé de référence ?
 * La référence (baseline) est null tant qu'aucun premier relevé n'a abouti :
 * pas de référence → pas de comparaison possible → pas de bandeau (on évite
 * ainsi les faux positifs au tout premier chargement ou hors-ligne).
 */
export function isNewerBuild(baseline: string | null, fresh: string | null): boolean {
  return baseline !== null && fresh !== null && fresh !== baseline;
}

/** On ne interroge /version.json que lorsque l'onglet est visible. */
export function shouldCheckNow(visibilityState: string | null | undefined): boolean {
  return visibilityState === "visible";
}
