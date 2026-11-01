import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// HOTFIX 31/10/2026 — /version.json, mini-endpoint de version servi comme
// asset statique (voir lib/version-check.ts et components/update-banner.tsx).
//
// `vinext build` tire un buildId (uuid) par build : dist/server/BUILD_ID.
// On l'expose avec le commit git courant dans dist/client/version.json pour
// que les onglets ouverts détectent qu'un nouveau build est servi (le buildId
// du premier relevé diffère du buildId frais → bandeau « nouvelle version
// disponible »).
//
// Bonus observabilité : /version.json rend aussi les diagnostics « quelle
// version est servie ? » triviaux (curl https://ws.aremond.ovh/version.json).
//
// En-têtes : /version.json ne doit PAS être mis en cache (contrairement aux
// chunks /_next/static/* immuables) — la règle est ajoutée à
// dist/client/_headers si absente (idempotent).

const root = fileURLToPath(new URL("../", import.meta.url));
const buildIdFile = path.join(root, "dist/server/BUILD_ID");
const versionFile = path.join(root, "dist/client/version.json");
const headersFile = path.join(root, "dist/client/_headers");

if (!existsSync(buildIdFile)) {
  console.error("[write-version] dist/server/BUILD_ID introuvable — build incomplet ?");
  process.exit(1);
}
const buildId = readFileSync(buildIdFile, "utf8").trim();
if (!/^[A-Za-z0-9._-]+$/.test(buildId)) {
  console.error(`[write-version] BUILD_ID invalide : ${JSON.stringify(buildId)}`);
  process.exit(1);
}

let commit = "unknown";
try {
  commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
} catch {
  // Déploiement hors dépôt git : on garde "unknown" plutôt que d'échouer.
}

const payload = { buildId, commit, builtAt: new Date().toISOString() };
writeFileSync(versionFile, `${JSON.stringify(payload, null, 2)}\n`);

if (existsSync(headersFile)) {
  const headers = readFileSync(headersFile, "utf8");
  if (!/^\/version\.json$/m.test(headers)) {
    writeFileSync(
      headersFile,
      `${headers.replace(/\n*$/, "\n")}/version.json\n  Cache-Control: no-cache\n`,
    );
  }
} else {
  writeFileSync(headersFile, "/version.json\n  Cache-Control: no-cache\n");
}

console.log(`[write-version] /version.json → buildId=${buildId} commit=${commit}`);
