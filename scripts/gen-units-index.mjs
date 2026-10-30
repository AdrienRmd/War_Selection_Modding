#!/usr/bin/env node
// Génère lib/units-index.json depuis le dataset wus-data publié (lecture seule).
// Usage : node scripts/gen-units-index.mjs  (WUS_SERVED_DIR pour surcharger le chemin)
// À relancer quand ws-data republie le dataset (le badge /units et les compteurs
// viennent d'updated-at.json ; cet index ne fournit que la structure de navigation).
//
// Noms localisés : la clé <*unitNameWarSelection/<id>> des fichiers
// content/localization/<lang>.json donne le nom officiel de chaque unité.
// On embarque en/fr/cn (+ tw, repli chinois traditionnel) avec repli sur le
// nom dérivé du chemin si la clé manque dans une langue.
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
const unitName = (id, lang) => {
  const value = localization[lang][`<*unitNameWarSelection/${id}>`];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const factionOrder = ["1", "2", "3", "4", "5", "animals", "decor", "helpers", "horde"];
const units = [];
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
      units.push({
        id,
        faction: parts[0],
        group: parts.length > 2 ? parts[parts.length - 2] : "",
        slug: parts[parts.length - 1],
        name: typeof fiche.name === "string" ? fiche.name : "",
        image: typeof fiche.image === "string" ? fiche.image : "",
        ...(Object.keys(names).length > 0 ? { names } : {}),
      });
    }
  }
};
walk(unitsRoot);
const factions = [...new Set(units.map((u) => u.faction))].sort(
  (a, b) => factionOrder.indexOf(a) - factionOrder.indexOf(b),
);

const index = {
  datasetId: meta.datasetId ?? "",
  gameVersion: meta.gameVersion ?? "",
  generatedAt: new Date().toISOString(),
  factions,
  units,
};
writeFileSync(outPath, JSON.stringify(index) + "\n");
const named = units.filter((u) => u.names && Object.keys(u.names).length > 0).length;
console.log(
  `[gen-units-index] ${units.length} unités, ${factions.length} factions, ${named} noms localisés (${meta.datasetId ?? "?"}) -> lib/units-index.json`,
);
