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
  // Décision orchestrateur (revue 07/11) : la bannière d'accueil « THE CREW »
  // reste la vitrine CURÉE PAR LES ADMINS — seules les lignes historiques
  // (user_id IS NULL, statut published) y figurent ; les créateurs issus
  // d'une candidature publiée vivent dans l'annuaire /createurs.
  const r = await bindings()
    .DB.prepare(
      "SELECT * FROM creators WHERE status = 'published' AND user_id IS NULL ORDER BY position, created_at, id",
    )
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

/* ================================================================== */
/* « Créateurs de contenu » (07/11/2026, migration 0015) — candidatures
 *  utilisateur, profils publics /createurs/<id>, réseaux sociaux en
 *  whitelist, associations mods/cartes (AUTO par compte propriétaire +
 *  MANUELLE via creator_items), modération admin sur le patron des
 *  soumissions replays (pending → published/rejected ; retrait auteur →
 *  withdrawn), quotas anti-abus verrouillés dans l'INSERT. */

import { HttpError } from "@/lib/atlas-server";

/** Whitelist des plateformes de réseaux sociaux (spec 07/11). Chaque
 *  plateforme impose ses domaines https — une URL YouTube doit être sur
 *  youtube.com/youtu.be, etc. Discord accepte les invitations
 *  (discord.gg) et les liens canoniques (discord.com). */
export const CREATOR_PLATFORMS = {
  youtube: {
    domains: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"],
    label: "YouTube",
  },
  "youtube-gaming": {
    domains: ["youtube.com", "www.youtube.com", "gaming.youtube.com"],
    label: "YouTube Gaming",
  },
  twitch: { domains: ["twitch.tv", "www.twitch.tv", "m.twitch.tv"], label: "Twitch" },
  discord: { domains: ["discord.gg", "discord.com", "www.discord.com"], label: "Discord" },
  x: { domains: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"], label: "X" },
  tiktok: { domains: ["tiktok.com", "www.tiktok.com"], label: "TikTok" },
  instagram: { domains: ["instagram.com", "www.instagram.com"], label: "Instagram" },
} as const;

export type CreatorPlatform = keyof typeof CREATOR_PLATFORMS;

export const CREATOR_APPLICATION_PENDING_LIMIT = 1; // candidature en attente max
export const CREATOR_APPLICATION_DAILY_LIMIT = 2; // candidatures par 24 h
export const CREATOR_LINKS_MAX = 6;
export const CREATOR_ITEMS_MAX = 12;
export const CREATOR_BIO_MAX = 500;
export const CREATOR_NAME_MAX = 60;

/** Valide une URL de réseau social : https STRICT, hostname exactement dans
 *  la whitelist de la plateforme, pas de credentials, pas de fragment vide
 *  parasite. Retourne l'URL normalisée ou null (→ 400 côté appelant).
 *  javascript:, data:, http: sont rejetés par construction. */
export function cleanCreatorLinkUrl(
  platform: CreatorPlatform,
  raw: unknown,
): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 300) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  const domains: readonly string[] = CREATOR_PLATFORMS[platform].domains;
  if (!domains.includes(host)) return null;
  if (!url.pathname || url.pathname === "/") return null;
  return url.toString();
}

/** Corps de candidature nettoyé : nom (1-60), présentation (0-500),
 *  réseaux [{platform, url}] ≤ 6 validés, revendications {maps:[], mods:[]}
 *  ≤ 12 au total (ids existants + publiés, revérifiés en base à l'écriture).
 *  Retourne null si invalide — l'appelant répond 400. */
