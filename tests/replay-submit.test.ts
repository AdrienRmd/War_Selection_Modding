import { beforeEach, describe, expect, it, vi } from "vitest";

// Chantier B — couche « replays récemment soumis » : validation, quotas
// (3 en attente / 5 par 24 h, verrou atomique), doublons 409, listing public
// publiés uniquement, modération admin, retrait auteur. Même harnais fake-D1
// que tests/map-quota.test.ts.

const { envStub, getChatGPTUser } = vi.hoisted(() => ({
  envStub: {} as Record<string, unknown>,
  getChatGPTUser: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({ env: envStub }));
vi.mock("@/app/chatgpt-auth", () => ({ getChatGPTUser }));

import {
  GET as replayGet,
  POST as replayPost,
  PATCH as replayPatch,
} from "@/app/api/replay/[[...path]]/route";
import { cleanReplayBody } from "@/lib/replay-submissions";
import type { ReplayRecord } from "@/lib/replay-submissions";

const ORIGIN = "http://localhost:8787";
const AUTHOR = "33333333-3333-4333-8333-333333333333";
const ADMIN = { userId: "admin", email: "admin@sites.test" };
const AUTHOR_USER = { userId: AUTHOR, email: "author@sites.test" };

interface State {
  replays: ReplayRecord[];
  now?: () => string;
}

function makeDb(state: State) {
  return {
    prepare(sql: string) {
      const s = sql.replace(/\s+/g, " ").trim();
      const args: unknown[] = [];
      const stmt = {
        bind(...values: unknown[]) {
          args.length = 0;
          args.push(...values);
          return stmt;
        },
        async first<T>() {
          if (s.startsWith("SELECT code, status FROM replays WHERE code = ?"))
            return ((state.replays.find((r) => r.code === args[0]) ?? null) as T);
          if (s.startsWith("SELECT * FROM replays WHERE code = ?"))
            return ((state.replays.find((r) => r.code === args[0]) ?? null) as T);
          return null as T;
        },
        async all<T>() {
          if (s.startsWith("SELECT * FROM replays WHERE status = 'published'")) {
            const limit = args[0] as number;
            return {
              results: state.replays
                .filter((r) => r.status === "published")
                .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
                .slice(0, limit),
            } as T;
          }
          if (s.startsWith("SELECT * FROM replays WHERE owner_id = ?"))
            return { results: state.replays.filter((r) => r.owner_id === args[0]) } as T;
          if (s.startsWith("SELECT * FROM replays ORDER BY created_at DESC"))
            return { results: state.replays } as T;
          return { results: [] } as T;
        },
        async run() {
          const now = (state.now ?? (() => new Date().toISOString()))();
          if (s.startsWith("INSERT INTO replays")) {
            // (code, team_size, mvp_name, mode_key, owner_id, now,
            //  ownerQuotaPending, limite, ownerQuotaJour, depuis, limiteJour)
            const [code, teamSize, mvpName, modeKey, , , ownerPending, , ownerDaily, since] = args;
            const pending = state.replays.filter(
              (r) => r.owner_id === ownerPending && r.status === "pending",
            ).length;
            const daily = state.replays.filter(
              (r) => r.owner_id === ownerDaily && r.created_at > String(since),
            ).length;
            if (pending >= 3 || daily >= 5) return { meta: { changes: 0 } };
            state.replays.push({
              code: String(code),
              team_size: teamSize as number,
              mvp_name: (mvpName as string | null) ?? null,
              mode_key: modeKey as string,
              owner_id: ownerPending as string,
              status: "pending",
              created_at: now,
              moderated_at: null,
              note: null,
            });
            return { meta: { changes: 1 } };
          }
          if (s.startsWith("UPDATE replays SET status='withdrawn', moderated_at=? WHERE code=? AND owner_id=?")) {
            const row = state.replays.find(
              (r) =>
                r.code === args[1] &&
                r.owner_id === args[2] &&
                (r.status === "pending" || r.status === "published"),
            );
            if (!row) return { meta: { changes: 0 } };
            row.status = "withdrawn";
            row.moderated_at = now;
            return { meta: { changes: 1 } };
          }
          if (s.startsWith("UPDATE replays SET status='withdrawn', moderated_at=? WHERE code=?")) {
            const row = state.replays.find((r) => r.code === args[1]);
            if (!row) return { meta: { changes: 0 } };
            row.status = "withdrawn";
            row.moderated_at = now;
            return { meta: { changes: 1 } };
          }
          if (s.startsWith("UPDATE replays SET status=?, moderated_at=?, note=? WHERE code=?")) {
            const row = state.replays.find((r) => r.code === args[3]);
            if (!row) return { meta: { changes: 0 } };
            row.status = args[0] as string;
            row.moderated_at = now;
            row.note = args[2] as string | null;
            return { meta: { changes: 1 } };
          }
          if (s.startsWith("UPDATE replays SET team_size=?")) {
            // Re-soumission : quotas relus (3 en attente, 5 par 24 h) puis MAJ.
            const ownerPending = state.replays.filter(
              (r) => r.owner_id === args[6] && r.status === "pending",
            ).length; // args[6] = owner de la sous-requête quota pending
            const ownerDaily = state.replays.filter(
              (r) => r.owner_id === args[8] && r.created_at > String(args[9]),
            ).length; // args[8]/args[9] = owner/depuis de la sous-requête quota 24 h
            if (ownerPending >= 3 || ownerDaily >= 5) return { meta: { changes: 0 } };
            const row = state.replays.find((r) => r.code === args[4] && r.owner_id === args[5]);
            if (!row) return { meta: { changes: 0 } };
            row.team_size = args[0] as number;
            row.mvp_name = args[1] as string | null;
            row.mode_key = args[2] as string;
            row.status = "pending";
            row.created_at = now;
            row.moderated_at = null;
            row.note = null;
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        },
      };
      return stmt;
    },
  };
}

let state: State;
function setState() {
  state = { replays: [] };
  envStub.DB = makeDb(state);
  envStub.BUCKET = {};
  envStub.ADMIN_EMAILS = "admin@sites.test";
}

function req(method: string, path: string, body?: unknown, user: unknown = AUTHOR_USER) {
  getChatGPTUser.mockResolvedValue((user ?? null) as never);
  const init: RequestInit = {
    method,
    headers: { Origin: ORIGIN },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  return new Request(ORIGIN + path, init);
}

const ctx = (parts: string[]) => ({ params: Promise.resolve({ path: parts }) });
const post = (path: string, body: unknown, user: unknown = AUTHOR_USER) =>
  replayPost(req("POST", path, body, user), ctx(["submit"]));
const patch = (path: string, body: unknown, user = AUTHOR_USER) =>
  replayPatch(req("PATCH", path, body, user), ctx([path.split("/").pop()!]));
const get = (path: string, user?: unknown) => {
  const clean = path.split("?")[0];
  return replayGet(req("GET", path, undefined, user), ctx(clean.replace("/api/replay/", "").split("/")));
};

beforeEach(setState);

describe("validation du corps de soumission", () => {
  it("normalise rep- → code nu, valide mode/taille/pseudo", () => {
    expect(cleanReplayBody({ code: "rep-Jd894wx6so9", teamSize: 8, modeKey: "replayMatchTypeTeamMatch", mvpName: "Vzgo" })).toEqual({
      code: "Jd894wx6so9",
      teamSize: 8,
      mvpName: "Vzgo",
      modeKey: "replayMatchTypeTeamMatch",
    });
    expect(cleanReplayBody({ code: "court", teamSize: 8, modeKey: "replayMatchTypeTeamMatch" })).toBeNull();
    expect(cleanReplayBody({ code: "Jd894wx6so9", teamSize: 0, modeKey: "replayMatchTypeTeamMatch" })).toBeNull();
    expect(cleanReplayBody({ code: "Jd894wx6so9", teamSize: 8, modeKey: "inconnu" })).toBeNull();
    // Caractères de contrôle retirés du pseudo.
    expect(cleanReplayBody({ code: "Jd894wx6so9", teamSize: 8, modeKey: "replayMatchTypeFFA", mvpName: "a\u0000b" })?.mvpName).toBe("ab");
  });
});

describe("POST /api/replay/submit", () => {
  const body = { code: "Jd894wx6so9", teamSize: 8, modeKey: "replayMatchTypeTeamMatch", mvpName: "Vzgo" };

  it("refuse les anonymes (401)", async () => {
    const r = await post("/api/replay/submit", body, null);
    expect(r.status).toBe(401);
  });

  it("refuse un corps invalide (400)", async () => {
    const r = await post("/api/replay/submit", { code: "x", teamSize: 8, modeKey: "replayMatchTypeTeamMatch" });
    expect(r.status).toBe(400);
  });

  it("soumet en pending (201) puis 409 au doublon", async () => {
    const r = await post("/api/replay/submit", body);
    expect(r.status).toBe(201);
    const d = (await r.json()) as { item: { code: string; status: string } };
    expect(d.item.code).toBe("Jd894wx6so9");
    expect(d.item.status).toBe("pending");
    const dup = await post("/api/replay/submit", body);
    expect(dup.status).toBe(409);
  });

  it("plafonne à 3 soumissions en attente (429)", async () => {
    for (let i = 0; i < 3; i++) {
      const r = await post("/api/replay/submit", { ...body, code: `code${i}AAAAAA`.slice(0, 11), mvpName: null });
      expect(r.status).toBe(201);
    }
    const r = await post("/api/replay/submit", { ...body, code: "zzzzzzzzzzz" });
    expect(r.status).toBe(429);
  });

  it("plafonne à 5 soumissions par 24 h (429)", async () => {
    for (let i = 0; i < 5; i++) {
      // publication immédiate pour ne pas toucher au plafond pending
      await post("/api/replay/submit", { ...body, code: `day${i}AAAAAAA`.slice(0, 11) });
      const rec = state.replays[state.replays.length - 1];
      rec.status = "published";
    }
    const r = await post("/api/replay/submit", { ...body, code: "sixthAAAAAA".slice(0, 11) });
    expect(r.status).toBe(429);
  });

  it("re-soumet après refus (la ligne repasse en pending)", async () => {
    await post("/api/replay/submit", body);
    state.replays[0].status = "rejected";
    const r = await post("/api/replay/submit", body);
    expect(r.status).toBe(201);
    expect(state.replays[0].status).toBe("pending");
  });

  it("re-soumission bornée par le quota 24 h : soumettre/retirer ×5 → 429", async () => {
    for (let i = 0; i < 5; i++) {
      const code = `res${i}AAAAAAA`.slice(0, 11);
      expect((await post("/api/replay/submit", { ...body, code, mvpName: null })).status).toBe(201);
      expect((await patch(`/api/replay/${code}`, { status: "withdrawn" })).status).toBe(200);
    }
    // 5 créations sur 24 h (même retirées) → la re-soumission est refusée.
    const again = await post("/api/replay/submit", { ...body, code: "res0AAAAAAA".slice(0, 11) });
    expect(again.status).toBe(429);
  });

  it("re-soumission autorisée sous le plafond 24 h (4 créations → 201)", async () => {
    for (let i = 0; i < 4; i++) {
      const code = `sub${i}AAAAAAA`.slice(0, 11);
      await post("/api/replay/submit", { ...body, code, mvpName: null });
      await patch(`/api/replay/${code}`, { status: "withdrawn" });
    }
    const r = await post("/api/replay/submit", { ...body, code: "sub0AAAAAAA".slice(0, 11) });
    expect(r.status).toBe(201);
    expect(state.replays[0].status).toBe("pending");
  });
});

describe("GET /api/replay/recent", () => {
  it("ne liste que les publiés, tri récent d'abord, limite par défaut 5", async () => {
    const rows: ReplayRecord[] = [
      { code: "AAAAAAAAAAA", team_size: 8, mvp_name: "a", mode_key: "replayMatchTypeTeamMatch", owner_id: AUTHOR, status: "published", created_at: "2026-10-31T10:00:00Z", moderated_at: null, note: null },
      { code: "BBBBBBBBBBB", team_size: 7, mvp_name: "b", mode_key: "replayMatchTypeTeamMatch", owner_id: AUTHOR, status: "pending", created_at: "2026-10-31T11:00:00Z", moderated_at: null, note: null },
      { code: "CCCCCCCCCCC", team_size: 6, mvp_name: "c", mode_key: "replayMatchTypeTeamMatch", owner_id: AUTHOR, status: "published", created_at: "2026-10-31T09:00:00Z", moderated_at: null, note: null },
    ];
    state.replays.push(...rows);
    const r = await get("/api/replay/recent", null);
    expect(r.status).toBe(200);
    // Listing public : cache court navigateur/CDN (60 s) — pas les branches auth.
    expect(r.headers.get("cache-control")).toBe("public, max-age=60");
    const d = (await r.json()) as { items: Array<{ code: string }> };
    expect(d.items.map((i) => i.code)).toEqual(["AAAAAAAAAAA", "CCCCCCCCCCC"]);
  });
});

describe("modération et retrait", () => {
  const code = "Jd894wx6so9";

  beforeEach(async () => {
    await post("/api/replay/submit", { code, teamSize: 8, modeKey: "replayMatchTypeTeamMatch", mvpName: "Vzgo" });
  });

  it("non-admin ne peut pas publier (403)", async () => {
    const r = await patch(`/api/replay/${code}`, { status: "published" });
    expect(r.status).toBe(403);
  });

  it("admin publie puis le replay apparaît dans recent", async () => {
    const r = await patch(`/api/replay/${code}`, { status: "published" }, ADMIN);
    expect(r.status).toBe(200);
    const recent = await get("/api/replay/recent", null);
    const d = (await recent.json()) as { items: string[] };
    expect(JSON.stringify(d)).toContain(code);
  });

  it("l'auteur retire sa soumission (withdrawn), un inconnu non", async () => {
    const r = await patch(`/api/replay/${code}`, { status: "withdrawn" });
    expect(r.status).toBe(200);
    expect(state.replays[0].status).toBe("withdrawn");
    await post("/api/replay/submit", { code: "Jd894wx6so9", teamSize: 8, modeKey: "replayMatchTypeTeamMatch" });
    const other = await patch(`/api/replay/${code}`, { status: "withdrawn" }, { userId: "autre", email: "x@y.z" });
    expect(other.status).toBe(404);
  });

  it("GET submissions : scope=admin réservé aux admins (403)", async () => {
    const r = await get("/api/replay/submissions?scope=admin");
    expect(r.status).toBe(403);
    const ok = await get("/api/replay/submissions?scope=admin", ADMIN);
    expect(ok.status).toBe(200);
    // Branche authentifiée : jamais de cache public.
    expect(ok.headers.get("cache-control")).toBe("no-store");
  });

  it("PATCH : code non alphanumérique refusé (400), préfixe rep- accepté", async () => {
    const bad = await patch("/api/replay/bad_code!99", { status: "published" }, ADMIN);
    expect(bad.status).toBe(400);
    const uni = await patch("/api/replay/回放代码十一位码码码码", { status: "withdrawn" }, ADMIN);
    expect(uni.status).toBe(400);
    const ok = await patch(`/api/replay/rep-${code}`, { status: "published" }, ADMIN);
    expect(ok.status).toBe(200);
    expect(state.replays[0].status).toBe("published");
  });
});
