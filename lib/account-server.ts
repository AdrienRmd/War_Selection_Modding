import { bindings, type MapRecord } from "@/lib/atlas-server";
import { listMods } from "@/lib/mod-server";

// Hub « mes créations » de /account (SB3). Les compteurs affichés DOIVENT
// rester égaux au contenu exact de GET /api/atlas/submissions et
// GET /api/mods/submissions (scope propriétaire) : on réutilise donc les
// mêmes requêtes que ces endpoints (même SQL côté cartes, même listMods
// côté mods) plutôt qu'un GROUP BY parallèle qui pourrait dériver. Le cap
// à 100 cartes / 200 lignes de mods est identique aux API — un utilisateur
// au-delà voit les mêmes compteurs que la liste réellement retournée.

/** Cartes du compte, exactement comme GET /api/atlas/submissions (scope owner). */
export async function ownMaps(userId: string): Promise<MapRecord[]> {
  const r = await bindings()
    .DB.prepare(
      "SELECT * FROM maps WHERE owner_id = ? ORDER BY created_at DESC LIMIT 100",
    )
    .bind(userId)
    .all<MapRecord>();
  return r.results;
}

/** Mods du compte, exactement comme GET /api/mods/submissions (scope owner). */
export async function ownMods(
  userId: string,
  admin: boolean,
): Promise<{ status: string; origin: string }[]> {
  const own = await listMods(userId, false, true);
  if (!admin) return own;
  // Miroir de la route : un admin y voit aussi les entrées éditoriales
  // (origin != "community") en plus de ses propres soumissions.
  const curated = (await listMods(userId, true, true)).filter((m) => m.origin !== "community");
  return [...curated, ...own];
}

export type CreationCounts = {
  maps: Record<string, number>;
  mods: Record<string, number>;
};

const tally = (statuses: string[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const status of statuses) counts[status] = (counts[status] || 0) + 1;
  return counts;
};

/** Agrège les statuts des deux listes sources en compteurs par type. */
export function countCreations(
  maps: { status: string }[],
  mods: { status: string }[],
): CreationCounts {
  return {
    maps: tally(maps.map((m) => m.status)),
    mods: tally(mods.map((m) => m.status)),
  };
}

/** Compteurs du hub : deux requêtes bornées (cartes + mods), jamais de N+1. */
export async function creationCounts(userId: string, admin: boolean): Promise<CreationCounts> {
  const [maps, mods] = await Promise.all([ownMaps(userId), ownMods(userId, admin)]);
  return countCreations(maps, mods);
}
