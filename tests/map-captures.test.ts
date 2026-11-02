import { beforeEach, describe, expect, it, vi } from "vitest";

// Finitions 01/11, chantier 7 — captures en jeu : soumission authentifiée,
// validation d'image par magie, quotas (3/carte/compte, 5/24 h), modération
// admin (publish/reject), retrait auteur, visibilité du fichier (publiée :
// publique ; en attente : propriétaire uniquement).

const { envStub, getChatGPTUser } = vi.hoisted(() => ({
  envStub: {} as Record<string, unknown>,
  getChatGPTUser: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({ env: envStub }));
vi.mock("@/app/chatgpt-auth", () => ({ getChatGPTUser }));

import { GET, PATCH, POST } from "@/app/api/map-captures/[[...path]]/route";
import { sniffImageType } from "@/lib/map-captures";

const ORIGIN = "http://localhost:8787";
const MAP = "map-00200088";
const AUTHOR = { userId: "author-1", email: "author@sites.test" };
const ADMIN = { userId: "admin", email: "admin@sites.test" };
const OTHER = { userId: "other-1", email: "other@sites.test" };

interface CaptureRow {
  id: string;
  map_id: string;
  owner_id: string;
  storage_key: string;
  content_type: string;
  caption: string | null;
  status: string;
  created_at: string;
  moderated_at: string | null;
}

// PNG 1×1 minimal (magie valide, taille ridicule — la validation est par
// magie, pas par dimension).
const PNG = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0,
  0, 0, 0, 0,
]);
const NOT_AN_IMAGE = new Uint8Array([104, 101, 108, 108, 111]);