export function cleanCreatorApplication(value: unknown): {
  name: string;
  bio: string;
  links: Array<{ platform: CreatorPlatform; url: string }>;
  mapIds: string[];
  modIds: string[];
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const name =
    typeof source.name === "string"
      ? source.name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, CREATOR_NAME_MAX)
      : "";
  if (!name) return null;
  const bio =
    typeof source.bio === "string"
      ? source.bio.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, CREATOR_BIO_MAX)
      : "";
  const rawLinks = Array.isArray(source.links) ? source.links : [];
  if (rawLinks.length > CREATOR_LINKS_MAX) return null;
  const links: Array<{ platform: CreatorPlatform; url: string }> = [];
  const seenPlatforms = new Set<string>();
  for (const entry of rawLinks) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const platform = (entry as Record<string, unknown>).platform;
    if (typeof platform !== "string" || !(platform in CREATOR_PLATFORMS)) return null;
    if (seenPlatforms.has(platform)) return null; // une ligne par plateforme
    seenPlatforms.add(platform);
    const url = cleanCreatorLinkUrl(platform as CreatorPlatform, (entry as Record<string, unknown>).url);
    if (!url) return null;
    links.push({ platform: platform as CreatorPlatform, url });
  }
  const idList = (v: unknown): string[] | null => {
    if (!Array.isArray(v)) return [];
    if (v.length > CREATOR_ITEMS_MAX) return null;
    const out: string[] = [];
    for (const id of v) {
      if (typeof id !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/i.test(id)) return null;
      out.push(id);
    }
    return [...new Set(out)];
  };
  const mapIds = idList(source.mapIds);
  const modIds = idList(source.modIds);
  if (mapIds === null || modIds === null) return null;
  if (mapIds.length + modIds.length > CREATOR_ITEMS_MAX) return null;
  return { name, bio, links, mapIds, modIds };
}

export interface CreatorLinkRow {
  id: string;
  creator_id: string;
  platform: string;
  url: string;
  position: number;
  created_at: string;
}

export interface CreatorItemRow {
  id: string;
  creator_id: string;
  kind: string;
  item_id: string;
  position: number;
  created_at: string;
}

export type CreatorRow15 = CreatorRow & {
  user_id: string | null;
  bio: string;
  status: string;
  moderated_at: string | null;
  note: string | null;
  updated_at: string | null;
};

export interface CreatorCard {
  id: string;
  name: string;
  role: string;
  bio: string;
  has_photo: boolean;
  links: Array<{ platform: CreatorPlatform; url: string }>;
  mapsCount: number;
  modsCount: number;
}

export interface CreatorProfile extends CreatorCard {
  /** Cartes/mods rapprochés AUTOMATIQUEMENT par compte propriétaire. */
  autoMaps: Array<{ id: string; title: string; players: number; category: string }>;
  autoMods: Array<{ id: string; title: string }>;
  /** Cartes/mods associés MANUELLEMENT (creator_items, revendications
   *  validées à la modération). */
  manualMaps: Array<{ id: string; title: string; players: number; category: string }>;
  manualMods: Array<{ id: string; title: string }>;
  status: string;
  mine: boolean;
}

const PLATFORM_KEYS = new Set(Object.keys(CREATOR_PLATFORMS));

async function linksOf(creatorId: string): Promise<CreatorLinkRow[]> {
  const r = await bindings()
    .DB.prepare("SELECT * FROM creator_links WHERE creator_id = ? ORDER BY position, created_at")
    .bind(creatorId)
    .all<CreatorLinkRow>();
  return (r.results ?? []).filter((row) => PLATFORM_KEYS.has(row.platform));
}

/** Cartes publiées (titre/players/catégorie) pour des ids — les lignes
 *  supprimées ou non publiées sont silencieusement écartées (le profil ne
 *  doit jamais référencer du contenu invisible). */
async function publishedMapsByIds(ids: string[]): Promise<Map<string, { id: string; title: string; players: number; category: string }>> {
  const out = new Map<string, { id: string; title: string; players: number; category: string }>();
  for (const id of ids) {
    const row = await bindings()
      .DB.prepare("SELECT id, title, players, category FROM maps WHERE id = ? AND status = 'published'")
      .bind(id)
      .first<{ id: string; title: string; players: number; category: string }>();
    if (row) out.set(row.id, row);
  }
  return out;
}

/** Mods publics (titre depuis le body JSON) pour des ids. Les mods « seed »
 *  (owner_id NULL) restent éligibles : ce sont des contenus du site. */
