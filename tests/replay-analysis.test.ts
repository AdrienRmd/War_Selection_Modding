import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGameContext } from "@/lib/replay/context";
import { ReplayInfoParser } from "@/lib/replay/parser";
import { parseReplayCode, REPLAY_API_BASE } from "@/lib/replay";
import { isReplaySuccess } from "@/lib/replay/structure";
import { buildReplayAnalysis } from "@/lib/replay/analysis";

// Analyse de replay « façon wsva » — tests sur les fixtures fraîches du
// 31/10/2026 (matchs 8v8 / 7v7 / 6v6, error=0). Garde-fou hors VPS : skip.
const REPLAYS_DIR = "/home/ubuntu/War-Selection/datasets/replays";
const CONTEXT_PATH = "/home/ubuntu/War-Selection/datasets/served/content/context.json";

const FIXTURES = ["Jd894wx6so9", "HkvVncU3mq9", "vjaltkPV6C6"] as const;

interface Loaded {
  code: string;
  analysis: ReturnType<typeof buildReplayAnalysis>;
  duration: number;
}

const loaded: Loaded[] = [];
if (existsSync(CONTEXT_PATH)) {
  const context = buildGameContext(JSON.parse(readFileSync(CONTEXT_PATH, "utf8")));
  for (const code of FIXTURES) {
    const path = join(REPLAYS_DIR, `wsva-${code}.json`);
    if (!existsSync(path)) continue;
    const json = JSON.parse(readFileSync(path, "utf8"));
    const result = new ReplayInfoParser(context, code).parse(json);
    if (!isReplaySuccess(result)) continue;
    loaded.push({ code, analysis: buildReplayAnalysis(result), duration: result.match.duration });
  }
}

const byCode = (code: string): Loaded | undefined => loaded.find((l) => l.code === code);
const fmt = (ms: number) => Math.round(ms / 1000);

