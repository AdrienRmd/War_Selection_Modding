import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  draftEdits,
  isSimpleCatalog,
  readSimpleProject,
  simpleLua,
  simpleProjectJSON,
  validateSimpleDraft,
  type SimpleCatalog,
  type SimpleDraft,
} from "@/lib/simple-workbench";
import { lua } from "@/lib/workbench";
import { searchUnits, unitsIndex } from "@/lib/units";
import { defaultCatalog, testEdit } from "./fixtures";

// Catalogue du mode simple : généré par scripts/gen-simple-catalog.mjs depuis
// le dataset publié. Le fichier servi est trop volumineux pour un import
// statique de test — on le lit depuis public/.
const catalog: SimpleCatalog = JSON.parse(
  readFileSync(join(process.cwd(), "public/simple-catalog.json"), "utf8"),
);
const SERVED_DIR = "/home/ubuntu/War-Selection/datasets/served";
const TREE_DIR = join(SERVED_DIR, "content/docs/tree");

// Point de contrôle : le dataset publié ds-20261030 expose 423 slots unitType
// modifiables. Si ce nombre change, régénérer public/simple-catalog.json et
// mettre à jour cette valeur attendue.
const PUBLISHED_SLOT_COUNT = 423;

// --- Lecteur minimal des fichiers arbre du dataset (pour recouper sans durcir) -----
type TreeNode = { k: string; v?: string; tp?: string; ch?: TreeNode[] };
const treeChild = (nodes: TreeNode[] | undefined, key: string) =>
  (nodes || []).find((n) => n.k === key);
const treeValue = (nodes: TreeNode[] | undefined, key: string): number | undefined => {
  const n = treeChild(nodes, key);
  return n && n.tp === "num" ? Number(n.v) : undefined;
};
const slotByAddress = (address: string): number | null => {
  for (const file of readdirSync(TREE_DIR)) {
    if (!/^gameplay\.root\.unitType\.\d+\.json$/.test(file)) continue;
    const nodes = JSON.parse(readFileSync(join(TREE_DIR, file), "utf8"));
    if (treeChild(nodes, "address")?.v === address) return Number(file.match(/(\d+)\.json$/)![1]);
  }
  return null;
};

describe("catalogue simple — intégrité", () => {
  it("est reconnu par le garde-fou isSimpleCatalog", () => {
    expect(isSimpleCatalog(catalog)).toBe(true);
    expect(isSimpleCatalog({ units: [] })).toBe(false);
  });

  it("couvre exactement le nombre de slots modifiables du dataset", () => {
    expect(catalog.units).toHaveLength(PUBLISHED_SLOT_COUNT);
    if (existsSync(join(SERVED_DIR, "updated-at.json"))) {
      const meta = JSON.parse(readFileSync(join(SERVED_DIR, "updated-at.json"), "utf8"));
      expect(catalog.provenance.datasetId).toBe(meta.datasetId);
      expect(catalog.provenance.gameVersion).toBe(meta.gameVersion);
      expect(catalog.provenance.gameVersionNumber).toBe(
        Number(String(meta.gameVersion).split(/[._]/)[1]),
      );
    }
  });

  it("déclare des unités uniques, joignables depuis l'index /units", () => {
    const ids = new Set(catalog.units.map((u) => u.id));
    expect(ids.size).toBe(catalog.units.length);
    const indexIds = new Set(unitsIndex.units.map((u) => u.id));
    for (const u of catalog.units) expect(indexIds.has(u.id)).toBe(true);
  });

  it("n'expose que des champs valides : chemin moteur, cohérence valeur, bornes, ×3 langues", () => {
    const pathOk = /^root\.(?:unitType|build)\[\d+\](?:\.[A-Za-z][A-Za-z0-9_]*|\[\d+\])+$/;
    const groups = new Set(["construction", "combat", "economy"]);
    const problems: string[] = [];
    for (const unit of catalog.units) {
      const keys = new Set<string>();
      for (const f of unit.fields) {
        const id = unit.id + ":" + f.key;
        if (keys.has(f.key)) problems.push("doublon " + id);
        keys.add(f.key);
        if (!pathOk.test(f.path)) problems.push("chemin " + id + " " + f.path);
        if (Math.abs(f.value - f.raw / f.scale) > 1e-9) problems.push("valeur " + id);
        if (!(f.min <= f.value && f.value <= f.max)) problems.push("bornes " + id);
        if (!groups.has(f.group)) problems.push("groupe " + id);
        if (!f.label || !f.labelEn || !f.labelFr || !f.help || !f.helpEn || !f.helpFr)
          problems.push("i18n incomplète " + id);
      }
      for (const w of unit.weapons)
        for (const key of w.fields)
          if (!keys.has(key)) problems.push("arme orpheline " + unit.id + ":" + key);
    }
    expect(problems.slice(0, 8), problems.slice(0, 8).join(" | ")).toEqual([]);
    expect(problems).toHaveLength(0);
  });
});

