import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { translate } from "@/lib/i18n";
import {
  breadcrumbOf,
  childPath,
  moddingMeta,
  resolveDeepLink,
  searchPaths,
  segmentsOf,
  treeFileUrl,
  type ModdingNode,
} from "@/lib/modding";
import homeBundled from "@/lib/modding-home.json";

const SERVED_DIR = "/home/ubuntu/War-Selection/datasets/served";
const TREE_DIR = join(SERVED_DIR, "content/docs/tree");
const LARGE_THRESHOLD = 256 * 1024;

// Point de contrôle : le dataset publié ds-20261030T123856 livre 9041 fichiers
// d'arbre (home.json inclus). Si ce nombre change, régénérer l'index
// (scripts/gen-modding-index.mjs) et mettre à jour cette valeur attendue.
const PUBLISHED_TREE_FILES = 9041;

const indexFile = JSON.parse(
  readFileSync(new URL("../public/modding-paths.json", import.meta.url), "utf8"),
) as {
  schema: number;
  datasetId: string;
  gameVersion: string;
  generatedAt: string;
  pathCount: number;
  largeCount: number;
  paths: string[];
  large: Record<string, number>;
};

// RNG déterministe (mulberry32) : l'échantillon aléatoire du critère SB5 est
// reproductible d'une exécution de test à l'autre.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const tailOf = (path: string): string => {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? path : path.slice(dot + 1);
};

describe("index des chemins /modding", () => {
  it("couvre exactement les chemins du dataset publié (point de contrôle)", () => {
    expect(indexFile.paths).toHaveLength(indexFile.pathCount);
    expect(new Set(indexFile.paths).size).toBe(indexFile.paths.length); // unicité
    expect([...indexFile.paths]).toEqual([...indexFile.paths].sort()); // tri stable
    expect(indexFile.schema).toBe(1);
    expect(Number.isNaN(Date.parse(indexFile.generatedAt))).toBe(false);
    expect(moddingMeta.pathCount).toBe(indexFile.pathCount);
  });

  it("égale les fichiers d'arbre publiés + feuilles racine quand le dataset est servi localement", () => {
    if (!existsSync(TREE_DIR)) return; // hors VPS : garde-fou du point de contrôle ci-dessus
    const meta = JSON.parse(readFileSync(join(SERVED_DIR, "updated-at.json"), "utf8"));
    const files = readdirSync(TREE_DIR)
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.slice(0, -".json".length));
    expect(files).toHaveLength(PUBLISHED_TREE_FILES);
    expect(meta.counts.treeFiles).toBe(PUBLISHED_TREE_FILES);
    expect(indexFile.datasetId).toBe(meta.datasetId);
    expect(moddingMeta.datasetId).toBe(meta.datasetId);

    // Chemins lazy = tous les fichiers sauf home.json.
    const lazy = new Set(files.filter((path) => path !== "home"));
    // Feuilles racine = enfants-feuilles directs de <folder>.root dans home.json.
    const rootLeaves = new Set<string>();
    const home = homeBundled as { ch?: ModdingNode[] };
    for (const folder of home.ch ?? []) {
      if (folder.tp !== "folder") continue;
      const root = (folder.ch ?? []).find((node) => node.tp === "root");
      for (const child of root?.ch ?? []) {
        if (child.as === true) continue;
        if (Array.isArray(child.ch) && child.ch.length > 0) continue;
        rootLeaves.add(`${folder.k}.root.${child.k}`);
      }
    }
    const expected = new Set([...lazy, ...rootLeaves]);
    const indexed = new Set(indexFile.paths);
    expect([...indexed].filter((p) => !expected.has(p))).toEqual([]); // rien d'inventé
    expect([...expected].filter((p) => !indexed.has(p))).toEqual([]); // rien d'oublié

    // home.json embarqué pour le SSR = copie exacte du dataset servi.
    expect(home).toEqual(JSON.parse(readFileSync(join(TREE_DIR, "home.json"), "utf8")));
  });

  it("recense les gros nœuds avec leur taille réelle sur disque", () => {
    const entries = Object.entries(indexFile.large);
    expect(entries.length).toBe(indexFile.largeCount);
    if (!existsSync(TREE_DIR)) return;
    for (const [path, size] of entries) {
      expect(size).toBeGreaterThan(LARGE_THRESHOLD);
      expect(statSync(join(TREE_DIR, `${path}.json`)).size).toBe(size);
    }
    // Les trois dumps messages (8,6 Mo) doivent être signalés.
    expect(Object.keys(indexFile.large)).toContain(
      "visual.root.session.gameplay.gameplay.scripts.scripts.messages.list.0",
    );
  });
});

