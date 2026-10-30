import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { translate } from "@/lib/i18n";
import {
  categoryLabels,
  countByFaction,
  countByGroup,
  countUnits,
  damageTypeLabels,
  factionLabels,
  formatDuration,
  formatPublishedDate,
  formatStatNumber,
  localizedGroupLabel,
  localizedNationLabel,
  localizedResourceLabel,
  localizedTagLabel,
  localizedUnitDescription,
  localizedUnitName,
  researchDeepLink,
  resourceImageUrl,
  searchUnits,
  shortTag,
  sourceTypeLabels,
  unitDeepLink,
  unitDisplayName,
  unitFicheUrl,
  unitGroups,
  unitImageUrl,
  unitsIndex,
  upgradeImageUrl,
  weaponTypeLabels,
  type UnitIndexEntry,
} from "@/lib/units";

const SERVED_DIR = "/home/ubuntu/War-Selection/datasets/served";

// Point de contrôle : le dataset publié ds-20261030 livre 453 fiches. Si ce
// nombre change, régénérer lib/units-index.json (scripts/gen-units-index.mjs)
// et mettre à jour cette valeur attendue.
const PUBLISHED_UNIT_COUNT = 453;

describe("index des unités /units", () => {
  it("couvre exactement le nombre d'unités du dataset publié", () => {
    expect(unitsIndex.units).toHaveLength(PUBLISHED_UNIT_COUNT);
  });

  it("égale le compte publié dans updated-at.json quand le dataset est servi localement", () => {
    const updatedAtPath = join(SERVED_DIR, "updated-at.json");
    if (!existsSync(updatedAtPath)) return; // hors VPS : garde-fou du point de contrôle ci-dessus
    const meta = JSON.parse(readFileSync(updatedAtPath, "utf8"));
    expect(unitsIndex.units).toHaveLength(meta.counts.units);
    expect(unitsIndex.datasetId).toBe(meta.datasetId);
    expect(unitsIndex.gameVersion).toBe(meta.gameVersion);
  });

  it("a des identifiants uniques et des factions connues", () => {
    const ids = new Set(unitsIndex.units.map((u) => u.id));
    expect(ids.size).toBe(unitsIndex.units.length);
    const known = new Set([...factionLabels.map((f) => f.id), "1", "2", "3", "4", "5"]);
    const unknown = [...new Set(unitsIndex.units.map((u) => u.faction))].filter(
      (faction) => !known.has(faction),
    );
    expect(unknown).toEqual([]);
    expect(new Set(unitsIndex.factions)).toEqual(new Set(unitsIndex.units.map((u) => u.faction)));
  });

  it("construit des URLs de fiche et d'image cohérentes, vérifiées sur échantillon disque", () => {
    const sample = unitsIndex.units.filter((_, i) => i % 37 === 0); // ~13 fiches
    const missing: string[] = [];
    for (const unit of sample) {
      const local = join(SERVED_DIR, "content/units/WarSelection", `${unit.id}.json`);
      if (!existsSync(local)) missing.push(unit.id);
    }
    if (existsSync(join(SERVED_DIR, "updated-at.json"))) expect(missing).toEqual([]);
    expect(unitFicheUrl("5/fr/fighter")).toBe(
      "/wus-data/content/units/WarSelection/5/fr/fighter.json",
    );
    expect(unitImageUrl("unit/WarSelection/5/fr/fighter.png")).toBe(
      "/wus-data/content/images/unit/WarSelection/5/fr/fighter.png",
    );
  });

  it("ne code aucun compte d'unités en dur dans la page /units", () => {
    const offenders: string[] = [];
    const targets = [
      "app/units/page.tsx",
      "app/units.css",
      "components/units-browser.tsx",
      "components/atlas-nav.tsx",
      "lib/units.ts",
    ];
    for (const file of targets) {
      if (/\b453\b/.test(readFileSync(file, "utf8"))) offenders.push(file);
    }
    expect(offenders, `Comptes codés en dur : ${offenders.join(", ")}`).toEqual([]);
  });
});