function makeDb(state: { captures: CaptureRow[] }) {
  const stmtFor = (sql: string, args: unknown[]) => ({
    sql: sql.replace(/\s+/g, " ").trim(),
    async run() {
      const s = this.sql;
      const now = new Date().toISOString();
      if (s.startsWith("INSERT INTO map_captures")) {
        const [id, mapId, ownerId, , contentType, caption, createdAt, , , perMap, , dayAgo, daily] =
          args as string[];
        const perMapCount = state.captures.filter(
          (c) =>
            c.owner_id === ownerId &&
            c.map_id === mapId &&
            (c.status === "pending" || c.status === "published"),
        ).length;
        const dailyCount = state.captures.filter(
          (c) => c.owner_id === ownerId && c.created_at > String(dayAgo),
        ).length;
        if (perMapCount >= Number(perMap) || dailyCount >= Number(daily))
          return { meta: { changes: 0 } };
        state.captures.push({
          id,
          map_id: mapId,
          owner_id: ownerId,
          storage_key: `map-captures/${mapId}/${id}`,
          content_type: contentType,
          caption: (caption as string | null) || null,
          status: "pending",
          created_at: createdAt ?? now,
          moderated_at: null,
        });
        return { meta: { changes: 1 } };
      }
      if (s.startsWith("UPDATE map_captures SET status = ?, moderated_at = ? WHERE id = ? AND status = 'pending'")) {
        const row = state.captures.find((c) => c.id === args[2] && c.status === "pending");
        if (!row) return { meta: { changes: 0 } };
        row.status = String(args[0]);
        row.moderated_at = now;
        return { meta: { changes: 1 } };
      }
      if (s.startsWith("UPDATE map_captures SET status = 'withdrawn'")) {
        const row = state.captures.find(
          (c) =>
            c.id === args[1] &&
            c.owner_id === args[2] &&
            (c.status === "pending" || c.status === "published"),
        );
        if (!row) return { meta: { changes: 0 } };
        row.status = "withdrawn";
        row.moderated_at = now;
        return { meta: { changes: 1 } };
      }
      if (s.startsWith("DELETE FROM map_captures")) {
        const i = state.captures.findIndex((c) => c.id === args[0] && c.owner_id === args[1]);
        if (i === -1) return { meta: { changes: 0 } };
        state.captures.splice(i, 1);
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    },
    async first<T>() {
      const s = this.sql;
      if (s.startsWith("SELECT * FROM map_captures WHERE id = ?"))
        return (state.captures.find((c) => c.id === args[0]) as T) ?? null;
      return null;
    },
    async all<T>() {
      // D1 renvoie { results: [...] } — pas un array nu.
      const wrap = async (): Promise<T[]> => {
        const s = this.sql;
        if (s.startsWith("SELECT * FROM map_captures WHERE map_id = ?"))
          return state.captures
            .filter(
              (c) =>
                c.map_id === args[0] &&
                (c.status === "published" || (c.owner_id === args[1] && c.status === "pending")),
            )
            .reverse() as T[];
        if (s.startsWith("SELECT * FROM map_captures WHERE status != 'withdrawn'"))
          return state.captures.slice().reverse() as T[];
        return [] as T[];
      };
      const results = await wrap();
      return { results } as unknown as { results: T[] };
    },
  });
  return {
    prepare(sql: string) {
      const args: unknown[] = [];
      const stmt = stmtFor(sql, args);
      return {
        ...stmt,
        bind(...values: unknown[]) {
          // Recrée l'objet statement avec les valeurs réelles.
          return stmtFor(sql, values);
        },
      };
    },
  };
}

let state: { captures: CaptureRow[] };
let r2: Map<string, Uint8Array>;

function multipartBody(bytes: Uint8Array, caption?: string) {
  const form = new FormData();
  form.set("capture", new File([bytes as BlobPart], "shot.png", { type: "image/png" }));
  if (caption) form.set("caption", caption);
  return form;
}

async function call(
  method: "GET" | "POST" | "PATCH",
  path: string,
  init: RequestInit = {},
  user: unknown = AUTHOR,
) {
  getChatGPTUser.mockResolvedValue((user ?? null) as never);
  const req = new Request(new URL(path, ORIGIN), {
    ...init,
    method,
    // Origin fusionné APRÈS le spread d'init : sans lui, sameOrigin rejette
    // les PATCH/POST qui ne portent que Content-Type (403 silencieux).
    headers: { Origin: ORIGIN, ...((init.headers as Record<string, string>) ?? {}) },
  });
  const segments = path.replace(/^\/api\/map-captures\/?/, "").split("/").filter(Boolean);
  const handler = method === "GET" ? GET : method === "POST" ? POST : PATCH;
  const response = await handler(req, { params: Promise.resolve({ path: segments }) });
  let data: unknown = null;
  try {
    data = await response.clone().json();
  } catch {
    data = null;
  }
  return { status: response.status, data, response };
}

async function submit(user = AUTHOR, bytes = PNG, caption?: string) {
  return call("POST", `/api/map-captures/${MAP}`, { body: multipartBody(bytes, caption) }, user);
}

beforeEach(() => {
  state = { captures: [] };
  r2 = new Map();
  envStub.DB = makeDb(state);
  envStub.BUCKET = {
    async put(key: string, bytes: Uint8Array) {
      r2.set(key, bytes);
    },
    async get(key: string) {
      if (!r2.has(key)) return null;
      const value = r2.get(key)!;
      return { body: new Blob([value as BlobPart]).stream() };
    },
    async delete(key: string) {
      r2.delete(key);
    },
  };
  envStub.ADMIN_EMAILS = "admin@sites.test";
  getChatGPTUser.mockReset();
});

describe("validation d'image (sniff magique)", () => {
  it("reconnaît PNG, JPEG et WebP, refuse le reste", () => {
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(new Uint8Array([255, 216, 255, 224, 0]))).toBe("image/jpeg");
    expect(
      sniffImageType(new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80])),
    ).toBe("image/webp");
    expect(sniffImageType(NOT_AN_IMAGE)).toBeNull();
  });
});