async function publicModsByIds(ids: string[]): Promise<Map<string, { id: string; title: string }>> {
  const out = new Map<string, { id: string; title: string }>();
  for (const id of ids) {
    const row = await bindings()
      .DB.prepare("SELECT id, body FROM community_mods WHERE id = ? AND status = 'published'")
      .bind(id)
      .first<{ id: string; body: string }>();
    if (!row) continue;
    try {
      const body = JSON.parse(row.body) as { title?: unknown };
      const title = typeof body.title === "string" ? body.title.slice(0, 80) : id;
      out.set(row.id, { id: row.id, title });
    } catch {
      out.set(row.id, { id: row.id, title: id });
    }
  }
  return out;
}

/** Rapprochement AUTOMATIQUE : cartes publiées du compte propriétaire. */
async function autoMapsOf(userId: string): Promise<Array<{ id: string; title: string; players: number; category: string }>> {
  const r = await bindings()
    .DB.prepare(
      "SELECT id, title, players, category FROM maps WHERE owner_id = ? AND status = 'published' ORDER BY created_at DESC, id LIMIT 24",
    )
    .bind(userId)
    .all<{ id: string; title: string; players: number; category: string }>();
  return r.results ?? [];
}

/** Rapprochement AUTOMATIQUE : mods publiés du compte propriétaire. */
async function autoModsOf(userId: string): Promise<Array<{ id: string; title: string }>> {
  const r = await bindings()
    .DB.prepare(
      "SELECT id, body FROM community_mods WHERE owner_id = ? AND status = 'published' ORDER BY updated_at DESC, id LIMIT 24",
    )
    .bind(userId)
    .all<{ id: string; body: string }>();
  return (r.results ?? []).map((row) => {
    try {
      const body = JSON.parse(row.body) as { title?: unknown };
      return { id: row.id, title: typeof body.title === "string" ? body.title.slice(0, 80) : row.id };
    } catch {
      return { id: row.id, title: row.id };
    }
  });
}

/** Créateurs PUBLIÉS avec réseaux et compteurs (page /createurs). */
export async function listPublishedCreators(): Promise<CreatorCard[]> {
  const r = await bindings()
    .DB.prepare(
      "SELECT * FROM creators WHERE status = 'published' ORDER BY position, created_at, id",
    )
    .all<CreatorRow15>();
  const cards: CreatorCard[] = [];
  for (const row of r.results ?? []) {
    const links = await linksOf(row.id);
    const [autoMaps, autoMods, items] = await Promise.all([
      row.user_id ? autoMapsOf(row.user_id) : Promise.resolve([]),
      row.user_id ? autoModsOf(row.user_id) : Promise.resolve([]),
      bindings()
        .DB.prepare("SELECT kind, COUNT(*) AS n FROM creator_items WHERE creator_id = ? GROUP BY kind")
        .bind(row.id)
        .all<{ kind: string; n: number }>(),
    ]);
    // Le compte additionne l'auto et le manuel : un item manuel qui
    // redondance l'auto est ignoré (même règle que le profil).
    const autoMapIds = new Set(autoMaps.map((m) => m.id));
    const autoModIds = new Set(autoMods.map((m) => m.id));
    const manualRows = await bindings()
      .DB.prepare("SELECT kind, item_id FROM creator_items WHERE creator_id = ?")
      .bind(row.id)
      .all<{ kind: string; item_id: string }>();
    const manualMaps = (manualRows.results ?? []).filter(
      (i) => i.kind === "map" && !autoMapIds.has(i.item_id),
    ).length;
    const manualMods = (manualRows.results ?? []).filter(
      (i) => i.kind === "mod" && !autoModIds.has(i.item_id),
    ).length;
    cards.push({
      id: row.id,
      name: row.name,
      role: row.role,
      bio: row.bio,
      has_photo: !!row.photo_key,
      links: links.map((l) => ({ platform: l.platform as CreatorPlatform, url: l.url })),
      mapsCount: autoMaps.length + manualMaps,
      modsCount: autoMods.length + manualMods,
    });
  }
  return cards;
}

/** Profil public d'un créateur publié (ou en attente si le lecteur est
 *  propriétaire/admin — prévisualisation pendant la modération). */
