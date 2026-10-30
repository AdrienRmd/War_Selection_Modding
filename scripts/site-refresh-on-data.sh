#!/usr/bin/env bash
# site-refresh-on-data.sh — resynchronise le site WS ATLAS avec le dataset publié.
#
# RÔLE        : régénérer TOUS les index du site depuis le dataset ws-data publié
#               puis, si et seulement si les tests sont VERTS et qu'un changement
#               réel existe, committer / pousser / redéployer la production.
#
# USAGE       : scripts/site-refresh-on-data.sh [--force]
#                 --force : régénérer même si le datasetId publié est déjà celui
#                 des index committés (utile après évolution des générateurs).
#                 Un commit n'a lieu que si le contenu régénéré diffère
#                 réellement (horodatages internes `generatedAt` ignorés).
#
# APPELANT    : nightly ws-data (wus-nightly.sh), UNIQUEMENT quand le dataset
#               publié CHANGE (après wus-publish.mjs). Le stdout de ce script est
#               journalisé par le nightly. Peut aussi être lancé à la main pour
#               un rattrapage. Idempotent : dataset inchangé => no-op, exit 0.
#
# CHAÎNE      : 1. gen-units-index.mjs            (dataset seul)
#               2. gen-researches-index.mjs       (dépend de lib/units-index.json)
#               3. gen-modding-index.mjs          (dataset seul)
#               4. gen-simple-catalog.mjs         (dépend des index 1 et 2)
#               5. npm run test (garde-fous : comptages, cohérence badge↔index,
#                  budget perf tests/perf-budget.test.ts)
#               6. si diff réel : commit (auteur dédié) -> push SSH (jamais
#                  --force) origin vps:experiments
#               7. ssh VPS : git pull --ff-only && ./deploy/vps/update-vps.sh
#                  (build -> restart systemd ws-atlas -> health 127.0.0.1:8787)
#               8. health check public https://ws.aremond.ovh (200 attendu)
#
# FAIL-CLOSED : toute anomalie (dataset illisible, incohérence served/published,
#               arbre git sale, tests rouges, diff vide, push ou déploiement en
#               échec) => exit != 0, AUCUN déploiement, message d'erreur clair,
#               arbre git laissé propre (fichiers régénérés restaurés, commit
#               local annulé si le push a échoué). Seule exception documentée :
#               un échec APRÈS un push réussi (ex. health check VPS) laisse le
#               commit sur origin/experiments — intervention manuelle indiquée,
#               on ne réécrit jamais l'historique poussé.
set -euo pipefail

# Cron n'a pas toujours /usr/local/bin ou ~/​.local/bin dans PATH (node/npm y vivent).
export PATH="/usr/local/bin:/usr/bin:/home/ubuntu/.local/bin:${PATH:-}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DATASETS_DIR="${WUS_DATASETS_DIR:-/home/ubuntu/War-Selection/datasets}"
PUBLISHED_META="$DATASETS_DIR/updated-at.json"
SERVED_DIR="${WUS_SERVED_DIR:-$DATASETS_DIR/served}"
# URL SSH établie (clé de l'utilisateur courant) ; origin HTTPS ne permet pas
# d'authentification non interactive. JAMAIS de --force : le VPS suit
# origin/experiments en --ff-only.
PUSH_URL="${WUS_PUSH_URL:-git@github.com:AustinLiu5567/ws-lab.git}"
VPS_HOST="${WUS_VPS_HOST:-ubuntu@51.254.129.80}"
PUBLIC_URL="https://ws.aremond.ovh"

ARTIFACTS=(
  lib/units-index.json
  lib/researches-index.json
  lib/modding-home.json
  lib/modding-meta.json
  public/modding-paths.json
  public/simple-catalog.json
  public/simple-catalog.json.gz
)

log()  { echo "[site-refresh] $*"; }
fail() { echo "[site-refresh] ERREUR : $*" >&2; exit 1; }

