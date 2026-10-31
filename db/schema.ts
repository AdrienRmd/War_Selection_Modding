// Drizzle schema for WS ATLAS. Defines the D1 tables — maps, reviews,
// featured_maps, community_mods, mod_reviews, users, sessions, auth_attempts,
// creators — plus their indexes. Drizzle is only used to generate the SQL
// migrations in drizzle/; the runtime reads and writes through hand-written,
// parameterized D1 SQL, not the query builder.
import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
export const maps = sqliteTable(
  "maps",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    author: text("author").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    description: text("description").notNull(),
    gameVersion: text("game_version").notNull(),
    players: integer("players").notNull(),
    category: text("category").notNull(),
    mods: text("mods").notNull(),
    mapCode: text("map_code").notNull().default(""),
    status: text("status").notNull().default("pending"),
    fileName: text("file_name").notNull(),
    fileKey: text("file_key").notNull(),
    fileSize: integer("file_size").notNull(),
    sha256: text("sha256").notNull(),
    coverKey: text("cover_key"),
    coverType: text("cover_type"),
    createdAt: text("created_at").notNull(),
    reviewedAt: text("reviewed_at"),
    feedback: text("feedback").notNull().default(""),
    revision: integer("revision").notNull().default(0),
    reviewToken: text("review_token"),
    // V2-P2 (migration 0008, additive) : SB5 rend le ZIP optionnel — une
    // carte peut vivre avec un code de partage seul. Les colonnes fichiers
    // historiques restent NOT NULL (SQLite ne peut pas relâcher la contrainte
    // sans reconstruction de table, interdite par la politique « additif
    // uniquement ») : une soumission sans ZIP écrit les défautes ""/0 et le
    // code vérifie `file_key != ""` partout. Rollback : revert du code,
    // colonnes ignorées par les requêtes existantes à colonnes explicites.
    // SB6 : statut de test déclaré par l'auteur après publication — mêmes
    // valeurs que lib/collection.ts collectionTestStates ; test_updated_at /
    // test_set_by forment l'historique simple (date + dernier rédacteur), la
    // révision D1 s'incrémente à chaque changement.
    testStatus: text("test_status").notNull().default("untested"),
    testUpdatedAt: text("test_updated_at"),
    testSetBy: text("test_set_by"),
    testNotes: text("test_notes").notNull().default(""),
    // SB7 : badge « créateur vérifié » — instantané pris à l'écriture de la
    // ligne (auteur affiché = displayName du compte propriétaire, match
    // exact). JAMAIS réécrit rétroactivement : les lignes existantes gardent 0.
    authorVerified: integer("author_verified").notNull().default(0),
  },
  (t) => [
    index("idx_maps_status_created").on(t.status, t.createdAt),
    index("idx_maps_owner_created").on(t.ownerId, t.createdAt),
  ],
);
export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    mapId: text("map_id")
      .notNull()
      .references(() => maps.id),
    reviewerId: text("reviewer_id").notNull(),
    action: text("action").notNull(),
    feedback: text("feedback").notNull(),
    checklist: text("checklist").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_reviews_map").on(t.mapId, t.createdAt)],
);
export const featuredMaps = sqliteTable("featured_maps", {
  id: text("id").primaryKey(),
  body: text("body").notNull(),
  revision: integer("revision").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
  fileKey: text("file_key"),
  fileName: text("file_name").notNull().default(""),
  fileSize: integer("file_size").notNull().default(0),
  sha256: text("sha256").notNull().default(""),
  coverKey: text("cover_key"),
  coverType: text("cover_type"),
});
export const communityMods = sqliteTable(
  "community_mods",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id"),
    origin: text("origin").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull().default("pending"),
    revision: integer("revision").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    feedback: text("feedback").notNull().default(""),
    fileKey: text("file_key"),
    fileName: text("file_name").notNull().default(""),
    fileSize: integer("file_size").notNull().default(0),
    sha256: text("sha256").notNull().default(""),
    reviewToken: text("review_token"),
  },
  (t) => [
    index("idx_mods_owner_status").on(t.ownerId, t.status),
    index("idx_mods_status_created").on(t.status, t.createdAt),
  ],
);
export const modReviews = sqliteTable(
  "mod_reviews",
  {
    id: text("id").primaryKey(),
    modId: text("mod_id")
      .notNull()
      .references(() => communityMods.id),
    reviewerId: text("reviewer_id").notNull(),
    action: text("action").notNull(),
    feedback: text("feedback").notNull(),
    checklist: text("checklist").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_mod_reviews_mod").on(t.modId, t.createdAt)],
);
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    // SB1 (migration 0006, additive) : avatar optionnel du compte. Clé R2
    // dérivée de l'userId (avatars/<id>/avatar) ; NULL = repli initiales.
    // Rollback : revert du code — colonnes nullable, toutes les requêtes
    // existantes listent leurs colonnes explicitement.
    avatarKey: text("avatar_key"),
    avatarType: text("avatar_type"),
    // SB2 (migration 0007, additive) : préférence de langue du compte
    // (zh/en/fr, NULL = aucun choix). Le cookie device atlas_locale reste
    // prioritaire sur l'appareil courant ; cette colonne s'applique sur un
    // nouvel appareil sans cookie. Rollback : revert code (nullable, jamais
    // lue par les requêtes existantes à colonnes explicites).
    locale: text("locale"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("idx_users_email_nocase").on(sql`${t.email} COLLATE NOCASE`),
    // V2-P4 (audit dev-secu MAJEUR #1, migration 0009 additive) : unicité du
    // pseudo COLLATE NOCASE — le badge « créateur vérifié » (match exact
    // auteur ↔ displayName du compte) n'est plus forgeable en copiant le
    // pseudo d'un auteur connu. Un compte ne peut reprendre le pseudo d'un
    // autre, même en changeant la casse ASCII.
    uniqueIndex("idx_users_display_name_nocase").on(sql`${t.displayName} COLLATE NOCASE`),
  ],
);
export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("idx_sessions_user").on(t.userId), index("idx_sessions_expires").on(t.expiresAt)],
);
// Persisted brute-force counters for the auth endpoints, one row per live
// window, keyed by attempt identity ("email:<lower(email)>" or "ip:<ip>").
// Rows are deleted when their window resets, when the attempt succeeds, or
// opportunistically GC'd alongside other writes.
export const authAttempts = sqliteTable(
  "auth_attempts",
  {
    attemptKey: text("attempt_key").primaryKey(),
    windowStart: integer("window_start").notNull(),
    count: integer("count").notNull(),
  },
  (t) => [index("idx_auth_attempts_window").on(t.windowStart)],
);
// Site creators shown in the homepage banner. Photos live in R2; rows are
// managed exclusively by administrators.
export const creators = sqliteTable(
  "creators",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    role: text("role").notNull().default(""),
    photoKey: text("photo_key"),
    photoType: text("photo_type"),
    position: integer("position").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_creators_position").on(t.position, t.createdAt)],
);
// Chantier B (31/10/2026) — replays « récemment soumis » : un ligne par code
// de replay soumis après analyse. Le code est nu (11 caractères, sans le
// préfixe « rep- », cf. parseReplayCode) ; team_size/mvp_name/mode_key sont
// fournis par le client depuis le résultat d'analyse (aucun appel serveur
// vers games-api). Modération par le socle existant (pending → published /
// rejected ; retrait possible par l'auteur → withdrawn). created_at en ISO
// text comme maps (tri lexicographique = chronologique).
export const replays = sqliteTable(
  "replays",
  {
    code: text("code").primaryKey(),
    teamSize: integer("team_size").notNull(),
    mvpName: text("mvp_name"),
    modeKey: text("mode_key").notNull(),
    ownerId: text("owner_id").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: text("created_at").notNull(),
    moderatedAt: text("moderated_at"),
    note: text("note"),
  },
  (t) => [
    index("idx_replays_status_created").on(t.status, t.createdAt),
    index("idx_replays_owner_created").on(t.ownerId, t.createdAt),
  ],
);

