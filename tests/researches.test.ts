import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { translate } from "@/lib/i18n";
import { unitsIndex } from "@/lib/units";
import {
  countByType,
  countResearches,
  localizedResearchDescription,
  localizedResearchName,
  researchesIndex,
  researchImageUrl,
  researchTypeLabels,
  searchResearches,
  typesInUse,
  unitDeepLink,
  type ResearchEntry,
} from "@/lib/researches";

const SERVED_DIR = "/home/ubuntu/War-Selection/datasets/served";

// Point de contrôle : le dataset publié ds-20261030 livre 156 recherches. Si ce
// nombre change, régénérer lib/researches-index.json (scripts/gen-researches-index.mjs)
// et mettre à jour cette valeur attendue.
const PUBLISHED_RESEARCH_COUNT = 156;

describe("index des recherches /researches", () => {
  it("couvre exactement le nombre de recherches du dataset publié", () => {
    expect(researchesIndex.researches).toHaveLength(PUBLISHED_RESEARCH_COUNT);
  });

  it("égale le compte publié dans updated-at.json quand le dataset est servi localement", () => {
    const updatedAtPath = join(SERVED_DIR, "updated-at.json");
    if (!existsSync(updatedAtPath)) return; // hors VPS : garde-fou du point de contrôle ci-dessus
    const meta = JSON.parse(readFileSync(updatedAtPath, "utf8"));
    expect(researchesIndex.researches).toHaveLength(meta.counts.researches);
    expect(researchesIndex.datasetId).toBe(meta.datasetId);
    expect(researchesIndex.gameVersion).toBe(meta.gameVersion);
    const context = JSON.parse(readFileSync(join(SERVED_DIR, "content/context.json"), "utf8"));
    expect(context.researches).toHaveLength(meta.counts.researches);
  });

  it("a des gameIds uniques et des types connus du sélecteur", () => {
    const ids = researchesIndex.researches.map((r) => r.gameId);
    expect(new Set(ids).size).toBe(ids.length);
    const known = new Set(researchesIndex.types.map((t) => t.name));
    const unknown = [...new Set(researchesIndex.researches.map((r) => r.type))].filter(
      (type) => !known.has(type),
    );
    expect(unknown).toEqual([]);
    // Le filtre n'affiche que les types réellement présents dans les données.
    expect(typesInUse(researchesIndex).every((t) => known.has(t.name))).toBe(true);
    expect(researchTypeLabels.length).toBeGreaterThanOrEqual(researchesIndex.types.length);
  });

  it("résout les noms et descriptions localisés depuis localization/<lang>.json (échantillon ≥ 20)", () => {
    const locDir = join(SERVED_DIR, "content/localization");
    if (!existsSync(join(locDir, "fr.json"))) return; // hors VPS : couverture statique ci-dessous
    const read = (lang: string) => JSON.parse(readFileSync(join(locDir, `${lang}.json`), "utf8"));
    const en = read("en");
    const fr = read("fr");
    const cn = read("cn");
    const sample = researchesIndex.researches.filter((_, i) => i % 7 === 0); // 156/7 ≈ 23
    expect(sample.length).toBeGreaterThanOrEqual(20);
    const mismatches: string[] = [];
    for (const research of sample) {
      const key = `<*upgrade${research.gameId}#0>`;
      const descKey = `<*upgrade${research.gameId}#1>`;
      if (research.names?.fr !== fr[key]) mismatches.push(`${research.gameId}:fr`);
      if (research.names?.en !== en[key]) mismatches.push(`${research.gameId}:en`);
      if (research.names?.cn !== cn[key]) mismatches.push(`${research.gameId}:cn`);
      // Descriptions : la valeur "---" du jeu est considérée absente.
      const expectedFrDesc = fr[descKey] === "---" ? undefined : fr[descKey];
      if ((research.descriptions?.fr ?? undefined) !== expectedFrDesc)
        mismatches.push(`${research.gameId}:desc-fr`);
    }
    expect(mismatches, `Divergences du dataset : ${mismatches.join(", ")}`).toEqual([]);
  });

  it("embarque au moins un nom localisé pour chaque recherche", () => {
    const unnamed = researchesIndex.researches.filter(
      (r) => !r.names || Object.values(r.names).every((v) => !v),
    );
    expect(unnamed.map((r) => r.gameId)).toEqual([]);
  });
});

