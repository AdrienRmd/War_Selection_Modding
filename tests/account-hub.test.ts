import { beforeEach, describe, expect, it, vi } from "vitest";

// SB3 : les compteurs du hub /account doivent égaler exactement le contenu
// de GET /api/atlas/submissions et GET /api/mods/submissions (scope owner).
// lib/account-server.ts étant la source partagée (la route atlas l'appelle
// pour son scope owner), on verrouille ici : (1) la requête SQL identique à
// celle de l'API, (2) la fusion mods admin = miroir de la route, (3)
// l'agrégation par statut égale au décompte des items tels que l'API les
// retourne.

const { envStub, listMods } = vi.hoisted(() => ({
  envStub: {} as Record<string, unknown>,
  listMods: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({ env: envStub }));
vi.mock("@/lib/mod-server", () => ({ listMods }));
vi.mock("@/app/chatgpt-auth", () => ({ getChatGPTUser: vi.fn() }));

import { countCreations, creationCounts, ownMaps, ownMods } from "@/lib/account-server";
import type { MapRecord } from "@/lib/atlas-server";

function mapRow(id: string, owner: string, status: string): MapRecord {
  return {
    id,
    owner_id: owner,
    author: "Ada",
    title: `Carte ${id}`,
    summary: "résumé",
    description: "description",
    game_version: "r1",
    players: 2,
    category: "历史战役",
    mods: "无",
    map_code: "",
    status,
    file_name: "carte.zip",
    file_key: `cle-${id}`,
    file_size: 1024,
    sha256: "a".repeat(64),
    cover_key: null,
    cover_type: null,
    created_at: "2026-01-01T00:00:00Z",
    reviewed_at: null,
    feedback: "",
    revision: 0,
  };
}

describe("ownMaps : même source que GET /api/atlas/submissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envStub.DB = { prepare: () => ({ bind: () => ({ all: async () => ({ results: [] }) }) }) };
    envStub.BUCKET = {};
  });

  it("exécute la requête owner exacte de l'API (SQL + bind)", async () => {
    const seen: { sql?: string; bound?: unknown } = {};
    envStub.DB = {
      prepare(sql: string) {
        seen.sql = sql;
        return {
          bind(value: unknown) {
            seen.bound = value;
            return {
              all: async () => ({ results: [] }),
            };
          },
        };
      },
    };
    await ownMaps("u1");
    expect(seen.sql).toBe(
      "SELECT * FROM maps WHERE owner_id = ? ORDER BY created_at DESC LIMIT 100",
    );
    expect(seen.bound).toBe("u1");
  });

  it("agrège les statuts de toutes les cartes du propriétaire, withdrawn inclus", async () => {
    envStub.DB = {
      prepare() {
        return {
          bind() {
            return {
              all: async () => ({
                results: [
                  mapRow("a", "u1", "pending"),
                  mapRow("b", "u1", "pending"),
                  mapRow("c", "u1", "approved"),
                  mapRow("d", "u1", "rejected"),
                  mapRow("e", "u1", "withdrawn"),
                ],
              }),
            };
          },
        };
      },
    };
    const maps = await ownMaps("u1");
    // Items tels que l'API les retourne : {...publicMap(m), status, feedback,
    // revision} — le statut porté par l'item EST le statut de la ligne.
    const apiItems = maps.map((m) => ({ status: m.status }));
    const counts = countCreations(apiItems, []);
    expect(counts.maps).toEqual({ pending: 2, approved: 1, rejected: 1, withdrawn: 1 });
    expect(counts.mods).toEqual({});
  });
});

describe("ownMods : miroir de GET /api/mods/submissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envStub.DB = { prepare: () => ({ bind: () => ({ all: async () => ({ results: [] }) }) }) };
    envStub.BUCKET = {};
  });

  it("utilisateur simple : uniquement ses propres mods", async () => {
    listMods.mockResolvedValue([
      { status: "pending", origin: "community" },
      { status: "approved", origin: "community" },
      { status: "approved", origin: "community" },
    ]);
    const mods = await ownMods("u1", false);
    expect(listMods).toHaveBeenCalledWith("u1", false, true);
    expect(listMods).toHaveBeenCalledTimes(1);
    expect(countCreations([], mods).mods).toEqual({ pending: 1, approved: 2 });
  });

  it("admin : entrées éditoriales (hors community) + propres mods, comme la route", async () => {
    listMods.mockImplementation(async (_u: string, admin: boolean) =>
      admin
        ? [
            { status: "approved", origin: "editorial" },
            { status: "approved", origin: "editorial" },
            { status: "pending", origin: "community" }, // mods d'un autre joueur
          ]
        : [{ status: "pending", origin: "community" }],
    );
    const mods = await ownMods("admin", true);
    expect(listMods).toHaveBeenCalledWith("admin", false, true);
    expect(listMods).toHaveBeenCalledWith("admin", true, true);
    // La soumission communautaire d'un tiers n'apparaît pas (scope owner),
    // les 2 entrées éditoriales oui — ordre de la route : curated puis own.
    expect(mods).toEqual([
      { status: "approved", origin: "editorial" },
      { status: "approved", origin: "editorial" },
      { status: "pending", origin: "community" },
    ]);
  });
});

describe("creationCounts : agrégation complète en 2 sources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envStub.DB = {
      prepare() {
        return {
          bind() {
            return {
              all: async () => ({ results: [mapRow("a", "u1", "approved")] }),
            };
          },
        };
      },
    };
    envStub.BUCKET = {};
  });

  it("combine cartes et mods sans en perdre un statut", async () => {
    envStub.DB = {
      prepare() {
        return {
          bind() {
            return {
              all: async () => ({ results: [mapRow("a", "u1", "approved")] }),
            };
          },
        };
      },
    };
    listMods.mockResolvedValue([{ status: "pending", origin: "community" }]);
    const counts = await creationCounts("u1", false);
    expect(counts).toEqual({
      maps: { approved: 1 },
      mods: { pending: 1 },
    });
  });
});