export async function creatorProfile(id: string, viewer: { id: string | null; admin: boolean }): Promise<CreatorProfile | null> {
  const row = await bindings()
    .DB.prepare("SELECT * FROM creators WHERE id = ?")
    .bind(id)
    .first<CreatorRow15>();
  if (!row) return null;
  const mine = !!viewer.id && row.user_id === viewer.id;
  if (row.status !== "published" && !viewer.admin && !mine) return null;
  const links = await linksOf(row.id);
  const items = await bindings()
    .DB.prepare("SELECT * FROM creator_items WHERE creator_id = ? ORDER BY kind, position, created_at")
    .bind(row.id)
    .all<CreatorItemRow>();
  const mapIds = (items.results ?? []).filter((i) => i.kind === "map").map((i) => i.item_id);
  const modIds = (items.results ?? []).filter((i) => i.kind === "mod").map((i) => i.item_id);
  const [autoMaps, autoMods, manualMapRows, manualModRows] = await Promise.all([
    row.user_id ? autoMapsOf(row.user_id) : Promise.resolve([]),
    row.user_id ? autoModsOf(row.user_id) : Promise.resolve([]),
    publishedMapsByIds(mapIds),
    publicModsByIds(modIds),
  ]);
  // Dédoublement défensif : une association manuelle qui redondance
  // l'automatique (même id) n'est pas affichée deux fois.
  const autoMapIds = new Set(autoMaps.map((m) => m.id));
  const autoModIds = new Set(autoMods.map((m) => m.id));
  // (e) Compteurs DÉDOUBLONNÉS : seuls les items manuels NON couverts par
  // l'automatique s'additionnent — cohérents avec les sections affichées
  // (consommés par les titres « N cartes / N mods » de la page profil).
  const manualMaps = [...manualMapRows.values()].filter((m) => !autoMapIds.has(m.id));
  const manualMods = [...manualModRows.values()].filter((m) => !autoModIds.has(m.id));
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    bio: row.bio,
    has_photo: !!row.photo_key,
    links: links.map((l) => ({ platform: l.platform as CreatorPlatform, url: l.url })),
    autoMaps,
    autoMods,
    manualMaps,
    manualMods,
    status: row.status,
    mine,
    mapsCount: autoMaps.length + manualMaps.length,
    modsCount: autoMods.length + manualMods.length,
  };
}

export interface CreatorApplicationView {
  id: string;
  name: string;
  bio: string;
  has_photo: boolean;
  status: string;
  createdAt: string;
  moderatedAt: string | null;
  note: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  links: Array<{ platform: CreatorPlatform; url: string }>;
  items: Array<{ kind: "map" | "mod"; id: string; title: string | null; ownerName: string | null }>;
}

