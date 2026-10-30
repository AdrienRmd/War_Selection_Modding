#!/usr/bin/env node
// Génère lib/units-index.json depuis le dataset wus-data publié (lecture seule).
// Usage : node scripts/gen-units-index.mjs  (WUS_SERVED_DIR pour surcharger le chemin)
// À relancer quand ws-data republie le dataset (le badge /units et les compteurs
// viennent d'updated-at.json ; cet index fournit la navigation ET les fiches).
//
// Embarqué (mission P3-étape-1) :
//  - noms localisés par unité (clés <*unitNameWarSelection/<id>>) ;
//  - étiquettes officielles de nations/âges ( <*nationNameN> ou <*nationNameN#0>
//    pour les pays à variantes ir1/ir2 : Empire Russe, Austro-Hongrie, Perse) ;
//  - noms officiels de ressources ( <*recourceName#N>, arrêt à la première
//    absente — les ressources non localisées ne sont pas affichées par l'UI) ;
//  - étiquettes officielles de tags ( <*unitTag#N>, utilisées par les blocs
//    « tags » et « types de dégâts » des fiches) ;
//  - par unité, un résumé « s » : caractéristiques, description localisée,
//    armures, construction (sources + build), travaux (coûts, durée, prérequis,
//    entité produite = unité ou recherche), armes, recherches applicables.
//    Les noms des entités référencées (bâtisseurs, prérequis, produits,
//    recherches) ne sont PAS dupliqués : l'UI les résout via cet index et
//    lib/researches-index.json (clé = id / gameId).
//
// Garde-fous : le script échoue si la forme du dataset dérive (point de
// contrôle depot/temple ci-dessous), pour ne jamais publier un index creux.
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const servedDir = process.env.WUS_SERVED_DIR ?? "/home/ubuntu/War-Selection/datasets/served";
const unitsRoot = join(servedDir, "content/units/WarSelection");
const locRoot = join(servedDir, "content/localization");
const updatedAtPath = join(servedDir, "updated-at.json");
const outPath = new URL("../lib/units-index.json", import.meta.url);

if (!existsSync(unitsRoot)) {
  console.error(`[gen-units-index] ${unitsRoot} introuvable — définis WUS_SERVED_DIR.`);
  process.exit(1);
}
const meta = JSON.parse(readFileSync(updatedAtPath, "utf8"));

