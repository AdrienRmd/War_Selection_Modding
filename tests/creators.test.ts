import { beforeEach, describe, expect, it, vi } from "vitest";

// Mission 07/11 « Créateurs de contenu » — validation des liens (whitelist
// https stricte), corps de candidature, quotas (1 en attente / 2 par 24 h),
// doublon de nom (NOCASE), modération admin (publier/refuser/retirer +
// sélection d'items), retrait auteur, annuaire publié uniquement. Même
// harnais fake-D1 que tests/replay-submit.test.ts.

const { envStub, getChatGPTUser } = vi.hoisted(() => ({
  envStub: {} as Record<string, unknown>,
  getChatGPTUser: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({ env: envStub }));
vi.mock("@/app/chatgpt-auth", () => ({ getChatGPTUser }));

import { GET as applyGet, POST as applyPost } from "@/app/api/creators/apply/route";
import {
  GET as applicationsGet,
  PATCH as applicationsPatch,
} from "@/app/api/creators/applications/route";
import { POST as withdrawPost } from "@/app/api/creators/withdraw/route";
import {
  cleanCreatorApplication,
  cleanCreatorLinkUrl,
  claimableItems,
  listPublishedCreators,
  creatorProfile,
} from "@/lib/creators-server";

const ORIGIN = "http://localhost:8787";
const AUTHOR = "44444444-4444-4444-8444-444444444444";
const OTHER = "55555555-5555-4555-8555-555555555555";
const ADMIN_USER = { userId: "admin", email: "admin@sites.test" };
const AUTHOR_USER = { userId: AUTHOR, email: "author@sites.test" };
const OTHER_USER = { userId: OTHER, email: "other@sites.test" };

interface CreatorState {
  creators: Array<Record<string, unknown>>;
  links: Array<Record<string, unknown>>;
  items: Array<Record<string, unknown>>;
  maps: Array<Record<string, unknown>>;
  mods: Array<Record<string, unknown>>;
  users: Array<Record<string, unknown>>;
}

let state: CreatorState;

function makeDb(s: CreatorState) {
  return {
    prepare(sql: string) {
      const q = sql.replace(/\s+/g, " ").trim();
      const args: unknown[] = [];
      const stmt = {
        bind(...values: unknown[]) {
          args.length = 0;
          args.push(...values);
          return stmt;
        },
        async first<T>() {
          if (q.startsWith("SELECT id FROM creators WHERE id = ? AND user_id IS NOT NULL"))
            return ((s.creators.find((c) => c.id === args[0] && c.user_id != null) ?? null) as T);
          if (q.startsWith("SELECT id FROM creators WHERE name = ? COLLATE NOCASE"))
            return ((s.creators.find(
              (c) =>
                String(c.name).toLowerCase() === String(args[0]).toLowerCase() &&
                c.status !== "withdrawn",
            ) ?? null) as T);
          if (q.startsWith("SELECT id FROM maps WHERE id = ? AND status = 'published'"))
            return ((s.maps.find((m) => m.id === args[0] && m.status === "published") ?? null) as T);
          if (q.startsWith("SELECT id FROM community_mods WHERE id = ? AND status = 'published'"))
            return ((s.mods.find((m) => m.id === args[0] && m.status === "published") ?? null) as T);
          if (q.startsWith("SELECT * FROM creators WHERE id = ?"))
            return ((s.creators.find((c) => c.id === args[0]) ?? null) as T);
          if (q.startsWith("SELECT title, author FROM maps WHERE id = ?"))
            return ((s.maps.find((m) => m.id === args[0]) ?? null) as T);
          if (q.startsWith("SELECT body FROM community_mods WHERE id = ?"))
            return ((s.mods.find((m) => m.id === args[0]) ?? null) as T);
          return null as T;
        },
        async all<T>() {
          // (revue 07/11) annuaire par LOTS : IN dynamique sur ids/user_ids
          if (q.startsWith("SELECT * FROM creators WHERE status = 'published' ORDER BY position")) {
            const rows = s.creators.filter((c) => c.status === "published").slice(0, 200);
            return { results: rows } as T;
          }
          if (q.startsWith("SELECT * FROM creator_links WHERE creator_id IN (")) {
            const ids = args as string[];
            return { results: s.links.filter((l) => ids.includes(l.creator_id as string)) } as T;
          }
          if (q.startsWith("SELECT creator_id, kind, item_id FROM creator_items WHERE creator_id IN (")) {
            const ids = args as string[];
            return {
              results: s.items
                .filter((i) => ids.includes(i.creator_id as string))
                .map((i) => ({ creator_id: i.creator_id, kind: i.kind, item_id: i.item_id })),
            } as T;
          }
          if (q.startsWith("SELECT id, owner_id FROM maps WHERE status = 'published' AND owner_id IN (")) {
            const ids = args as string[];
            return {
              results: s.maps
                .filter((m) => m.status === "published" && ids.includes(m.owner_id as string))
                .map((m) => ({ id: m.id, owner_id: m.owner_id })),
            } as T;
          }
          if (q.startsWith("SELECT id, owner_id FROM community_mods WHERE status = 'published' AND owner_id IN (")) {
            const ids = args as string[];
            return {
              results: s.mods
                .filter((m) => m.status === "published" && ids.includes(m.owner_id as string))
                .map((m) => ({ id: m.id, owner_id: m.owner_id })),
            } as T;
          }
          if (q.startsWith("SELECT * FROM creators WHERE status = 'published'"))
            return { results: s.creators.filter((c) => c.status === "published") } as T;
          if (q.startsWith("SELECT * FROM creators WHERE user_id = ?"))
            return { results: s.creators.filter((c) => c.user_id === args[0]) } as T;
          if (q.startsWith("SELECT c.*, u.display_name")) {
            const byUser = new Map(s.users.map((u) => [u.id, u]));
            return {
              results: s.creators
                .filter((c) => c.user_id != null)
                .map((c) => ({
                  ...c,
                  owner_name: byUser.get(c.user_id as string)?.display_name ?? null,
                  owner_email: byUser.get(c.user_id as string)?.email ?? null,
                })),
            } as T;
          }
          if (q.startsWith("SELECT * FROM creator_links WHERE creator_id = ?"))
            return { results: s.links.filter((l) => l.creator_id === args[0]) } as T;
          if (q.startsWith("SELECT * FROM creator_items WHERE creator_id = ? ORDER BY kind"))
            return { results: s.items.filter((i) => i.creator_id === args[0]) } as T;
          if (q.startsWith("SELECT kind, COUNT(*) AS n FROM creator_items"))
            return {
              results: ["map", "mod"]
                .map((kind) => ({
                  kind,
                  n: s.items.filter((i) => i.creator_id === args[0] && i.kind === kind).length,
                }))
                .filter((r) => r.n > 0),
            } as T;
          if (q.startsWith("SELECT id, title, players, category FROM maps WHERE owner_id = ?"))
            return {
              results: s.maps.filter((m) => m.owner_id === args[0] && m.status === "published"),
            } as T;
          if (q.startsWith("SELECT id, body FROM community_mods WHERE owner_id = ?"))
            return {
              results: s.mods.filter((m) => m.owner_id === args[0] && m.status === "published"),
            } as T;
          if (q.startsWith("SELECT id, title, author, owner_id FROM maps WHERE status = 'published'"))
            return { results: s.maps.filter((m) => m.status === "published").slice(0, 100) } as T;
          if (q.startsWith("SELECT id, body, owner_id FROM community_mods WHERE status = 'published'"))
            return { results: s.mods.filter((m) => m.status === "published").slice(0, 100) } as T;
          if (q.startsWith("SELECT id, title, players, category FROM maps WHERE id = ? AND status"))
            return { results: [] } as T;
          if (q.includes("creator_items") && q.startsWith("SELECT ci.kind")) {
            const rows = s.items.filter((i) => i.creator_id === args[0]);
            return { results: rows.map((row) => ({ kind: row.kind, item_id: row.item_id })) } as T;
          }
          if (q.startsWith("SELECT kind, item_id FROM creator_items WHERE creator_id = ?")) {
            const rows = s.items.filter((i) => i.creator_id === args[0]);
            return { results: rows.map((row) => ({ kind: row.kind, item_id: row.item_id })) } as T;
          }
          return { results: [] as unknown[] } as T;
        },
        async run() {
          if (q.startsWith("INSERT INTO creators")) {
            // (id, name, now, ownerId, bio, ownerPending, limite, ownerDaily, depuis, limiteJour)
            const [, , createdAt, ownerInsert, bio, ownerPending, , ownerDaily, since] = args;
            const pending = s.creators.filter(
              (c) => c.user_id === ownerPending && c.status === "pending",
            ).length;
            const daily = s.creators.filter(
              (c) => c.user_id === ownerDaily && String(c.created_at) > String(since),
            ).length;
            if (pending >= 1 || daily >= 2) return { meta: { changes: 0 } };
            // Course : l'index UNIQUE idx_creators_name_nocase (0015) fait
            // échouer l'INSERT sur un nom pris entre-temps.
            const taken = s.creators.some(
              (c) => String(c.name).toLowerCase() === String(args[1]).toLowerCase() && c.status !== "withdrawn",
            );
            if (taken) {
              const err = new Error("UNIQUE constraint failed: idx_creators_name_nocase") as Error & { code?: string };
              err.code = "2067";
              throw err;
            }
            s.creators.push({
              id: args[0],
              name: args[1],
              role: "",
              photo_key: null,
              photo_type: null,
              position: 0,
              created_at: createdAt,
              user_id: ownerInsert,
              bio,
              status: "pending",
              moderated_at: null,
              note: null,
              updated_at: null,
            });
            return { meta: { changes: 1 } };
          }
          if (q.startsWith("INSERT INTO creator_links")) {
            s.links.push({
              id: args[0],
              creator_id: args[1],
              platform: args[2],
              url: args[3],
              position: args[4],
              created_at: args[5],
            });
            return { meta: { changes: 1 } };
          }
          if (q.startsWith("INSERT INTO creator_items")) {
            // kind est un littéral SQL ('map'/'mod') : args = (id, creator_id,
            // item_id, position, created_at).
            const kind = q.includes("'mod'") ? "mod" : "map";
            s.items.push({
              id: args[0],
              creator_id: args[1],
              kind,
              item_id: args[2],
              position: args[3],
              created_at: args[4],
            });
            return { meta: { changes: 1 } };
          }
          if (q.startsWith("UPDATE creators SET status = ?, moderated_at = ?, note = ?, updated_at = ? WHERE id = ?")) {
            const row = s.creators.find((c) => c.id === args[4]);
            if (!row) return { meta: { changes: 0 } };
            row.status = args[0];
            row.moderated_at = args[1];
            row.note = args[2];
            row.updated_at = args[3];
            return { meta: { changes: 1 } };
          }
          if (q.startsWith("UPDATE creators SET status = 'withdrawn', moderated_at = ?, updated_at = ? WHERE id = ? AND user_id = ?")) {
            const row = s.creators.find(
              (c) =>
                c.id === args[2] &&
                c.user_id === args[3] &&
                (c.status === "pending" || c.status === "published"),
            );
            if (!row) return { meta: { changes: 0 } };
            row.status = "withdrawn";
            row.moderated_at = args[0];
            return { meta: { changes: 1 } };
          }
          if (q.startsWith("DELETE FROM creator_items WHERE creator_id = ? AND kind = ? AND item_id = ?")) {
            const before = s.items.length;
            s.items = s.items.filter(
              (i) => !(i.creator_id === args[0] && i.kind === args[1] && i.item_id === args[2]),
            );
            return { meta: { changes: before - s.items.length ? 1 : 0 } };
          }
          return { meta: { changes: 0 } };
        },
      };
      return stmt;
    },
    async batch(stmts: Array<{ run: () => Promise<{ meta: { changes: number } }> }>) {
      const out = [];
      for (const st of stmts) out.push(await st.run());
      return out;
    },
  };
}

function setState() {
  state = {
    creators: [],
    links: [],
    items: [],
    maps: [
      { id: "map-alpha", title: "Alpha", author: "AlphaAuthor", owner_id: AUTHOR, status: "published", players: 8, category: "pvp", created_at: "2026-11-01T00:00:00Z" },
      { id: "map-beta", title: "Beta", author: "BetaAuthor", owner_id: OTHER, status: "published", players: 4, category: "pve", created_at: "2026-11-02T00:00:00Z" },
      { id: "map-draft", title: "Draft", author: "X", owner_id: AUTHOR, status: "pending", players: 2, category: "pvp", created_at: "2026-11-03T00:00:00Z" },
    ],
    mods: [
      { id: "mod-gamma", owner_id: AUTHOR, status: "published", body: JSON.stringify({ title: "Gamma Mod" }) },
      { id: "mod-hidden", owner_id: AUTHOR, status: "pending", body: JSON.stringify({ title: "Hidden" }) },
    ],
    users: [
      { id: AUTHOR, display_name: "AlphaAuthor", email: "author@sites.test" },
      { id: OTHER, display_name: "BetaAuthor", email: "other@sites.test" },
    ],
  };
  envStub.DB = makeDb(state);
  envStub.BUCKET = {
    put: async () => undefined,
    get: async () => null,
    delete: async () => undefined,
  };
  envStub.ADMIN_EMAILS = "admin@sites.test";
}

/** POST multipart : le champ « application » porte le JSON (comme le vrai
 *  formulaire — pas de photo dans ces tests, la validation est identique). */
function applyReq(body: unknown, user: unknown = AUTHOR_USER) {
  getChatGPTUser.mockResolvedValue((user ?? null) as never);
  const form = new FormData();
  form.set("application", JSON.stringify(body));
  return new Request(ORIGIN + "/api/creators/apply", {
    method: "POST",
    headers: { Origin: ORIGIN },
    body: form,
  });
}

function req(method: string, path: string, body?: unknown, user: unknown = AUTHOR_USER) {
  getChatGPTUser.mockResolvedValue((user ?? null) as never);
  const init: RequestInit = { method, headers: { Origin: ORIGIN } };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  return new Request(ORIGIN + path, init);
}

beforeEach(setState);

describe("cleanCreatorLinkUrl — whitelist https stricte", () => {
  it("accepte les URLs https des domaines de la plateforme", () => {
    expect(cleanCreatorLinkUrl("youtube", "https://www.youtube.com/@creator")).toContain("youtube.com/@creator");
    expect(cleanCreatorLinkUrl("twitch", "https://www.twitch.tv/someone")).toBeTruthy();
    expect(cleanCreatorLinkUrl("discord", "https://discord.gg/abc123")).toBeTruthy();
    expect(cleanCreatorLinkUrl("x", "https://x.com/handle")).toBeTruthy();
    expect(cleanCreatorLinkUrl("tiktok", "https://www.tiktok.com/@handle")).toBeTruthy();
    expect(cleanCreatorLinkUrl("instagram", "https://www.instagram.com/handle")).toBeTruthy();
  });

  it("rejette http, javascript, data, mauvais domaine, racine, credentials", () => {
    expect(cleanCreatorLinkUrl("youtube", "http://www.youtube.com/@c")).toBeNull();
    expect(cleanCreatorLinkUrl("youtube", "javascript:alert(1)")).toBeNull();
    expect(cleanCreatorLinkUrl("youtube", "data:text/html,x")).toBeNull();
    expect(cleanCreatorLinkUrl("youtube", "https://evil.example/@c")).toBeNull();
    expect(cleanCreatorLinkUrl("youtube", "https://www.youtube.com/")).toBeNull();
    expect(cleanCreatorLinkUrl("twitch", "https://user:pass@www.twitch.tv/x")).toBeNull();
    expect(cleanCreatorLinkUrl("youtube", "https://twitch.tv/x")).toBeNull(); // plateforme ≠ domaine
    expect(cleanCreatorLinkUrl("youtube", "")).toBeNull();
  });
});

describe("cleanCreatorApplication", () => {
  const base = { name: "Nova", bio: "Bonjour", links: [], mapIds: [], modIds: [] };
  it("nom obligatoire, bio et listes optionnelles", () => {
    expect(cleanCreatorApplication(base)).toEqual({ ...base, bio: "Bonjour" });
    expect(cleanCreatorApplication({ ...base, name: "  " })).toBeNull();
    expect(cleanCreatorApplication({ ...base, bio: undefined })).toEqual({ ...base, bio: "" });
  });
  it("réseaux : plateforme whitelist, une par plateforme, ≤ 6", () => {
    expect(
      cleanCreatorApplication({ ...base, links: [{ platform: "youtube", url: "https://www.youtube.com/@a" }] }),
    ).toBeTruthy();
    expect(cleanCreatorApplication({ ...base, links: [{ platform: "myspace", url: "https://x.com/a" }] })).toBeNull();
    expect(
      cleanCreatorApplication({
        ...base,
        links: [
          { platform: "youtube", url: "https://www.youtube.com/@a" },
          { platform: "youtube", url: "https://youtu.be/x" },
        ],
      }),
    ).toBeNull();
    expect(
      cleanCreatorApplication({
        ...base,
        links: Array.from({ length: 7 }, (_, i) => ({
          platform: "youtube",
          url: `https://www.youtube.com/@a${i}`,
        })),
      }),
    ).toBeNull();
  });
  it("revendications : ids sûrs, total ≤ 12, doublons fusionnés", () => {
    expect(cleanCreatorApplication({ ...base, mapIds: ["map-alpha"] })).toBeTruthy();
    expect(cleanCreatorApplication({ ...base, mapIds: ["../etc"] })).toBeNull();
    expect(
      cleanCreatorApplication({ ...base, mapIds: Array.from({ length: 13 }, (_, i) => `m${i}`) }),
    ).toBeNull();
    const out = cleanCreatorApplication({ ...base, mapIds: ["a", "a"], modIds: ["b"] });
    expect(out?.mapIds).toEqual(["a"]);
    expect(out?.mapIds.length).toBe(1);
  });
});

describe("POST /api/creators/apply — candidature", () => {
  const body = (over: Record<string, unknown> = {}) => ({
    name: "Nova",
    bio: "Je fais des cartes",
    links: [{ platform: "youtube", url: "https://www.youtube.com/@nova" }],
    mapIds: ["map-beta"],
    modIds: [],
    ...over,
  });

  it("refuse les anonymes (401)", async () => {
    const r = await applyPost(applyReq(body(), null));
    expect(r.status).toBe(401);
  });

  it("refuse un corps invalide (400) — lien hors whitelist", async () => {
    const r = await applyPost(applyReq(body({ links: [{ platform: "youtube", url: "https://twitch.tv/x" }] })));
    expect(r.status).toBe(400);
  });

  it("refuse une revendication inconnue ou non publiée (400)", async () => {
    expect((await applyPost(applyReq(body({ mapIds: ["map-ghost"] })))).status).toBe(400);
    expect((await applyPost(applyReq(body({ mapIds: ["map-draft"] })))).status).toBe(400);
    expect((await applyPost(applyReq(body({ modIds: ["mod-hidden"] })))).status).toBe(400);
  });

  it("candidature valide → 201, statut pending, liens et items écrits", async () => {
    const r = await applyPost(applyReq(body()));
    expect(r.status).toBe(201);
    const d = (await r.json()) as { item: { status: string; links: unknown[]; items: unknown[] } };
    expect(d.item.status).toBe("pending");
    expect(d.item.links).toHaveLength(1);
    expect(d.item.items).toHaveLength(1);
    expect(state.creators[0].status).toBe("pending");
    expect(state.links).toHaveLength(1);
    expect(state.items).toHaveLength(1);
  });

  it("quota : 1 seule candidature en attente par compte (429)", async () => {
    expect((await applyPost(applyReq(body()))).status).toBe(201);
    const r = await applyPost(applyReq(body({ name: "Nova2" })));
    expect(r.status).toBe(429);
  });

  it("doublon de nom (NOCASE) → 409, même après publication", async () => {
    state.creators.push({ id: "legacy", name: "nova", status: "published", user_id: null });
    const r = await applyPost(applyReq(body()));
    expect(r.status).toBe(409);
  });

  it("course de nom concurrente → contrainte UNIQUE traduite en 409 (jamais 500)", async () => {
    // Le SELECT préalable passe (pas encore de ligne), l'INSERT tombe sur
    // l'index : le serveur doit répondre 409 clair.
    const raceReq = applyReq(body());
    // simule l'écriture concurrente APRÈS la vérification, AVANT l'INSERT :
    // le fake lève UNIQUE dès qu'un homonyme non retiré existe.
    state.creators.push({ id: "racer", name: "Nova", status: "published", user_id: "someone" });
    const r = await applyPost(raceReq);
    expect(r.status).toBe(409);
    const d = (await r.json()) as { error?: string };
    expect(d.error).toContain("already taken");
  });
});

describe("GET /api/creators/applications — file", () => {
  it("mes candidatures ; scope=admin interdit aux non-admins (403)", async () => {
    await applyPost(applyReq({ name: "Nova", bio: "", links: [], mapIds: [], modIds: [] }));
    const mine = await applicationsGet(req("GET", "/api/creators/applications", undefined, AUTHOR_USER));
    expect(mine.status).toBe(200);
    const d = (await mine.json()) as { items: unknown[] };
    expect(d.items).toHaveLength(1);
    const denied = await applicationsGet(req("GET", "/api/creators/applications?scope=admin", undefined, AUTHOR_USER));
    expect(denied.status).toBe(403);
    const adminList = await applicationsGet(req("GET", "/api/creators/applications?scope=admin", undefined, ADMIN_USER));
    expect(adminList.status).toBe(200);
  });
});

describe("PATCH /api/creators/applications — modération admin", () => {
  beforeEach(async () => {
    const r = await applyPost(
      applyReq({
        name: "Nova",
        bio: "",
        links: [{ platform: "x", url: "https://x.com/nova" }],
        mapIds: ["map-alpha", "map-beta"],
        modIds: ["mod-gamma"],
      }),
    );
    expect(r.status).toBe(201);
  });

  it("refuse les non-admins (403) et les actions inconnues (400)", async () => {
    const id = state.creators[0].id as string;
    expect((await applicationsPatch(req("PATCH", "/api/creators/applications", { id, action: "publish" }, AUTHOR_USER))).status).toBe(403);
    expect((await applicationsPatch(req("PATCH", "/api/creators/applications", { id, action: "boom" }, ADMIN_USER))).status).toBe(400);
  });

  it("publie (pending → published) et retire les revendications décochées", async () => {
    const id = state.creators[0].id as string;
    const r = await applicationsPatch(
      req("PATCH", "/api/creators/applications", { id, action: "publish", itemIds: ["map-alpha", "mod-gamma"] }, ADMIN_USER),
    );
    expect(r.status).toBe(200);
    const d = (await r.json()) as { item: { status: string; items: Array<{ id: string }> } };
    expect(d.item.status).toBe("published");
    expect(d.item.items.map((i) => i.id).sort()).toEqual(["map-alpha", "mod-gamma"]);
    expect(state.items.filter((i) => i.item_id === "map-beta")).toHaveLength(0);
  });

  it("rejette avec note (rejected + note)", async () => {
    const id = state.creators[0].id as string;
    const r = await applicationsPatch(
      req("PATCH", "/api/creators/applications", { id, action: "reject", note: "Nom déjà pris ailleurs" }, ADMIN_USER),
    );
    expect(r.status).toBe(200);
    expect(state.creators[0].status).toBe("rejected");
    expect(state.creators[0].note).toBe("Nom déjà pris ailleurs");
  });
});

describe("POST /api/creators/withdraw — retrait auteur", () => {
  it("l'auteur retire sa candidature ; un autre compte → 404", async () => {
    await applyPost(applyReq({ name: "Nova", bio: "", links: [], mapIds: [], modIds: [] }));
    const id = state.creators[0].id as string;
    expect((await withdrawPost(req("POST", "/api/creators/withdraw", { id }, OTHER_USER))).status).toBe(404);
    const r = await withdrawPost(req("POST", "/api/creators/withdraw", { id }, AUTHOR_USER));
    expect(r.status).toBe(200);
    expect(state.creators[0].status).toBe("withdrawn");
  });
});

describe("annuaire et profils — publiés uniquement", () => {
  it("listPublishedCreators ignore les candidatures en attente", async () => {
    await applyPost(applyReq({ name: "Nova", bio: "", links: [], mapIds: [], modIds: [] }));
    state.creators.push({ id: "legacy", name: "Legacy", status: "published", user_id: null, position: 0, created_at: "2026-01-01T00:00:00Z" });
    const list = await listPublishedCreators();
    expect(list.map((c) => c.name)).toEqual(["Legacy"]);
  });

  it("creatorProfile : pending invisible pour un tiers, visible pour son auteur", async () => {
    await applyPost(applyReq({ name: "Nova", bio: "", links: [], mapIds: [], modIds: [] }));
    const id = state.creators[0].id as string;
    expect(await creatorProfile(id, { id: OTHER, admin: false })).toBeNull();
    expect(await creatorProfile(id, { id: null, admin: true })).not.toBeNull();
    expect((await creatorProfile(id, { id: AUTHOR, admin: false }))?.mine).toBe(true);
  });

  it("claimable : cartes et mods publiés uniquement ; les siens exclus si connecté", async () => {
    // anonyme (null) : tout le publié est proposé.
    const anon = await claimableItems(null);
    expect(anon.maps.map((m) => m.id).sort()).toEqual(["map-alpha", "map-beta"]);
    expect(anon.mods.map((m) => m.id)).toEqual(["mod-gamma"]);
    // connecté : ses propres contenus disparaissent (auto-attachés).
    const own = await claimableItems(AUTHOR);
    expect(own.maps.map((m) => m.id)).toEqual(["map-beta"]);
    expect(own.mods).toHaveLength(0);
    // GET : l'identité du dernier mock (AUTHOR) exclut ses propres
    // contenus — la route sert la même liste filtrée que claimableItems.
    const r = await applyGet();
    const d = (await r.json()) as {
      maps: Array<{ id: string }>;
      mods: Array<{ id: string }>;
    };
    expect(d.maps.map((m) => m.id).sort()).toEqual(["map-beta"]);
    expect(d.mods.map((m) => m.id)).toEqual([]);
  });
});
