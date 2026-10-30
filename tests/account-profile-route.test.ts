import { beforeEach, describe, expect, it, vi } from "vitest";

// SB1 : PATCH /api/account/profile — auth session, CSRF sameOrigin, rejets
// de validation (pseudo, avatar type/taille/structure), neutralisation EXIF,
// purge R2 au remplacement/retrait, throttling borné par compte.

const { envStub, getChatGPTUser } = vi.hoisted(() => ({
  envStub: {} as Record<string, unknown>,
  getChatGPTUser: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({ env: envStub }));
vi.mock("@/app/chatgpt-auth", () => ({ getChatGPTUser }));

import { PATCH } from "@/app/api/account/profile/route";

const ORIGIN = "http://localhost:8787";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const AVATAR_KEY = `avatars/${USER_ID}/avatar`;

interface DbLog {
  sql: string[];
  bindings: unknown[][];
  sessionRow: Record<string, unknown> | null;
  updatedRow: Record<string, unknown> | null;
  updateChanges: number;
}

function makeDb(log: DbLog) {
  return {
    prepare(sql: string) {
      log.sql.push(sql);
      return {
        bind(...args: unknown[]) {
          log.bindings.push(args);
          return {
            first: async () => {
              if (sql.includes("FROM sessions s JOIN users")) return log.sessionRow;
              if (sql.includes("SELECT display_name, avatar_key")) return log.updatedRow;
              return null;
            },
            all: async () => ({ results: [] }),
            run: async () => {
              if (sql.startsWith("UPDATE users")) return { meta: { changes: log.updateChanges } };
              if (sql.includes("auth_attempts")) return { meta: { changes: 1 } };
              return { meta: { changes: 0 } };
            },
          };
        },
      };
    },
    batch: async (stmts: unknown[]) => ({ results: stmts.map(() => ({ meta: { changes: 1 } })) }),
  };
}

function makeBucket() {
  return {
    puts: [] as { key: string; bytes: Uint8Array; type: string }[],
    deletes: [] as string[],
    async put(key: string, bytes: Uint8Array, opts: { httpMetadata: { contentType: string } }) {
      this.puts.push({ key, bytes, type: opts.httpMetadata.contentType });
    },
    async delete(key: string) {
      this.deletes.push(key);
    },
    async get() {
      return null;
    },
  };
}

function baseEnv(log: DbLog) {
  envStub.DB = makeDb(log);
  envStub.BUCKET = makeBucket();
}

function request(body: BodyInit, headers: Record<string, string>) {
  return new Request(`${ORIGIN}/api/account/profile`, {
    method: "PATCH",
    headers: { origin: ORIGIN, ...headers },
    body,
  });
}

const jsonReq = (obj: unknown, cookie = "atlas_session=tok123") =>
  request(JSON.stringify(obj), {
    "content-type": "application/json",
    cookie,
  });

function multipart(fields: Record<string, string | File>, cookie = "atlas_session=tok123") {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return request(form, { cookie });
}

const sessionRow = (extra: Record<string, unknown> = {}) => ({
  user_id: USER_ID,
  display_name: "QA User",
  email: "qa@example.test",
  avatar_key: null,
  avatar_type: null,
  ...extra,
});

let log: DbLog;
beforeEach(() => {
  vi.clearAllMocks();
  log = {
    sql: [],
    bindings: [],
    sessionRow: sessionRow(),
    updatedRow: null,
    updateChanges: 1,
  };
  baseEnv(log);
  log.updatedRow = { display_name: "QA User", avatar_key: null, avatar_type: null };
});

describe("authentification et CSRF", () => {
  it("rejette un appel anonyme (401) sans toucher à la base", async () => {
    const r = await PATCH(jsonReq({ displayName: "Ada" }, "atlas_session="));
    expect(r.status).toBe(401);
    expect(log.sql.filter((s) => s.startsWith("UPDATE"))).toHaveLength(0);
  });

  it("rejette une origine croisée (403, garde sameOrigin des mutations existantes)", async () => {
    const req = new Request(`${ORIGIN}/api/account/profile`, {
      method: "PATCH",
      headers: { origin: "https://evil.example", "content-type": "application/json", cookie: "atlas_session=tok123" },
      body: JSON.stringify({ displayName: "Ada" }),
    });
    const r = await PATCH(req);
    expect(r.status).toBe(403);
  });

  it("rejette un content-type inattendu (400)", async () => {
    const r = await PATCH(request("hello", { "content-type": "text/plain", cookie: "atlas_session=tok123" }));
    expect(r.status).toBe(400);
  });
});

describe("pseudo (displayName)", () => {
  it("met à jour un pseudo valide et retourne le profil", async () => {
    log.updatedRow = { display_name: "Ada Lovelace", avatar_key: null, avatar_type: null };
    const r = await PATCH(jsonReq({ displayName: "Ada Lovelace" }));
    expect(r.status).toBe(200);
    const update = log.sql.find((s) => s.startsWith("UPDATE users"));
    expect(update).toContain("display_name = ?");
    expect(log.bindings.some((a) => a[0] === "Ada Lovelace" && a[1] === USER_ID)).toBe(true);
    const d = (await r.json()) as { user: { displayName: string } };
    expect(d.user.displayName).toBe("Ada Lovelace");
  });

  it("rejette un pseudo réservé (usurpation admin)", async () => {
    const r = await PATCH(jsonReq({ displayName: "Admin" }));
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toBe("该昵称不可使用。");
  });

  it("rejette un pseudo trop court", async () => {
    const r = await PATCH(jsonReq({ displayName: "x" }));
    expect(r.status).toBe(400);
  });

  it("rejette un corps vide (rien à mettre à jour)", async () => {
    const r = await PATCH(jsonReq({}));
    expect(r.status).toBe(400);
  });

  it("jamais d'identité lue depuis le corps : le WHERE reste l'userId de session", async () => {
    await PATCH(jsonReq({ displayName: "Ada", userId: "someone-else" } as unknown as Record<string, string>));
    const updateIndex = log.sql.findIndex((s) => s.startsWith("UPDATE users"));
    expect(log.bindings[updateIndex]!.at(-1)).toBe(USER_ID);
  });
});

describe("avatar", () => {
  const pngBytes = new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10,
    // IHDR
    0, 0, 0, 13, 73, 72, 68, 82, ...new Array(13).fill(1), 1, 2, 3, 4,
    // eXIf (doit disparaître)
    0, 0, 0, 4, 101, 88, 73, 102, 7, 7, 7, 7, 1, 2, 3, 4,
    // IEND
    0, 0, 0, 0, 73, 69, 78, 68, 1, 2, 3, 4,
  ]);

  it("stocke un PNG valide sans son chunk eXIf, clé dérivée de l'userId", async () => {
    const file = new File([pngBytes], "portrait.png", { type: "image/png" });
    const r = await PATCH(multipart({ avatar: file }));
    expect(r.status).toBe(200);
    const bucket = envStub.BUCKET as ReturnType<typeof makeBucket>;
    expect(bucket.puts).toHaveLength(1);
    expect(bucket.puts[0]!.key).toBe(AVATAR_KEY);
    expect(bucket.puts[0]!.type).toBe("image/png");
    expect(new TextDecoder().decode(bucket.puts[0]!.bytes)).not.toContain("eXIf");
    expect(log.sql.find((s) => s.startsWith("UPDATE users"))).toContain("avatar_key = ?");
  });

  it("rejette un mauvais type (GIF)", async () => {
    const gif = new File([new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 2, 3, 4])], "a.gif", {
      type: "image/gif",
    });
    const r = await PATCH(multipart({ avatar: gif }));
    expect(r.status).toBe(400);
    expect((envStub.BUCKET as ReturnType<typeof makeBucket>).puts).toHaveLength(0);
  });

  it("rejette un fichier de plus de 2 Mo", async () => {
    const big = new Uint8Array(2 * 1024 * 1024 + 16);
    big.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
    const file = new File([big], "big.png", { type: "image/png" });
    const r = await PATCH(multipart({ avatar: file }));
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toBe("头像不能超过 2 MB。");
  });

  it("rejette un PNG à la structure cassée (signature valide, chunks incohérents)", async () => {
    const broken = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 9, 9, 9]);
    const file = new File([broken], "broken.png", { type: "image/png" });
    const r = await PATCH(multipart({ avatar: file }));
    expect(r.status).toBe(400);
  });

  it("retrait : NULL en base puis purge de l'objet R2 existant", async () => {
    log.sessionRow = sessionRow({ avatar_key: AVATAR_KEY, avatar_type: "image/png" });
    const r = await PATCH(multipart({ removeAvatar: "true" }));
    expect(r.status).toBe(200);
    const update = log.sql.find((s) => s.startsWith("UPDATE users"));
    expect(update).toContain("avatar_key = NULL");
    const bucket = envStub.BUCKET as ReturnType<typeof makeBucket>;
    expect(bucket.deletes).toEqual([AVATAR_KEY]);
  });

  it("refuse avatar + removeAvatar simultanés", async () => {
    const file = new File([pngBytes], "p.png", { type: "image/png" });
    const r = await PATCH(multipart({ avatar: file, removeAvatar: "true" }));
    expect(r.status).toBe(400);
    expect(bucket().puts).toHaveLength(0);
  });
});

function bucket() {
  return envStub.BUCKET as ReturnType<typeof makeBucket>;
}

describe("cohérence transactionnelle", () => {
  it("échec de la mise à jour D1 → l'objet R2 fraîchement posé est purgé", async () => {
    log.updateChanges = 0;
    const file = new File(
      [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 73, 69, 78, 68, 1, 2, 3, 4])],
      "ok.png",
      { type: "image/png" },
    );
    const r = await PATCH(multipart({ avatar: file }));
    expect(r.status).toBe(503);
    expect(bucket().puts).toHaveLength(1); // posé puis…
    expect(bucket().deletes).toEqual([AVATAR_KEY]); // …nettoyé par le finally
  });
});
