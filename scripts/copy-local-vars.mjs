import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Régénération post-build de dist/server/.dev.vars (ADMIN_EMAILS…).
// `vinext build` recrée dist/server et ne copie PAS le .dev.vars gitigné de
// la racine : sans cette étape, chaque déploiement (update-vps.sh → build →
// restart) faisait disparaître la liaison ADMIN_EMAILS du worker — constaté
// le 30/10 22:52 (bannière wrangler sans « env.ADMIN_EMAILS », console de
// modération /admin inaccessible). Le fichier racine reste la source de
// vérité locale (valeur gérée hors git, cf. deploy/vps).
const root = fileURLToPath(new URL("../", import.meta.url));
const source = path.join(root, ".dev.vars");
const target = path.join(root, "dist/server/.dev.vars");

if (!existsSync(source)) {
  // Machine de dev sans .dev.vars : rien à copier (les vars de dev passent
  // par ailleurs). Ne jamais échouer le build pour une valeur locale.
  console.log("[copy-local-vars] pas de .dev.vars à la racine — ignoré");
} else {
  try {
    copyFileSync(source, target);
    console.log("[copy-local-vars] .dev.vars → dist/server/.dev.vars");
  } catch (e) {
    console.error("[copy-local-vars] échec de copie :", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  }
}
