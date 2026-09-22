import { bindings, identity } from "@/lib/atlas-server";
import { seedMods } from "@/lib/mod-seeds";
import { emptyMod, type ModBody, type ModEntry, type ModRecord } from "@/lib/mod-types";

const bodyKeys = Object.keys(emptyMod) as (keyof ModBody)[];

// Whitelist the public body fields: arbitrary JSON must not inject owner IDs,
// storage keys, review tokens, or override trusted record metadata.
function cleanBody(value: unknown): ModBody {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const body = { ...emptyMod };
  for (const key of bodyKeys) {
    if (typeof source[key] === "string") body[key] = source[key];
  }
  return body;
}

export function seedRecord(id: string): ModRecord | null {
  const seed = seedMods.find((entry) => entry.id === id);
  if (!seed) return null;
  return {
    id: seed.id,
    owner_id: null,
    origin: seed.origin,
    body: JSON.stringify(cleanBody(seed)),
    status: seed.status,
    revision: seed.revision,
    created_at: seed.created_at,
    updated_at: seed.updated_at,
    feedback: "",
    file_key: null,
    file_name: "",
    file_size: 0,
    sha256: "",
    review_token: null,
  };
}

/** Internal lookup. Callers must enforce visibility before returning a record. */
export async function rawMod(id: string): Promise<ModRecord | null> {
  const row = await bindings()
    .DB.prepare("SELECT * FROM community_mods WHERE id = ?")
    .bind(id)
    .first<ModRecord>();
  // A pending, rejected, or withdrawn row still masks its approved seed.
  // Database errors propagate instead of exposing possibly withdrawn content.
  return row ?? seedRecord(id);
}

export function publicMod(record: ModRecord, editable = false): ModEntry {
  const body = cleanBody(JSON.parse(record.body));
  return {
    ...body,
    id: record.id,
    origin: record.origin,
    status: record.status,
    revision: record.revision,
    created_at: record.created_at,
    updated_at: record.updated_at,
    file_name: record.file_name,
    file_size: record.file_size,
    sha256: record.sha256,
    has_file: !!record.file_key,
    editable,
    ...(editable ? { feedback: record.feedback } : {}),
  };
}

export async function listMods(
  userId?: string,
  admin?: boolean,
  manage = false,
): Promise<ModEntry[]> {
  if (userId === undefined && admin === undefined) {
    const viewer = await identity();
    userId = viewer.user?.userId;
    admin = viewer.admin;
  }
  // Bounded listing: keep the existing display order (newest updates first,
  // deterministic id tiebreak) and cap at 200 rows. The 23 curated seeds are
  // merged separately below, so the cap only bounds community submissions —
  // years of headroom — and older overflow rows stay reachable one-by-one
  // through rawMod().
  const result = await bindings()
    .DB.prepare("SELECT * FROM community_mods ORDER BY updated_at DESC, id ASC LIMIT 200")
    .all<ModRecord>();
  const rows = result.results;
  const overridden = new Set(rows.map((row) => row.id));
  const records = [
    ...seedMods.filter((seed) => !overridden.has(seed.id)).map((seed) => seedRecord(seed.id)!),
    ...rows,
  ];
  const canEdit = (record: ModRecord) => !!admin || (!!userId && record.owner_id === userId);
  return records
    .filter((record) => (manage ? canEdit(record) : record.status === "approved"))
    .map((record) => publicMod(record, canEdit(record)));
}