describe("analyse replay wsva — fixtures réelles (8v8/7v7/6v6)", () => {
  it("charge au moins les trois fixtures fraîches", () => {
    expect(loaded.length).toBeGreaterThanOrEqual(3);
  });

  it("verdict : Rouge gagne par élimination sur le 8v8 capturé", () => {
    const m = byCode("Jd894wx6so9");
    expect(m).toBeDefined();
    if (!m) return;
    expect(m.analysis.verdict.winnerSide).toBe(1); // Red (2e équipe)
    expect(m.analysis.verdict.reason).toBe("elimination");
    expect(m.analysis.verdict.teamSize).toBe(8);
    expect(m.analysis.verdict.modeKey).toBe("replayMatchTypeTeamMatch");
  });

  it("verdict : 7v7 et 6v6 cohérents", () => {
    expect(byCode("HkvVncU3mq9")?.analysis.verdict.teamSize).toBe(7);
    expect(byCode("vjaltkPV6C6")?.analysis.verdict.teamSize).toBe(6);
    expect(byCode("vjaltkPV6C6")?.analysis.verdict.winnerSide).toBe(1);
  });

  it("power : parts Blue+Red = 1, bornées [0,1], sur toute la durée", () => {
    for (const l of loaded) {
      const power = l.analysis.power;
      expect(power).not.toBeNull();
      if (!power) continue;
      expect(power.blue.length).toBeGreaterThan(60);
      expect(power.blue.length).toBe(power.red.length);
      for (let i = 0; i < power.blue.length; i++) {
        const b = power.blue[i];
        const r = power.red[i];
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(1);
        expect(Math.abs(b + r - 1)).toBeLessThan(1e-9);
      }
      // Dernier point aligné sur la fin de partie (gagnant ≥ 60 %).
      const lastBlue = power.blue[power.blue.length - 1];
      const winnerIsRed = l.analysis.verdict.winnerSide === 1;
      const winnerPower = winnerIsRed ? 1 - lastBlue : lastBlue;
      expect(winnerPower).toBeGreaterThan(0.6);
    }
  });

  it("power : Red ≈ 55 % à 17:30 sur le 8v8 capturé (calibrage wsva)", () => {
    const m = byCode("Jd894wx6so9");
    if (!m?.analysis.power) return;
    const idx = Math.round((17.5 * 60 * 1000) / 30000) - 1;
    const red = m.analysis.power.red[idx];
    expect(red).toBeGreaterThan(0.45);
    expect(red).toBeLessThan(0.62);
  });

  it("win chance : démarre ≈ 50 %, gagnant ≥ 90 % à la fin", () => {
    for (const l of loaded) {
      const wc = l.analysis.winChanceBlue;
      expect(wc).not.toBeNull();
      if (!wc) continue;
      expect(wc[0]).toBeGreaterThan(0.3);
      expect(wc[0]).toBeLessThan(0.7);
      const finalBlue = wc[wc.length - 1];
      const winnerBlue = l.analysis.verdict.winnerSide === 0;
      const winnerFinal = winnerBlue ? finalBlue : 1 - finalBlue;
      expect(winnerFinal).toBeGreaterThan(0.9);
    }
  });

  it("événements décisifs : non vides, triés, ≤ 8, temps dans la partie", () => {
    for (const l of loaded) {
      const events = l.analysis.events;
      expect(events.length).toBeGreaterThan(0);
      expect(events.length).toBeLessThanOrEqual(8);
      for (let i = 1; i < events.length; i++)
        expect(events[i].timeMs).toBeGreaterThanOrEqual(events[i - 1].timeMs);
      for (const e of events) {
        expect(e.timeMs).toBeGreaterThan(0);
        expect(e.timeMs).toBeLessThanOrEqual(l.duration);
        expect(e.winBefore).toBeGreaterThanOrEqual(0);
        expect(e.winAfter).toBeLessThanOrEqual(1);
      }
    }
  });

  it("8v8 capturé : élimination de diabol982 par dbat à 21:02, merveille dbat 44:56", () => {
    const m = byCode("Jd894wx6so9");
    if (!m) return;
    const elim = m.analysis.events.find(
      (e) => e.kind === "elimination" && e.elimination?.victim === "diabol982",
    );
    expect(elim).toBeDefined();
    if (!elim?.elimination) return;
    expect(fmt(elim.timeMs)).toBe(21 * 60 + 2); // 21:02 (capture wsva)
    expect(elim.elimination.killers[0]).toBe("dbat");
    expect(elim.elimination.leftGame).toBe(false);
    expect(elim.elimination.downTo).toBe(7);
    const wonder = m.analysis.events.find((e) => e.kind === "wonder");
    expect(wonder).toBeDefined();
    expect(wonder?.wonder?.builder).toBe("dbat");
    expect(fmt(wonder?.timeMs ?? 0)).toBe(44 * 60 + 56); // 44:56
    // Abandon détecté : Мразотный Гусь™ (capture « left the game » à 41:34).
    const left = m.analysis.events.find(
      (e) => e.kind === "elimination" && e.elimination?.victim === "Мразотный Гусь™",
    );
    expect(left?.elimination?.leftGame).toBe(true);
    // Chute de travailleurs avant la décision (capture : 31:30, −17 %).
    const workers = m.analysis.events.filter((e) => e.kind === "workers");
    expect(workers.length).toBeGreaterThan(0);
    expect(workers[0].timeMs).toBeLessThan(35 * 60 * 1000);
    expect(workers[0].workers?.lostPct ?? 0).toBeGreaterThanOrEqual(10);
  });

  it("impact : parts par équipe ≈ 100 %, triées, MMR et effectifs conformes", () => {
    const m = byCode("Jd894wx6so9");
    if (!m) return;
    expect(m.analysis.teams).toHaveLength(2);
    for (const team of m.analysis.teams) {
      const total = team.players.reduce((a, p) => a + p.share, 0);
      expect(total).toBeCloseTo(1, 5);
      for (let i = 1; i < team.players.length; i++)
        expect(team.players[i - 1].share).toBeGreaterThanOrEqual(team.players[i].share);
      expect(team.players.length).toBe(8);
    }
    expect(m.analysis.teams[0].avgRating).toBe(91); // capture : Average MMR 91
    expect(m.analysis.teams[0].aliveCount).toBe(0); // 8 of 8 eliminated
    expect(m.analysis.teams[1].avgRating).toBe(105);
    expect(m.analysis.teams[1].aliveCount).toBe(7); // 1 of 8 eliminated
    // Vzgo = 1er impact bleu (capture : 34 %).
    const top = m.analysis.teams[0].players[0];
    expect(top.player.nickname).toBe("Vzgo");
    expect(top.share).toBeGreaterThan(0.28);
    expect(top.share).toBeLessThan(0.42);
    expect(top.squad).toBe(2); // capture : Squad 2
    expect(top.lastAgeTimeMs).toBe(54 * 60_000 + 15_000); // 54:15
  });

  it("phases : early < mid < durée, poids ≈ 1, décision dans la partie", () => {
    for (const l of loaded) {
      const s = l.analysis.stages;
      expect(s).not.toBeNull();
      if (!s) continue;
      expect(s.earlyEndMs).toBeGreaterThan(60_000);
      expect(s.midEndMs).toBeGreaterThan(s.earlyEndMs);
      expect(s.midEndMs).toBeLessThan(l.duration);
      expect(s.cleanupFromMs).toBeLessThanOrEqual(l.duration);
      expect(s.cleanupFromMs).toBeGreaterThanOrEqual(l.duration - 5 * 60_000 - 1_000);
      for (const team of l.analysis.teams) {
        const w = team.weights.early + team.weights.mid + team.weights.late;
        expect(w).toBeCloseTo(1, 5);
      }
    }
  });

  it("taux d'impact : Σ par joueur = son score MVP (remise à l'échelle)", () => {
    for (const l of loaded) {
      for (const team of l.analysis.teams) {
        for (const p of team.players) {
          const total = p.impactRate.reduce((a, x) => a + x, 0);
          expect(total).toBeCloseTo(p.player.mvpScore ?? 0, 6);
          expect(p.impactRate.every((x) => Number.isFinite(x) && x >= 0)).toBe(true);
        }
      }
    }
  });
});

describe("normalisation du code (rep- → nu) cohérente avec l'API", () => {
  it("l'URL construite pour l'API officielle porte toujours le code nu", () => {
    // Note API : getByReplay attend le code SANS préfixe rep- (rep-XXX → error 5).
    expect(parseReplayCode("rep-Jd894wx6so9")).toBe("Jd894wx6so9");
    expect(parseReplayCode("Jd894wx6so9")).toBe("Jd894wx6so9");
    const url = `${REPLAY_API_BASE}${parseReplayCode("rep-Jd894wx6so9")}`;
    expect(url).toBe("https://games-api.warselect.io/getByReplay?code=Jd894wx6so9");
    expect(url).not.toContain("rep-");
  });
});