// Replay phase 2 (31/10/2026, migration 0011 additive) — digest public par
// replay soumis : saison (calendaire mensuelle UTC, fallback documenté : pas
// de champ saison dans les données games-api), catégorie big/solo, horodatage
// de début, durée, région, top unités produites et joueurs (pseudo, victoire,
// MVP, unités tuées/perdues). Écrit à la soumission (client qui a parsé le
// replay), consommé à la publication pour l'agrégation incrémentale.
// aggregated_at = garde-fou d'idempotence (contribution actuellement appliquée
// dans player_stats).
export const replayResults = sqliteTable(
  "replay_results",
  {
    code: text("code").primaryKey(),
    season: text("season").notNull(),
    category: text("category").notNull(),
    startedAt: text("started_at").notNull(),
    durationS: integer("duration_s").notNull(),
    modeKey: text("mode_key").notNull(),
    teamSize: integer("team_size").notNull(),
    region: text("region"),
    mapCode: text("map_code"),
    data: text("data").notNull(),
    updatedAt: text("updated_at").notNull(),
    aggregatedAt: text("aggregated_at"),
  },
  (t) => [index("idx_replay_results_season").on(t.season)],
);

// Classement joueurs par saison/catégorie (agrégation incrémentale à la
// publication d'un replay ; formule de points documentée dans
// lib/replay-stats.ts : participation×1 + victoire×2 + MVP×2 + ⌊tués/100⌋).
// Rebuildable intégralement depuis replays × replay_results.
export const playerStats = sqliteTable(
  "player_stats",
  {
    season: text("season").notNull(),
    category: text("category").notNull(),
    playerName: text("player_name").notNull(),
    games: integer("games").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    mvps: integer("mvps").notNull().default(0),
    kills: integer("kills").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    points: integer("points").notNull().default(0),
    lastPlayed: text("last_played").notNull(),
  },
  (t) => [uniqueIndex("pk_player_stats").on(t.season, t.category, t.playerName)],
);
