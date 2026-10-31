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
// V3-P2 #3 : le throttle est compilé hors des builds DEV (RATE_LIMITS_ENABLED
// = !import.meta.env.DEV) ; on l'active explicitement ici pour tester le
// comportement PRODUCTION du budget PATCH (10 autorisées, la 11ᵉ refusée).
vi.mock("@/lib/auth-server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth-server")>()),
  RATE_LIMITS_ENABLED: true,
}));

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

// ---------------------------------------------------------------------------
// SB1-d — comportement EXACT du throttle PATCH (V3-P2 #3) : PROFILE_PATCH_BUDGET
// = { limit: 10, windowMs: 60 000 }. count>=limit → refus : les 10 PREMIÈRES
// modifications d'une fenêtre de 60 s passent, la 11ᵉ reçoit 429. Le DB de
// test maintient l'état auth_attempts (fenêtre + compteur) comme D1.

function makeThrottleDb(
  log: DbLog,
  attempts: Map<string, { window_start: number; count: number }>,
) {
  return {
    prepare(sql: string) {
      log.sql.push(sql);
      return {
        bind(...args: unknown[]) {
          return {
            // marqueurs lus par batch() (statements liés réels de D1)
            __sql: sql,
            __args: args,
            first: async () => {
              if (sql.includes("FROM sessions s JOIN users")) return log.sessionRow;
              if (sql.includes("SELECT display_name, avatar_key")) return log.updatedRow;
              if (sql.includes("FROM auth_attempts"))
                return attempts.get(String(args[0])) ?? null;
              return null;
            },
            all: async () => ({ results: [] }),
            run: async () => {
              if (sql.startsWith("UPDATE users")) return { meta: { changes: log.updateChanges } };
              if (sql.includes("UPDATE auth_attempts")) {
                const row = attempts.get(String(args[0]));
                if (row) row.count += 1;
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 0 } };
            },
          };
        },
      };
    },
    batch: async (stmts: { __sql?: string; __args?: unknown[] }[]) => {
      for (const stmt of stmts) {
        if (stmt.__sql?.includes("INSERT INTO auth_attempts") && stmt.__args) {
          attempts.set(String(stmt.__args[0]), {
            window_start: Number(stmt.__args[1]),
            count: 1,
          });
        }
      }
      return { results: stmts.map(() => ({ meta: { changes: 1 } })) };
    },
  };
}

describe("SB1-d — throttling PATCH : 10 autorisées par fenêtre, la 11ᵉ refusée", () => {
  let attempts: Map<string, { window_start: number; count: number }>;
  beforeEach(() => {
    attempts = new Map();
    envStub.DB = makeThrottleDb(log, attempts);
  });

  it("rafale de 11 PATCH en < 1 min : #1 à #10 → 200, #11 → 429", async () => {
    for (let i = 1; i <= 10; i++) {
      const r = await PATCH(jsonReq({ locale: "en" }));
      expect(r.status, `PATCH n°${i} de la fenêtre`).toBe(200);
    }
    const r11 = await PATCH(jsonReq({ locale: "en" }));
    expect(r11.status).toBe(429);
    expect(((await r11.json()) as { error: string }).error).toBe("修改过于频繁，请 1 分钟后再试。");
    // Retry-After borné à la fenêtre restante (≤ 60 s), jamais 0
    const retry = Number(r11.headers.get("Retry-After"));
    expect(retry).toBeGreaterThan(0);
    expect(retry).toBeLessThanOrEqual(60);
    // la 11ᵉ requête refusée ne touche jamais users (rien d'écrit)
    expect(log.sql.filter((s) => s.startsWith("UPDATE users"))).toHaveLength(10);
  });

  it("fenêtre expirée : le compteur repart à zéro (plus de 429)", async () => {
    attempts.set(`profile:${USER_ID}`, { window_start: Date.now() - 61_000, count: 99 });
    const r = await PATCH(jsonReq({ locale: "fr" }));
    expect(r.status).toBe(200);
    expect(attempts.get(`profile:${USER_ID}`)).toEqual({
      window_start: expect.any(Number),
      count: 1,
    });
  });
});

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

describe("SB2 — préférence de langue du compte", () => {
  it("enregistre une locale valide (zh/en/fr)", async () => {
    log.updatedRow = { display_name: "QA User", avatar_key: null, avatar_type: null, locale: "zh" };
    const r = await PATCH(jsonReq({ locale: "zh" }));
    expect(r.status).toBe(200);
    const update = log.sql.find((s) => s.startsWith("UPDATE users"));
    expect(update).toContain("locale = ?");
    expect(log.bindings.some((a) => a[0] === "zh" && a[1] === USER_ID)).toBe(true);
    const d = (await r.json()) as { user: { locale: string } };
    expect(d.user.locale).toBe("zh");
  });

  it("rejette une locale hors zh/en/fr", async () => {
    const r = await PATCH(jsonReq({ locale: "de" }));
    expect(r.status).toBe(400);
    expect(log.sql.filter((s) => s.startsWith("UPDATE users"))).toHaveLength(0);
  });

  it("accepte la locale en multipart avec le pseudo et l'avatar", async () => {
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 73, 69, 78, 68, 1, 2, 3, 4]);
    const r = await PATCH(
      multipart({ displayName: "Ada ZH", locale: "zh", avatar: new File([png], "p.png", { type: "image/png" }) }),
    );
    expect(r.status).toBe(200);
    const update = log.sql.find((s) => s.startsWith("UPDATE users"))!;
    expect(update).toContain("display_name = ?");
    expect(update).toContain("locale = ?");
    expect(update).toContain("avatar_key = ?");
  });
});