describe("logique de comptage et de recherche (échantillon mocké)", () => {
  const mock: UnitIndexEntry[] = [
    { id: "5/fr/fighter", faction: "5", group: "fr", slug: "fighter", name: "<*x>", image: "i.png" },
    { id: "5/de/tank_heavy", faction: "5", group: "de", slug: "tank_heavy", name: "<*y>", image: "" },
    { id: "animals/tiger/male", faction: "animals", group: "tiger", slug: "male", name: "<*z>", image: "" },
    { id: "horde/orcs/grunt", faction: "horde", group: "orcs", slug: "grunt", name: "<*w>", image: "" },
  ];

  it("compte le total et la répartition par faction", () => {
    expect(countUnits(mock)).toBe(4);
    expect(countByFaction(mock)).toEqual({ "5": 2, animals: 1, horde: 1 });
    const totalFromFactions = Object.values(countByFaction(unitsIndex.units)).reduce(
      (a, b) => a + b,
      0,
    );
    expect(totalFromFactions).toBe(countUnits(unitsIndex.units));
  });

  it("recherche par id et par nom affiché, insensible à la casse", () => {
    expect(searchUnits(mock, "FIGHTER").map((u) => u.id)).toEqual(["5/fr/fighter"]);
    expect(searchUnits(mock, "tank heavy").map((u) => u.id)).toEqual(["5/de/tank_heavy"]);
    expect(searchUnits(mock, "  ").length).toBe(4);
    expect(searchUnits(mock, "navire-inconnu")).toEqual([]);
  });

  it("dérive le nom affiché et compresse les clés brutes", () => {
    expect(unitDisplayName(mock[0])).toBe("fighter · fr");
    expect(unitDisplayName(mock[2])).toBe("male · tiger");
    expect(shortTag("<*unitTag#4>")).toBe("unitTag 4");
    expect(shortTag("genericUnitTag")).toBe("genericUnitTag");
  });
  it("localise la date de publication du badge pour zh / en / fr", () => {
    const iso = "2026-10-30T12:00:00.927Z";
    const zh = formatPublishedDate(iso, "zh");
    const en = formatPublishedDate(iso, "en");
    const fr = formatPublishedDate(iso, "fr");
    expect(zh).toContain("2026");
    expect(en).toMatch(/October/);
    expect(fr).toMatch(/octobre/);
    expect(new Set([zh, en, fr]).size).toBe(3);
    expect(formatPublishedDate("not-a-date", "fr")).toBe("not-a-date");
  });
});

describe("noms localisés des unités (localization/<lang>.json)", () => {
  const dragoon: UnitIndexEntry = {
    id: "3/ae/dragoon",
    faction: "3",
    group: "ae",
    slug: "dragoon",
    name: "<*unitNameWarSelection/3/ae/dragoon>",
    image: "",
    names: { en: "Dragoon", fr: "Dragon", cn: "龙骑兵", tw: "龍騎兵" },
  };
  const onlyTw: UnitIndexEntry = {
    id: "5/x/legacy",
    faction: "5",
    group: "x",
    slug: "legacy",
    name: "",
    image: "",
    names: { tw: "繁體名" },
  };
  const onlyEn: UnitIndexEntry = {
    id: "5/x/mixed",
    faction: "5",
    group: "x",
    slug: "mixed",
    name: "",
    image: "",
    names: { en: "EN name" },
  };
  const noNames: UnitIndexEntry = {
    id: "horde/orcs/grunt",
    faction: "horde",
    group: "orcs",
    slug: "grunt",
    name: "",
    image: "",
  };

  it("résout fr→fr, en→en, zh→cn puis tw, repli en puis nom dérivé", () => {
    expect(localizedUnitName(dragoon, "fr")).toBe("Dragon");
    expect(localizedUnitName(dragoon, "en")).toBe("Dragoon");
    expect(localizedUnitName(dragoon, "zh")).toBe("龙骑兵");
    // Repli chinois traditionnel quand le simplifié manque.
    expect(localizedUnitName(onlyTw, "zh")).toBe("繁體名");
    // Locale sans traduction → repli en, sinon nom dérivé du chemin.
    expect(localizedUnitName(onlyEn, "fr")).toBe("EN name");
    expect(localizedUnitName(onlyTw, "fr")).toBe("legacy · x");
    expect(localizedUnitName(noNames, "fr")).toBe("grunt · orcs");
  });

  it("recherche sur les noms localisés des trois langues", () => {
    expect(searchUnits([dragoon], "dragon").map((u) => u.id)).toEqual(["3/ae/dragoon"]);
    expect(searchUnits([dragoon], "龙骑兵").map((u) => u.id)).toEqual(["3/ae/dragoon"]);
    expect(searchUnits([dragoon], "龍騎兵").map((u) => u.id)).toEqual(["3/ae/dragoon"]);
    expect(searchUnits([dragoon], "dragoon").map((u) => u.id)).toEqual(["3/ae/dragoon"]);
    expect(searchUnits([dragoon], "baliste")).toEqual([]);
  });

  it("embarque au moins un nom localisé pour chaque unité de l'index", () => {
    const unnamed = unitsIndex.units.filter(
      (u) => !u.names || Object.values(u.names).every((v) => !v),
    );
    expect(unnamed, `Unités sans nom localisé : ${unnamed.slice(0, 5).map((u) => u.id).join(", ")}`)
      .toEqual([]);
  });

  it("égal le localization/<lang>.json du dataset servi sur un échantillon ≥ 20", () => {
    const locDir = join(SERVED_DIR, "content/localization");
    if (!existsSync(join(locDir, "fr.json"))) return; // hors VPS : garde-fous ci-dessus
    const read = (lang: string) => JSON.parse(readFileSync(join(locDir, `${lang}.json`), "utf8"));
    const en = read("en");
    const fr = read("fr");
    const cn = read("cn");
    const sample = unitsIndex.units.filter((_, i) => i % 19 === 0); // 453/19 ≈ 24 unités
    expect(sample.length).toBeGreaterThanOrEqual(20);
    const mismatches: string[] = [];
    for (const unit of sample) {
      const key = `<*unitNameWarSelection/${unit.id}>`;
      if (unit.names?.fr !== fr[key]) mismatches.push(`${unit.id}:fr`);
      if (unit.names?.en !== en[key]) mismatches.push(`${unit.id}:en`);
      if (unit.names?.cn !== cn[key]) mismatches.push(`${unit.id}:cn`);
    }
    expect(mismatches, `Noms divergents du dataset : ${mismatches.join(", ")}`).toEqual([]);
  });
});

