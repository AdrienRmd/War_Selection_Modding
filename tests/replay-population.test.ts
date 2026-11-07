import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildGameContext } from "@/lib/replay/context";
import { ReplayInfoParser } from "@/lib/replay/parser";
import { playerSeries } from "@/lib/replay/analysis";
import { isReplaySuccess } from "@/lib/replay/structure";
import {
  REPLAY_DATASET_POPULATION,
  armyPointsCreatedTotal,
  armyPopulationCreated,
  armyPopulationRatio,
  ecoPopulation,
  formatMinutesSeconds,
  populationAtTick,
  populationYMax,
  unitSupplyConsume,
} from "@/lib/replay/population";
import {
  PLAYER_COLORS,
  lightenColor,
  populationPlayerColor,
} from "@/components/replay/chart-theme";

/* Population (estimation) — série par joueur du replay (mission 06/11).
 * Fixtures réelles de l'espace pilote (garde-fou hors VPS : test sauté). */
const REPLAYS_DIR = "/home/ubuntu/War-Selection/datasets/replays";
const CONTEXT_PATH = "/home/ubuntu/War-Selection/datasets/served/content/context.json";

const loadFixture = (code: string) => {
  const path = join(REPLAYS_DIR, `replay-${code}.json`);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
};

describe("population — primitives", () => {
  it("supply du dataset : coûts connus, 0 pour les bâtiments", () => {
    expect(unitSupplyConsume("WarSelection/1/worker")).toBe(1);
    expect(unitSupplyConsume("WarSelection/5/tractor")).toBe(3);
    expect(unitSupplyConsume("WarSelection/4/de/cannon/big_bertha")).toBe(9);
    expect(unitSupplyConsume("WarSelection/1/hut")).toBe(0); // bâtiment
    expect(unitSupplyConsume("WarSelection/inconnu")).toBe(0);
  });

  it("éco exacte : workers×1 + boats×2 + tracteurs×3", () => {
    expect(ecoPopulation(11, 0, 0)).toBe(11);
    expect(ecoPopulation(66, 6, 5)).toBe(66 + 12 + 15);
    expect(ecoPopulation(undefined, undefined, undefined)).toBe(0);
  });

  it("calibration R : garde-fous division par zéro / valeurs nulles", () => {
    expect(armyPopulationRatio(0, 100)).toBe(0);
    expect(armyPopulationRatio(100, 0)).toBe(0);
    expect(armyPopulationRatio(100, NaN)).toBe(0);
    expect(armyPopulationRatio(240, 1200)).toBeCloseTo(0.2, 6);
  });

  it("points d'armée créés : max(create + kill cumulé)", () => {
    expect(armyPointsCreatedTotal([23, 40, 10], [0, 0, 90])).toBe(100);
    expect(armyPointsCreatedTotal([], [])).toBe(0);
  });

  it("populationAtTick : entier positif, jamais NaN, armée nulle sans ratio", () => {
    expect(populationAtTick(11, 500, 0)).toBe(11);
    expect(populationAtTick(11, 500, 0.2)).toBe(111);
    expect(populationAtTick(0, 0, 0.5)).toBe(0);
    expect(Number.isFinite(populationAtTick(Infinity, 1, 1))).toBe(true);
  });

  it("cadrage Y : 600 par défaut, étendu par multiples de 100", () => {
    expect(populationYMax(0)).toBe(600);
    expect(populationYMax(598)).toBe(600);
    expect(populationYMax(601)).toBe(700);
    expect(populationYMax(1200)).toBe(1200);
    expect(populationYMax(NaN)).toBe(600);
  });

  it("MM:SS : minutes paddées, heures en repli", () => {
    expect(formatMinutesSeconds(0)).toBe("00:00");
    expect(formatMinutesSeconds(90)).toBe("01:30");
    expect(formatMinutesSeconds(2349)).toBe("39:09");
    expect(formatMinutesSeconds(3661)).toBe("1:01:01");
  });
});

