import { describe, expect, it } from "vitest";
import { stripGluedModeSuffix } from "@/components/replay/replay-portal";
import { parseReplayCode } from "@/lib/replay";

// Fix UX V4 (bug réel en prod) : le badge de mode « 6v6 » était collé au
// code dans la liste « récemment soumis » — les visiteurs recopiaient
// « rep-vjaltkPV6C66v6 » et obtenaient « Format de code invalide ».
// stripGluedModeSuffix (UI seule, la lib partagée reste stricte) retire le
// suffixe NvN UNIQUEMENT si le reste forme un code complet (14 car. avec
// rep-, 11 nus) — un code valide de 11 caractères ne peut jamais être amputé.

describe("stripGluedModeSuffix — badge de mode collé au code", () => {
  it("retire le mode collé au code complet avec préfixe rep- (bug réel)", () => {
    expect(stripGluedModeSuffix("rep-vjaltkPV6C66v6")).toBe("rep-vjaltkPV6C6");
  });

  it("retire le mode collé au code nu (le reste fait exactement 11 caractères)", () => {
    expect(stripGluedModeSuffix("vjaltkPV6C66v6")).toBe("vjaltkPV6C6");
  });

  it("tolère les espaces avant le mode et les tailles à 2 chiffres", () => {
    expect(stripGluedModeSuffix("rep-vjaltkPV6C6 6v6")).toBe("rep-vjaltkPV6C6");
    expect(stripGluedModeSuffix("rep-Jd894wx6so9 8v8")).toBe("rep-Jd894wx6so9");
    expect(stripGluedModeSuffix("Jd894wx6so910v10")).toBe("Jd894wx6so9");
    expect(stripGluedModeSuffix("  rep-HkvVncU3mq97v7  ")).toBe("rep-HkvVncU3mq9");
  });

  it("compose avec parseReplayCode : code+mode collé analysé proprement", () => {
    expect(parseReplayCode(stripGluedModeSuffix("rep-vjaltkPV6C66v6"))).toBe("vjaltkPV6C6");
    expect(parseReplayCode(stripGluedModeSuffix("vjaltkPV6C66v6"))).toBe("vjaltkPV6C6");
  });

  it("préserve un code VALIDE finissant littéralement par NvN (cas ambigu documenté)", () => {
    // Un vrai code fait exactement 11 caractères : retirer « 6v6 » ne
    // laisserait que 8 caractères → le strip ne s'applique pas.
    expect(stripGluedModeSuffix("jxXISVZ96v6")).toBe("jxXISVZ96v6");
    expect(stripGluedModeSuffix("rep-jxXISVZ96v6")).toBe("rep-jxXISVZ96v6");
  });

  it("borne le strip : ne retire rien si le reste n'est pas un code complet", () => {
    // Trop court après strip, préfixes mal formés, modes inexacts : intact.
    expect(stripGluedModeSuffix("rep-abcd6v6")).toBe("rep-abcd6v6");
    expect(stripGluedModeSuffix("mon code est 6v6")).toBe("mon code est 6v6");
    expect(stripGluedModeSuffix("rep-vjaltkPV6C66x6")).toBe("rep-vjaltkPV6C66x6"); // x ≠ v
    expect(stripGluedModeSuffix("rep-vjaltkPV6C66V6")).toBe("rep-vjaltkPV6C66V6"); // V majuscule (badges en minuscules)
    expect(stripGluedModeSuffix("rep-vjaltkPV6C6123v12")).toBe("rep-vjaltkPV6C6123v12"); // 3 chiffres ≠ NvN
  });

  it("laisse inchangées les saisies sans suffixe de mode", () => {
    expect(stripGluedModeSuffix("rep-jxXISVZ90rk")).toBe("rep-jxXISVZ90rk");
    expect(stripGluedModeSuffix("jxXISVZ90rk")).toBe("jxXISVZ90rk");
    expect(stripGluedModeSuffix("")).toBe("");
    expect(stripGluedModeSuffix("  rep-JUqOV1ljGxg  ")).toBe("rep-JUqOV1ljGxg"); // trim seul
  });
});