describe("fiche enrichie embarquée — entrepôt (1/depot)", () => {
  const depot = unitsIndex.units.find((u) => u.id === "1/depot");
  it("existe avec un résumé complet", () => {
    expect(depot).toBeDefined();
    expect(depot?.s).toBeDefined();
  });

  it("affiche les coûts Matériaux 100 (source) / 20 (initial) / 100 (complet)", () => {
    const sources = depot?.s?.sources ?? [];
    expect(sources.length).toBeGreaterThan(0);
    expect(sources[0].cost).toEqual([[1, 100]]);
    expect(depot?.s?.build?.init).toEqual([[1, 20]]);
    expect(depot?.s?.build?.full).toEqual([[1, 100]]);
    // Nom officiel localisé de la ressource #1 : Matériaux (fr) / Materials (en).
    expect(localizedResourceLabel(unitsIndex, 1, "fr")).toBe("Matériaux");
    expect(localizedResourceLabel(unitsIndex, 1, "en")).toBe("Materials");
    expect(localizedResourceLabel(unitsIndex, 0, "zh")).toBe("食物");
    // Icône de ressource servie par le dataset.
    expect(resourceImageUrl(1)).toBe("/wus-data/content/images/resource/1.png");
  });

  it("pointe le bâtisseur worker avec un lien profond cliquable", () => {
    expect(depot?.s?.sources?.[0].by).toBe("1/worker");
    expect(unitDeepLink("1/worker")).toBe("/units?unit=1%2Fworker");
  });

  it("porte la nation officielle Age de Pierre (nationId 1)", () => {
    expect(depot?.nationId).toBe(1);
    expect(localizedNationLabel(unitsIndex, 1, "fr")).toBe("Age de Pierre");
    expect(localizedNationLabel(unitsIndex, 1, "en")).toBe("Stone Age");
    expect(localizedNationLabel(unitsIndex, 1, "zh")).toBe("石器时代");
  });

  it("embarque les caractéristiques officielles (description masquée si absente du loc)", () => {
    expect(localizedUnitDescription(depot!, "fr")).toBeUndefined(); // <*unitText…/1/depot> absent du loc → section masquée
    expect(depot?.s?.health).toBe(150);
    expect(depot?.s?.storageMultiplier).toBe(100);
    expect(depot?.s?.killValue).toBeDefined();
    expect(depot?.s?.armorZonal).toEqual([[2, 1]]);
    expect(depot?.s?.armorTyped).toEqual([["damageTypeRanged", 40]]);
    const bomber = unitsIndex.units.find((u) => u.id === "5/fr/airplane_bomber");
    expect(localizedUnitDescription(bomber!, "fr")).toMatch(/piste d’atterrissage/);
  });
});

