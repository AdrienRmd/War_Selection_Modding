import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { translate } from "@/lib/i18n";
import { collectedSeeds, type CollectedMap } from "@/lib/collection";
import {
  collectionI18nSize,
  defaultMapName,
  mapName,
  mapNote,
  mapSearchExtra,
} from "@/lib/collection-i18n";
import dict from "@/lib/collection-i18n.json";

// Mission finitions 01/11 — chantier 4 : fiches cartes trilingues.
// Le dictionnaire lib/collection-i18n.json (généré par
// scripts/gen-collection-i18n.mjs) couvre les NOMS et NOTES de toutes les
// fiches titrées/annotées, avec repli langue d'origine si absent, et la
// recherche de /maps matche zh/en/fr.

const entries = dict as Record<
  string,
  { en?: { name?: string; note?: string }; fr?: { name?: string; note?: string } }
>;
const seed = (id: string): CollectedMap => {
  const m = collectedSeeds.find((x) => x.id === id);
  if (!m) throw new Error(`fiche inconnue ${id}`);
  return m;
};

describe("dictionnaire trilingue des fiches cartes", () => {
  it("existe et ne référence que des fiches réelles (aucun id orphelin)", () => {
    const ids = new Set(collectedSeeds.map((m) => m.id));
    const orphans = Object.keys(entries).filter((id) => !ids.has(id));
    expect(orphans).toEqual([]);
    expect(collectionI18nSize).toBeGreaterThanOrEqual(110);
  });

  it("couvre le nom FR de toutes les fiches titrées", () => {
    const titled = collectedSeeds.filter((m) => m.title);
    const missing = titled.filter((m) => !entries[m.id]?.fr?.name);
    expect(missing.map((m) => m.id)).toEqual([]);
  });

  it("couvre la note FR de toutes les fiches avec résumé", () => {
    const noted = collectedSeeds.filter((m) => m.summary || m.summary_en);
    const missing = noted.filter((m) => !entries[m.id]?.fr?.note);
    expect(missing.map((m) => m.id)).toEqual([]);
  });

  it("retire « unconfirmed » des titres publics EN (conservé en données)", () => {
    const westerplatte = seed("map-981104b9");
    expect(westerplatte.title_en).toContain("unconfirmed"); // données brutes intactes
    expect(mapName(westerplatte, "en")).toBe("Westerplatte");
    expect(mapNote(westerplatte, "en")).not.toContain("association unconfirmed");
  });

  it("traduit les titres qui n'étaient pas de l'anglais (zh/ru/pl)", () => {
    expect(mapName(seed("map-00318438"), "en")).toBe("Lying-Flat Survival");
    expect(mapName(seed("map-086004a8"), "en")).toBe("South America");
    expect(mapName(seed("map-00658421"), "en")).toBe("Map for 6 Players");
  });
});

describe("repli langue d'origine et défauts propres", () => {
  const ghost: CollectedMap = {
    ...seed("map-00200088"),
    id: "map-ghost0001",
    title: "幽灵地图",
    title_en: "",
    summary: "只有中文说明。",
    summary_en: "",
  };

  it("fiche hors dictionnaire : repli sur les données (zh/en/fr)", () => {
    expect(mapName(ghost, "zh")).toBe("幽灵地图");
    expect(mapName(ghost, "en")).toBe("幽灵地图"); // pas d'EN → langue d'origine
    expect(mapNote(ghost, "fr")).toBe("只有中文说明。"); // pas de FR → origine
  });

  it("fiche sans nom : défaut propre « Carte/Map/地图 <code> » localisé", () => {
    expect(defaultMapName("fr", "map-abc123")).toBe("Carte map-abc123");
    expect(defaultMapName("en", "map-abc123")).toBe("Map map-abc123");
    expect(defaultMapName("zh", "map-abc123")).toBe("地图 map-abc123");
    const untitled = collectedSeeds.find((m) => !m.title);
    expect(untitled && mapName(untitled, "fr")).toMatch(/^Carte map-/);
  });
});

describe("recherche trilingue de /maps", () => {
  it("mapSearchExtra expose nom et note FR au corpus cherchable", () => {
    const extra = mapSearchExtra(seed("map-00200088"));
    expect(extra).toContain("Bataille de Stalingrad"); // nom FR
    expect(extra.toLowerCase()).toContain("stalingrad original de yurky");
  });

  it("le prédicat de recherche matche une requête FR via le dictionnaire", () => {
    const haystackOf = (id: string) => {
      const m = seed(id);
      return [
        m.title,
        m.title_en,
        m.author,
        m.map_code,
        m.summary,
        m.summary_en,
        m.mods,
        m.relation_note,
        m.relation_note_en,
        mapSearchExtra(m),
      ]
        .join(" ")
        .toLowerCase();
    };
    expect(haystackOf("map-00200088").includes("bataille de stalingrad")).toBe(true);
    expect(haystackOf("map-102580b4").includes("guerre de la mer égée")).toBe(true);
    expect(haystackOf("map-102580b4").includes("mer Égée".toLowerCase())).toBe(true);
  });
});

// Chantier 4d : les libellés l(zh, en) des composants cartes doivent avoir
// une couverture FR (clé zh OU clé EN traduite) — « Source notes » etc.
describe("couverture FR des libellés des composants cartes", () => {
  const files = [
    "components/collected-maps.tsx",
    "components/collected-map-detail.tsx",
    "components/map-provenance.tsx",
    "components/community-maps.tsx",
  ];
  const pairs: [string, string][] = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    const re = /l\(\s*["'`]([^"'`]+)["'`]\s*,\s*["'`]([^"'`]+)["'`]\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) pairs.push([m[1], m[2]]);
  }

  it("chaque paire (zh, en) a une traduction française", () => {
    const missing = pairs.filter(
      ([zh, en]) => translate(zh, "fr") === zh && translate(en, "fr") === en,
    );
    expect(missing, `Libellés sans FR : ${missing.map(([zh]) => zh).join(" | ")}`).toEqual([]);
  });

  it("le composant cartes n'affiche plus « Nom à compléter » comme titre", () => {
    const src = readFileSync("components/collected-maps.tsx", "utf8");
    expect(src).not.toMatch(/名称待补充[\s\S]*Unidentified map/);
  });
});
