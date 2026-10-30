#!/usr/bin/env node
// Génère lib/researches-index.json depuis le dataset wus-data publié (lecture seule).
// Usage : node scripts/gen-researches-index.mjs  (WUS_SERVED_DIR pour surcharger le chemin)
//
// Sources (sonde du 30/10/2026, dataset ds-20261030T123856) :
//  - content/context.json : les 156 recherches (gameId, type, image, clés de
//    nom/description <*upgradeN#0>/<*upgradeN#1>) ;
//  - content/localization/<lang>.json : noms et descriptions officiels (en/fr/cn/tw) ;
//  - content/researches/researchSelector.json : les 10 researchTypes ;
//  - content/docs/tree/gameplay.root.researches.json : list[i].upgrades[] →
//    table upgrades[] (champ `unit`) = unités affectées par la recherche i ;
//  - content/docs/tree/gameplay.root.unitType.<N>.json : `address` (chemin
//    d'unité) + requirements.researchAll/researchAny = recherche(s) exigée(s)
//    pour produire l'unité → index inverse « la recherche débloque l'unité ».
// Le dataset ne publie NI coûts, NI durées, NI prérequis recherche→recherche
// (constat documenté dans ~/War-Selection/docs/SPEC-refonte-ws-atlas.md,
//  amendement SB4) : rien n'est inventé ici.
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const servedDir = process.env.WUS_SERVED_DIR ?? "/home/ubuntu/War-Selection/datasets/served";
const contextPath = join(servedDir, "content/context.json");
const updatedAtPath = join(servedDir, "updated-at.json");
const outPath = new URL("../lib/researches-index.json", import.meta.url);

if (!existsSync(contextPath)) {
  console.error(`[gen-researches-index] ${contextPath} introuvable — définis WUS_SERVED_DIR.`);
  process.exit(1);
}
const meta = JSON.parse(readFileSync(updatedAtPath, "utf8"));
const context = JSON.parse(readFileSync(contextPath, "utf8"));

// --- Localisation (noms + descriptions officiels) -------------------------
const NAME_LANGS = ["en", "fr", "cn", "tw"];
const localization = {};
for (const lang of NAME_LANGS) {
  const file = join(servedDir, "content/localization", `${lang}.json`);
  localization[lang] = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
}
const resolve = (key, lang) => {
  const value = localization[lang][key];
  return typeof value === "string" && value.length > 0 && value !== "---" ? value : undefined;
};

// --- researchTypes (researchSelector.json) ---------------------------------
const selectorPath = join(servedDir, "content/researches/researchSelector.json");
const selector = existsSync(selectorPath)
  ? JSON.parse(readFileSync(selectorPath, "utf8"))
  : { researchTypes: [] };
const types = (selector.researchTypes ?? []).map((t) => ({ id: t.id, name: t.name }));

// --- Unités : ids publiés (chemins sans extension) -------------------------
const unitsRoot = join(servedDir, "content/units/WarSelection");
const publishedUnitIds = new Set();
const walkUnits = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkUnits(full);
    else if (entry.name.endsWith(".json"))
      publishedUnitIds.add(full.slice(unitsRoot.length + 1, -5).replace(/\\/g, "/"));
  }
};
walkUnits(unitsRoot);

// --- Arbre gameplay : unités affectées par recherche ------------------------
// helpers de parcours du dump arbre {k, tp, v, ch}
const findValue = (nodes, key) => {
  for (const node of nodes) {
    if (node.k === key && "v" in node) return node.v;
    if (node.ch) {
      const found = findValue(node.ch, key);
      if (found !== undefined) return found;
    }
  }
  return undefined;
};
const findNode = (nodes, key) => {
  for (const node of nodes) {
    if (node.k === key) return node;
    if (node.ch) {
      const found = findNode(node.ch, key);
      if (found) return found;
    }
  }
  return undefined;
};
const numericIds = (objNode) => {
  const ids = [];
  for (const child of objNode?.ch ?? []) {
    if (!/^\d+$/.test(child.k)) continue;
    for (const leaf of child.ch ?? []) if ("v" in leaf) ids.push(Number(leaf.v));
  }
  return ids;
};
const addressToId = (address) =>
  typeof address === "string" && address.startsWith("WarSelection/")
    ? address.slice("WarSelection/".length)
    : undefined;

