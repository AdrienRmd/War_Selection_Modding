import { bindings } from "@/lib/atlas-server";
export type CreatorRow = {
  id: string;
  name: string;
  role: string;
  photo_key: string | null;
  photo_type: string | null;
  position: number;
  created_at: string;
};
export type Creator = {
  id: string;
  name: string;
  role: string;
  has_photo: boolean;
};
export function publicCreator(r: CreatorRow): Creator {
  return { id: r.id, name: r.name, role: r.role, has_photo: !!r.photo_key };
}
export async function listCreators(): Promise<Creator[]> {
  const r = await bindings()
    .DB.prepare("SELECT * FROM creators ORDER BY position, created_at, id")
    .all<CreatorRow>();
  return r.results.map(publicCreator);
}
export async function creatorRow(id: string) {
  return bindings().DB.prepare("SELECT * FROM creators WHERE id = ?").bind(id).first<CreatorRow>();
}
export async function nextCreatorPosition() {
  const r = await bindings()
    .DB.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS next FROM creators")
    .first<{ next: number }>();
  return r?.next || 1;
}