describe("index inverse unités ↔ recherches (données réelles du dataset)", () => {
  it("ne référence que des unités publiées de l'index /units", () => {
    const published = new Set(unitsIndex.units.map((u) => u.id));
    const offenders: string[] = [];
    for (const research of researchesIndex.researches) {
      for (const unitId of [...(research.unlocks ?? []), ...(research.affects ?? [])]) {
        if (!published.has(unitId)) offenders.push(`${research.gameId}→${unitId}`);
      }
    }
    expect(offenders, `Unités inconnues : ${offenders.slice(0, 5).join(", ")}`).toEqual([]);
  });

  it("dérive « unlocks » d'exigences unitType réelles (échantillon re-vérifié à la source)", () => {
    const treeDir = join(SERVED_DIR, "content/docs/tree");
    if (!existsSync(join(treeDir, "gameplay.root.researches.json"))) return; // hors VPS
    const withUnlocks = researchesIndex.researches.filter((r) => r.unlocks && r.unlocks.length > 0);
    expect(withUnlocks.length).toBeGreaterThan(0);
    // Re-vérifie 3 recherches : chaque unité listée doit exiger la recherche
    // dans researchAll/researchAny de SON fichier unitType.
    const sample = withUnlocks.filter((_, i) => i % 9 === 0).slice(0, 3);
    // Parcours du dump arbre {k, tp, v, ch} — typé explicitement (tsc strict).
    interface TreeNode {
      k?: string;
      v?: string | number | boolean;
      ch?: TreeNode[];
    }
    const findNode = (nodes: TreeNode[] | undefined, key: string): TreeNode | undefined => {
      for (const node of nodes ?? []) {
        if (node.k === key) return node;
        if (node.ch) {
          const found = findNode(node.ch, key);
          if (found) return found;
        }
      }
      return undefined;
    };
    const numericIds = (objNode: TreeNode | undefined): number[] => {
      const ids: number[] = [];
      for (const child of objNode?.ch ?? []) {
        if (!/^\d+$/.test(child.k ?? "")) continue;
        for (const leaf of child.ch ?? []) if ("v" in leaf) ids.push(Number(leaf.v));
      }
      return ids;
    };
    const readFile = (path: string): TreeNode[] =>
      JSON.parse(readFileSync(path, "utf8")) as TreeNode[];
    const treeFiles = readdirSync(treeDir);
    for (const research of sample) {
      for (const unitId of research.unlocks!.slice(0, 4)) {
        let verified = false;
        for (const file of treeFiles) {
          if (!/^gameplay\.root\.unitType\.\d+\.json$/.test(file)) continue;
          const dump = readFile(join(treeDir, file));
          const address = findNode(dump, "address");
          if (address?.v !== `WarSelection/${unitId}`) continue;
          const requirements = findNode(dump, "requirements");
          const required = [
            ...numericIds(findNode(requirements?.ch ?? [], "researchAll")),
            ...numericIds(findNode(requirements?.ch ?? [], "researchAny")),
          ];
          if (required.includes(research.gameId)) verified = true;
          break;
        }
        expect(verified, `${unitId} devrait exiger la recherche ${research.gameId}`).toBe(true);
      }
    }
  });
});