# Restaure l'état git d'avant-run (no-op si tout est déjà committé/propre).
restore_tree() { git checkout -q -- "${ARTIFACTS[@]}" 2>/dev/null || true; }
trap 'log "échec inattendu ligne $LINENO — arbre git restauré"; restore_tree' ERR

FORCE=0
if [ $# -gt 0 ]; then
  if [ "$1" = "--force" ]; then FORCE=1; else fail "argument inconnu : $1 (usage : scripts/site-refresh-on-data.sh [--force])"; fi
fi

# --- 0. Préconditions (fail-closed) -----------------------------------------
for bin in git node npm curl ssh; do
  command -v "$bin" >/dev/null 2>&1 || fail "binaire requis absent : $bin"
done
[ -f "$PUBLISHED_META" ] || fail "$PUBLISHED_META introuvable (dataset publié absent ?)"

DATASET_ID="$(node -e 'const m=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); if(!m.datasetId) process.exit(1); console.log(m.datasetId)' "$PUBLISHED_META" 2>/dev/null)" \
  || fail "datasetId illisible dans $PUBLISHED_META"
[ -n "$DATASET_ID" ] || fail "datasetId vide dans $PUBLISHED_META"

# Le dataset servi aux générateurs doit être exactement le publié — sinon le
# badge (updated-at.json) et les fiches (index régénérés depuis served/)
# raconteraient deux datasets différents.
SERVED_ID="$(node -e 'const m=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); console.log(m.datasetId||"")' "$SERVED_DIR/updated-at.json" 2>/dev/null || echo "")"
[ "$SERVED_ID" = "$DATASET_ID" ] \
  || fail "datasets/served ($SERVED_ID) != datasets/updated-at.json ($DATASET_ID) — publish incomplet ?"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$CURRENT_BRANCH" = "vps" ] || fail "branche courante '$CURRENT_BRANCH' != vps"

[ -z "$(git status --porcelain)" ] || fail "arbre git sale — committer/annuler avant de relancer"

# Le déploiement doit partir de l'état exact de la production (origin/experiments).
git fetch -q origin experiments || fail "git fetch origin/experiments impossible"
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/experiments)" ] \
  || fail "HEAD local != origin/experiments — synchroniser d'abord (git pull)"

# --- 1. No-op si le dataset publié n'a pas changé ----------------------------
if [ "$FORCE" -eq 0 ]; then
  COMMITTED_ID="$(node -e 'console.log(JSON.parse(require("fs").readFileSync("lib/modding-meta.json","utf8")).datasetId||"")' 2>/dev/null || echo "")"
  if [ "$COMMITTED_ID" = "$DATASET_ID" ]; then
    log "dataset publié inchangé ($DATASET_ID = index déjà déployés) — rien à faire."
    exit 0
  fi
  log "changement de dataset détecté : $COMMITTED_ID -> $DATASET_ID"
fi

PREV_HEAD="$(git rev-parse HEAD)"

# --- 2. Régénération de tous les index (ordre des dépendances) ---------------
log "régénération des index pour $DATASET_ID ..."
node scripts/gen-units-index.mjs
node scripts/gen-researches-index.mjs
node scripts/gen-modding-index.mjs
node scripts/gen-simple-catalog.mjs

# Chaque artefact régénéré doit porter le datasetId publié.
for artifact in lib/units-index.json lib/researches-index.json lib/modding-meta.json public/modding-paths.json; do
  ARTIFACT_ID="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).datasetId||"")' "$artifact" 2>/dev/null || echo "")"
  [ "$ARTIFACT_ID" = "$DATASET_ID" ] \
    || { restore_tree; fail "$artifact porte datasetId '$ARTIFACT_ID' != '$DATASET_ID' (générateur mal aligné sur le dataset servi ?)"; }
done

