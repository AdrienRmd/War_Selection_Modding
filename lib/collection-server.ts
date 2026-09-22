import { bindings } from "@/lib/atlas-server";
import {
  collectedSeeds,
  collectionSeed,
  collectionBodySchema,
  type CollectedMap,
} from "@/lib/collection";
type CollectionRow = { id: string; body: string; revision: number; updated_at: string };
function merge(seed: CollectedMap, row?: CollectionRow | null): CollectedMap {
  return row
    ? {
        ...seed,
        ...collectionBodySchema.parse(JSON.parse(row.body)),
        id: seed.id,
        map_code: seed.map_code,
        images: seed.images,
        revision: row.revision,
        updated_at: row.updated_at,
      }
    : seed;
}
// Reuse the existing curated-map override store. Imported seeds are never
// inserted during reads or migrations; a saved/hidden override always wins.
export async function collectedMap(id: string): Promise<CollectedMap | null> {
  const seed = collectionSeed(id);
  if (!seed) return null;
  const row = await bindings()
    .DB.prepare("SELECT id, body, revision, updated_at FROM featured_maps WHERE id = ?")
    .bind(id)
    .first<CollectionRow>();
  return merge(seed, row);
}
export async function collectedMaps(includeHidden = false): Promise<CollectedMap[]> {
  const rows = await bindings()
    .DB.prepare("SELECT id, body, revision, updated_at FROM featured_maps WHERE id LIKE 'map-%'")
    .all<CollectionRow>();
  const byId = new Map(rows.results.map((row) => [row.id, row]));
  return collectedSeeds
    .map((seed) => merge(seed, byId.get(seed.id)))
    .filter((m) => includeHidden || m.visibility === "listed")
    .sort((a, b) => Number(!!b.title) - Number(!!a.title) || a.source_order - b.source_order);
}
