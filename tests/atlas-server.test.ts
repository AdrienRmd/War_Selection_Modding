import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  approvedMaps,
  bindings,
  HttpError,
  identity,
  isAdmin,
  json,
  limitedBody,
  publicMap,
  sameOrigin,
  type MapRecord,
} from "@/lib/atlas-server";

// atlas-server reads the worker env from "cloudflare:workers" and the identity
// from "@/app/chatgpt-auth"; both are stubbed so the pure helpers (sameOrigin,
// pagination, body limits...) run in the plain node test environment.
const { envStub, getChatGPTUser } = vi.hoisted(() => ({
  envStub: {} as Record<string, unknown>,
  getChatGPTUser: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({ env: envStub }));
vi.mock("@/app/chatgpt-auth", () => ({ getChatGPTUser }));

function mapRecord(id: number): MapRecord {
  return {
    id: `m${id}`,
    owner_id: "u1",
    author: "Ada",
    title: `Carte ${id}`,
    summary: "résumé",
    description: "description",
    game_version: "r1",
    players: 2,
    category: "skirmish",
    mods: "[]",
    map_code: `CODE-${id}`,
    status: "approved",
    file_name: "carte.zip",
    file_key: `cle-${id}`,
    file_size: 1024,
    sha256: "a".repeat(64),
    cover_key: id % 2 === 0 ? "cover" : null,
    cover_type: id % 2 === 0 ? "image/png" : null,
    created_at: "2026-01-01T00:00:00Z",
    reviewed_at: "2026-01-02T00:00:00Z",
    feedback: "",
    revision: 1,
  };
}

function makeDB(results: MapRecord[]) {
  const seen: { sql?: string; offset?: number } = {};
  return {
    seen,
    prepare(sql: string) {
      seen.sql = sql;
      return {
        bind(offset: number) {
          seen.offset = offset;
          return { all: async () => ({ results }) };
        },
      };
    },
  };
}

describe("sameOrigin", () => {
  const build = (url: string, headers: Record<string, string>) => new Request(url, { headers });

  const forbiddenStatus = (req: Request): number | null => {
    try {
      sameOrigin(req);
      return null;
    } catch (e) {
      return e instanceof HttpError ? e.status : -1;
    }
  };

  it("accepte une requête dont l'origine correspond à req.url", () => {
    const req = build("http://127.0.0.1:8787/api/auth/signin", {
      origin: "http://127.0.0.1:8787",
    });
    expect(forbiddenStatus(req)).toBeNull();
  });

  it("fait confiance à X-Forwarded-Proto : https attendu derrière le proxy", () => {
    const ok = build("http://127.0.0.1:8787/api/map", {
      origin: "https://127.0.0.1:8787",
      "x-forwarded-proto": "https",
    });
    expect(forbiddenStatus(ok)).toBeNull();
  });

  it("rejette l'origine http quand X-Forwarded-Proto annonce https", () => {
    const req = build("http://127.0.0.1:8787/api/map", {
      origin: "http://127.0.0.1:8787",
      "x-forwarded-proto": "https",
    });
    expect(forbiddenStatus(req)).toBe(403);
  });

  it("utilise le premier maillon d'une chaîne X-Forwarded-Proto (insensible à la casse)", () => {
    const req = build("http://127.0.0.1:8787/api/map", {
      origin: "https://127.0.0.1:8787",
      "x-forwarded-proto": "HTTPS, http",
    });
    expect(forbiddenStatus(req)).toBeNull();
  });

  it("rejette une requête sans en-tête Origin", () => {
    const req = build("http://127.0.0.1:8787/api/map", {});
    expect(forbiddenStatus(req)).toBe(403);
  });

  it("rejette une origine externe", () => {
    const req = build("http://127.0.0.1:8787/api/map", {
      origin: "https://evil.example",
    });
    expect(forbiddenStatus(req)).toBe(403);
  });
});

describe("HttpError", () => {
  it("expose status + message et reste une Error", () => {
    const e = new HttpError(404, "introuvable");
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(HttpError);
    expect(e.status).toBe(404);
    expect(e.message).toBe("introuvable");
  });
});

describe("json", () => {
  it("renvoie 200 par défaut avec les en-têtes no-store / nosniff", async () => {
    const res = json({ ok: true });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("respecte le status fourni", () => {
    expect(json({ error: "x" }, 418).status).toBe(418);
  });
});

describe("publicMap", () => {
  it("projette les champs publics et masque owner_id / file_key / feedback", () => {
    const pub = publicMap(mapRecord(2));
    expect(pub).toMatchObject({
      id: "m2",
      author: "Ada",
      title: "Carte 2",
      map_code: "CODE-2",
      file_name: "carte.zip",
      file_size: 1024,
      sha256: "a".repeat(64),
    });
    const keys = Object.keys(pub);
    expect(keys).not.toContain("owner_id");
    expect(keys).not.toContain("file_key");
    expect(keys).not.toContain("feedback");
    expect(keys).not.toContain("status");
  });

  it("calcule has_cover d'après cover_key", () => {
    expect(publicMap(mapRecord(2)).has_cover).toBe(true);
    expect(publicMap(mapRecord(1)).has_cover).toBe(false);
  });
});

describe("bindings / isAdmin / identity", () => {
  beforeEach(() => {
    for (const key of Object.keys(envStub)) delete envStub[key];
    getChatGPTUser.mockReset();
  });

  it("bindings() lève si les bindings de stockage manquent", () => {
    expect(() => bindings()).toThrow("Storage bindings unavailable");
  });

  it("bindings() renvoie l'env complet quand DB et BUCKET sont présents", () => {
    envStub.DB = { marker: "db" };
    envStub.BUCKET = { marker: "bucket" };
    expect(bindings()).toMatchObject({ DB: { marker: "db" }, BUCKET: { marker: "bucket" } });
  });

  it("isAdmin accepte un email de la liste (casse et espaces ignorés)", () => {
    envStub.ADMIN_EMAILS = " Admin@Atlas.test ,other@x.io";
    const user = { userId: "u1", displayName: "A", email: "admin@atlas.test", fullName: null };
    expect(isAdmin(user)).toBe(true);
  });

  it("isAdmin refuse un email hors liste, une liste vide ou un user nul", () => {
    const user = { userId: "u1", displayName: "A", email: "nope@atlas.test", fullName: null };
    envStub.ADMIN_EMAILS = "admin@atlas.test";
    expect(isAdmin(user)).toBe(false);
    envStub.ADMIN_EMAILS = undefined;
    expect(isAdmin({ ...user, email: "admin@atlas.test" })).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it("identity() combine l'utilisateur et le verdict admin", async () => {
    const user = { userId: "u1", displayName: "A", email: "admin@atlas.test", fullName: null };
    getChatGPTUser.mockResolvedValue(user);
    envStub.ADMIN_EMAILS = "admin@atlas.test";
    envStub.DB = {};
    envStub.BUCKET = {};
    await expect(identity()).resolves.toEqual({ user, admin: true });
  });
});

describe("approvedMaps", () => {
  beforeEach(() => {
    for (const key of Object.keys(envStub)) delete envStub[key];
    envStub.BUCKET = {};
  });

  it("renvoie 24 éléments et hasMore=true pour 25 résultats SQL", async () => {
    const db = makeDB(Array.from({ length: 25 }, (_, i) => mapRecord(i + 1)));
    envStub.DB = db;
    const page = await approvedMaps();
    expect(page.items).toHaveLength(24);
    expect(page.hasMore).toBe(true);
    expect(page.items[0]).toMatchObject({ id: "m1", has_cover: false });
  });

  it("renvoie hasMore=false à la dernière page et transmet l'offset à la requête", async () => {
    const db = makeDB([mapRecord(1), mapRecord(2)]);
    envStub.DB = db;
    const page = await approvedMaps(24);
    expect(page.items).toHaveLength(2);
    expect(page.hasMore).toBe(false);
    expect(db.seen.offset).toBe(24);
    expect(db.seen.sql).toContain("OFFSET ?");
  });
});

describe("limitedBody", () => {
  it("rejette 413 dès que Content-Length dépasse la limite", async () => {
    const body = "x".repeat(300);
    const req = new Request("http://x.test/u", {
      method: "POST",
      headers: { "content-length": String(body.length) },
      body,
    });
    await expect(limitedBody(req, 200)).rejects.toMatchObject({ status: 413 });
  });

  it("rejette 400 sans corps de requête", async () => {
    const req = new Request("http://x.test/u", { method: "POST" });
    await expect(limitedBody(req, 200)).rejects.toMatchObject({ status: 400 });
  });

  it("renvoie les octets exacts pour un corps dans la limite", async () => {
    const req = new Request("http://x.test/u", {
      method: "POST",
      headers: { "content-length": "5" },
      body: "hello",
    });
    const result = await limitedBody(req, 200);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(Array.from(result)).toEqual([104, 101, 108, 108, 111]);
  });

  it("coupe le flux et renvoie 413 quand la limite est dépassée en streaming", async () => {
    const body = "y".repeat(300);
    const req = new Request("http://x.test/u", {
      method: "POST",
      headers: { "content-length": "1" },
      body,
    });
    await expect(limitedBody(req, 200)).rejects.toMatchObject({ status: 413 });
  });
});