describe("anti-durcissement : aucune valeur de jeu codée en dur", () => {
  it("recoupe les valeurs du catalogue avec l'arbre du dataset servi (échantillon)", () => {
    if (!existsSync(TREE_DIR)) return; // hors VPS : garde-fous des autres tests
    const samples = ["1/temple", "1/worker", "5/fr/fighter"];
    for (const id of samples) {
      const slot = slotByAddress("WarSelection/" + id);
      expect(slot, `slot de ${id}`).not.toBeNull();
      const nodes: TreeNode[] = JSON.parse(
        readFileSync(join(TREE_DIR, `gameplay.root.unitType.${slot}.json`), "utf8"),
      );
      const unit = catalog.units.find((u) => u.id === id);
      expect(unit, `unité ${id} au catalogue`).toBeDefined();
      const health = unit!.fields.find((f) => f.key === "health")!;
      expect(health.raw).toBe(treeValue(treeChild(nodes, "deathability")!.ch, "health"));
      const view = unit!.fields.find((f) => f.key === "view")!;
      expect(view.raw).toBe(treeValue(nodes, "viewRange"));
    }
    // Temple : coûts de construction lus depuis gameplay.root.build.json.
    const temple = catalog.units.find((u) => u.id === "1/temple")!;
    const slot = slotByAddress("WarSelection/1/temple")!;
    const buildTree: TreeNode[] = JSON.parse(
      readFileSync(join(TREE_DIR, "gameplay.root.build.json"), "utf8"),
    );
    const entry = buildTree.find(
      (n) => n.k !== undefined && Number(n.k) >= 0 && treeValue(n.ch, "unit") === slot,
    );
    expect(entry).toBeDefined();
    const materials = 1;
    const initRaw = treeValue(treeChild(entry!.ch, "initCost")!.ch, String(materials));
    const buildRaw = treeValue(treeChild(entry!.ch, "buildCost")!.ch, String(materials));
    expect(temple.fields.find((f) => f.path.endsWith(`.initCost[${materials}]`))!.raw).toBe(initRaw);
    expect(temple.fields.find((f) => f.path.endsWith(`.buildCost[${materials}]`))!.raw).toBe(
      buildRaw,
    );
  });

  it("ne contient ni version de jeu ni compte d'unités codé en dur dans les sources du mode simple", () => {
    const targets = [
      "components/simple-workbench.tsx",
      "lib/simple-workbench.ts",
      "app/workbench/simple/page.tsx",
    ];
    const offenders: string[] = [];
    for (const file of targets) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      if (/\b4018\b/.test(source)) offenders.push(file + " contient 4018");
      if (/\b453\b/.test(source)) offenders.push(file + " contient 453");
      if (/\b423\b/.test(source)) offenders.push(file + " contient 423");
      if (/\b3992\b/.test(source)) offenders.push(file + " contient 3992");
    }
    expect(offenders).toEqual([]);
  });
});