// Langues embarquées pour l'affichage : zh (site) ← cn puis tw, en, fr.
const NAME_LANGS = ["en", "fr", "cn", "tw"];
const localization = {};
for (const lang of NAME_LANGS) {
  const file = join(locRoot, `${lang}.json`);
  localization[lang] = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
}
// Valeur localisée exploitable (jamais "---", jamais vide).
const locValue = (key, lang) => {
  const value = localization[lang][key];
  return typeof value === "string" && value.length > 0 && value !== "---" ? value : undefined;
};
const locMap = (key) => {
  const out = {};
  for (const lang of NAME_LANGS) {
    const value = locValue(key, lang);
    if (value !== undefined) out[lang] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
};
const unitName = (id, lang) => locValue(`<*unitNameWarSelection/${id}>`, lang);

// --- Résumé d'une fiche (modèle embarqué « s ») -----------------------------
const stripPrefix = (entityId) =>
  typeof entityId === "string" && entityId.startsWith("WarSelection/")
    ? entityId.slice("WarSelection/".length)
    : undefined;
// [id, quantité, max?] — le 3e élément (1) signale quantityTypeNotMore (≤).
const reqUnits = (requirements) =>
  (requirements?.units ?? [])
    .map((r) => {
      const id = stripPrefix(r.unitId);
      if (!id) return undefined;
      const min = typeof r.quantityMin === "number" ? r.quantityMin : 0;
      return r.quantityStr === "quantityTypeNotMore" ? [id, min, 1] : [id, min];
    })
    .filter(Boolean);
const reqResearch = (requirements) =>
  (requirements?.researchAny ?? [])
    .map((r) => (typeof r.researchId === "number" ? r.researchId : undefined))
    .filter((v) => v !== undefined);
// Coûts : paires [resourceId, valeur] non nulles (les lignes à 0 ne s'affichent pas).
const costPairs = (cost) =>
  (cost ?? [])
    .filter((c) => typeof c.resourceId === "number" && typeof c.value === "number" && c.value > 0)
    .map((c) => [c.resourceId, c.value]);

const buildSummary = (fiche, tagKeys) => {
  const s = {};
  for (const key of [
    "health",
    "size",
    "viewRange",
    "threat",
    "storageMultiplier",
    "killValue",
    "controllable",
    "category",
  ]) {
    if (fiche[key] !== undefined && fiche[key] !== null) s[key] = fiche[key];
  }
  if (typeof fiche.description === "string" && fiche.description) {
    const desc = locMap(fiche.description);
    if (desc) s.desc = desc;
  }
  if (Array.isArray(fiche.armorZonal) && fiche.armorZonal.length > 0) {
    s.armorZonal = fiche.armorZonal.map((z) => [z.value, z.probability]);
  }
  if (Array.isArray(fiche.armorTyped) && fiche.armorTyped.length > 0) {
    s.armorTyped = fiche.armorTyped.map((z) => [z.type, z.probability]);
    for (const [type] of s.armorTyped) tagKeys.add(type);
  }
  const ficheTags = (fiche.tags ?? [])
    .map((tag) => (typeof tag?.name === "string" ? tag.name : undefined))
    .filter((name) => name !== undefined);
  if (ficheTags.length > 0) s.tags = ficheTags;
  const sources = (fiche.sources ?? [])
    .map((source) => {
      const builder = stripPrefix(source.sourceInfo?.entityId);
      if (!builder) return undefined;
      const out = { by: builder, cost: costPairs(source.cost) };
      const units = reqUnits(source.requirements);
      if (units.length > 0) out.reqU = units;
      const research = reqResearch(source.requirements);
      if (research.length > 0) out.reqR = research;
      if (typeof source.sourceType === "string") out.type = source.sourceType;
      return out;
    })
    .filter(Boolean);
  if (sources.length > 0) s.sources = sources;
  const build = fiche.build;
  if (build && typeof build === "object") {
    const b = {};
    for (const [key, field] of [
      ["init", "initCost"],
      ["full", "fullCost"],
      ["heal", "healCost"],
    ]) {
      const pairs = costPairs(build[field]);
      if (pairs.length > 0) b[key] = pairs;
    }
    const units = reqUnits(build.requirements);
    if (units.length > 0) b.reqU = units;
    const research = reqResearch(build.requirements);
    if (research.length > 0) b.reqR = research;
    if (Object.keys(b).length > 0) s.build = b;
  }
  const works = (fiche.abilities ?? [])
    .filter((a) => a.containerName === "abilityContainerWork")
    .map((a) => {
      const work = a.work ?? {};
      const entityInfo = a.ability?.entityInfo ?? {};
      const entityId = entityInfo.entityId;
      const out = { cost: costPairs(work.cost) };
      if (typeof work.makeTime === "number") out.t = work.makeTime;
      const units = reqUnits(a.ability?.requirements);
      if (units.length > 0) out.reqU = units;
      const research = reqResearch(a.ability?.requirements);
      if (research.length > 0) out.reqR = research;
      // Entité produite : identifiant numérique → recherche (gameId), chemin → unité.
      const numericEntity =
        (typeof entityId === "number" && Number.isInteger(entityId)) ||
        (typeof entityId === "string" && /^\d+$/.test(entityId));
      if (numericEntity) {
        out.entity = { kind: "research", gameId: Number(entityId) };
      } else {
        const id = stripPrefix(entityId);
        if (id) out.entity = { kind: "unit", id };
        else return undefined; // travail sans produit identifiable : ignoré
      }
      return out;
    })
    .filter(Boolean);
  if (works.length > 0) s.works = works;
  const weapons = (fiche.weapons ?? []).map((w) => {
    const out = {};
    if (typeof w.weaponType === "string") out.type = w.weaponType;
    if (typeof w.rechargePeriod === "number") out.recharge = w.rechargePeriod;
    if (typeof w.attacksPerAttack === "number") out.attacks = w.attacksPerAttack;
    const distance = w.distance ?? {};
    if (typeof distance.min === "number") out.min = distance.min;
    if (typeof distance.max === "number") out.max = distance.max;
    const damages = (w.damage?.damages ?? [])
      .filter((d) => typeof d.value === "number" && d.value > 0)
      .map((d) => [d.type, d.value]);
    if (damages.length > 0) {
      out.damage = damages;
      for (const [type] of damages) tagKeys.add(type);
    }
    return Object.keys(out).length > 0 ? out : undefined;
  });
  if (weapons.filter(Boolean).length > 0) s.weapons = weapons.filter(Boolean);
  const researchIds = [...new Set((fiche.applicableResearches ?? [])
    .map((r) => (typeof r?.gameId === "number" ? r.gameId : undefined))
    .filter((v) => v !== undefined))].sort((a, b) => a - b);
  if (researchIds.length > 0) s.researchIds = researchIds;
  return Object.keys(s).length > 0 ? s : undefined;
};

const factionOrder = ["1", "2", "3", "4", "5", "animals", "decor", "helpers", "horde"];
const units = [];
const nationIds = new Set();
const tagKeys = new Set();
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".json")) {
      const id = relative(unitsRoot, full).replace(/\\/g, "/").replace(/\.json$/, "");
      const parts = id.split("/");
      const fiche = JSON.parse(readFileSync(full, "utf8"));
      const names = {};
      for (const lang of NAME_LANGS) {
        const value = unitName(id, lang);
        if (value !== undefined) names[lang] = value;
      }
      for (const tag of fiche.tags ?? []) {
        if (typeof tag?.name === "string") tagKeys.add(tag.name);
      }
      const nationId = fiche.nation?.nationId;
      if (typeof nationId === "number") nationIds.add(nationId);
      const summary = buildSummary(fiche, tagKeys);
      units.push({
        id,
        faction: parts[0],
        group: parts.length > 2 ? parts[parts.length - 2] : "",
        slug: parts[parts.length - 1],
        name: typeof fiche.name === "string" ? fiche.name : "",
        image: typeof fiche.image === "string" ? fiche.image : "",
        ...(Object.keys(names).length > 0 ? { names } : {}),
        ...(typeof nationId === "number" ? { nationId } : {}),
        ...(summary ? { s: summary } : {}),
      });
    }
  }
};
walk(unitsRoot);
const factions = [...new Set(units.map((u) => u.faction))].sort(
  (a, b) => factionOrder.indexOf(a) - factionOrder.indexOf(b),
);

