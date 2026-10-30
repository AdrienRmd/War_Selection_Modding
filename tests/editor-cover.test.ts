import { beforeEach, describe, expect, it, vi } from "vitest";

// MINEUR #3 (audit V2-P4) — couvertures téléversées via l'ÉDITEUR de carte
// (PATCH /api/editor/{id}) : mêmes normes que les avatars — structure
// parcourable + purge EXIF/texte AVANT le put R2.

const { envStub, getChatGPTUser } = vi.hoisted(() => ({
  envStub: {} as Record<string, unknown>,
  getChatGPTUser: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({ env: envStub }));
vi.mock("@/app/chatgpt-auth", () => ({ getChatGPTUser }));

import { PATCH } from "@/app/api/editor/[id]/route";
import type { MapRecord } from "@/lib/atlas-server";

const ORIGIN = "http://localhost:8787";
const AUTHOR_ID = "22222222-2222-4222-8222-222222222222";
const MAP_ID = "11111111-1111-4111-8111-111111111111";

function mapRow(): MapRecord {
  return {
    id: MAP_ID,
    owner_id: AUTHOR_ID,
    author: "Ada Code",
    title: "Carte QA",
    summary: "résumé de test",
    description: "description de test suffisamment longue pour la validation.",
    game_version: "v42",
    players: 8,
    category: "历史战役",
    mods: "无",
    map_code: "map-1c54042c",
    status: "approved",
    file_name: "carte.zip",
    file_key: "submissions/x/map.zip",
    file_size: 1024,
    sha256: "a".repeat(64),
    cover_key: null,
    cover_type: null,
    created_at: "2026-10-01T00:00:00Z",
    reviewed_at: "2026-10-02T00:00:00Z",
    feedback: "",
    revision: 3,
    test_status: "untested",
    test_updated_at: null,
    test_set_by: null,
    test_notes: "",
    author_verified: 1,
  };
}

function makeDb(row: MapRecord | null) {
  return {
    prepare(sql: string) {
      return {
        bind() {
          return {
            first: async () => {
              if (sql.includes("SELECT * FROM maps WHERE id = ?")) return row;
              return null;
            },
            all: async () => ({ results: [] }),
            run: async () => ({ meta: { changes: 1 } }),
          };
        },
      };
    },
    batch: async (stmts: unknown[]) => stmts.map(() => ({ meta: { changes: 1 } })),
  };
}

function makeBucket() {
  return {
    puts: [] as { key: string; bytes: Uint8Array; type: string }[],
    async put(key: string, bytes: Uint8Array, opts: { httpMetadata: { contentType: string } }) {
      this.puts.push({ key, bytes, type: opts.httpMetadata.contentType });
    },
    async delete() {},
    async get() {
      return null;
    },
  };
}

const chars = (s: string) => Array.from(s).map((c) => c.charCodeAt(0));
const pngChunk = (type: string, data: number[]) => {
  const body = [
    data.length >>> 24,
    (data.length >>> 16) & 255,
    (data.length >>> 8) & 255,
    data.length & 255,
  ];
  return [...body, ...Array.from(type).map((c) => c.charCodeAt(0)), ...data, 1, 2, 3, 4];
};
const pngWithMeta = () =>
  new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10,
    ...pngChunk("IHDR", new Array(13).fill(1)),
    ...pngChunk("eXIf", chars("GPS 48.8584,2.2945")),
    ...pngChunk("tEXt", [...chars("Auteur"), 0, ...chars("Ada")]),
    ...pngChunk("IDAT", [1, 2, 3, 4]),
    ...pngChunk("IEND", []),
  ]);

const textOf = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join("");

let bucket: ReturnType<typeof makeBucket>;

beforeEach(() => {
  vi.clearAllMocks();
  getChatGPTUser.mockResolvedValue({
    userId: AUTHOR_ID,
    displayName: "Ada Code",
    email: "ada@example.test",
  });
  envStub.DB = makeDb(mapRow());
  bucket = makeBucket();
  envStub.BUCKET = bucket;
});

const patchEditor = (files: Record<string, File>) => {
  const form = new FormData();
  form.set("title", "Carte QA");
  form.set("author", "Ada Code");
  form.set("summary", "résumé de test");
  form.set("description", "description de test suffisamment longue pour la validation.");
  form.set("game_version", "v42");
  form.set("players", "8");
  form.set("category", "历史战役");
  form.set("mods", "无");
  form.set("map_code", "map-1c54042c");
  form.set("revision", "3");
  for (const [k, v] of Object.entries(files)) form.set(k, v);
  return PATCH(
    new Request(`${ORIGIN}/api/editor/${MAP_ID}`, {
      method: "PATCH",
      headers: { origin: ORIGIN },
      body: form,
    }),
    { params: Promise.resolve({ id: MAP_ID }) },
  );
};

describe("MINEUR #3 — couverture via /api/editor : purge EXIF avant R2", () => {
  it("cover PNG avec eXIf/tEXt → stockée purgée, type inspection serveur", async () => {
    const res = await patchEditor({ cover: new File([pngWithMeta()], "c.png", { type: "image/png" }) });
    expect(res.status).toBe(200);
    const put = bucket.puts.find((p) => p.key.includes("/cover"));
    expect(put).toBeTruthy();
    expect(put!.type).toBe("image/png");
    const stored = textOf(put!.bytes);
    expect(stored).not.toContain("GPS");
    expect(stored).not.toContain("Auteur");
    expect(stored).toContain("IHDR");
  });

  it("cover PNG à structure invalide → 400, aucun put R2", async () => {
    const broken = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0xff, 0xff, 0xff]);
    const res = await patchEditor({
      cover: new File([broken], "c.png", { type: "image/png" }),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("封面文件无效，请重新选择。");
    expect(bucket.puts).toEqual([]);
  });
});