describe("fiche enrichie embarquée — temple (1/temple) : travaux vers recherches", () => {
  const temple = unitsIndex.units.find((u) => u.id === "1/temple");

  it("expose 3 travaux avec durées 90 / 90.1 / 60 s", () => {
    const works = temple?.s?.works ?? [];
    expect(works).toHaveLength(3);
    expect(works.map((w) => w.t)).toEqual([90, 90.1, 60]);
    expect(works.map((w) => formatDuration(w.t!, "fr"))).toEqual(["90 s", "90,1 s", "60 s"]);
  });

  it("produit les recherches 3 / 4 / 25, cliquables vers /researches", () => {
    const works = temple?.s?.works ?? [];
    expect(works.map((w) => w.entity.kind)).toEqual(["research", "research", "research"]);
    expect(works.map((w) => (w.entity as { gameId: number }).gameId)).toEqual([3, 4, 25]);
    for (const gameId of [3, 4, 25]) {
      expect(researchDeepLink(gameId)).toBe(`/researches?research=${gameId}`);
      expect(upgradeImageUrl(gameId)).toBe(`/wus-data/content/images/upgrade/${gameId}.png`);
    }
  });

  it("porte les prérequis d'unités (ouvriers × 20) et les recherches applicables", () => {
    const works = temple?.s?.works ?? [];
    expect(works[0].reqU).toEqual([["1/worker", 20]]);
    expect(temple?.s?.researchIds).toEqual([3, 4]);
  });

  it("égale le dépôt de données servi (coûts et durées non inventés)", () => {
    const fichePath = join(SERVED_DIR, "content/units/WarSelection/1/temple.json");
    if (!existsSync(fichePath)) return; // hors VPS : couvert par les points de contrôle du générateur
    const fiche = JSON.parse(readFileSync(fichePath, "utf8"));
    const works = (fiche.abilities ?? []).filter(
      (a: { containerName?: string }) => a.containerName === "abilityContainerWork",
    );
    expect(works).toHaveLength(3);
    const costs = works.map((a: { work: { cost: { resourceId: number; value: number }[] } }) =>
      a.work.cost.filter((c) => c.value > 0).map((c) => [c.resourceId, c.value]),
    );
    expect((temple?.s?.works ?? []).map((w) => w.cost)).toEqual(costs);
  });
});

describe("formats localisés (nombres et durées)", () => {
  it("formate les durées par langue : 90 s / 90 sec / 90 秒", () => {
    expect(formatDuration(90, "fr")).toBe("90 s");
    expect(formatDuration(90, "en")).toBe("90 sec");
    expect(formatDuration(90, "zh")).toBe("90 秒");
    expect(formatDuration(90.1, "fr")).toBe("90,1 s");
    expect(formatDuration(90.1, "en")).toBe("90.1 sec");
    expect(formatDuration(60, "zh")).toBe("60 秒");
  });

  it("localise les séparateurs décimaux et des milliers", () => {
    expect(formatStatNumber(6.625129937489298, "fr")).toBe("6,625");
    expect(formatStatNumber(1000, "fr")).toMatch(/1[\s\u202f\u00a0]000/);
    expect(formatStatNumber(90.1, "en")).toBe("90.1");
    expect(formatStatNumber(150, "zh")).toBe("150");
  });
});

describe("étiquettes d'âges officielles dans la liste /units", () => {
  it("groupe par nation officielle avec les noms localisés du jeu", () => {
    const groups = unitGroups(unitsIndex);
    expect(groups.length).toBeGreaterThan(10);
    const fr = (nationId: number) =>
      localizedGroupLabel(unitsIndex, { key: `n:${nationId}`, nationId }, "fr");
    expect(fr(1)).toBe("Age de Pierre");
    expect(fr(2)).toBe("Europe");
    expect(fr(3)).toBe("Asie");
    expect(fr(4)).toBe("Europe de l’Ouest");
    expect(fr(5)).toBe("Europe de l’Est");
    expect(fr(6)).toBe("Asie de l’Ouest");
    expect(fr(7)).toBe("Asie de l’Est");
    expect(fr(8)).toBe("Abstrait");
    expect(fr(14)).toBe("France");
    // Étiquettes EN et ZH officielles elles aussi.
    expect(localizedGroupLabel(unitsIndex, { key: "n:1", nationId: 1 }, "en")).toBe("Stone Age");
    expect(localizedGroupLabel(unitsIndex, { key: "n:1", nationId: 1 }, "zh")).toBe("石器时代");
  });

  it("couvre chaque unité exactement une fois (aucune unité sans groupe)", () => {
    const counts = countByGroup(unitsIndex.units);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(countUnits(unitsIndex.units));
    const groupKeys = new Set(unitGroups(unitsIndex).map((g) => g.key));
    for (const key of Object.keys(counts)) expect(groupKeys.has(key)).toBe(true);
  });

  it("garde les groupes spéciaux (animaux, décor, horde…) localisés par le site", () => {
    const groups = unitGroups(unitsIndex);
    expect(groups.some((g) => g.faction === "animals")).toBe(true);
    expect(groups.some((g) => g.faction === "horde")).toBe(true);
    const animals = groups.find((g) => g.faction === "animals")!;
    expect(localizedGroupLabel(unitsIndex, animals, "fr")).toBe("Animaux sauvages");
  });

  it("n'affiche plus aucun libellé générique « Ère 1-5 »", () => {
    const generic = /(?:Ère\s?\d|Age\s?\d$|第\s?\d\s?时代)/;
    for (const group of unitGroups(unitsIndex)) {
      for (const locale of ["fr", "en", "zh"] as const) {
        const label = localizedGroupLabel(unitsIndex, group, locale);
        if (label) expect(`${group.key}:${label}`).not.toMatch(generic);
      }
    }
    // Aucun résidu dans le code du site (hors commentaires, libellés ou dictionnaires).
    const targets = [
      "lib/units.ts",
      "lib/english.ts",
      "lib/french.ts",
      "components/units-browser.tsx",
      "app/units/page.tsx",
    ];
    const offenders: string[] = [];
    for (const file of targets) {
      const code = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|\s)\/\/.*$/gm, "");
      if (/\bÈre [1-5]\b|\bAge [1-5]\b|第 [1-5] 时代/.test(code)) offenders.push(file);
    }
    expect(offenders, `Libellés génériques résiduels : ${offenders.join(", ")}`).toEqual([]);
  });
});