// --- Cartes partagées : nations (âges officiels), ressources, tags -----------
const nations = {};
for (const id of [...nationIds].sort((a, b) => a - b)) {
  const label = locMap(`<*nationName${id}>`) ?? locMap(`<*nationName${id}#0>`);
  if (label) nations[String(id)] = label;
}
const resources = {};
for (let i = 0; ; i += 1) {
  const label = locMap(`<*recourceName#${i}>`);
  if (!label) break; // #5+ absents du fr : jamais affichés par l'UI
  resources[String(i)] = label;
}
const tags = {};
for (const key of [...tagKeys].sort()) {
  if (!key.startsWith("<*")) continue; // enums brutes → dictionnaires du site
  const label = locMap(key);
  if (label) tags[key] = label;
}

// --- Points de contrôle : échec bruyant si la forme du dataset dérive --------
const checkpoint = (id, check) => {
  const unit = units.find((u) => u.id === id);
  if (!unit || !check(unit)) {
    console.error(`[gen-units-index] point de contrôle échoué pour ${id} — dataset inattendu.`);
    process.exit(1);
  }
};
checkpoint("1/depot", (u) =>
  u.nationId === 1 &&
  JSON.stringify(u.s?.sources?.[0]?.cost) === JSON.stringify([[1, 100]]) &&
  u.s?.sources?.[0]?.by === "1/worker" &&
  JSON.stringify(u.s?.build?.init) === JSON.stringify([[1, 20]]) &&
  JSON.stringify(u.s?.build?.full) === JSON.stringify([[1, 100]]),
);
checkpoint("1/temple", (u) => {
  const works = u.s?.works ?? [];
  const gameIds = works.map((w) => w.entity?.gameId);
  const times = works.map((w) => w.t);
  return (
    works.length === 3 &&
    JSON.stringify(gameIds) === JSON.stringify([3, 4, 25]) &&
    JSON.stringify(times) === JSON.stringify([90, 90.1, 60])
  );
});
if (nations["1"]?.fr !== "Age de Pierre") {
  console.error("[gen-units-index] étiquette officielle <*nationName1> inattendue.");
  process.exit(1);
}

const index = {
  datasetId: meta.datasetId ?? "",
  gameVersion: meta.gameVersion ?? "",
  generatedAt: new Date().toISOString(),
  factions,
  nations,
  resources,
  tags,
  units,
};
writeFileSync(outPath, JSON.stringify(index) + "\n");
const named = units.filter((u) => u.names && Object.keys(u.names).length > 0).length;
const withSummary = units.filter((u) => u.s).length;
console.log(
  `[gen-units-index] ${units.length} unités, ${factions.length} factions, ${named} noms localisés, ` +
    `${withSummary} résumés, ${Object.keys(nations).length} nations, ${Object.keys(resources).length} ressources, ` +
    `${Object.keys(tags).length} tags (${meta.datasetId ?? "?"}) -> lib/units-index.json`,
);