# --- 3. Tests (garde-fous) : rouges => rien n'est committé ni déployé --------
log "suite de tests (garde-fous comptages/cohérence/budget perf) ..."
if ! npm run test; then
  restore_tree
  fail "tests ÉCHOUS après régénération pour $DATASET_ID — index NON committés, site NON déployé, arbre restauré."
fi

# --- 4. Changement réel ? (hors horodatages internes generatedAt) -----------
# Compare HEAD vs arbre de travail sur les artefacts : si seule la valeur
# volatile generatedAt bouge, ce n'est pas un changement réel -> no-op.
REAL_CHANGE="$(node - <<'NODE'
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const zlib = require("node:zlib");
const artifacts = [
  "lib/units-index.json", "lib/researches-index.json", "lib/modding-home.json",
  "lib/modding-meta.json", "public/modding-paths.json",
  "public/simple-catalog.json", "public/simple-catalog.json.gz",
];
// Décompresse les .gz, compare le JSON hors champ volatile generatedAt.
const readContent = (buffer, path) =>
  path.endsWith(".gz") ? zlib.gunzipSync(buffer).toString("utf8") : buffer.toString("utf8");
const stripVolatile = (value) => {
  if (value && typeof value === "object" && !Array.isArray(value) && "generatedAt" in value) {
    const { generatedAt, ...rest } = value;
    return rest;
  }
  return value;
};
for (const path of artifacts) {
  let oldBuffer;
  try {
    oldBuffer = execFileSync("git", ["show", `HEAD:${path}`], { maxBuffer: 32 * 1024 * 1024 });
  } catch {
    console.log("change"); // artefact inconnu de HEAD : changement réel
    process.exit(0);
  }
  const oldJson = stripVolatile(JSON.parse(readContent(oldBuffer, path)));
  const newJson = stripVolatile(JSON.parse(readContent(fs.readFileSync(path), path)));
  if (JSON.stringify(oldJson) !== JSON.stringify(newJson)) {
    console.log("change");
    process.exit(0);
  }
}
console.log("same");
NODE
)"
if [ "$REAL_CHANGE" != "change" ]; then
  restore_tree
  log "aucun changement réel après régénération (generatedAt excepté) — rien à committer, rien à déployer."
  exit 0
fi

# --- 5. Commit (auteur dédié) + push SSH (jamais --force) -------------------
git add -- "${ARTIFACTS[@]}"
if ! git -c user.name="WS ATLAS Nightly" -c user.email="ws-atlas@vps.local" \
  commit --author="WS ATLAS Nightly <ws-atlas@vps.local>" \
  -m "data: refresh indexes to $DATASET_ID"; then
  restore_tree
  fail "commit impossible — vérifier l'état git."
fi
if ! git push "$PUSH_URL" vps:experiments; then
  git reset -q --hard "$PREV_HEAD"
  fail "push vers origin/experiments échoué — commit local ANNULÉ (reset $PREV_HEAD), site non déployé."
fi

# --- 6. Déploiement VPS (chaîne AGENTS.md) -----------------------------------
log "déploiement VPS (pull --ff-only + update-vps.sh) ..."
if ! ssh -o BatchMode=yes "$VPS_HOST" 'cd ~/war_selecion && git pull --ff-only && ./deploy/vps/update-vps.sh'; then
  fail "déploiement VPS échoué — le commit $DATASET_ID est DÉJÀ sur origin/experiments : intervention manuelle requise (relancer ./deploy/vps/update-vps.sh sur le VPS), aucun retour arrière automatique."
fi

# --- 7. Health check public ----------------------------------------------------
CODE="$(curl -fsS -o /dev/null -w '%{http_code}' "$PUBLIC_URL/" || echo 000)"
[ "$CODE" = "200" ] || fail "health check $PUBLIC_URL -> HTTP $CODE (le commit est déjà poussé et déployé — vérifier le service ws-atlas sur le VPS)."

log "OK — index $DATASET_ID committés, poussés et déployés ; $PUBLIC_URL répond 200."
