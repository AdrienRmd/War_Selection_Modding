import { bindings } from "@/lib/atlas-server";
import { checkAndRecordFailure, RATE_LIMITS_ENABLED } from "@/lib/auth-server";
import { profileAttemptKey } from "@/lib/profile";

// SB4 — helpers partagés des suppressions définitives (D4 ADOPTÉE : purge de
// la ligne D1 + purge R2 des objets liés). Deux règles non négociables :
//  1. la propriété est TOUJOURS vérifiée côté serveur depuis la session —
//     aucun identifiant venu du client ne décide de ce qui est supprimé ;
//  2. un objet R2 n'est purgé qu'après que la ligne ne le référence plus ET
//     qu'aucune autre ligne ne le référence (pattern des remplacements de
//     fichiers : app/api/mods, app/api/editor). En cas d'incertitude on
//     garde l'objet — un orphelin restant est invisible, une référence
//     supprimée casse la ligne.

/** Clés R2 d'une ligne de carte : ZIP + couverture, si présents. */
export function mapObjectKeys(m: { file_key: string; cover_key: string | null }): string[] {
  return [m.file_key, m.cover_key].filter((key): key is string => !!key);
}

/** Clé R2 d'une ligne de mod communautaire : fichier téléchargeable, si présent. */
export function modObjectKeys(m: { file_key: string | null }): string[] {
  return m.file_key ? [m.file_key] : [];
}

// D1 limite chaque requête à 100 paramètres liés ; les requêtes de contrôle
// ci-dessous en consomment 2 par clé → morceaux de 48 clés maximum.
const REFERENCE_CHUNK = 48;

async function referencedKeys(chunk: string[]): Promise<Set<string>> {
  const { DB } = bindings();
  const marks = chunk.map(() => "?").join(",");
  // Les espaces de noms R2 sont cloisonnés par table (submissions|edits/… =
  // maps, mods/… = community_mods, avatars/… = users) : vérifier ces deux
  // tables suffit à garantir qu'aucune ligne ne référence plus la clé.
  const mapsRefs = await DB.prepare(
    `SELECT file_key AS k FROM maps WHERE file_key IN (${marks}) UNION SELECT cover_key AS k FROM maps WHERE cover_key IN (${marks})`,
  )
    .bind(...chunk, ...chunk)
    .all<{ k: string | null }>();
  const modsRefs = await DB.prepare(
    `SELECT file_key AS k FROM community_mods WHERE file_key IN (${marks})`,
  )
    .bind(...chunk)
    .all<{ k: string | null }>();
  return new Set(
    [...mapsRefs.results, ...modsRefs.results]
      .map((row) => row.k)
      .filter((key): key is string => !!key),
  );
}

/**
 * Supprime les objets R2 donnés uniquement si plus AUCUNE ligne ne les
 * référence (contrôle post-commit, par morceaux bornés). Best effort : la
 * purge des objets ne transforme jamais un commit D1 réussi en erreur — un
 * échec est journalisé et l'objet orphelin restera invisible.
 * Retourne la liste des clés réellement purgées.
 */
export async function purgeObjects(keys: string[]): Promise<string[]> {
  const unique = [...new Set(keys.filter(Boolean))];
  if (!unique.length) return [];
  const { BUCKET } = bindings();
  const orphaned: string[] = [];
  try {
    for (let i = 0; i < unique.length; i += REFERENCE_CHUNK) {
      const chunk = unique.slice(i, i + REFERENCE_CHUNK);
      const referenced = await referencedKeys(chunk);
      orphaned.push(...chunk.filter((key) => !referenced.has(key)));
    }
    if (orphaned.length) await BUCKET.delete(orphaned);
  } catch (e) {
    console.error("Object purge failed", e instanceof Error ? e.message : "unknown");
    return [];
  }
  return orphaned;
}

// ---------------------------------------------------------------------------
// Throttling des endpoints destructeurs (même table auth_attempts que l'auth
// et le PATCH profil). Les budgets bornent tentatives réussies ET refusées ;
// désactivés en dev comme le reste (RATE_LIMITS_ENABLED).

export const CREATION_DELETE_BUDGET = { limit: 20, windowMs: 60 * 60 * 1000 };
export const ACCOUNT_DELETE_BUDGET = { limit: 5, windowMs: 60 * 60 * 1000 };

export function creationDeleteAttemptKey(userId: string): string {
  return `delete:${userId.slice(0, 64)}`;
}

export function accountDeleteAttemptKey(userId: string): string {
  return `account-delete:${userId.slice(0, 64)}`;
}

/** Retourne 0 si autorisé, sinon le Retry-After en secondes. */
export async function deletionRetryAfterSec(
  key: string,
  budget: { limit: number; windowMs: number },
): Promise<number> {
  if (!RATE_LIMITS_ENABLED) return 0;
  const verdict = await checkAndRecordFailure(key, budget.limit, budget.windowMs);
  return verdict.allowed ? 0 : Math.max(1, verdict.retryAfterSec);
}

/** Réponse 429 standard des endpoints destructeurs. */
export function deletionRateLimited(retryAfterSec: number, message: string): Response {
  return Response.json(
    { error: message },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Retry-After": String(retryAfterSec),
      },
    },
  );
}

/**
 * Clés auth_attempts rattachées à un compte (throttling + brute-force email).
 * Purge lors de la suppression de compte : l'adresse e-mail ne doit rester
 * nulle part (SPEC SB4-c).
 */
export function accountAttemptKeys(
  userId: string,
  email: string,
): [string, string, string, string] {
  return [
    `email:${email.toLowerCase()}`,
    profileAttemptKey(userId),
    creationDeleteAttemptKey(userId),
    accountDeleteAttemptKey(userId),
  ];
}