/** File de modération (admin) ou mes candidatures (auteur). */
export async function listCreatorApplications(
  ownerId: string | null,
  adminScope: boolean,
): Promise<CreatorApplicationView[]> {
  const db = bindings().DB;
  const rows = adminScope
    ? await db
        .prepare(
          "SELECT c.*, u.display_name AS owner_name, u.email AS owner_email FROM creators c LEFT JOIN users u ON u.id = c.user_id WHERE c.user_id IS NOT NULL ORDER BY c.created_at DESC, c.id LIMIT 200",
        )
        .all<CreatorRow15 & { owner_name: string | null; owner_email: string | null }>()
    : await db
        .prepare("SELECT * FROM creators WHERE user_id = ? ORDER BY created_at DESC, id LIMIT 50")
        .bind(ownerId!)
        .all<CreatorRow15 & { owner_name: null; owner_email: null }>();
  const views: CreatorApplicationView[] = [];
  for (const row of rows.results ?? []) {
    const links = await linksOf(row.id);
    const items = await db
      .prepare(
        "SELECT ci.kind, ci.item_id FROM creator_items ci WHERE ci.creator_id = ? ORDER BY ci.kind, ci.position",
      )
      .bind(row.id)
      .all<{ kind: string; item_id: string }>();
    const itemViews: CreatorApplicationView["items"] = [];
    for (const item of items.results ?? []) {
      if (item.kind === "map") {
        const m = await db
          .prepare("SELECT title, author FROM maps WHERE id = ?")
          .bind(item.item_id)
          .first<{ title: string; author: string }>();
        itemViews.push({ kind: "map", id: item.item_id, title: m?.title ?? null, ownerName: m?.author ?? null });
      } else {
        const m = await db
          .prepare("SELECT body FROM community_mods WHERE id = ?")
          .bind(item.item_id)
          .first<{ body: string }>();
        let title: string | null = null;
        try {
          const body = JSON.parse(m?.body ?? "null") as { title?: unknown } | null;
          title = typeof body?.title === "string" ? body.title.slice(0, 80) : null;
        } catch {
          title = null;
        }
        itemViews.push({ kind: "mod", id: item.item_id, title, ownerName: null });
      }
    }
    views.push({
      id: row.id,
      name: row.name,
      bio: row.bio,
      has_photo: !!row.photo_key,
      status: row.status,
      createdAt: row.created_at,
      moderatedAt: row.moderated_at,
      note: row.note,
      ownerName: row.owner_name ?? null,
      ownerEmail: adminScope ? (row.owner_email ?? null) : null,
      links: links.map((l) => ({ platform: l.platform as CreatorPlatform, url: l.url })),
      items: itemViews,
    });
  }
  return views;
}

export interface PhotoUpload {
  key: string;
  type: "image/png" | "image/jpeg";
}

/** Sniff PNG/JPEG d'un upload (même politique que la bannière : 2 MB max). */
export function sniffCreatorPhoto(bytes: Uint8Array, size: number): "image/png" | "image/jpeg" | null {
  if (size < 4 || size > 2 * 1024 * 1024) return null;
  const png = bytes.length > 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  if (png) return "image/png";
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (jpg) return "image/jpeg";
  return null;
}

/** Dépose la photo de candidature dans R2 (clé creators/<id>/photo). */
export async function putCreatorPhoto(id: string, bytes: Uint8Array, type: string): Promise<PhotoUpload> {
  const key = `creators/${id}/photo`;
  await bindings().BUCKET.put(key, bytes, { httpMetadata: { contentType: type } });
  return { key, type: type as "image/png" | "image/jpeg" };
}

/** Candidature « devenir créateur » (auth requis). Le corps JSON est validé
 *  par cleanCreatorApplication ; les ids revendiqués doivent exister en
 *  PUBLIÉ (revérifié en base ici — jamais confiance au client) ; le nom doit
 *  être unique parmi les créateurs non retirés (COLLATE NOCASE). Quotas :
 *  1 candidature en attente max, 2 par 24 h — verrou atomique dans l'INSERT.
 *  Photo optionnelle multipart à part (voir la route). */
