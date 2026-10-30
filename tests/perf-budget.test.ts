import { statSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Budget de performance des artefacts générés — budget SB9/revue qualité 30/10.
//
// Les seuils ci-dessous verrouillent en test ce qui ne vivait auparavant que
// dans les rapports P3/P4 (lead-qualite : « budgets perf non verrouillés par
// test — risque de dérive silencieuse »). Chaque constante = taille mesurée au
// 30/10/2026 (dataset ds-20261030T132546) + ~15 % de marge, arrondie.
//
// Si ce test ÉCHOUE après une régénération d'index (scripts/gen-*.mjs), ce
// n'est PAS à corriger en augmentant le seuil en silence : l'index a grossi de
// plus de 15 %, il faut en comprendre la cause (dataset plus volumineux,
// résumé enrichi, régression du générateur) et re-baseliner EXPLICITEMENT les
// constantes avec l'accord de ws-lead (nouveau budget documenté).
//
// Embarqué vs servi :
//  - « embarqué » = importé statiquement dans les bundles (SSR props ou code
//    client) : lib/units-index.json (lib/units.ts), lib/researches-index.json
//    (lib/researches.ts), lib/modding-home.json + lib/modding-meta.json
//    (app/modding, lib/modding.ts). Total plafonné par le budget SPEC de
//    0,83 Mo de données intégrées.
//  - « servi » = ressource statique chargée à la demande (jamais dans un
//    bundle) : public/modding-paths.json (première recherche) et
//    public/simple-catalog.json.gz (montée de /workbench/simple).

// Mesuré 488 029 o (446 Ko, ~50 Ko gzip) — marge ~15 % → 565 000 o.
const UNITS_INDEX_MAX_BYTES = 565_000;
// Mesuré 103 775 o — marge ~15 % → 120 000 o.
const RESEARCHES_INDEX_MAX_BYTES = 120_000;
// Mesuré 2 202 o — marge ~15 % → 2 600 o.
const MODDING_HOME_MAX_BYTES = 2_600;
// Mesuré 410 196 o (~24 Ko gzip) — marge ~15 % → 475 000 o.
const MODDING_PATHS_MAX_BYTES = 475_000;
// Mesuré 621 080 o gzip (8,65 Mo brut jamais dans un bundle) — marge ~15 % → 715 000 o.
const SIMPLE_CATALOG_GZ_MAX_BYTES = 715_000;
// Total embarqué mesuré 594 170 o (units + researches + modding-home + modding-meta)
// — marge ~15 % → 685 000 o, très en deçà du plafond SPEC de 0,83 Mo.
const EMBEDDED_TOTAL_MAX_BYTES = 685_000;

const sizeOf = (relativePath: string): number =>
  statSync(new URL(`../${relativePath}`, import.meta.url)).size;

const kib = (bytes: number): string => `${(bytes / 1024).toFixed(1)} Ko`;

describe("budget de performance des artefacts générés (SB9/revue qualité 30/10)", () => {
  it("lib/units-index.json reste sous son budget", () => {
    const size = sizeOf("lib/units-index.json");
    expect(size, `units-index ${kib(size)} > budget ${kib(UNITS_INDEX_MAX_BYTES)}`).toBeLessThan(
      UNITS_INDEX_MAX_BYTES,
    );
  });

  it("lib/researches-index.json reste sous son budget", () => {
    const size = sizeOf("lib/researches-index.json");
    expect(
      size,
      `researches-index ${kib(size)} > budget ${kib(RESEARCHES_INDEX_MAX_BYTES)}`,
    ).toBeLessThan(RESEARCHES_INDEX_MAX_BYTES);
  });

  it("lib/modding-home.json reste sous son budget", () => {
    const size = sizeOf("lib/modding-home.json");
    expect(size, `modding-home ${kib(size)} > budget ${kib(MODDING_HOME_MAX_BYTES)}`).toBeLessThan(
      MODDING_HOME_MAX_BYTES,
    );
  });

  it("public/modding-paths.json reste sous son budget", () => {
    const size = sizeOf("public/modding-paths.json");
    expect(
      size,
      `modding-paths ${kib(size)} > budget ${kib(MODDING_PATHS_MAX_BYTES)}`,
    ).toBeLessThan(MODDING_PATHS_MAX_BYTES);
  });

  it("public/simple-catalog.json.gz reste sous son budget", () => {
    const size = sizeOf("public/simple-catalog.json.gz");
    expect(
      size,
      `simple-catalog.gz ${kib(size)} > budget ${kib(SIMPLE_CATALOG_GZ_MAX_BYTES)}`,
    ).toBeLessThan(SIMPLE_CATALOG_GZ_MAX_BYTES);
  });

  it("total des index embarqués reste sous le budget (0,83 Mo SPEC)", () => {
    const total =
      sizeOf("lib/units-index.json") +
      sizeOf("lib/researches-index.json") +
      sizeOf("lib/modding-home.json") +
      sizeOf("lib/modding-meta.json");
    expect(
      total,
      `total embarqué ${kib(total)} > budget ${kib(EMBEDDED_TOTAL_MAX_BYTES)} (SPEC 0,83 Mo)`,
    ).toBeLessThan(EMBEDDED_TOTAL_MAX_BYTES);
  });
});
