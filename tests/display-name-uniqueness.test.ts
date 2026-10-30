import { beforeEach, describe, expect, it, vi } from "vitest";

// V2-P4-fix (audit dev-secu) — MAJEUR #1 : unicité users.display_name
// (index 0009 COLLATE NOCASE) appliquée aux DEUX portes (signup + PATCH
// profile) ; MAJEUR #2 : validation stricte displayNameIssue() au signup
// (mêmes règles que PATCH). Le badge « créateur vérifié » (match exact
// auteur ↔ displayName) devient non forgeable : un compte B ne peut plus
// prendre le pseudo d'un compte A.

const { envStub, getChatGPTUser } = vi.hoisted(() => ({
  envStub: {} as Record<string, unknown>,
  getChatGPTUser: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({ env: envStub }));
vi.mock("@/app/chatgpt-auth", () => ({ getChatGPTUser }));

const NICKNAME_TAKEN = "昵称已被使用，请换一个。";
const RESERVED = "该昵称不可使用。";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";

// ---------------------------------------------------------------------------
// Signup — mock D1 configurable (emails / pseudos existants, INSERT levant
// l'erreur UNIQUE de l'index 0009).

interface SignupDbConfig {
  existingEmails: string[];
  existingNames: string[]; // comparés en COLLATE NOCASE comme l'index
  insertThrowsUnique: boolean;
  inserted: { email: string; displayName: string }[];
}

function makeSignupDb(cfg: SignupDbConfig) {
  return {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          if (sql.includes("WHERE email = ?")) {
            const email = String(args[0]);
            return {
              first: async () =>
                cfg.existingEmails.includes(email) ? { id: "existing" } : null,
            };
          }
          if (sql.includes("display_name = ? COLLATE NOCASE")) {
            const name = String(args[0]);
            return {
              first: async () =>
                cfg.existingNames.some(
                  (n) => n.toLowerCase() === name.toLowerCase(),
                )
                  ? { id: "holder" }
                  : null,
            };
          }
          if (sql.startsWith("INSERT INTO users")) {
            return {
              run: async () => {
                if (cfg.insertThrowsUnique) {
                  throw new Error(
                    "UNIQUE constraint failed: users.display_name: SQLITE_CONSTRAINT",
                  );
                }
                cfg.inserted.push({
                  email: String(args[1]),
                  displayName: String(args[2]),
                });
                return { meta: { changes: 1 } };
              },
            };
          }
          return {
            first: async () => null,
            all: async () => ({ results: [] }),
            run: async () => ({ meta: { changes: 0 } }),
          };
        },
      };
    },
    batch: async () => [],
  };
}

const signupRequest = (displayName: string, email = "fresh@example.test") =>
  import("@/app/api/auth/[[...path]]/route").then(({ POST }) =>
    POST(
      new Request("http://x.test/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://x.test" },
        body: JSON.stringify({
          email,
          password: "correct-horse-42",
          displayName,
        }),
      }),
      { params: Promise.resolve({ path: ["signup"] }) },
    ),
  );

let signupCfg: SignupDbConfig;
beforeEach(() => {
  vi.clearAllMocks();
  getChatGPTUser.mockResolvedValue(null);
  signupCfg = {
    existingEmails: [],
    existingNames: [],
    insertThrowsUnique: false,
    inserted: [],
  };
  envStub.DB = makeSignupDb(signupCfg);
  envStub.BUCKET = {};
});

describe("MAJEUR #2 — signup applique displayNameIssue (mêmes règles que PATCH)", () => {
  it("refuse les pseudos réservés (official, admin, 官方…) → 400", async () => {
    for (const name of ["official", "Admin", "a d m i n", "官方", "War Selection"]) {
      const res = await signupRequest(name);
      expect(res.status, name).toBe(400);
      expect(((await res.json()) as { error: string }).error, name).toBe(RESERVED);
    }
  });

  it("refuse emoji, doubles espaces, contrôles, trop court → 400", async () => {
    for (const name of ["😀42", "Ada  Lo", "Ada\tLo", "A", "x".repeat(41)]) {
      const res = await signupRequest(name);
      expect(res.status, JSON.stringify(name)).toBe(400);
    }
  });

  it("le pseudo stocké est trimmé (cohérent avec PATCH)", async () => {
    const res = await signupRequest("  Ada Lovelace  ");
    expect(res.status).toBe(201);
    expect(signupCfg.inserted[0]?.displayName).toBe("Ada Lovelace");
  });
});