describe("recherche par chemin (index réel)", () => {
  it("trouve unitType.5 et defaultFormation, insensible à la casse et aux espaces", () => {
    const paths = indexFile.paths;
    expect(searchPaths(paths, "unitType.5", 20)).toContain("gameplay.root.unitType.5");
    expect(searchPaths(paths, "  UNITTYPE.5 ", 20)).toContain("gameplay.root.unitType.5");
    expect(searchPaths(paths, "defaultFormation", 40).join(" ")).toContain(
      "gameplay.root.defaultFormationInterval",
    );
    expect(searchPaths(paths, "", 20)).toEqual([]);
    expect(searchPaths(paths, "zzzz-not-a-key", 20)).toEqual([]);
  });

  it("classe d'abord les chemins dont le dernier segment commence par la requête", () => {
    const results = searchPaths(indexFile.paths, "window", 60);
    expect(results[0]).toBe("visual.root.window");
    expect(results.every((p) => p.toLowerCase().includes("window"))).toBe(true);
    expect(results.length).toBeLessThanOrEqual(60);
  });

  it("borne l'affichage mais compte toutes les correspondances", () => {
    const limited = searchPaths(indexFile.paths, "unitType", 10);
    expect(limited).toHaveLength(10);
    const total = searchPaths(indexFile.paths, "unitType", 5_000_000).length;
    expect(total).toBeGreaterThan(400); // les 453 unités + chemins descendants
  });
});

