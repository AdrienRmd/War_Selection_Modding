// SB5 — code de partage de carte War Selection.
//
// Format constaté sur les 172+ codes des seeds éditoriaux (collection + canal
// Discord, cf. lib/collection-seeds.json / discord-map-seeds.json) : 100 %
// sont `map-` + 8 caractères hexadécimaux minuscules (longueur 12).
//
// Politique (spec SB5-c + D6) : ce contrôle est une aide, PAS un blocage —
// les variantes d'éditions peuvent exister et le jeu peut évoluer. Le serveur
// accepte toute chaîne nettoyée ≤ 150 caractères ; `mapCodeLooksPlausible`
// alimente l'avertissement (non bloquant) côté formulaire et file de
// modération, et la détection de doublons reste un avertissement modérateur.
export const MAP_CODE_MAX_LENGTH = 150;

// Strict : exactement le format des codes existants observés en base.
export const MAP_CODE_PATTERN = /^map-[0-9a-f]{8}$/;

/** Nettoyage inoffensif : trim + garde-fou longueur (le zod serveur revalide). */
export function normalizeMapCode(raw: string): string {
  return raw.trim().slice(0, MAP_CODE_MAX_LENGTH);
}

/** Vraisemblance du format `map-XXXXXXXX` — avertissement seulement, jamais un refus. */
export function mapCodeLooksPlausible(code: string): boolean {
  return MAP_CODE_PATTERN.test(normalizeMapCode(code));
}

// SB6 — vocabulaire du statut de test déclaré par l'auteur. Valeurs
// strictement identiques à `collectionTestStates` (lib/collection.ts) :
// réutilisation du vocabulaire de la collection admin, sans import pour ne
// pas embarquer les seeds dans le bundle API. Le test unitaire
// tests/map-sharing.test.ts verrouille l'égalité.
export const mapTestStates = ["untested", "working", "issues", "unavailable"] as const;
export type MapTestState = (typeof mapTestStates)[number];

/** Libellés bilingues [zh, en] au même format que collectionLabels. */
export const mapTestLabels: Record<MapTestState, [string, string]> = {
  untested: ["待实测", "Untested"],
  working: ["已实测可用", "Tested · working"],
  issues: ["存在问题", "Known issues"],
  unavailable: ["已失效", "Unavailable"],
};