describe("export Lua — moteur v6 réutilisé tel quel", () => {
  const temple = catalog.units.find((u) => u.id === "1/temple")!;
  const costField = temple.fields.find((f) => f.key.startsWith("build-") && f.key.includes("buildCost-"))!;
  const draft: SimpleDraft = {
    "1/temple": { [costField.key]: String(costField.value / 2) },
  };

  it("produit le format onStart du moteur v6 avec les jetons de chemin du dataset courant", () => {
    const out = simpleLua(catalog, draft, "Mod simple");
    expect(out.startsWith("-- Mod simple\n")).toBe(true);
    expect(out).toContain("-- WS ATLAS gameplay Lua.");
    expect(out).toContain("addMod({onStart=onStart})");
    const tokens = costField.path
      .slice(5)
      .match(/([A-Za-z][A-Za-z0-9_]*)|\[(\d+)\]/g)!
      .map((m) => (m.startsWith("[") ? m.slice(1, -1) : `"${m}"`))
      .join(", ");
    expect(out).toContain(`{path={${tokens}}, value=${Math.round((costField.value / 2) * costField.scale)}, expected=${costField.raw}`);
    expect(out).toContain(`build=${costField.buildId}, unit=${temple.slot}`);
    expect(out).toContain(`Baseline: Steam ${catalog.provenance.steamBuild}; Gameplay ${catalog.provenance.gameplayVersion}.`);
  });

  it("est byte-identical entre deux exécutions (déterminisme)", () => {
    expect(simpleLua(catalog, draft, "Mod simple")).toBe(simpleLua(catalog, draft, "Mod simple"));
  });

  it("régression v6 explicite : l'export expert d'un cas de référence reste byte-identical", () => {
    const rule = { unitId: 1, targetKey: "req-empty", requiredUnitId: 1, min: 1, max: 3 };
    const out = lua(defaultCatalog(), [testEdit], "Référence", [rule], "abort");
    expect(createHash("sha256").update(out).digest("hex")).toBe(
      "a9e72100a8be54349c30f07196ea0adba539ac44be7b9014308439862a7f16db",
    );
    expect(out).toHaveLength(5403);
    expect(out).toBe(lua(defaultCatalog(), [testEdit], "Référence", [rule], "abort"));
  });
});

describe("validation du brouillon (mode simple)", () => {
  const temple = catalog.units.find((u) => u.id === "1/temple")!;
  const health = temple.fields.find((f) => f.key === "health")!;

  it("accepte une modification valide et l'ignore quand elle revient à la valeur d'origine", () => {
    const edits = validateSimpleDraft(catalog, { "1/temple": { health: "900" } });
    expect(edits).toEqual([{ unitId: "1/temple", fieldKey: "health", value: 900 }]);
    expect(validateSimpleDraft(catalog, { "1/temple": { health: String(health.value) } })).toEqual(
      [],
    );
  });

  it("rejette bornes et précision incompatibles avec le champ", () => {
    expect(() => validateSimpleDraft(catalog, { "1/temple": { health: "0" } })).toThrow(/请输入/);
    expect(() => validateSimpleDraft(catalog, { "1/temple": { health: "abc" } })).toThrow(/请输入/);
    const gather = temple.fields.find((f) => f.key === "gather-0-rate" && f.scale === 50);
    if (gather)
      expect(() =>
        validateSimpleDraft(catalog, { "1/temple": { [gather.key]: "0.017" } }),
      ).toThrow(/请输入/);
  });

  it("applique le précheck d'armes du moteur (min ≤ max < stop)", () => {
    const fighter = catalog.units.find((u) => u.id === "5/fr/fighter")!;
    const rmax = fighter.fields.find((f) => f.key === "weapon-0-range-max")!;
    try {
      validateSimpleDraft(catalog, { "5/fr/fighter": { [rmax.key]: String(rmax.max) } });
      throw new Error("devrait échouer");
    } catch (e) {
      expect((e as Error).message).toMatch(/Range must satisfy|请输入|应该失败|devrait échouer/);
      expect((e as Error).message).not.toBe("devrait échouer");
    }
  });
});

