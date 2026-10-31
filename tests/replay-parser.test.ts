import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGameContext } from "@/lib/replay/context";
import { calcKillDeath } from "@/lib/replay/kill-death";
import { getCachedReplay, parseReplayCode } from "@/lib/replay";
import { ReplayInfoParser } from "@/lib/replay/parser";
import { TimeLineDataset, TimeLineMultiRowDataset } from "@/lib/replay/dataset";
import { isReplaySuccess } from "@/lib/replay/structure";

// Système Replay (Chantier B) — tests du port du parser wsunitstats.
// Fixtures : vraies réponses de l'API officielle games-api.warselect.io,
// stockées dans l'espace pilote (garde-fou hors VPS : test sauté).
const REPLAYS_DIR = "/home/ubuntu/War-Selection/datasets/replays";
const CONTEXT_PATH = "/home/ubuntu/War-Selection/datasets/served/content/context.json";

const loadFixture = (code: string): unknown | null => {
  const path = join(REPLAYS_DIR, `replay-${code}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
};

// Match 7v7 réel (28/10/2026) : 14 joueurs, 16 factions, équipes 2×7,
// scriptParameters format legacy, extraData['7'] présent (non legacy).
const TEAM_7V7 = "jxXISVZ90rk";
// Match 6v6 réel (28/10/2026).
const TEAM_6V6 = "JUqOV1ljGxg";

describe("normalisation du code de replay", () => {
  it("accepte le code nu et le préfixe rep-, exige 11 caractères, casse préservée", () => {
    expect(parseReplayCode("jxXISVZ90rk")).toBe("jxXISVZ90rk");
    expect(parseReplayCode("rep-jxXISVZ90rk")).toBe("jxXISVZ90rk");
    expect(parseReplayCode("  rep-JUqOV1ljGxg  ")).toBe("JUqOV1ljGxg");
    expect(parseReplayCode("JXOXISVZ90RK")).not.toBe("jxXISVZ90rk"); // sensible à la casse
    expect(parseReplayCode("court")).toBeNull();
    expect(parseReplayCode("trop-long-pour-etre-un-code")).toBeNull();
    expect(parseReplayCode("rep-abcd")).toBeNull();
    expect(parseReplayCode(undefined)).toBeNull();
  });

  it("exige 11 caractères alphanumériques (charset API officielle)", () => {
    // 11 caractères MAIS charset exotique → refusés (durcissement revue).
    expect(parseReplayCode("jxXISVZ9_rk")).toBeNull(); // soulignement
    expect(parseReplayCode("bad_code!99")).toBeNull(); // ponctuation
    expect(parseReplayCode("jxXISVZ9-rk")).toBeNull(); // tiret interne (11 car.)
    expect(parseReplayCode("回放代码十一位码码码码")).toBeNull(); // unicode (11 caractères)
    expect(parseReplayCode("@@@@@@@@@@@")).toBeNull(); // symboles (11 car.)
    expect(parseReplayCode("jxXISVZ9 rk")).toBeNull(); // espace interne (11 car.)
    // La casse et le mixte chiffres/lettres restent acceptés.
    expect(parseReplayCode("Jd894wx6so9")).toBe("Jd894wx6so9");
    expect(parseReplayCode("0123456789a")).toBe("0123456789a");
  });
});

describe("parser de replay — match réel 7v7 (fixture API)", () => {
  const fixture = loadFixture(TEAM_7V7);
  it.skipIf(fixture === null)("parse le match complet", () => {
    const context = buildGameContext(JSON.parse(readFileSync(CONTEXT_PATH, "utf8")));
    const result = new ReplayInfoParser(context, TEAM_7V7).parse(fixture as object);

    expect(isReplaySuccess(result)).toBe(true);
    if (!isReplaySuccess(result)) return;
    // Match : mode par équipes, 14 joueurs, durée cohérente.
    expect(result.match.mode).toBe("replayMatchTypeTeamMatch");
    expect(result.match.playersCount).toBe(14);
    expect(result.match.duration).toBeGreaterThan(0);
    expect(result.match.replayCode).toBe(TEAM_7V7);
    // Équipes : 4 entrées dont 2 équipes pleines de 7 joueurs.
    expect(result.teams).toHaveLength(4);
    const fullTeams = result.teams.filter((t) => t.players.length === 7);
    expect(fullTeams).toHaveLength(2);
    // Exactement une équipe gagnante parmi les équipes pleines.
    expect(fullTeams.filter((t) => t.isWinner)).toHaveLength(1);
    // Joueurs : 14, MVP unique parmi ceux avec timeline.
    expect(result.players.filter(Boolean)).toHaveLength(14);
    const mvpPlayers = result.players.filter((p) => p.isMvp);
    expect(mvpPlayers).toHaveLength(1);
    expect(mvpPlayers[0].mvpScore).toBeGreaterThan(0);
    // Chaque joueur a un pseudo et une couleur de faction.
    for (const player of result.players) {
      expect(player.nickname.length).toBeGreaterThan(0);
      expect(player.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(player.survivalOn).toBe(true);
      expect(player.researchOn).toBe(true);
      expect(player.unitsKilledOn).toBe(true);
    }
    // Timeline : périodes de 30 s, courbes non vides.
    expect(result.timeLinePeriod).toBe(30000);
    expect(result.charts.length).toBeGreaterThan(5);
    const armyChart = result.charts.find(
      (c) => c.containerName === "replayDatasetUnitCreatePointsName",
    );
    expect(armyChart).toBeDefined();
    const playersGroup = armyChart!.datasetGroups.find(
      (g) => g.dataGroupIdentifier === "players",
    )!;
    expect(playersGroup.datasets.length).toBe(14);
    // Les séries players ont toutes une longueur = timeline + 1 (point 0).
    for (const dataset of playersGroup.datasets as TimeLineDataset[]) {
      expect(dataset.values.length).toBeGreaterThan(2);
    }
    // Événements de recherche présents sur au moins un joueur.
    const researchChart = result.charts.find(
      (c) => c.containerName === "replayDatasetResearchesName",
    );
    expect(researchChart).toBeDefined();
    const researchPlayers = researchChart!.datasetGroups.find(
      (g) => g.dataGroupIdentifier === "players",
    )!;
    const totalEvents = researchPlayers.datasets.reduce(
      (acc, d) => acc + (d as unknown as { events: unknown[] }).events.length,
      0,
    );
    expect(totalEvents).toBeGreaterThan(50);
  });

  it.skipIf(fixture === null)("calcule le K/D des joueurs à partir des unités", () => {
    const context = buildGameContext(JSON.parse(readFileSync(CONTEXT_PATH, "utf8")));
    const result = new ReplayInfoParser(context, TEAM_7V7).parse(fixture as object);
    expect(isReplaySuccess(result)).toBe(true);
    if (!isReplaySuccess(result)) return;
    let withKd = 0;
    for (const player of result.players) {
      const kd = calcKillDeath(player, context.killValues);
      if (kd) {
        withKd++;
        expect(kd.raw).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(kd.value)).toBe(true);
      }
    }
    expect(withKd).toBeGreaterThan(5);
  });
});

describe("parser de replay — états d'erreur de l'API", () => {
  const context = buildGameContext({ units: [], researches: [] });

  it("code inexistant → erreur 2 avec message", () => {
    const result = new ReplayInfoParser(context, "AAAAAAAAAAA").parse({
      error: 2,
      description: "No replay",
    });
    expect(result.error).toBe(2);
    expect(result.message).toContain("does not exist");
  });

  it("code incorrect → erreur 5 reportée avec la description", () => {
    const result = new ReplayInfoParser(context, "AAAAAAAAAAA").parse({
      error: 5,
      description: "Incorrect replay code: AAAAAAAAAAA",
    });
    expect(result.error).toBe(5);
    expect(result.message).toContain("Incorrect replay code");
  });

  it("maintenance → erreur 6", () => {
    const result = new ReplayInfoParser(context, "AAAAAAAAAAA").parse({ error: 6 });
    expect(result.error).toBe(6);
    expect(result.message).toContain("maintenance");
  });

  it("données de match absentes → erreur 255", () => {
    const result = new ReplayInfoParser(context, "AAAAAAAAAAA").parse({
      error: 0,
      data: { initData: { players: [1], teams: [[0]] }, extraData: {} },
    });
    expect(result.error).toBe(255);
    expect(result.message).toContain("Match data is absent");
  });
});

describe("client replay (fetch injecté)", () => {
  const fixture = loadFixture(TEAM_6V6);
  it.skipIf(fixture === null)("appelle l'API officielle et met en cache le résultat", async () => {
    const contextJson = JSON.parse(readFileSync(CONTEXT_PATH, "utf8"));
    const calls: string[] = [];
    const fetchImpl = ((url: string) => {
      calls.push(url);
      return Promise.resolve(
        new Response(JSON.stringify(fixture), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }) as unknown as typeof fetch;
    // Contexte servi localement au lieu de /wus-data (hors navigateur).
    const contextFetch = ((url: string) => {
      if (String(url).includes("context.json")) {
        return Promise.resolve(
          new Response(JSON.stringify(contextJson), { status: 200 }),
        );
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    }) as unknown as typeof fetch;
    // Injection : le module utilise fetch pour le contexte ET l'API.
    let apiCalls = 0;
    const combinedFetch = ((url: string) => {
      const s = String(url);
      if (s.startsWith("https://games-api.warselect.io/")) {
        apiCalls++;
        return Promise.resolve(
          new Response(JSON.stringify(fixture), { status: 200 }),
        );
      }
      if (s.includes("context.json")) {
        return Promise.resolve(new Response(JSON.stringify(contextJson), { status: 200 }));
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    }) as unknown as typeof fetch;
    void calls;
    void contextFetch;
    void fetchImpl;

    const first = await getCachedReplay(TEAM_6V6, combinedFetch);
    expect(isReplaySuccess(first)).toBe(true);
    if (!isReplaySuccess(first)) return;
    expect(first.match.playersCount).toBe(12);
    expect(first.match.mode).toBe("replayMatchTypeTeamMatch");
    // Cache mémoire : un second appel ne re-fetch pas l'API.
    const second = await getCachedReplay(TEAM_6V6, combinedFetch);
    expect(second).toBe(first);
    expect(apiCalls).toBe(1);
  });

  it("erreur réseau → message d'état clair, sans exception", async () => {
    const failingFetch = (() =>
      Promise.reject(new Error("offline"))) as unknown as typeof fetch;
    const result = await getCachedReplay("AAAAAAAAAAA", failingFetch);
    expect(result.error).toBe(255);
    expect(!isReplaySuccess(result) && result.message).toBe("network");
  });
});

describe("jeux de données timeline", () => {
  it("TimeLineDataset suit min/max/moyennes locales et globales", () => {
    const dataset = new TimeLineDataset("test", false, null, "win", "#fff", 10);
    dataset.push(2);
    dataset.push(4);
    expect(dataset.values).toEqual([0, 2, 4]);
    expect(dataset.max).toBe(4);
    expect(dataset.pointsSum).toBe(6);
    expect(dataset.pointsAvgLocal).toBeCloseTo(2);
    expect(dataset.pointsAvgGlobal).toBeCloseTo(0.6);
  });

  it("TimeLineMultiRowDataset somme par ligne et rejette les largeurs incohérentes", () => {
    const dataset = new TimeLineMultiRowDataset("test", false, null, "win", 3, 10);
    dataset.push([1, 2, 3]);
    // Comportement de la source : push écrit à l'index courant, compute
    // écrit à l'index suivant (décalage du point initial) — ici [1, 10].
    dataset.computeSum(0, [10, 20, 30]);
    expect(dataset.values[0]).toEqual([1, 10]);
    expect(() => dataset.push([1, 2])).toThrow(/should match/);
  });
});
