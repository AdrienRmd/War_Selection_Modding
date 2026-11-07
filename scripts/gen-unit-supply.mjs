// Génération de lib/replay/unit-supply.json — coût de population (supply
// « consume ») par unité, extrait du dataset public servi
// (content/units/WarSelection/**.json, même exporteur que wsunitstats).
//
// Usage : node scripts/gen-unit-supply.mjs [racine-du-contenu-servi]
//   (défaut : /home/ubuntu/War-Selection/datasets/served/content — l'espace
//    pilote ws-data ; toute autre racine avec content/units/… fonctionne).
//
// Le fichier généré est COMMITTÉ (le site n'a pas accès au pipeline ws-data
// au build) : relancer ce script après chaque mise à jour du dataset.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] ?? "/home/ubuntu/War-Selection/datasets/served/content";
const unitsRoot = join(root, "units", "WarSelection");
const out = new URL("../lib/replay/unit-supply.json", import.meta.url);

const table = {};
let scanned = 0;
let withConsume = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    if (!name.endsWith(".json")) continue;
    scanned += 1;
    let unit;
    try {
      unit = JSON.parse(readFileSync(p, "utf8"));
    } catch {
      continue;
    }
    const consume = unit?.supply?.consume;
    if (typeof consume === "number" && consume > 0 && typeof unit.gameId === "string") {
      table[unit.gameId] = consume;
      withConsume += 1;
    }
  }
}

walk(unitsRoot);
const entries = Object.keys(table).sort();
const sorted = Object.fromEntries(entries.map((k) => [k, table[k]]));
writeFileSync(
  out,
  JSON.stringify(
    {
      _source:
        "généré par scripts/gen-unit-supply.mjs depuis content/units/WarSelection (dataset public wsunitstats) — supply.consume par gameId",
      _generatedAt: new Date().toISOString().slice(0, 10),
      units: sorted,
    },
    null,
    0,
  ) + "\n",
);
console.log(`unit-supply: ${withConsume}/${scanned} unités avec supply.consume → lib/replay/unit-supply.json`);
