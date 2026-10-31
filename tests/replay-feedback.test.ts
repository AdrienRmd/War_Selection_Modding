import { beforeEach, describe, expect, it, vi } from "vitest";

// Replay phase 2 (B4) — widget « données exactes ? » : validation, auth,
// upsert modifiable, quota 10 écritures/24 h, agrégat public, récap admin.

const { envStub, getChatGPTUser } = vi.hoisted(() => ({
  envStub: {} as Record<string, unknown>,
  getChatGPTUser: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({ env: envStub }));
vi.mock("@/app/chatgpt-auth", () => ({ getChatGPTUser }));

import {
  GET as replayGet,
  POST as replayPost,
} from "@/app/api/replay/[[...path]]/route";
import { cleanFeedbackBody } from "@/lib/replay-feedback";

const ORIGIN = "http://localhost:8787";
const AUTHOR = { userId: "author-1", email: "author@sites.test" };
const OTHER = { userId: "author-2", email: "other@sites.test" };
const ADMIN = { userId: "admin", email: "admin@sites.test" };

interface FeedbackRow {
  code: string;
  user_id: string;
  vote: string;
  created_at: string;
  updated_at: string;
}
interface ReplayRow {
  code: string;
  status: string;
  team_size: number;
  created_at: string;
}

function makeDb(feedback: FeedbackRow[], replays: ReplayRow[]) {
  const stmtFor = (sql: string, args: unknown[]) => ({
    sql: sql.replace(/\s+/g, " ").trim(),
    args,
    async run() {
      const s = this.sql;
      const now = new Date().toISOString();
      if (s.startsWith("INSERT INTO replay_feedback")) {
        // INSERT ... SELECT conditionnel : quota lu au moment de l'écriture.
        const [code, userId, vote] = args as string[];
        const dayAgo = String(args[6]);
        const writes = feedback.filter((f) => f.user_id === userId && f.updated_at > dayAgo).length;
        if (writes >= 10) return { meta: { changes: 0 } };
        const existing = feedback.find((f) => f.code === code && f.user_id === userId);
        if (existing) {
          existing.vote = vote;
          existing.updated_at = now;
        } else {
          feedback.push({ code, user_id: userId, vote, created_at: now, updated_at: now });
        }
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    },
    async first<T>() {
      const s = this.sql;
      if (s.startsWith("SELECT vote FROM replay_feedback WHERE code = ? AND user_id = ?"))
        return ((feedback.find(
          (f) => f.code === this.args[0] && f.user_id === this.args[1],
        ) ?? null) as T);
      return null as T;
    },
    async all<T>() {
      const s = this.sql;
      if (s.startsWith("SELECT vote, COUNT(*)")) {
        const counts = new Map<string, number>();
        for (const f of feedback.filter((f) => f.code === this.args[0]))
          counts.set(f.vote, (counts.get(f.vote) ?? 0) + 1);
        return { results: [...counts.entries()].map(([vote, n]) => ({ vote, n })) } as T;
      }
      if (s.startsWith("SELECT f.code,")) {
        const rows = [...new Set(feedback.map((f) => f.code))].map((code) => {
          const of = feedback.filter((f) => f.code === code);
          const replay = replays.find((r) => r.code === code);
          return {
            code,
            accurate: of.filter((f) => f.vote === "accurate").length,
            mostly: of.filter((f) => f.vote === "mostly").length,
            issues: of.filter((f) => f.vote === "issues").length,
            total: of.length,
            team_size: replay?.team_size ?? null,
            status: replay?.status ?? null,
            created_at: replay?.created_at ?? null,
          };
        });
        return { results: rows.sort((a, b) => b.issues - a.issues || b.total - a.total) } as T;
      }
      return { results: [] } as T;
    },
  });
  return {
    prepare(sql: string) {
      const args: unknown[] = [];
      const stmt = {
        bind(...values: unknown[]) {
          args.length = 0;
          args.push(...values);
          return stmt;
        },
        run: () => stmtFor(sql, args).run(),
        first: <T,>() => stmtFor(sql, args).first<T>(),
        all: <T,>() => stmtFor(sql, args).all<T>(),
      };
      Object.defineProperty(stmt, "sql", { get: () => sql });
      Object.defineProperty(stmt, "args", { get: () => args });
      return stmt;
    },
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      const out = [];
      for (const st of statements) out.push(await st.run());
      return out;
    },
  };
}

let feedback: FeedbackRow[];
let replays: ReplayRow[];

function req(method: string, path: string, body: unknown, user: unknown = AUTHOR) {
  getChatGPTUser.mockResolvedValue((user ?? null) as never);
  const init: RequestInit = { method, headers: { Origin: ORIGIN } };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  return new Request(ORIGIN + path, init);
}

const ctx = (parts: string[]) => ({ params: Promise.resolve({ path: parts }) });
const post = (path: string, body: unknown, user: unknown = AUTHOR) =>
  replayPost(req("POST", path, body, user), ctx(["feedback"]));
const get = (path: string, user?: unknown) =>
  replayGet(req("GET", path, undefined, user), ctx(path.replace("/api/replay/", "").split("?")[0].split("/")));

beforeEach(() => {
  feedback = [];
  replays = [{ code: "Jd894wx6so9", status: "published", team_size: 8, created_at: "2026-10-31T12:00:00Z" }];
  envStub.DB = makeDb(feedback, replays);
  envStub.BUCKET = {};
  envStub.ADMIN_EMAILS = "admin@sites.test";
});

describe("validation du corps de vote", () => {
  it("accepte code nu ou rep- et les 3 votes, refuse le reste", () => {
    expect(cleanFeedbackBody({ code: "Jd894wx6so9", vote: "accurate" })).toEqual({
      code: "Jd894wx6so9",
      vote: "accurate",
    });
    expect(cleanFeedbackBody({ code: "rep-Jd894wx6so9", vote: "issues" })).toEqual({
      code: "Jd894wx6so9",
      vote: "issues",
    });
    expect(cleanFeedbackBody({ code: "Jd894wx6so9", vote: "nope" })).toBeNull();
    expect(cleanFeedbackBody({ code: "short", vote: "mostly" })).toBeNull();
    expect(cleanFeedbackBody(null)).toBeNull();
  });
});

describe("POST /api/replay/feedback", () => {
  it("refuse les anonymes (401) et les corps invalides (400)", async () => {
    expect((await post("/api/replay/feedback", { code: "Jd894wx6so9", vote: "accurate" }, null)).status).toBe(401);
    expect((await post("/api/replay/feedback", { code: "bad", vote: "accurate" })).status).toBe(400);
  });

  it("enregistre un vote (201) puis l'agrégat public le reflète", async () => {
    const r = await post("/api/replay/feedback", { code: "Jd894wx6so9", vote: "accurate" });
    expect(r.status).toBe(201);
    const view = await get("/api/replay/feedback?code=Jd894wx6so9");
    expect(view.status).toBe(200);
    expect(await view.json()).toEqual({
      item: { accurate: 1, mostly: 0, issues: 0, total: 1, mine: "accurate" },
    });
  });

  it("un vote par (replay, compte) : changer d'avis met à jour sans dupliquer", async () => {
    await post("/api/replay/feedback", { code: "Jd894wx6so9", vote: "accurate" });
    const changed = await post("/api/replay/feedback", { code: "Jd894wx6so9", vote: "issues" });
    expect(changed.status).toBe(201);
    expect(feedback).toHaveLength(1);
    expect(feedback[0].vote).toBe("issues");
    const view = await get("/api/replay/feedback?code=Jd894wx6so9");
    const item = ((await view.json()) as { item: { issues: number; accurate: number; total: number } }).item;
    expect(item).toMatchObject({ issues: 1, accurate: 0, total: 1 });
  });

  it("deux comptes différents : chaque (code, user) séparé ; GET anonyme sans mine", async () => {
    await post("/api/replay/feedback", { code: "Jd894wx6so9", vote: "accurate" }, AUTHOR);
    await post("/api/replay/feedback", { code: "Jd894wx6so9", vote: "mostly" }, OTHER);
    const anon = await get("/api/replay/feedback?code=Jd894wx6so9", null);
    const item = ((await anon.json()) as { item: Record<string, unknown> }).item;
    expect(item).toMatchObject({ accurate: 1, mostly: 1, total: 2 });
    expect("mine" in item).toBe(false);
  });

  it("quota : 10 écritures / 24 h puis 429 (insertions ET changements)", async () => {
    const codes = Array.from({ length: 10 }, (_, i) => `Q${i}111111111`.slice(0, 11).padEnd(11, "1"));
    for (const code of codes)
      expect((await post("/api/replay/feedback", { code, vote: "mostly" })).status).toBe(201);
    const blocked = await post("/api/replay/feedback", { code: "Zzzzzzzzzzz", vote: "accurate" });
    expect(blocked.status).toBe(429);
    // même un changement d'avis est bloqué par le quota d'écritures
    const changeBlocked = await post("/api/replay/feedback", { code: codes[0], vote: "issues" });
    expect(changeBlocked.status).toBe(429);
    // un autre compte n'est pas impacté
    expect((await post("/api/replay/feedback", { code: "Zzzzzzzzzzz", vote: "accurate" }, OTHER)).status).toBe(201);
  });
});

describe("GET /api/replay/feedback-summary", () => {
  it("réservé aux admins (401/403), agrège par code avec la ligne replays", async () => {
    await post("/api/replay/feedback", { code: "Jd894wx6so9", vote: "accurate" }, AUTHOR);
    await post("/api/replay/feedback", { code: "Jd894wx6so9", vote: "issues" }, OTHER);
    expect((await get("/api/replay/feedback-summary", null)).status).toBe(401);
    expect((await get("/api/replay/feedback-summary", AUTHOR)).status).toBe(403);
    const res = await get("/api/replay/feedback-summary", ADMIN);
    expect(res.status).toBe(200);
    const items = ((await res.json()) as { items: Array<Record<string, unknown>> }).items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      code: "Jd894wx6so9",
      accurate: 1,
      issues: 1,
      total: 2,
      teamSize: 8,
      status: "published",
    });
  });

  it("trie les codes les plus signalés d'abord", async () => {
    await post("/api/replay/feedback", { code: "Jd894wx6so9", vote: "accurate" }, AUTHOR);
    await post("/api/replay/feedback", { code: "HkvVncU3mq9", vote: "issues" }, OTHER);
    replays.push({ code: "HkvVncU3mq9", status: "published", team_size: 7, created_at: "2026-10-31T10:00:00Z" });
    const res = await get("/api/replay/feedback-summary", ADMIN);
    const items = ((await res.json()) as { items: Array<{ code: string }> }).items;
    expect(items.map((i) => i.code)).toEqual(["HkvVncU3mq9", "Jd894wx6so9"]);
  });
});
