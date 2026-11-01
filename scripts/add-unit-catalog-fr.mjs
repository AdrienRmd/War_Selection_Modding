// HOTFIX i18n 01/11/2026 — ajoute `nameFr` aux 453 unités de
// public/unit-catalog.json (+ .gz), le catalogue de l'atelier mods complet
// (/workbench, components/mod-workbench.tsx). La locale FR affichait les noms
// EN parce que ce catalogue n'a jamais porté les noms FR — contrairement à
// simple-catalog.json (mode simple, 423 fiches nameFr complet) et à
// lib/units-index.json (noms officiels par locale, source de ce merge).
//
// Correspondance : nom zh du catalogue (« 祭坛 ») ↔ names.cn (repli names.tw)
// de l'index — vérifiée 453/453 le 01/11/2026. Repli final nameEn (jamais de
// vide). Idempotent : ré-exécuter ne change rien une fois les champs posés ;
// une future régénération du catalogue (expand-workbench.mjs, qui lit
// maintenant fr.loc) re-produit les mêmes valeurs.
//
// Usage : node scripts/add-unit-catalog-fr.mjs   (depuis la racine du repo)
import fs from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "public/unit-catalog.json");
const catalogGzPath = path.join(root, "public/unit-catalog.json.gz");
const indexPath = path.join(root, "lib/units-index.json");

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));

const byCn = new Map();
for (const u of index.units ?? []) {
  const names = u.names ?? {};
  const cn = names.cn || names.tw;
  if (cn && !byCn.has(cn)) byCn.set(cn, names);
}

let added = 0;
let same = 0;
let fallbackEn = 0;
let missing = 0;
for (const unit of catalog.units ?? []) {
  const names = byCn.get(unit.name);
  const fr = names?.fr || unit.nameEn;
  if (!fr) {
    missing += 1;
    continue;
  }
  if (unit.nameFr === fr) {
    same += 1;
    continue;
  }
  unit.nameFr = fr;
  if (!names?.fr) fallbackEn += 1;
  added += 1;
}

catalog.provenance = {
  ...catalog.provenance,
  nameFrSource: "lib/units-index.json names.fr (merge scripts/add-unit-catalog-fr.mjs)",
  nameFrMergedAt: new Date().toISOString(),
};

fs.writeFileSync(catalogPath, JSON.stringify(catalog));
fs.writeFileSync(catalogGzPath, gzipSync(JSON.stringify(catalog), { level: 9 }));

console.log(
  `[add-unit-catalog-fr] ${catalog.units?.length ?? 0} unités — ${added} nameFr ajoutés, ` +
    `${same} déjà identiques, ${fallbackEn} replis EN, ${missing} sans source.`,
);
if (missing > 0) process.exit(1);
