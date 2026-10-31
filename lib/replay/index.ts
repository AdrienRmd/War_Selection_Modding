/** API publique du système Replay WS ATLAS — saisie d'un code, appel à
 *  l'API officielle War Selection (games-api.warselect.io, uniquement),
 *  parsing via le port de wsunitstats, cache local par code.
 *
 *  Aucune donnée n'est envoyée ailleurs que vers games-api.warselect.io. */
import { ReplayInfoParser, type ReplayApiResponse } from "./parser";
import { loadGameContext, type ReplayGameContext } from "./context";
import type { ReplayParseResult } from "./structure";

export const REPLAY_API_BASE = "https://games-api.warselect.io/getByReplay?code=";

/** Normalise un code saisi : préfixe optionnel « rep- » puis exactement 11
 *  caractères alphanumériques [A-Za-z0-9] (charset aligné sur l’API officielle —
 *  les codes réels sont alphanumériques, sensibles à la casse). Renvoie null
 *  si invalide. */
export function parseReplayCode(input: string | undefined | null): string | null {
  if (!input) return null;
  const match = /^(?:rep-)?([A-Za-z0-9]{11})$/.exec(input.trim());
  return match ? match[1] : null;
}

let legacyUnitIdsPromise: Promise<Record<string, string>> | undefined;

/** Charge (une fois) le mapping ids numériques legacy → ids de chemin
 *  (public/legacy-ids.json) pour les replays antérieurs au passage aux
 *  ids de chemin (absence d'extraData['7']). */
export function loadLegacyUnitIds(fetchImpl: typeof fetch = fetch): Promise<Record<string, string>> {
  legacyUnitIdsPromise ??= fetchImpl("/legacy-ids.json")
    .then((response) =>
      response.ok
        ? (response.json() as Promise<{ units: Record<string, string> }>)
        : Promise.reject(new Error("Cannot load legacy unit ids")),
    )
    .then((legacyIds) => legacyIds.units)
    .catch((error: unknown) => {
      // Permet une nouvelle tentative au replay suivant.
      legacyUnitIdsPromise = undefined;
      throw error;
    });
  return legacyUnitIdsPromise;
}

let gameContextPromise: Promise<ReplayGameContext> | undefined;

/** Contexte de jeu (unités + recherches), chargé une fois par session. */
export function getGameContext(fetchImpl: typeof fetch = fetch): Promise<ReplayGameContext> {
  gameContextPromise ??= loadGameContext(fetchImpl);
  return gameContextPromise;
}

/** Appelle l'API officielle et parse le replay. Le fetch est injectable
 *  pour les tests ; en production il reste strictement côté navigateur. */
export async function fetchAndParseReplay(
  replayCode: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ReplayParseResult> {
  let response: Response;
  try {
    response = await fetchImpl(`${REPLAY_API_BASE}${replayCode}`);
  } catch {
    return { error: 255, message: "network" };
  }
  if (!response.ok) {
    return { error: 255, message: `http-${response.status}` };
  }
  let json: ReplayApiResponse;
  try {
    json = (await response.json()) as ReplayApiResponse;
  } catch {
    return { error: 255, message: "not-json" };
  }
  const isLegacy = json.error === 0 && json.data?.extraData?.["7"] == null;
  const [context, legacyUnitIds] = await Promise.all([
    getGameContext(fetchImpl),
    isLegacy ? loadLegacyUnitIds(fetchImpl) : Promise.resolve(undefined),
  ]);
  return new ReplayInfoParser(context, replayCode, legacyUnitIds).parse(json);
}

/** Cache mémoire des replays parsés, par code (rafraîchi à la session). */
const replayCache = new Map<string, ReplayParseResult>();
const replayCacheLimit = 20;

export async function getCachedReplay(
  replayCode: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ReplayParseResult> {
  const cached = replayCache.get(replayCode);
  if (cached) return cached;
  const result = await fetchAndParseReplay(replayCode, fetchImpl);
  if (replayCache.size >= replayCacheLimit) {
    replayCache.delete(replayCache.keys().next().value as string);
  }
  replayCache.set(replayCode, result);
  return result;
}

export type { ReplayParseResult, ReplayGameContext };
export { ReplayInfoParser } from "./parser";
export { buildGameContext, loadGameContext } from "./context";
export { calcKillDeath, type KillDeath } from "./kill-death";
export { matchTypeFromId, symmetryTypeFromId } from "./structure";
