import { beforeEach, describe, expect, it, vi } from "vitest";

// V2-P3 — SB4b : suppression de compte self-service (DELETE /api/account).
// Politique arbitrée : créations publiées CONSERVÉES (author_verified → 0,
// aucun nom réécrit), soumissions en attente PURGÉES avec leurs fichiers,
// sessions purgées (session morte testée), user + avatar purgés, email
// effacé des compteurs de throttling. Journal minimal sans PII.

const { envStub } = vi.hoisted(() => ({
  envStub: {} as Record<string, unknown>,
}));

vi.mock("cloudflare:workers", () => ({ env: envStub }));

import { DELETE } from "@/app/api/account/route";
import { sessionUserByToken } from "@/lib/auth-server";
import { avatarKeyFor } from "@/lib/profile";
import type { MapRecord } from "@/lib/atlas-server";
import type { ModRecord } from "@/lib/mod-types";

const ORIGIN = "http://localhost:8787";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const EMAIL = "ada@example.test";
const TOKEN = "session-token-123";

function mapRow(id: string, status: string, overrides: Partial<MapRecord> = {}): MapRecord {
  return {
    id,
    owner_id: USER_ID,
    author: "Ada Code",
    title: `Carte ${id}`,
    summary: "résumé",
    description: "description",
    game_version: "v42",
    players: 8,
    category: "历史战役",
    mods: "无",
    map_code: "",
    status,
    file_name: "carte.zip",
    file_key: `submissions/${id}/map.zip`,
    file_size: 1024,
    sha256: "a".repeat(64),
    cover_key: null,
    cover_type: null,
    created_at: "2026-10-01T00:00:00Z",
    reviewed_at: null,
    feedback: "",
    revision: 1,
    test_status: "untested",
    test_updated_at: null,
    test_set_by: null,
    test_notes: "",
    author_verified: 1,
    ...overrides,
  };
}

function modRow(id: string, status: string, overrides: Partial<ModRecord> = {}): ModRecord {
  return {
    id,
    owner_id: USER_ID,
    origin: "community",
    body: "{}",
    status,
    revision: 0,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    feedback: "",
    file_key: `mods/${id}/mod.zip`,
    file_name: "mod.zip",
    file_size: 2048,
    sha256: "b".repeat(64),
    review_token: null,
    ...overrides,
  };
}

interface State {
  users: {
    id: string;
    email: string;
    display_name: string;
    avatar_key: string | null;
    avatar_type: string | null;
    locale: string | null;
  }[];
  sessions: { token_hash: string; user_id: string; expires_at: number; created_at: number }[];
  auth_attempts: { attempt_key: string; window_start: number; count: number }[];
  maps: MapRecord[];
  reviews: { id: string; map_id: string }[];
  community_mods: ModRecord[];
  mod_reviews: { id: string; mod_id: string }[];
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}