export async function applyCreator(
  ownerId: string,
  body: unknown,
): Promise<{ item: CreatorApplicationView }> {
  const cleaned = cleanCreatorApplication(body);
  if (!cleaned)
    throw new HttpError(
      400,
      "申请内容无效：名称必填（最长 60 字），链接必须是平台白名单内的 https 地址。 / Invalid application: name required (max 60), links must be https URLs on whitelisted platforms.",
    );
  const { name, bio, links, mapIds, modIds } = cleaned;
  const db = bindings().DB;

  // Nom unique parmi les créateurs non retirés (deux comptes ne peuvent pas
  // revendiquer la même identité publique).
  const clash = await db
    .prepare("SELECT id FROM creators WHERE name = ? COLLATE NOCASE AND status != 'withdrawn'")
    .bind(name)
    .first<{ id: string }>();
  if (clash)
    throw new HttpError(409, "这个名字已被使用。 / This creator name is already taken.");

  // Revendications : items existants ET publiés (les seeds de mods sont
  // publiés par construction ; une ligne retirée les masque).
  for (const mapId of mapIds) {
    const ok = await db
      .prepare("SELECT id FROM maps WHERE id = ? AND status = 'published'")
      .bind(mapId)
      .first<{ id: string }>();
    if (!ok)
      throw new HttpError(400, `地图 ${mapId} 不存在或未发布。 / Map ${mapId} does not exist or is not published.`);
  }
  for (const modId of modIds) {
    const ok = await db
      .prepare("SELECT id FROM community_mods WHERE id = ? AND status = 'published'")
      .bind(modId)
      .first<{ id: string }>();
    if (!ok)
      throw new HttpError(400, `Mod ${modId} 不存在或未发布。 / Mod ${modId} does not exist or is not published.`);
  }

  const now = new Date().toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const id = crypto.randomUUID();

  const inserted = await db
    .prepare(
      "INSERT INTO creators (id, name, role, position, created_at, user_id, bio, status) SELECT ?, ?, '', 0, ?, ?, ?, 'pending' WHERE (SELECT COUNT(*) FROM creators WHERE user_id = ? AND status = 'pending') < ? AND (SELECT COUNT(*) FROM creators WHERE user_id = ? AND created_at > ?) < ?",
    )
    .bind(
      id,
      name,
      now,
      ownerId,
      bio,
      ownerId,
      CREATOR_APPLICATION_PENDING_LIMIT,
      ownerId,
      dayAgo,
      CREATOR_APPLICATION_DAILY_LIMIT,
    )
    .run();
  if (inserted.meta.changes !== 1)
    throw new HttpError(
      429,
      "申请过于频繁：每个账号同时只能有一份待审申请，24 小时内最多 2 份。 / Application limit reached: one pending application per account, max 2 per 24h.",
    );

  for (const [index, link] of links.entries()) {
    await db
      .prepare("INSERT INTO creator_links (id, creator_id, platform, url, position, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), id, link.platform, link.url, index, now)
      .run();
  }
  for (const [index, mapId] of mapIds.entries()) {
    await db
      .prepare("INSERT INTO creator_items (id, creator_id, kind, item_id, position, created_at) VALUES (?, ?, 'map', ?, ?, ?)")
      .bind(crypto.randomUUID(), id, mapId, index, now)
      .run();
  }
  for (const [index, modId] of modIds.entries()) {
    await db
      .prepare("INSERT INTO creator_items (id, creator_id, kind, item_id, position, created_at) VALUES (?, ?, 'mod', ?, ?, ?)")
      .bind(crypto.randomUUID(), id, modId, index, now)
      .run();
  }

  const [view] = await listCreatorApplications(ownerId, false).then((list) => list.filter((v) => v.id === id));
  return { item: view };
}

/** Modération admin d'une candidature : published / rejected (+ note ≤ 300)
 *  ou withdrawn (retrait admin). `itemIds` (optionnel) REMPLACE la sélection
 *  manuelle de mods/cartes revendiquées — l'admin peut retirer une
 *  revendication douteuse avant de publier. */
export async function moderateCreator(
  id: string,
  action: "published" | "rejected" | "withdrawn",
  note: string | null,
  itemIds: string[] | null,
): Promise<CreatorApplicationView> {
  const cleanNote = note?.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 300) || null;
  const db = bindings().DB;
  const now = new Date().toISOString();
  const row = await db
    .prepare("SELECT id FROM creators WHERE id = ? AND user_id IS NOT NULL")
    .bind(id)
    .first<{ id: string }>();
  if (!row) throw new HttpError(404, "创作者申请不存在。 / Creator application not found.");

  if (itemIds !== null) {
    if (itemIds.length > CREATOR_ITEMS_MAX)
      throw new HttpError(400, "最多关联 12 项内容。 / At most 12 associated items.");
    const existing = await db
      .prepare("SELECT kind, item_id FROM creator_items WHERE creator_id = ?")
      .bind(id)
      .all<{ kind: string; item_id: string }>();
    const current = new Map((existing.results ?? []).map((i) => [`${i.kind}:${i.item_id}`, i]));
    for (const key of current.keys()) {
      const [kind, itemId] = key.split(":");
      if (!itemIds.includes(itemId))
        await db.prepare("DELETE FROM creator_items WHERE creator_id = ? AND kind = ? AND item_id = ?").bind(id, kind, itemId).run();
    }
    // (Les additions admin se font via le même canal candidature : chaque
    // item doit rester un contenu publié existant du site.)
  }

  const changed = await db
    .prepare("UPDATE creators SET status = ?, moderated_at = ?, note = ?, updated_at = ? WHERE id = ?")
    .bind(action, now, cleanNote, now, id)
    .run();
  if (changed.meta.changes !== 1) throw new HttpError(404, "创作者申请不存在。 / Creator application not found.");

  const rows = await db
    .prepare(
      "SELECT c.*, u.display_name AS owner_name FROM creators c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?",
    )
    .bind(id)
    .all<CreatorRow15 & { owner_name: string | null }>();
  const target = (rows.results ?? [])[0];
  const links = await linksOf(id);
  const items = await db
    .prepare("SELECT kind, item_id FROM creator_items WHERE creator_id = ? ORDER BY kind, position")
    .bind(id)
    .all<{ kind: string; item_id: string }>();
  return {
    id,
    name: target?.name ?? "",
    bio: target?.bio ?? "",
    has_photo: !!target?.photo_key,
    status: action,
    createdAt: target?.created_at ?? now,
    moderatedAt: now,
    note: cleanNote,
    ownerName: target?.owner_name ?? null,
    ownerEmail: null,
    links: links.map((l) => ({ platform: l.platform as CreatorPlatform, url: l.url })),
    items: (items.results ?? []).map((i) => ({ kind: (i.kind === "mod" ? "mod" : "map") as "map" | "mod", id: i.item_id, title: null, ownerName: null })),
  };
}