describe("MAJEUR #1 — unicité du pseudo à l'inscription (index 0009 NOCASE)", () => {
  it("pseudo déjà pris (casse indifférente) → 400 « 昵称已被使用 »", async () => {
    signupCfg.existingNames = ["Ada Lovelace"];
    const res = await signupRequest("ada lovelace");
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe(NICKNAME_TAKEN);
    expect(signupCfg.inserted).toEqual([]);
  });

  it("course INSERT vs vérification : erreur UNIQUE résolue en « pseudo pris » quand l'email est libre", async () => {
    signupCfg.insertThrowsUnique = true;
    signupCfg.existingEmails = [];
    const res = await signupRequest("Ada");
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe(NICKNAME_TAKEN);
  });

  it("course INSERT vs vérification : email pris entre-temps → 409 email", async () => {
    signupCfg.insertThrowsUnique = true;
    signupCfg.existingEmails = ["fresh@example.test"];
    const res = await signupRequest("Ada");
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe(
      "该邮箱已注册，请直接登录。",
    );
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/account/profile — la deuxième porte.

interface PatchDbConfig {
  sessionRow: Record<string, unknown> | null;
  clashId: string | null;
  updateThrowsUnique: boolean;
  updates: { sql: string; args: unknown[] }[];
}

function makePatchDb(cfg: PatchDbConfig) {
  return {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          if (sql.includes("FROM sessions s JOIN users")) {
            return { first: async () => cfg.sessionRow };
          }
          if (sql.includes("display_name = ? COLLATE NOCASE AND id != ?")) {
            return { first: async () => (cfg.clashId ? { id: cfg.clashId } : null) };
          }
          if (sql.includes("SELECT display_name, avatar_key")) {
            return {
              first: async () => ({
                display_name: String(args[0]),
                avatar_key: null,
                avatar_type: null,
                locale: null,
              }),
            };
          }
          if (sql.includes("auth_attempts")) {
            return { run: async () => ({ meta: { changes: 1 } }) };
          }
          if (sql.startsWith("UPDATE users")) {
            return {
              run: async () => {
                if (cfg.updateThrowsUnique) {
                  throw new Error(
                    "UNIQUE constraint failed: users.display_name: SQLITE_CONSTRAINT",
                  );
                }
                cfg.updates.push({ sql, args });
                return { meta: { changes: 1 } };
              },
            };
          }
          return { first: async () => null, run: async () => ({ meta: { changes: 0 } }) };
        },
      };
    },
    batch: async () => [],
  };
}

const patchRequest = (displayName: string) =>
  import("@/app/api/account/profile/route").then(({ PATCH }) =>
    PATCH(
      new Request("http://localhost:8787/api/account/profile", {
        method: "PATCH",
        headers: {
          origin: "http://localhost:8787",
          "content-type": "application/json",
          cookie: "atlas_session=tok123",
        },
        body: JSON.stringify({ displayName }),
      }),
    ),
  );

let patchCfg: PatchDbConfig;
describe("MAJEUR #1 — unicité du pseudo au PATCH profile", () => {
  beforeEach(() => {
    patchCfg = {
      sessionRow: {
        user_id: USER_ID,
        display_name: "Ada Origin",
        email: "ada@example.test",
        avatar_key: null,
        avatar_type: null,
      },
      clashId: null,
      updateThrowsUnique: false,
      updates: [],
    };
    envStub.DB = makePatchDb(patchCfg);
    envStub.BUCKET = {};
  });

  it("pseudo pris par un AUTRE compte → 400 « 昵称已被使用 »", async () => {
    patchCfg.clashId = OTHER_ID;
    const res = await patchRequest("Ada Copycat");
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe(NICKNAME_TAKEN);
    expect(patchCfg.updates).toEqual([]);
  });

  it("re-déclarer son propre pseudo (même casse différente) reste autorisé", async () => {
    const res = await patchRequest("ada origin");
    expect(res.status).toBe(200);
    expect(patchCfg.updates.length).toBe(1);
    expect(patchCfg.updates[0]!.args[0]).toBe("ada origin");
  });

  it("course UPDATE vs vérification : erreur UNIQUE → 400 « 昵称已被使用 »", async () => {
    patchCfg.updateThrowsUnique = true;
    const res = await patchRequest("Ada Copycat");
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe(NICKNAME_TAKEN);
  });

  it("E2E badge non forgeable : B ne peut plus prendre le pseudo de A (scénario de l'audit)", async () => {
    // Avant le correctif : B renommait son pseudo en celui de A (200), puis
    // soumettait author=<pseudo de A> → author_verified = 1 (badge volé).
    // Désormais la porte PATCH refuse : le displayName unique rend le match
    // exact (snapshot SB7) non forgeable.
    patchCfg.sessionRow = {
      ...patchCfg.sessionRow!,
      display_name: "Mallory B", // session = compte B
    } as Record<string, unknown>;
    patchCfg.clashId = OTHER_ID; // « Ada Origin » est porté par le compte A
    const res = await patchRequest("Ada Origin"); // pseudo du compte A
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe(NICKNAME_TAKEN);
  });
});