describe("tags officiels du jeu résolus par l'index", () => {
  it("traduit les clés <*unitTag#N> et laisse les enums au dictionnaire du site", () => {
    expect(localizedTagLabel(unitsIndex, "<*unitTag#2>", "fr")).toBe("Bâtiment");
    expect(localizedTagLabel(unitsIndex, "<*unitTag#3>", "fr")).toBe("Ouvrier");
    expect(localizedTagLabel(unitsIndex, "<*unitTag#14>", "fr")).toBe("Aviation");
    // Clé absente du loc → repli compact, jamais de clé brute complète.
    expect(localizedTagLabel(unitsIndex, "<*unitTag#999>", "fr")).toBe("unitTag 999");
    expect(localizedTagLabel(unitsIndex, "damageTypeInconnu", "fr")).toBe("damageTypeInconnu");
  });
});

describe("couverture i18n des libellés /units", () => {
  const keys = [
    "单位档案",
    "按时代浏览游戏单位，查看原始数值、武器与图片；数据来自公开导出。",
    "共 ${count} 个单位",
    "数据更新于 ${date}，共 ${count} 个单位",
    "正在读取数据版本…",
    "数据版本暂时不可用",
    "野生动物",
    "装饰单位",
    "辅助单位",
    "部落单位",
    "名称、阵营（时代）与描述来自游戏官方本地化（中文 / English / Français），个别缺失时回退为原始键；数值与图片来自公开数据集。",
    "基础特征",
    "护甲",
    "区域护甲",
    "建造",
    "初始成本",
    "完整成本",
    "修缮成本",
    "前置研究",
    "工作项目",
    "产出",
    "时长",
    "血量",
    "体型",
    "威胁",
    "储存加成",
    "击杀价值",
    "可控",
    "是",
    "否",
    "射程",
    "装填",
    "每次攻击发射",
    "标签",
    "相关研究",
    "生产所需研究",
    "影响此单位的研究",
    "关联研究程序",
    "其他单位",
    "关闭",
    "原始导出字段",
    "WAR SELECTION / UNIT ARCHIVE",
    // Enums du jeu traduits par les dictionnaires du site.
    ...categoryLabels.map((c) => c.zh),
    ...weaponTypeLabels.map((w) => w.zh),
    ...damageTypeLabels.map((d) => d.zh),
    ...sourceTypeLabels.map((s) => s.zh),
    ...factionLabels.map((f) => f.zh),
  ];

  it("traduit chaque libellé en EN et FR", () => {
    const missing = keys.filter(
      (key) =>
        // L'eyebrow est déjà anglais à la source : seule la couverture FR compte.
        (key === "WAR SELECTION / UNIT ARCHIVE" && translate(key, "fr") === key) ||
        (key !== "WAR SELECTION / UNIT ARCHIVE" &&
          (translate(key, "en") === key || translate(key, "fr") === key)),
    );
    expect(missing, `Clés non traduites : ${missing.join(" | ")}`).toEqual([]);
  });

  it("applique les templates de compte et de badge dans les trois langues", () => {
    expect(translate("共 453 个单位", "fr")).toBe("453 unités");
    expect(translate("共 453 个单位", "en")).toBe("453 units");
    expect(translate("数据更新于 2026年10月30日，共 453 个单位", "fr")).toBe(
      "Données mises à jour le 2026年10月30日 · 453 unités",
    );
  });
});