/** Retrait par l'auteur : pending/published → withdrawn (le profil
 *  disparaît ; la photo R2 reste pour une éventuelle réactivation). */
export async function withdrawCreator(id: string, ownerId: string): Promise<{ status: string }> {
  const db = bindings().DB;
  const now = new Date().toISOString();
  const changed = await db
    .prepare(
      "UPDATE creators SET status = 'withdrawn', moderated_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND status IN ('pending','published')",
    )
    .bind(now, now, id, ownerId)
    .run();
  if (changed.meta.changes !== 1)
    throw new HttpError(404, "找不到可撤回的创作者档案。 / No withdrawable creator profile found.");
  return { status: "withdrawn" };
}

/** Sélection « revendicable » pour le formulaire : cartes et mods publiés
 *  (les plus récents d'abord, plafonnés) — le rapprochement AUTOMATIQUE par
 *  compte couvre déjà les contenus du candidat ; cette liste sert aux
 *  revendications complémentaires (modération admin à la clé). */
export async function claimableItems(
  /** Compte connecté : ses propres contenus publiés sont EXCLUS (ils sont
   *  déjà rattachés automatiquement par owner_id — une revendication ne
   *  doit jamais doubler une association automatique). */
  viewerId: string | null,
): Promise<{
  maps: Array<{ id: string; title: string; author: string }>;
  mods: Array<{ id: string; title: string }>;
}> {
  const db = bindings().DB;
  const maps = await db
    .prepare("SELECT id, title, author, owner_id FROM maps WHERE status = 'published' ORDER BY created_at DESC LIMIT 100")
    .all<{ id: string; title: string; author: string; owner_id: string }>();
  const modRows = await db
    .prepare("SELECT id, body, owner_id FROM community_mods WHERE status = 'published' ORDER BY updated_at DESC LIMIT 100")
    .all<{ id: string; body: string; owner_id: string }>();
  if (viewerId) {
    maps.results = (maps.results ?? []).filter((m) => m.owner_id !== viewerId);
    modRows.results = (modRows.results ?? []).filter((m) => m.owner_id !== viewerId);
  }
  const mods = (modRows.results ?? []).map((row) => {
    try {
      const body = JSON.parse(row.body) as { title?: unknown };
      return { id: row.id, title: typeof body.title === "string" ? body.title.slice(0, 80) : row.id };
    } catch {
      return { id: row.id, title: row.id };
    }
  });
  return { maps: maps.results ?? [], mods };
}
