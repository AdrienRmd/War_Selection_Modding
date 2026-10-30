#!/usr/bin/env node
// Génère lib/units-index.json depuis le dataset wus-data publié (lecture seule).
// Usage : node scripts/gen-units-index.mjs  (WUS_SERVED_DIR pour surcharger le chemin)
// À relancer quand ws-data republie le dataset (le badge /units et les compteurs
// viennent d'updated-at.json ; cet index ne fournit que la structure de navigation).
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const servedDir = process.env.WUS_SERVED_DIR ?? "/home/ubuntu/War-Selection/datasets/served";
const unitsRoot = join(servedDir, "content/units/WarSelection");
const updatedAtPath = join(servedDir, "updated-at.json");
const outPath = new URL("../lib/units-index.json", import.meta.url);

if (!existsSync(unitsRoot)) {
  console.error(`[gen-units-index] ${unitsRoot} introuvable — définis WUS_SERVED_DIR.`);
  process.exit(1);
}
const meta = JSON.parse(readFileSync(updatedAtPath, "utf8"));

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
      units.push({
        id,
        faction: parts[0],
        group: parts.length > 2 ? parts[parts.length - 2] : "",
        slug: parts[parts.length - 1],
        name: typeof fiche.name === "string" ? fiche.name : "",
        image: typeof fiche.image === "string" ? fiche.image : "",
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
console.log(
  `[gen-units-index] ${units.length} unités, ${factions.length} factions (${meta.datasetId ?? "?"}) -> lib/units-index.json`,
);
