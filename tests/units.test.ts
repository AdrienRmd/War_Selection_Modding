import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { translate } from "@/lib/i18n";
import {
  countByFaction,
  countUnits,
  factionLabels,
  formatPublishedDate,
  searchUnits,
  shortTag,
  unitDisplayName,
  unitFicheUrl,
  unitImageUrl,
  unitsIndex,
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
    const known = new Set(factionLabels.map((f) => f.id));
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

describe("couverture i18n des libellés /units", () => {
  const keys = [
    "单位档案",
    "按时代浏览游戏单位，查看原始数值、武器与图片；数据来自公开导出。",
    "共 ${count} 个单位",
    "数据更新于 ${date}，共 ${count} 个单位",
    "正在读取数据版本…",
    "数据版本暂时不可用",
    "第 1 时代",
    "第 5 时代",
    "野生动物",
    "装饰单位",
    "辅助单位",
    "部落单位",
    "名称为游戏导出的原始键，尚未本地化；图片与数值来自公开数据集。",
    "血量",
    "体型",
    "恢复速度",
    "威胁",
    "国家编号",
    "可控",
    "是",
    "否",
    "射程",
    "每次攻击发射",
    "护甲分布",
    "标签",
    "原始名称",
    "载入单位数据…",
    "单位数据暂时无法加载",
    "关闭",
    "重试",
    "原始导出字段",
    "WAR SELECTION / UNIT ARCHIVE",
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
