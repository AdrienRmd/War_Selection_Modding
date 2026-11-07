import { describe, expect, it } from "vitest";
import { formatKd, formatStatNumber } from "@/components/replay/player-stats-table";
import { translate } from "@/lib/i18n";

/* Micro-mission UI 07/11 — formats du tableau « Statistiques complètes » :
 * K/D toujours 2 décimales (virgule FR), compact TOUJOURS 1 décimale,
 * sous 1000 entier brut ; en-tête « Survie / élimination » sans hanzi. */

describe("formatKd — 2 décimales, séparateur locale", () => {
  it("fr : virgule française, toujours 2 décimales", () => {
    expect(formatKd(2.01, "fr")).toBe("2,01");
    expect(formatKd(0.6, "fr")).toBe("0,60");
    expect(formatKd(0.01, "fr")).toBe("0,01");
    expect(formatKd(12, "fr")).toBe("12,00");
    expect(formatKd(0, "fr")).toBe("0,00");
  });
  it("en / zh : point décimal", () => {
    expect(formatKd(2.01, "en")).toBe("2.01");
    expect(formatKd(0.6, "zh")).toBe("0.60");
  });
});

describe("formatStatNumber — entier < 1000, compact 1 décimale ≥ 1000", () => {
  const fr = formatStatNumber("fr");
  it("sous 1000 : entier brut", () => {
    expect(fr(971)).toBe("971");
    expect(fr(569)).toBe("569");
    expect(fr(163)).toBe("163");
    expect(fr(0)).toBe("0");
  });
  it("≥ 1000 : compact TOUJOURS 1 décimale (séparateur fin avant k)", () => {
    expect(fr(12700)).toMatch(/^12,7[\s\u202f]k$/);
    expect(fr(8000)).toMatch(/^8,0[\s\u202f]k$/);
    expect(fr(149900)).toMatch(/^149,9[\s\u202f]k$/);
    expect(fr(1000)).toMatch(/^1,0[\s\u202f]k$/);
  });
  it("pas de décimale forcée sous 1000", () => {
    expect(fr(999)).toBe("999");
  });
});

describe("en-tête Survie — artefact hanzi corrigé", () => {
  it("fr : « Survie / élimination », sans caractère chinois", () => {
    const fr = translate("存活 / 被淘汰", "fr");
    expect(fr).toBe("Survie / élimination");
    expect(fr).not.toMatch(/[\u4e00-\u9fff]/);
  });
  it("en : « Survival / eliminated »", () => {
    expect(translate("存活 / 被淘汰", "en")).toBe("Survival / eliminated");
  });
});