function makeDb(state: State, log: { sql: string[] }) {
  const norm = (sql: string) => sql.replace(/\s+/g, " ").trim();
  const exec = (rawSql: string, args: unknown[]) => {
    const sql = norm(rawSql);
    return {
      first: async () => {
        if (sql.includes("FROM sessions s JOIN users u")) {
          const session = state.sessions.find((s) => s.token_hash === args[0]);
          if (!session || session.expires_at <= (args[1] as number)) return null;
          return state.users
            .filter((u) => u.id === session.user_id)
            .map((u) => ({
              user_id: u.id,
              display_name: u.display_name,
              email: u.email,
              avatar_key: u.avatar_key,
              avatar_type: u.avatar_type,
              locale: u.locale,
            }))[0] ?? null;
        }
        return null;
      },
      all: async () => {
        if (sql.includes("FROM maps WHERE file_key IN")) {
          const keys = new Set(args as string[]);
          const k = [
            ...new Set(
              state.maps.flatMap((m) => [m.file_key, m.cover_key]).filter((key): key is string => !!key && keys.has(key)),
            ),
          ];
          return { results: k.map((key) => ({ k: key })) };
        }
        if (sql.includes("FROM community_mods WHERE file_key IN")) {
          const keys = new Set(args as string[]);
          const k = [
            ...new Set(
              state.community_mods
                .map((m) => m.file_key)
                .filter((key): key is string => !!key && keys.has(key)),
            ),
          ];
          return { results: k.map((key) => ({ k: key })) };
        }
        if (sql.includes("SELECT id, file_key, cover_key FROM maps WHERE owner_id = ?"))
          return {
            results: state.maps
              .filter((m) => m.owner_id === args[0] && m.status !== "approved")
              .map((m) => ({ id: m.id, file_key: m.file_key, cover_key: m.cover_key })),
          };
        if (sql.includes("SELECT id, file_key FROM community_mods WHERE owner_id = ?"))
          return {
            results: state.community_mods
              .filter(
                (m) =>
                  m.owner_id === args[0] &&
                  m.origin === "community" &&
                  m.status !== "approved",
              )
              .map((m) => ({ id: m.id, file_key: m.file_key })),
          };
        return { results: [] };
      },
      run: async () => {
        log.sql.push(sql);
        let changes = 0;
        if (sql.startsWith("UPDATE maps SET author_verified = 0")) {
          let n = 0;
          for (const m of state.maps)
            if (m.owner_id === args[0] && m.status === "approved") {
              m.author_verified = 0;
              n++;
            }
          changes = n;
        } else if (sql.startsWith("DELETE FROM reviews WHERE map_id IN")) {
          const doomed = new Set(
            state.maps
              .filter((m) => m.owner_id === args[0] && m.status !== "approved")
              .map((m) => m.id),
          );
          const before = state.reviews.length;
          state.reviews = state.reviews.filter((r) => !doomed.has(r.map_id));
          changes = before - state.reviews.length;
        } else if (sql.startsWith("DELETE FROM maps WHERE owner_id = ?")) {
          const before = state.maps.length;
          state.maps = state.maps.filter(
            (m) => !(m.owner_id === args[0] && m.status !== "approved"),
          );
          changes = before - state.maps.length;
        } else if (sql.startsWith("DELETE FROM mod_reviews WHERE mod_id IN")) {
          const doomed = new Set(
            state.community_mods
              .filter(
                (m) =>
                  m.owner_id === args[0] &&
                  m.origin === "community" &&
                  m.status !== "approved",
              )
              .map((m) => m.id),
          );
          const before = state.mod_reviews.length;
          state.mod_reviews = state.mod_reviews.filter((r) => !doomed.has(r.mod_id));
          changes = before - state.mod_reviews.length;
        } else if (
          sql.startsWith(
            "DELETE FROM community_mods WHERE owner_id = ? AND origin = 'community' AND status != 'approved'",
          )
        ) {
          const before = state.community_mods.length;
          state.community_mods = state.community_mods.filter(
            (m) =>
              !(
                m.owner_id === args[0] &&
                m.origin === "community" &&
                m.status !== "approved"
              ),
          );
          changes = before - state.community_mods.length;
        } else if (sql.startsWith("DELETE FROM sessions WHERE user_id = ?")) {
          const before = state.sessions.length;
          state.sessions = state.sessions.filter((s) => s.user_id !== args[0]);
          changes = before - state.sessions.length;
        } else if (sql.startsWith("DELETE FROM auth_attempts WHERE attempt_key IN")) {
          const doomed = new Set(args as string[]);
          const before = state.auth_attempts.length;
          state.auth_attempts = state.auth_attempts.filter((a) => !doomed.has(a.attempt_key));
          changes = before - state.auth_attempts.length;
        } else if (sql.startsWith("DELETE FROM users WHERE id = ?")) {
          const before = state.users.length;
          state.users = state.users.filter((u) => u.id !== args[0]);
          changes = before - state.users.length;
        }
        return { meta: { changes } };
      },
    };
  };
  return {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return exec(sql, args);
        },
      };
    },
    async batch(statements: { run: () => Promise<{ meta: { changes: number } }> }[]) {
      const results = [];
      for (const s of statements) results.push(await s.run());
      return results;
    },
  };
}

function makeBucket() {
  return {
    deletes: [] as (string | string[])[],
    async put() {},
    async delete(keys: string | string[]) {
      this.deletes.push(keys);
    },
    async get() {
      return null;
    },
  };
}

let state: State;
let bucket: ReturnType<typeof makeBucket>;