describe("population — palette joueur (graphe Chart.js)", () => {
  it("10 premiers joueurs : palette mesurée telle quelle", () => {
    PLAYER_COLORS.forEach((c, i) => expect(populationPlayerColor(i)).toBe(c));
  });

  it("au-delà de 10 : même teinte éclaircie de 12 %, cycle stable", () => {
    expect(populationPlayerColor(10)).toBe(lightenColor(PLAYER_COLORS[0], 0.12));
    expect(populationPlayerColor(13)).toBe(lightenColor(PLAYER_COLORS[3], 0.12));
    expect(populationPlayerColor(20)).toBe(lightenColor(PLAYER_COLORS[0], 0.12));
    expect(populationPlayerColor(0)).not.toBe(populationPlayerColor(10));
  });

  it("14 joueurs = 14 couleurs distinctes (14 joueurs d'un 7v7 réel)", () => {
    const colors = Array.from({ length: 14 }, (_, i) => populationPlayerColor(i));
    expect(new Set(colors).size).toBe(14);
  });
});

describe("population — parser sur replay réel 7v7", () => {
  const fixture = loadFixture("jxXISVZ90rk");
  it.skipIf(fixture === null)("série population pour chaque joueur", () => {
    const context = buildGameContext(JSON.parse(readFileSync(CONTEXT_PATH, "utf8")));
    const result = new ReplayInfoParser(context, "jxXISVZ90rk").parse(fixture);
    expect(isReplaySuccess(result)).toBe(true);
    if (!isReplaySuccess(result)) return;
    for (const player of result.players) {
      const series = playerSeries(result, REPLAY_DATASET_POPULATION, player);
      expect(series).not.toBeNull();
      expect(series!.length).toBeGreaterThan(2);
      // valeurs finies, entières, ≥ 0
      for (const v of series!) expect(Number.isInteger(v) && v >= 0).toBe(true);
    }
  });

  it.skipIf(fixture === null)(
    "éliminé : la série retombe à 0 après l'élimination (repli abrupt)",
    () => {
      const context = buildGameContext(JSON.parse(readFileSync(CONTEXT_PATH, "utf8")));
      const result = new ReplayInfoParser(context, "jxXISVZ90rk").parse(fixture);
      if (!isReplaySuccess(result)) return;
      // joueur éliminé AVANT le dernier quart de la partie (repli visible)
      const dead = result.players.find(
        (p) => p.isDead && (p.survivalTime ?? 0) > 0 && p.survivalTime! < result.match.duration * 0.75,
      );
      expect(dead).toBeDefined();
      const series = playerSeries(result, REPLAY_DATASET_POPULATION, dead!);
      expect(series).not.toBeNull();
      const deathTick = Math.max(1, Math.ceil((dead!.survivalTime! / 1000) / 30));
      // avant la mort : population > 0 ; après (marge de deux relevés) :
      // repli abrupt à ~0 (résiduel réel ≤ 20 % du pic — unités survivantes
      // du jeu, la timeline les met à zéro quelques relevés plus tard).
      const peak = Math.max(...series!);
      expect(series!.slice(1, Math.max(2, deathTick - 1)).some((v) => v > 0)).toBe(true);
      const tail = series!.slice(Math.min(deathTick + 2, series!.length - 1));
      expect(tail.length).toBeGreaterThan(0);
      for (const v of tail) expect(v).toBeLessThanOrEqual(Math.max(5, peak * 0.2));
    },
  );

  it.skipIf(fixture === null)("amplitude plausible (0–600 usuel, extensible)", () => {
    const context = buildGameContext(JSON.parse(readFileSync(CONTEXT_PATH, "utf8")));
    const result = new ReplayInfoParser(context, "jxXISVZ90rk").parse(fixture);
    if (!isReplaySuccess(result)) return;
    const max = Math.max(
      ...result.players.flatMap((p) => playerSeries(result, REPLAY_DATASET_POPULATION, p) ?? [0]),
    );
    expect(max).toBeGreaterThan(30); // une vraie partie dépasse la pop de départ
    expect(max).toBeLessThan(1200); // et reste dans un ordre de grandeur réaliste
  });

  it("armyPopulationCreated ignore la catégorie worker (comptée par tick)", () => {
    const units = new Map([
      [
        "unitCategoryWorker",
        [
          { id: "WarSelection/1/worker", number: 40 },
          { id: "WarSelection/5/fisher", number: 4 },
        ],
      ],
      [
        "unitCategoryLand",
        [
          { id: "WarSelection/3/ee/catapult", number: 5 }, // 4 pop
          { id: "WarSelection/2/e/archer", number: 10 }, // 1 pop
        ],
      ],
    ]);
    expect(armyPopulationCreated(units)).toBe(5 * 4 + 10 * 1);
    expect(armyPopulationCreated(undefined)).toBe(0);
  });
});
