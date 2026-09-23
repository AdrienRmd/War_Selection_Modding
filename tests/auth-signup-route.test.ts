import { beforeEach, describe, expect, it, vi } from "vitest";

// Contrat signup (F1) : un succès NE doit PAS réinitialiser le bucket IP.
// Le budget « 20 inscriptions/h/IP » doit borner les succès aussi, donc
// recordSuccess() n'est branché que sur le flux signin. L'accès D1 est
// remplacé via le même stub « cloudflare:workers » que tests/atlas-server.test.ts
// et recordSuccess est espionné sans toucher aux vrais helpers (hashage,
// sessions, liste de mots de passe communs).
const { recordSuccess, envStub } = vi.hoisted(() => ({
  recordSuccess: vi.fn(async () => {}),
  envStub: {} as Record<string, unknown>,
}));

vi.mock("cloudflare:workers", () => ({ env: envStub }));
vi.mock("@/app/chatgpt-auth", () => ({ getChatGPTUser: vi.fn(async () => null) }));
vi.mock("@/lib/auth-server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth-server")>();
  return { ...actual, recordSuccess };
});

function makeDB() {
  const statements: string[] = [];
  return {
    statements,
    prepare(statement: string) {
      statements.push(statement);
      return {
        bind() {
          return this;
        },
        first: async () => null,
        run: async () => ({ meta: { changes: 1 } }),
      };
    },
    batch: async () => [],
  };
}

beforeEach(() => {
  recordSuccess.mockClear();
  const DB = makeDB();
  envStub.DB = DB;
  envStub.BUCKET = {};
});

describe("POST /api/auth/signup — budget IP", () => {
  it("ne réinitialise PAS le bucket IP après un succès", async () => {
    const { POST } = await import("@/app/api/auth/[[...path]]/route");
    const res = await POST(
      new Request("http://x.test/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://x.test" },
        body: JSON.stringify({
          email: "Fresh@Example.com",
          password: "correct-horse-42",
          displayName: "Ada",
        }),
      }),
      { params: Promise.resolve({ path: ["signup"] }) },
    );
    expect(res.status).toBe(201);
    // Ni clé IP ni clé email : seul le flux signin purge ses seaux. Avant le
    // correctif, recordSuccess(ipKey) était appelé ici et le test échouait.
    expect(recordSuccess).not.toHaveBeenCalled();
  });

  it("crée bien le compte et la session quand le budget est disponible", async () => {
    const { POST } = await import("@/app/api/auth/[[...path]]/route");
    const res = await POST(
      new Request("http://x.test/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://x.test" },
        body: JSON.stringify({
          email: "Second@Example.com",
          password: "another-horse-42",
          displayName: "Grace",
        }),
      }),
      { params: Promise.resolve({ path: ["signup"] }) },
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { user?: { email?: string } };
    expect(body.user?.email).toBe("second@example.com");
    expect(res.headers.get("set-cookie")).toContain("atlas_session=");
  });
});