async function baseState() {
  state = {
    users: [
      {
        id: USER_ID,
        email: EMAIL,
        display_name: "Ada Code",
        avatar_key: avatarKeyFor(USER_ID),
        avatar_type: "image/png",
        locale: null,
      },
      {
        id: "autre",
        email: "autre@example.test",
        display_name: "Autre",
        avatar_key: null,
        avatar_type: null,
        locale: null,
      },
    ],
    sessions: [
      { token_hash: await sha256Hex(TOKEN), user_id: USER_ID, expires_at: Date.now() + 60000, created_at: Date.now() },
      { token_hash: "hash-autre", user_id: "autre", expires_at: Date.now() + 60000, created_at: Date.now() },
    ],
    auth_attempts: [
      { attempt_key: `email:${EMAIL}`, window_start: 0, count: 1 },
      { attempt_key: `profile:${USER_ID}`, window_start: 0, count: 1 },
      { attempt_key: "email:autre@example.test", window_start: 0, count: 1 },
    ],
    // 2 cartes publiées (conservées) + 1 pending (purgée) + 1 rejected
    // (non publique, purgée) + 1 carte d'AUTRUI (jamais touchée).
    maps: [
      mapRow("approved-1", "approved"),
      mapRow("approved-2", "approved", { author_verified: 1 }),
      mapRow("pending-1", "pending"),
      mapRow("rejected-1", "rejected"),
      mapRow("autre", "pending", { owner_id: "autre", author: "Autre" }),
    ],
    reviews: [
      { id: "rv-approved", map_id: "approved-1" },
      { id: "rv-pending", map_id: "pending-1" },
      { id: "rv-autre", map_id: "autre" },
    ],
    // 1 mod publié (conservé) + 1 pending (purgé) + 1 éditorial (jamais
    // touché : contenu du site) + 1 mod d'autrui (jamais touché).
    community_mods: [
      modRow("mod-ok", "approved"),
      modRow("mod-pending", "pending"),
      modRow("mod-editorial", "approved", { origin: "editorial", owner_id: "site" }),
      modRow("mod-autre", "pending", { owner_id: "autre" }),
    ],
    mod_reviews: [
      { id: "mrv-ok", mod_id: "mod-ok" },
      { id: "mrv-pending", mod_id: "mod-pending" },
      { id: "mrv-autre", mod_id: "mod-autre" },
    ],
  };
}

