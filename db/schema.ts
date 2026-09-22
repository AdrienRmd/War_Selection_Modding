// Drizzle schema for WS ATLAS. Defines the D1 tables — maps, reviews,
// featured_maps, community_mods, mod_reviews, users, sessions — plus their
// indexes. Drizzle is only used to generate the SQL migrations in drizzle/;
// the runtime reads and writes through hand-written, parameterized D1 SQL,
// not the query builder.
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
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("idx_users_email_nocase").on(sql`${t.email} COLLATE NOCASE`)],
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