// gameplay.root.researches.json : [list, upgrades]
const researchesTreePath = join(servedDir, "content/docs/tree/gameplay.root.researches.json");
let affectsByResearch = {};
if (existsSync(researchesTreePath)) {
  const tree = JSON.parse(readFileSync(researchesTreePath, "utf8"));
  const [listNode, upgradesNode] = tree;
  const upgradeEffects = {};
  for (const entry of upgradesNode?.ch ?? []) {
    if (!/^\d+$/.test(entry.k)) continue;
    const unit = findValue(entry.ch ?? [], "unit");
    if (unit !== undefined) upgradeEffects[Number(entry.k)] = Number(unit);
  }
  // id numérique d'unité → address du unitType correspondant
  const unitAddress = {};
  const treeDir = join(servedDir, "content/docs/tree");
  for (const file of readdirSync(treeDir)) {
    const match = /^gameplay\.root\.unitType\.(\d+)\.json$/.exec(file);
    if (!match) continue;
    const dump = JSON.parse(readFileSync(join(treeDir, file), "utf8"));
    const address = findValue(dump, "address");
    const id = addressToId(address);
    if (id) unitAddress[Number(match[1])] = id;
  }
  affectsByResearch = {};
  for (const entry of listNode?.ch ?? []) {
    if (!/^\d+$/.test(entry.k)) continue;
    const upgradesObj = findNode(entry.ch ?? [], "upgrades");
    const affected = new Set();
    for (const upgradeId of numericIds(upgradesObj)) {
      const unitId = unitAddress[upgradeEffects[upgradeId]];
      if (unitId && publishedUnitIds.has(unitId)) affected.add(unitId);
    }
    if (affected.size > 0) affectsByResearch[Number(entry.k)] = [...affected].sort();
  }
}

// --- Index inverse : unités débloquées par recherche ------------------------
// (requirements.researchAll / researchAny des unitTypes publiés)
const unlocksByResearch = {};
if (existsSync(join(servedDir, "content/docs/tree"))) {
  const treeDir = join(servedDir, "content/docs/tree");
  for (const file of readdirSync(treeDir)) {
    const match = /^gameplay\.root\.unitType\.(\d+)\.json$/.exec(file);
    if (!match) continue;
    const dump = JSON.parse(readFileSync(join(treeDir, file), "utf8"));
    const unitId = addressToId(findValue(dump, "address"));
    if (!unitId || !publishedUnitIds.has(unitId)) continue;
    const requirements = findNode(dump, "requirements");
    const researchIds = new Set([
      ...numericIds(findNode(requirements?.ch ?? [], "researchAll")),
      ...numericIds(findNode(requirements?.ch ?? [], "researchAny")),
    ]);
    for (const researchId of researchIds) {
      if (!unlocksByResearch[researchId]) unlocksByResearch[researchId] = new Set();
      unlocksByResearch[researchId].add(unitId);
    }
  }
}

// --- Assemblage -------------------------------------------------------------
const researches = (context.researches ?? []).map((research) => {
  const names = {};
  const descriptions = {};
  for (const lang of NAME_LANGS) {
    const name = resolve(research.name, lang);
    const description = resolve(research.description, lang);
    if (name !== undefined) names[lang] = name;
    if (description !== undefined) descriptions[lang] = description;
  }
  const entry = {
    gameId: research.gameId,
    type: research.type,
    image: typeof research.image === "string" ? research.image : "",
  };
  if (Object.keys(names).length > 0) entry.names = names;
  if (Object.keys(descriptions).length > 0) entry.descriptions = descriptions;
  const affects = affectsByResearch[research.gameId];
  if (affects) entry.affects = affects;
  const unlocks = unlocksByResearch[research.gameId];
  if (unlocks) entry.unlocks = [...unlocks].sort();
  return entry;
});

const index = {
  datasetId: meta.datasetId ?? "",
  gameVersion: meta.gameVersion ?? "",
  generatedAt: new Date().toISOString(),
  types,
  researches,
};
writeFileSync(outPath, JSON.stringify(index) + "\n");
const withAffects = researches.filter((r) => r.affects).length;
const withUnlocks = researches.filter((r) => r.unlocks).length;
console.log(
  `[gen-researches-index] ${researches.length} recherches, ${types.length} types, ` +
    `${withAffects} avec unités affectées, ${withUnlocks} avec unités débloquées ` +
    `(${meta.datasetId ?? "?"}) -> lib/researches-index.json`,
);