const request = (confirm: string, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}/api/account`, {
    method: "DELETE",
    headers: { origin: ORIGIN, "content-type": "application/json", cookie: `atlas_session=${TOKEN}`, ...headers },
    body: JSON.stringify({ confirm }),
  });

beforeEach(async () => {
  vi.clearAllMocks();
  await baseState();
  envStub.DB = makeDb(state, { sql: [] });
  bucket = makeBucket();
  envStub.BUCKET = bucket;
});

describe("SB4b — DELETE /api/account (politique orchestrateur)", () => {
  it("suppression complète : publiées conservées (author_verified→0, auteur intact), pending purgées + R2, sessions/user/avatar/email purgés", async () => {
    const journal = vi.spyOn(console, "log").mockImplementation(() => {});
    const r = await DELETE(request("Ada Code"));
    expect(r.status).toBe(200);
    expect((await r.json() as { ok?: boolean }).ok).toBe(true);

    // Comptes : le sien purgé, celui d'autrui intact.
    expect(state.users.map((u) => u.id)).toEqual(["autre"]);
    // Sessions : toutes celles du compte purgées (l'autre compte intact).
    expect(state.sessions.map((s) => user_id(s))).toEqual(["autre"]);
    // Cartes publiées conservées, auteur historique inchangé, badge retombé.
    const kept = state.maps.filter((m) => m.owner_id === USER_ID);
    expect(kept.map((m) => m.id).sort()).toEqual(["approved-1", "approved-2"]);
    for (const m of kept) {
      expect(m.author).toBe("Ada Code");
      expect(m.author_verified).toBe(0);
    }
    // Pending/rejected purgées + reviews associées ; carte d'autrui intacte.
    expect(state.maps.map((m) => m.id).sort()).toEqual(
      ["approved-1", "approved-2", "autre"].sort(),
    );
    expect(state.reviews.map((rv) => rv.id).sort()).toEqual(["rv-approved", "rv-autre"].sort());
    // Mods : publié conservé, pending purgé (+ review), éditorial et autrui
    // intacts.
    expect(state.community_mods.map((m) => m.id).sort()).toEqual(
      ["mod-ok", "mod-editorial", "mod-autre"].sort(),
    );
    expect(state.mod_reviews.map((m) => m.id).sort()).toEqual(["mrv-ok", "mrv-autre"].sort());
    // R2 : fichiers des pending (carte + mod) + avatar purgés — jamais les
    // fichiers des créations conservées ni ceux d'autrui.
    const purged = bucket.deletes.flatMap((d) => d).sort();
    expect(purged).toEqual(
      [
        `submissions/pending-1/map.zip`,
        `submissions/rejected-1/map.zip`,
        `mods/mod-pending/mod.zip`,
        avatarKeyFor(USER_ID),
      ].sort(),
    );
    // Email effacé des compteurs de throttling (jamais réapparu).
    expect(state.auth_attempts.map((a) => a.attempt_key)).toEqual(["email:autre@example.test"]);
    // Journal minimal sans PII (ni email ni pseudo).
    const logged = journal.mock.calls.map((c) => c.map(String).join(" ")).join("\n");
    expect(logged).toContain(USER_ID);
    expect(logged).not.toContain(EMAIL);
    expect(logged).not.toContain("Ada Code");
    journal.mockRestore();
  });

  it("la session est morte après suppression (sessionUserByToken → null)", async () => {
    await DELETE(request("Ada Code"));
    expect(await sessionUserByToken(TOKEN)).toBeNull();
  });

  it("cookie de session effacé dans la réponse (Set-Cookie Max-Age=0)", async () => {
    const r = await DELETE(request("Ada Code"));
    const cookie = r.headers.get("set-cookie") || "";
    expect(cookie).toContain("atlas_session=");
    expect(cookie).toContain("Max-Age=0");
  });

  it("confirmation erronée → 400 : RIEN n'est purgé", async () => {
    const r = await DELETE(request("Mauvais Pseudo"));
    expect(r.status).toBe(400);
    expect((await r.json() as { error?: string }).error).toBe("确认输入与账号昵称不一致。");
    expect(state.users).toHaveLength(2);
    expect(state.maps).toHaveLength(5);
    expect(state.sessions).toHaveLength(2);
    expect(bucket.deletes).toHaveLength(0);
  });

  it("anonyme (pas de session) → 401 sans rien toucher", async () => {
    const r = await DELETE(
      new Request(`${ORIGIN}/api/account`, {
        method: "DELETE",
        headers: { origin: ORIGIN, "content-type": "application/json" },
        body: JSON.stringify({ confirm: "Ada Code" }),
      }),
    );
    expect(r.status).toBe(401);
    expect(state.users).toHaveLength(2);
  });

  it("session expirée → 401 (session morte = compte inaccessible)", async () => {
    state.sessions = state.sessions.map((s) => ({ ...s, expires_at: 1 }));
    const r = await DELETE(request("Ada Code"));
    expect(r.status).toBe(401);
    expect(state.users).toHaveLength(2);
  });

  it("origine croisée → 403 (garde CSRF sameOrigin des mutations existantes)", async () => {
    const r = await DELETE(
      new Request(`${ORIGIN}/api/account`, {
        method: "DELETE",
        headers: {
          origin: "https://evil.example",
          "content-type": "application/json",
          cookie: `atlas_session=${TOKEN}`,
        },
        body: JSON.stringify({ confirm: "Ada Code" }),
      }),
    );
    expect(r.status).toBe(403);
    expect(state.users).toHaveLength(2);
  });

  it("l'identité ne vient jamais du corps : userId absent du JSON, seul le compte de session est ciblé", async () => {
    const r = await DELETE(
      new Request(`${ORIGIN}/api/account`, {
        method: "DELETE",
        headers: {
          origin: ORIGIN,
          "content-type": "application/json",
          cookie: `atlas_session=${TOKEN}`,
        },
        body: JSON.stringify({ confirm: "Ada Code", userId: "autre", email: "autre@example.test" }),
      }),
    );
    expect(r.status).toBe(200);
    // Le compte « autre » n'a pas été supprimé malgré le corps forgé.
    expect(state.users.map((u) => u.id)).toEqual(["autre"]);
  });
});

function user_id(s: { user_id: string }): string {
  return s.user_id;
}