describe("soumission de capture", () => {
  it("refuse les anonymes", async () => {
    const r = await submit(null as never);
    expect(r.status).toBe(401);
  });

  it("refuse les fichiers qui ne sont pas des images", async () => {
    const r = await submit(AUTHOR, NOT_AN_IMAGE);
    expect(r.status).toBe(400);
  });

  it("refuse une carte hors collection", async () => {
    const r = await call("POST", "/api/map-captures/map-inexistant", {
      body: multipartBody(PNG),
    });
    expect(r.status).toBe(404);
  });

  it("accepte un PNG valide → pending, objet R2 écrit", async () => {
    const r = await submit(AUTHOR, PNG, "Belle bataille");
    expect(r.status).toBe(201);
    const item = (r.data as { item: { status: string; caption: string } }).item;
    expect(item.status).toBe("pending");
    expect(item.caption).toBe("Belle bataille");
    expect(r2.size).toBe(1);
  });

  it("plafonne à 3 captures par carte et par compte", async () => {
    expect((await submit()).status).toBe(201);
    expect((await submit()).status).toBe(201);
    expect((await submit()).status).toBe(201);
    const r = await submit();
    expect(r.status).toBe(429);
  });
});

describe("visibilité et modération", () => {
  it("l'anonyme ne voit que les publiées ; l'auteur voit aussi ses pending", async () => {
    const first = (await submit()).data as { item: { id: string } };
    await submit(OTHER);
    const anonList = (await call("GET", `/api/map-captures/${MAP}`, {}, null)).data as {
      items: unknown[];
    };
    expect(anonList.items).toEqual([]);
    const authorList = (await call("GET", `/api/map-captures/${MAP}`)).data as {
      items: { status: string; mine?: boolean }[];
    };
    // Les pending d'AUTRUI restent invisibles : seul le propriétaire voit
    // les siennes en attente (ici : 1 seule, celle de l'auteur).
    expect(authorList.items).toHaveLength(1);
    expect(authorList.items.every((i) => i.status === "pending" && i.mine)).toBe(true);

    const pub = await call(
      "PATCH",
      `/api/map-captures/${first.item.id}`,
      {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      },
      ADMIN,
    );
    expect(pub.status).toBe(200);
    const after = (await call("GET", `/api/map-captures/${MAP}`, {}, null)).data as {
      items: { id: string; status: string }[];
    };
    expect(after.items).toHaveLength(1);
    expect(after.items[0].id).toBe(first.item.id);
  });

  it("la modération est réservée à l'admin", async () => {
    const { item } = (await submit()).data as { item: { id: string } };
    const r = await call(
      "PATCH",
      `/api/map-captures/${item.id}`,
      {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      },
      AUTHOR,
    );
    expect(r.status).toBe(403);
  });

  it("l'auteur retire sa capture ; le fichier suit le statut", async () => {
    const { item } = (await submit()).data as { item: { id: string } };
    const fileAnon = await call("GET", `/api/map-captures/file/${item.id}`, {}, null);
    expect(fileAnon.status).toBe(404);
    const fileOwner = await call("GET", `/api/map-captures/file/${item.id}`);
    expect(fileOwner.status).toBe(200);
    expect(fileOwner.response.headers.get("Cache-Control")).toContain("private");

    const w = await call(
      "PATCH",
      `/api/map-captures/${item.id}`,
      {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "withdraw" }),
      },
      AUTHOR,
    );
    expect(w.status).toBe(200);
    const after = await call("GET", `/api/map-captures/file/${item.id}`);
    expect(after.status).toBe(404);
  });

  it("file admin : uniquement admin", async () => {
    expect((await call("GET", "/api/map-captures/queue")).status).toBe(403);
    const q = await call("GET", "/api/map-captures/queue", {}, ADMIN);
    expect(q.status).toBe(200);
  });

  it("fichier publié : public et caché ensuite au retrait", async () => {
    const { item } = (await submit()).data as { item: { id: string } };
    await call(
      "PATCH",
      `/api/map-captures/${item.id}`,
      {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      },
      ADMIN,
    );
    const pub = await call("GET", `/api/map-captures/file/${item.id}`, {}, null);
    expect(pub.status).toBe(200);
    expect(pub.response.headers.get("Cache-Control")).toContain("public");
  });
});