describe("logique de comptage, filtres et recherche (échantillon mocké)", () => {
  const mock: ResearchEntry[] = [
    {
      gameId: 0,
      type: "researchTypeCombat",
      image: "upgrade/0.png",
      names: { en: "Fur shoes", fr: "Chaussures en fourrure", cn: "毛皮靴" },
      descriptions: { en: "Faster workers", fr: "Ouvriers plus rapides" },
      affects: ["1/worker"],
      unlocks: ["1/house"],
    },
    {
      gameId: 1,
      type: "researchTypeAgeTransition",
      image: "upgrade/1.png",
      names: { en: "Iron Age of Europe", fr: "Age de Fer de l’Europe", cn: "欧洲铁器时代" },
      descriptions: { en: "Transition" },
    },
    {
      gameId: 155,
      type: "researchTypeBuff",
      image: "upgrade/155.png",
      names: { tw: "恐慌" },
    },
  ];

  it("compte le total et la répartition par type, cohérente avec l'index réel", () => {
    expect(countResearches(mock)).toBe(3);
    expect(countByType(mock)).toEqual({
      researchTypeCombat: 1,
      researchTypeAgeTransition: 1,
      researchTypeBuff: 1,
    });
    const totalFromTypes = Object.values(countByType(researchesIndex.researches)).reduce(
      (a, b) => a + b,
      0,
    );
    expect(totalFromTypes).toBe(countResearches(researchesIndex.researches));
  });

  it("localise les noms : fr→fr, en→en, zh→cn puis tw, repli clé brute", () => {
    expect(localizedResearchName(mock[0], "fr")).toBe("Chaussures en fourrure");
    expect(localizedResearchName(mock[0], "en")).toBe("Fur shoes");
    expect(localizedResearchName(mock[0], "zh")).toBe("毛皮靴");
    expect(localizedResearchName(mock[2], "zh")).toBe("恐慌");
    expect(localizedResearchName(mock[2], "fr")).toBe("<*upgrade155#0>");
    expect(localizedResearchDescription(mock[0], "fr")).toBe("Ouvriers plus rapides");
    expect(localizedResearchDescription(mock[1], "zh")).toBe("Transition"); // repli en
  });

  it("recherche par nom localisé (3 langues), id et type", () => {
    expect(searchResearches(mock, "fourrure").map((r) => r.gameId)).toEqual([0]);
    expect(searchResearches(mock, "Iron Age").map((r) => r.gameId)).toEqual([1]);
    expect(searchResearches(mock, "铁器").map((r) => r.gameId)).toEqual([1]);
    expect(searchResearches(mock, "  ").length).toBe(3);
    expect(searchResearches(mock, "#155")).toEqual([]);
    expect(searchResearches(mock, "155").map((r) => r.gameId)).toEqual([155]);
  });

  it("construit les URLs d'image et les liens profonds vers /units", () => {
    expect(researchImageUrl("upgrade/0.png")).toBe("/wus-data/content/images/upgrade/0.png");
    expect(unitDeepLink("3/ae/dragoon")).toBe("/units?unit=3%2Fae%2Fdragoon");
    const unitsById = new Set(unitsIndex.units.map((u) => u.id));
    const linked = researchesIndex.researches
      .flatMap((r) => r.unlocks ?? [])
      .flatMap((link) => [decodeURIComponent(link)]);
    expect(linked.every((unitId) => unitsById.has(unitId))).toBe(true);
  });
});

describe("ne code aucun compte en dur dans la page /researches", () => {
  it("n'écrit pas 156 dans les fichiers de la page", () => {
    const offenders: string[] = [];
    const targets = [
      "app/researches/page.tsx",
      "app/researches.css",
      "components/researches-browser.tsx",
      "components/atlas-nav.tsx",
      "lib/researches.ts",
    ];
    for (const file of targets) {
      if (/\b156\b/.test(readFileSync(file, "utf8"))) offenders.push(file);
    }
    expect(offenders, `Comptes codés en dur : ${offenders.join(", ")}`).toEqual([]);
  });
});

describe("couverture i18n des libellés /researches", () => {
  const keys = [
    "科技档案",
    "WAR SELECTION / RESEARCH ARCHIVE",
    "浏览全部研究，按类型筛选，查看官方名称、描述与关联单位；数据来自公开导出。",
    "共 ${count} 项研究",
    "数据更新于 ${date}，共 ${count} 项研究",
    "搜索研究…",
    "搜索研究",
    "研究类型",
    "没有找到对应研究。",
    "描述",
    "类型",
    "游戏编号",
    "解锁单位",
    "受影响单位",
    "研究名称与描述来自游戏官方本地化；解锁与受影响单位来自游戏导出的单位需求数据。数据集不含研究费用与时长。",
    "时代过渡",
    "经济",
    "领土",
    "战斗",
    "单位",
    "增益",
    "奇观过渡",
    "光环",
  ];

  it("traduit chaque libellé en EN et FR", () => {
    const missing = keys.filter(
      (key) =>
        // L'eyebrow est déjà anglais à la source : seule la couverture FR compte.
        (key === "WAR SELECTION / RESEARCH ARCHIVE" && translate(key, "fr") === key) ||
        (key !== "WAR SELECTION / RESEARCH ARCHIVE" &&
          (translate(key, "en") === key || translate(key, "fr") === key)),
    );
    expect(missing, `Clés non traduites : ${missing.join(" | ")}`).toEqual([]);
  });

  it("applique les templates de compte et de badge dans les trois langues", () => {
    expect(translate("共 156 项研究", "fr")).toBe("156 recherches");
    expect(translate("共 156 项研究", "en")).toBe("156 researches");
    expect(translate("数据更新于 2026年10月30日，共 156 项研究", "fr")).toBe(
      "Données mises à jour le 2026年10月30日 · 156 recherches",
    );
  });
});