describe("projets JSON — sauvegarde, import, obsolescence", () => {
  const temple = catalog.units.find((u) => u.id === "1/temple")!;
  const costField = temple.fields.find((f) => f.key.startsWith("build-") && f.key.includes("buildCost-"))!;
  const draft: SimpleDraft = { "1/temple": { [costField.key]: "200" } };

  it("assure le round-trip export → import sans obsolescence", () => {
    const json = simpleProjectJSON(catalog, draft, "Mon mod");
    const p = readSimpleProject(json, catalog);
    expect(p.name).toBe("Mon mod");
    expect(p.datasetChanged).toBe(false);
    expect(p.stale).toEqual([]);
    expect(p.missing).toEqual([]);
    expect(p.draft).toEqual(draft);
    expect(draftEdits(catalog, p.draft)).toEqual([
      { unitId: "1/temple", fieldKey: costField.key, value: 200 },
    ]);
  });

  it("détecte l'obsolescence : « avait X à la création, le jeu vaut Y maintenant »", () => {
    // Projet fictif ancien : même dataset, mais baseline d'époque différente.
    const old = JSON.stringify({
      format: "ws-atlas-simple-project",
      schemaVersion: 1,
      name: "Mod d'époque",
      dataset: {
        id: catalog.provenance.datasetId,
        gameVersion: catalog.provenance.gameVersion,
        catalogGeneratedAt: "2026-01-01T00:00:00Z",
      },
      edits: [
        {
          unit: "1/temple",
          field: costField.key,
          value: 200,
          baselineRaw: costField.raw - 1000, // le jeu a changé depuis
        },
        {
          unit: "1/temple",
          field: "health",
          value: 900,
          baselineRaw: temple.fields.find((f) => f.key === "health")!.raw,
        },
      ],
    });
    const p = readSimpleProject(old, catalog);
    expect(p.stale).toHaveLength(1);
    expect(p.stale[0].wasValue).toBe((costField.raw - 1000) / costField.scale);
    expect(p.stale[0].nowValue).toBe(costField.raw / costField.scale);
    expect(p.stale[0].modValue).toBe(200);
    expect(p.datasetChanged).toBe(false);
  });

  it("signale un dataset différent et les champs disparus, et rejette les fichiers invalides", () => {
    const other = JSON.stringify({
      format: "ws-atlas-simple-project",
      schemaVersion: 1,
      name: "Autre époque",
      dataset: { id: "ds-ancien", gameVersion: "1.2.3", catalogGeneratedAt: "x" },
      edits: [
        { unit: "1/temple", field: "champ-disparu", value: 5, baselineRaw: 5 },
      ],
    });
    const p = readSimpleProject(other, catalog);
    expect(p.datasetChanged).toBe(true);
    expect(p.missing).toEqual([{ unit: "1/temple", fieldKey: "champ-disparu" }]);
    expect(p.draft).toEqual({});
    expect(() => readSimpleProject('{"format":"autre"}', catalog)).toThrow(/WS ATLAS/);
    expect(() =>
      readSimpleProject(
        JSON.stringify({
          format: "ws-atlas-simple-project",
          schemaVersion: 1,
          name: "X",
          dataset: { id: "d", gameVersion: "v", catalogGeneratedAt: "c" },
          edits: [
            { unit: "1/temple", field: costField.key, value: 1, baselineRaw: 1 },
            { unit: "1/temple", field: costField.key, value: 2, baselineRaw: 2 },
          ],
        }),
        catalog,
      ),
    ).toThrow(/重复改动/);
  });
});

describe("scénario débutant en ≤ 3 étapes (logique pure)", () => {
  it("étape 1 : « temple » est trouvable par nom localisé", () => {
    expect(searchUnits(unitsIndex.units, "Temple").some((u) => u.id === "1/temple")).toBe(true);
    expect(searchUnits(unitsIndex.units, "寺庙").some((u) => u.id === "1/temple")).toBe(true);
  });

  it("étapes 2+3 : modifier un coût puis exporter un Lua qui contient la valeur choisie", () => {
    const temple = catalog.units.find((u) => u.id === "1/temple")!;
    const costField = temple.fields.find((f) => f.key.startsWith("build-") && f.key.includes("buildCost-"))!;
    const draft: SimpleDraft = { "1/temple": { [costField.key]: "200" } };
    const edits = validateSimpleDraft(catalog, draft);
    expect(edits).toHaveLength(1);
    const out = simpleLua(catalog, draft, "Temple moins cher");
    expect(out).toContain("value=200000");
    expect(out).toContain("expected=" + costField.raw);
    // La valeur d'origine reste visible dans le résumé avant/après.
    expect(costField.value).toBe(costField.raw / costField.scale);
  });
});