describe("logique lazy et lien profond (arbre mocké)", () => {
  const fixtureHome: ModdingNode[] = [
    {
      k: "gameplay",
      tp: "folder",
      ch: [
        {
          k: "root",
          tp: "root",
          ch: [
            { k: "buildPlanStayTime", v: "600000", tp: "num" },
            { k: "unitType", tp: "obj", as: true },
          ],
        },
      ],
    },
  ];
  const fixtureFiles: Record<string, ModdingNode[]> = {
    "gameplay.root.unitType": [
      { k: "0", tp: "obj", as: true },
      { k: "size", v: "453", tp: "num" },
    ],
    "gameplay.root.unitType.0": [
      { k: "attack", tp: "obj", as: true },
      { k: "hp", v: "10", tp: "num" },
    ],
    "gameplay.root.unitType.0.attack": [{ k: "damage", v: "5", tp: "num" }],
  };
  const makeLoader = () => {
    const fetches: string[] = [];
    const load = async (path: string): Promise<ModdingNode[]> => {
      fetches.push(path);
      const file = fixtureFiles[path];
      if (!file) throw new Error(`404 ${path}`);
      return file;
    };
    return { fetches, load, cache: new Map<string, ModdingNode[]>() };
  };
  // Chargeur avec cache mémoire, comme le composant en production.
  const cached = (load: (path: string) => Promise<ModdingNode[]>) => {
    const cache = new Map<string, ModdingNode[]>();
    return async (path: string) => {
      const hit = cache.get(path);
      if (hit) return hit;
      const children = await load(path);
      cache.set(path, children);
      return children;
    };
  };

  it("construit l'URL du fichier d'un nœud lazy", () => {
    expect(treeFileUrl("gameplay.root.unitType.0")).toBe(
      "/wus-data/content/docs/tree/gameplay.root.unitType.0.json",
    );
    expect(childPath("gameplay.root", "unitType")).toBe("gameplay.root.unitType");
    expect(childPath("", "gameplay")).toBe("gameplay");
  });

  it("résout un lien profond complet : un fetch par niveau lazy, jamais les niveaux inline", async () => {
    const { fetches, load } = makeLoader();
    const result = await resolveDeepLink(
      fixtureHome,
      "gameplay.root.unitType.0.attack.damage",
      load,
    );
    expect(result.missingAt).toBeNull();
    expect(result.target?.path).toBe("gameplay.root.unitType.0.attack.damage");
    expect(result.target?.node.v).toBe("5");
    expect([...result.levels.keys()]).toEqual([
      "",
      "gameplay",
      "gameplay.root",
      "gameplay.root.unitType",
      "gameplay.root.unitType.0",
      "gameplay.root.unitType.0.attack",
    ]);
    // Les niveaux inline (gameplay, gameplay.root) ne déclenchent AUCUN fetch :
    // seuls les 3 nœuds « as » sont chargés à la demande.
    expect(fetches).toEqual([
      "gameplay.root.unitType",
      "gameplay.root.unitType.0",
      "gameplay.root.unitType.0.attack",
    ]);
  });

  it("s'arrête proprement sur un segment absent ou une feuille traversée", async () => {
    const { load } = makeLoader();
    const missing = await resolveDeepLink(fixtureHome, "gameplay.root.unitType.9", load);
    expect(missing.missingAt).toBe("gameplay.root.unitType");
    expect(missing.target).toBeNull();
    const throughLeaf = await resolveDeepLink(
      fixtureHome,
      "gameplay.root.buildPlanStayTime.deeper",
      load,
    );
    expect(throughLeaf.missingAt).toBe("gameplay.root.buildPlanStayTime");
    const leaf = await resolveDeepLink(fixtureHome, "gameplay.root.buildPlanStayTime", load);
    expect(leaf.missingAt).toBeNull();
    expect(leaf.target?.node.v).toBe("600000");
  });

  it("réutilise le cache : une seconde résolution ne refetch rien", async () => {
    const { fetches, load } = makeLoader();
    const loader = cached(load);
    const path = "gameplay.root.unitType.0.attack";
    await resolveDeepLink(fixtureHome, path, loader);
    expect(fetches).toHaveLength(3);
    await resolveDeepLink(fixtureHome, path, loader);
    expect(fetches).toHaveLength(3);
  });

  it("construit le fil d'Ariane cumulatif et la profondeur", () => {
    expect(breadcrumbOf("gameplay.root.unitType.5")).toEqual([
      { key: "gameplay", path: "gameplay" },
      { key: "root", path: "gameplay.root" },
      { key: "unitType", path: "gameplay.root.unitType" },
      { key: "5", path: "gameplay.root.unitType.5" },
    ]);
    expect(breadcrumbOf("")).toEqual([]);
    expect(segmentsOf("gameplay.root.unitType.5")).toHaveLength(4);
  });
});

describe("critère SB5 : 100 chemins aléatoires atteignables ≤4 clics OU via recherche", () => {
  const rng = mulberry32(20261030);
  const sample: string[] = [];
  const pool = indexFile.paths;
  while (sample.length < 100 && pool.length > 0) {
    sample.push(pool[Math.floor(rng() * pool.length)]);
  }
  expect(sample).toHaveLength(100);

  it("chaque chemin échantillonné est atteignable : profondeur ≤4 (clics) OU présent dans les résultats de recherche", () => {
    const unreachable: string[] = [];
    let deepOnlyBySearch = 0;
    for (const path of sample) {
      const direct = segmentsOf(path).length <= 4; // gameplay→root→unitType→5 : 4 expansions
      const viaSearch = searchPaths(indexFile.paths, tailOf(path), 200).includes(path);
      if (!direct) deepOnlyBySearch += 1;
      if (!direct && !viaSearch) unreachable.push(path);
    }
    // La branche recherche doit être réellement exercée par l'échantillon.
    expect(deepOnlyBySearch).toBeGreaterThan(50);
    expect(unreachable, `Chemins injoignables : ${unreachable.slice(0, 5).join(", ")}`).toEqual([]);
  });

  it("résout réellement la chaîne deep-link de 12 chemins échantillonnés (dataset servi, gros nœuds exclus)", async () => {
    if (!existsSync(TREE_DIR)) return; // hors VPS : la logique est couverte par l'arbre mocké
    const diskLoader = (path: string): Promise<ModdingNode[]> => {
      const file = join(TREE_DIR, `${path}.json`);
      if (!existsSync(file)) throw new Error(`404 ${path}`);
      return Promise.resolve(JSON.parse(readFileSync(file, "utf8")) as ModdingNode[]);
    };
    const safe = sample.filter(
      (path) => !(path in indexFile.large) && existsSync(join(TREE_DIR, `${path}.json`)),
    );
    const subset = safe.filter((_, i) => i % Math.ceil(safe.length / 12) === 0).slice(0, 12);
    expect(subset.length).toBeGreaterThanOrEqual(10);
    const home = homeBundled as { ch?: ModdingNode[] };
    for (const path of subset) {
      const result = await resolveDeepLink(home.ch ?? [], path, diskLoader);
      expect(result.missingAt, `Chemin non résolu : ${path}`).toBeNull();
      expect(result.target?.path, `Cible absente : ${path}`).toBe(path);
    }
  });
});

