#!/usr/bin/env node
// Génère l'index des chemins de l'arbre modding depuis le dataset wus-data
// publié (lecture seule). Usage : node scripts/gen-modding-index.mjs
// (WUS_SERVED_DIR pour surcharger le chemin du dataset servi).
//
// Sources (dataset ds-20261030T123856, 9041 fichiers d'arbre) :
//  - content/docs/tree/*.json : chaque fichier = un nœud « as » (lazy). Le
//    chemin SANS extension est le chemin du nœud (ex. gameplay.root.unitType.5).
//    Ce sont ces ~9040 chemins — PAS les ~1M de valeurs — que l'index embarque,
//    pour que la recherche « par chemin » reste légère (<300 Ko gzip visé).
//  - content/docs/tree/home.json : la racine inline. Ses feuilles directes
//    sous gameplay.root / visual.root (ex. defaultFormationInterval) ne sont
//    des fichiers ni donc des chemins lazy : on les ajoute à l'index pour
//    qu'elles restent cherchables (résolution via home inline, sans fetch).
//
// Sorties :
//  - public/modding-paths.json : index complet (paths + tailles des gros
//    nœuds) servi comme ressource statique, chargé par le client À LA DEMANDE
//    (première interaction avec la recherche) — jamais dans le bundle.
//  - lib/modding-home.json : copie de home.json (2 Ko) pour le rendu SSR des
//    deux premiers niveaux sans requête réseau (hairpin worker→Apache bloqué).
//  - lib/modding-meta.json : méta compacte (datasetId, compteurs) pour la page
//    serveur et les tests.
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const servedDir = process.env.WUS_SERVED_DIR ?? "/home/ubuntu/War-Selection/datasets/served";
const treeDir = join(servedDir, "content/docs/tree");
const updatedAtPath = join(servedDir, "updated-at.json");
if (!existsSync(join(treeDir, "home.json")) || !existsSync(updatedAtPath)) {
  console.error(`[gen-modding-index] ${treeDir} introuvable — définis WUS_SERVED_DIR.`);
  process.exit(1);
}
const meta = JSON.parse(readFileSync(updatedAtPath, "utf8"));
const home = JSON.parse(readFileSync(join(treeDir, "home.json"), "utf8"));

// --- Chemins lazy : un par fichier d'arbre (home.json exclu) ---------------
const files = readdirSync(treeDir)
  .filter((name) => name.endsWith(".json"))
  .map((name) => name.slice(0, -".json".length));
const lazyPaths = files.filter((path) => path !== "home").sort();

// --- Feuilles racine : enfants-feuilles directs de <folder>.root -----------
const rootLeaves = [];
for (const folder of home.ch ?? []) {
  if (folder.tp !== "folder") continue;
  const root = (folder.ch ?? []).find((node) => node.tp === "root");
  for (const child of root?.ch ?? []) {
    if (child.as === true) continue; // déjà couvert par son fichier
    if (Array.isArray(child.ch) && child.ch.length > 0) continue; // pas une feuille
    rootLeaves.push(`${folder.k}.root.${child.k}`);
  }
}
const paths = [...new Set([...lazyPaths, ...rootLeaves])].sort();

// --- Gros nœuds : taille réelle sur disque pour avertir l'utilisateur -------
const LARGE_THRESHOLD = 256 * 1024;
const large = {};
for (const path of lazyPaths) {
  const size = statSync(join(treeDir, `${path}.json`)).size;
  if (size > LARGE_THRESHOLD) large[path] = size;
}

const index = {
  schema: 1,
  datasetId: meta.datasetId ?? "",
  gameVersion: meta.gameVersion ?? "",
  generatedAt: new Date().toISOString(),
  pathCount: paths.length,
  largeCount: Object.keys(large).length,
  paths,
  large,
};
const indexPath = new URL("../public/modding-paths.json", import.meta.url);
const indexPathRaw = JSON.stringify(index) + "\n";
writeFileSync(indexPath, indexPathRaw);

const homeOut = new URL("../lib/modding-home.json", import.meta.url);
writeFileSync(homeOut, JSON.stringify(home) + "\n");

const metaOut = {
  schema: 1,
  datasetId: index.datasetId,
  gameVersion: index.gameVersion,
  generatedAt: index.generatedAt,
  pathCount: index.pathCount,
  largeCount: index.largeCount,
};
writeFileSync(new URL("../lib/modding-meta.json", import.meta.url), JSON.stringify(metaOut) + "\n");

const gz = gzipSync(Buffer.from(indexPathRaw, "utf8"), { level: 9 }).length;
console.log(
  `[gen-modding-index] ${paths.length} chemins (${lazyPaths.length} lazy + ${rootLeaves.length} feuilles racine), ` +
    `${index.largeCount} gros nœuds >${LARGE_THRESHOLD >> 10} Ko — ${meta.datasetId ?? "?"}\n` +
    `[gen-modding-index] public/modding-paths.json : ${(Buffer.byteLength(indexPathRaw) / 1024).toFixed(0)} Ko brut, ${(gz / 1024).toFixed(1)} Ko gzip`,
);
