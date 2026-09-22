import { z } from "zod";
import source from "./collection-seeds.json";
import discordSource from "./discord-map-seeds.json";
import imageSource from "./collection-image-seeds.json";

export const collectionCategories = [
  "unknown",
  "PVE",
  "PVP",
  "historical",
  "survival",
  "other",
] as const;
export const collectionTestStates = ["untested", "working", "issues", "unavailable"] as const;
export const collectionBodySchema = z
  .object({
    title: z.string().trim().max(120),
    title_en: z.string().trim().max(160),
    author: z.string().trim().max(100),
    players: z.number().int().min(1).max(64).nullable(),
    category: z.enum(collectionCategories),
    summary: z.string().trim().max(500),
    summary_en: z.string().trim().max(700),
    description: z.string().trim().max(10000),
    description_en: z.string().trim().max(14000),
    mods: z.string().trim().max(4000),
    mods_en: z.string().trim().max(5000),
    game_version: z.string().trim().max(100),
    test_status: z.enum(collectionTestStates),
    tested_at: z.string().max(10),
    test_notes: z.string().trim().max(4000),
    test_notes_en: z.string().trim().max(5000),
    visibility: z.enum(["listed", "hidden"]),
  })
  .superRefine((body, ctx) => {
    if (
      body.tested_at &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(body.tested_at) ||
        !Number.isFinite(Date.parse(body.tested_at)) ||
        new Date(body.tested_at).toISOString().slice(0, 10) !== body.tested_at ||
        body.tested_at > new Date().toISOString().slice(0, 10))
    )
      ctx.addIssue({
        code: "custom",
        path: ["tested_at"],
        message: "请填写有效且不晚于今天的测试日期。",
      });
    if (
      body.test_status !== "untested" &&
      (!body.tested_at || !body.game_version || !body.test_notes)
    )
      ctx.addIssue({
        code: "custom",
        path: ["test_status"],
        message: "更新实测状态前，请填写测试日期、游戏版本和测试记录。",
      });
  });
export type CollectionBody = z.infer<typeof collectionBodySchema>;
export type MapProvenance = {
  preview_kind?: "map" | "shared" | "art";
  preview_note?: string;
  preview_note_en?: string;
  image_source_url?: string;
  map_version?: string;
  edition?: "original" | "variant" | "remix";
  relation_note?: string;
  relation_note_en?: string;
  sources?: { url: string; label: string; label_en: string }[];
  related_maps?: { id: string; label: string; label_en: string }[];
};
export type CollectedMap = CollectionBody &
  MapProvenance & {
    id: string;
    map_code: string;
    images: string[];
    source_note: string;
    source_note_en: string;
    source_order: number;
    collected_at: string;
    revision: number;
    updated_at: string;
  };
// Source supplements fill gaps without replacing the curator's existing archive.
// Durable admin edits are applied afterwards by collection-server.ts.
const byCode = new Map<string, CollectedMap>(
  (source as CollectedMap[]).map((m) => [m.map_code, m]),
);
for (const incoming of discordSource as CollectedMap[]) {
  const current = byCode.get(incoming.map_code);
  if (!current) {
    byCode.set(incoming.map_code, incoming);
    continue;
  }
  const merged = {
    ...incoming,
    ...current,
    sources: incoming.sources,
    related_maps: incoming.related_maps,
    edition: incoming.edition,
    map_version: incoming.map_version,
    relation_note: incoming.relation_note,
    relation_note_en: incoming.relation_note_en,
  };
  for (const key of [
    "title",
    "title_en",
    "author",
    "summary",
    "summary_en",
    "mods",
    "mods_en",
  ] as const)
    if (!merged[key]) merged[key] = incoming[key];
  for (const key of ["description", "description_en"] as const)
    merged[key] = [current[key], incoming[key]].filter(Boolean).join("\n\n");
  if (!merged.players) merged.players = incoming.players;
  if (merged.category === "unknown") merged.category = incoming.category;
  byCode.set(incoming.map_code, merged);
}
type ImageSupplement = {
  images: string[];
  preview_kind: "map" | "shared" | "art";
  preview_note: string;
  preview_note_en: string;
  image_source_url: string;
  prefer_new_cover?: boolean;
};
for (const [id, images] of Object.entries(imageSource as Record<string, ImageSupplement>)) {
  const entry = byCode.get(id);
  if (entry) {
    const { prefer_new_cover, ...preview } = images;
    const ordered = prefer_new_cover
      ? [...preview.images, ...entry.images]
      : [...entry.images, ...preview.images];
    byCode.set(id, { ...entry, ...preview, images: [...new Set(ordered)] });
  }
}
export const collectedSeeds = [...byCode.values()];
export function collectionSeed(id: string) {
  return collectedSeeds.find((m) => m.id === id);
}
export function collectionBody(m: CollectedMap): CollectionBody {
  return collectionBodySchema.parse(m);
}
export const collectionLabels = {
  untested: ["待实测", "Untested"],
  working: ["已实测可用", "Tested · working"],
  issues: ["存在问题", "Known issues"],
  unavailable: ["已失效", "Unavailable"],
  unknown: ["类型待确认", "Type unknown"],
  PVE: ["合作 / PVE", "Co-op / PVE"],
  PVP: ["对战 / PVP", "Competitive / PVP"],
  historical: ["历史战役", "Historical"],
  survival: ["生存", "Survival"],
  other: ["其他", "Other"],
} as const;