describe("couverture i18n des libellés /modding", () => {
  const keys = [
    "参数档案",
    "浏览游戏参数树：按节点展开数值、字符串与函数签名，支持路径搜索与深链；数据来自公开导出，只读。",
    "参数树",
    "共 ${count} 条可搜索路径",
    "数据更新于 ${date}，共 ${count} 个参数节点",
    "搜索路径…",
    "搜索节点路径",
    "输入片段如 unitType.5 或 defaultFormation，点击结果直达节点。",
    "正在载入路径索引…",
    "路径索引暂时不可用",
    "没有匹配的路径。",
    "共 ${count} 条匹配，显示前 ${shown} 条",
    "路径导航",
    "路径未找到或不可展开",
    "正在加载节点…",
    "节点加载失败",
    "复制路径",
    "已复制",
    "按需加载",
    "大文件节点（约 ${mb} MB），加载可能较慢",
    "显示更多（共 ${count} 个子节点）",
    "展开或折叠",
    "（空）",
    "重试",
    "正在读取数据版本…",
    "数据版本暂时不可用",
  ];

  it("traduit chaque libellé en EN et FR", () => {
    const missing = keys.filter(
      (key) => translate(key, "en") === key || translate(key, "fr") === key,
    );
    expect(missing, `Clés non traduites : ${missing.join(" | ")}`).toEqual([]);
  });

  it("couvre l'eyebrow (déjà anglais à la source) en FR", () => {
    expect(translate("WAR SELECTION / MODDING ARCHIVE", "fr")).toBe(
      "WAR SELECTION / ARCHIVES DE MODDING",
    );
  });

  it("applique les templates de compte et de badge dans les trois langues", () => {
    expect(translate("共 9063 条可搜索路径", "en")).toBe("9063 searchable paths");
    expect(translate("共 9063 条可搜索路径", "fr")).toBe("9063 chemins interrogeables");
    expect(translate("数据更新于 2026年10月30日，共 9041 个参数节点", "en")).toBe(
      "Data updated 2026年10月30日 · 9041 parameter nodes",
    );
    expect(translate("数据更新于 2026年10月30日，共 9041 个参数节点", "fr")).toBe(
      "Données mises à jour le 2026年10月30日 · 9041 nœuds de paramètres",
    );
    expect(translate("共 120 条匹配，显示前 60 条", "fr")).toBe(
      "120 correspondances, 60 premières affichées",
    );
  });

  it("branche la page et la navigation sur /modding (source)", () => {
    const nav = readFileSync(new URL("../components/atlas-nav.tsx", import.meta.url), "utf8");
    expect(nav).toContain('"/modding"');
    expect(nav).toContain("参数档案");
    const page = readFileSync(new URL("../app/modding/page.tsx", import.meta.url), "utf8");
    expect(page).toContain("ModdingTreeBrowser");
    // Le titre de page passe par PageTitle/T : aucune chaîne codée en dur côté client.
    const tree = readFileSync(new URL("../components/modding-tree.tsx", import.meta.url), "utf8");
    expect(tree).toContain('"use client"');
    expect(tree).toContain("useBilingual");
  });
});
