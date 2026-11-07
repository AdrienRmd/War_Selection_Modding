#!/usr/bin/env bash
# replay-nightly.sh — récolte automatique des replays (socle SITE, 07/11).
# Orchestrateur du crawler (le vrai travail est dans scripts/replay-nightly.mjs,
# lancé via tsx pour parser avec lib/replay du repo — prouvé hors navigateur
# par tests/replay-parser.test.ts sous vitest).
#
# CONTRAT ws-data (cron 02:30 UTC, APRÈS wus-nightly 02:00) :
#   bash ~/war_selecion/scripts/replay-nightly.sh [--dry-run] [--resume]
#        [--backfill N] [--max-fetch N]
#
#   - flock idempotent (un seul run à la fois) ;
#   - --dry-run     : aucune écriture réseau (ni ingest, ni état) ;
#   - --resume      : accepté pour la reprise après salve 429 (les codes non
#                     traités ne sont jamais marqués vus — le run suivant les
#                     reprend naturellement ; le drapeau est surtout un
#                     marqueur de log/rapport) ;
#   - --backfill N  : plafond de codes traités par exécution (défaut 300) ;
#   - --max-fetch N : plafond de requêtes games-api par exécution (défaut = backfill) ;
#   - environnement : INGEST_SECRET (header X-Ingest-Secret du crawler) —
#                     JAMAIS de valeur en dur ici ;
#   - sorties : log horodaté (~/War-Selection/logs/replay-nightly.log) et
#     rapport JSON par run dans ~/War-Selection/logs/reports/replay-nightly/
#     (durée, fetchs, 201/409/erreurs, ETag) ;
#   - état local : ~/War-Selection/datasets/replays/auto-ingest/state.json
#     (codes vus + ETag de l'index — documenté, sauvegarde atomique) ;
#   - POLITENESSE : UA identifiable, délai ≥ 1 s entre requêtes games-api,
#     disjoncteur 429 (pauses 5→15→30 min, max 3 puis échec propre — patron
#     wus-lib), backfill du plus récent au plus ancien, JAMAIS de
#     contournement de défi humain ; index = 1 requête/jour avec ETag.
#
# Ne touche AUCUN cron (installation = ws-data, protocole cron-edit).
set -uo pipefail

ROOT_REPO="${REPLAY_NIGHTLY_REPO:-/home/ubuntu/war_selecion}"
ROOT_DATA="${REPLAY_NIGHTLY_DATA:-/home/ubuntu/War-Selection}"
LOGS="$ROOT_DATA/logs"
STATE_DIR="$ROOT_DATA/datasets/replays/auto-ingest"
REPORTS="$LOGS/reports/replay-nightly"
NODE="${NODE_BIN:-node}"

mkdir -p "$LOGS" "$REPORTS" "$STATE_DIR"

# flock : un seul crawl à la fois (patron wus-nightly).
exec 9>"$LOGS/.replay-nightly.lock"
if ! flock -n 9; then
  echo "[$(date -u -Is)] replay-nightly déjà en cours — abandon (flock)" >>"$LOGS/replay-nightly.log"
  exit 0
fi

RUNID="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT="$REPORTS/run-$RUNID.json"
say() { echo "[$RUNID] $*" | tee -a "$LOGS/replay-nightly.log"; }

say "début — repo=$ROOT_REPO data=$ROOT_DATA args=$*"

# Le parseur TS du repo exige tsx (dépendance locale du repo).
cd "$ROOT_REPO" || { say "ERREUR repo introuvable"; exit 1; }
if [ ! -x "$ROOT_REPO/node_modules/.bin/tsx" ]; then
  say "ERREUR tsx absent (npm install requis dans $ROOT_REPO)"
  exit 1
fi

# Garde disque (documentée aussi dans le .mjs — double étage) :
# > 90 % sur le FS de l'état → avertissement; le .mjs saute le backfill.
DF_PCT=$(df -P "$STATE_DIR" | awk 'NR==2 {gsub("%","",$5); print $5}')
if [ -n "${DF_PCT:-}" ] && [ "$DF_PCT" -gt 90 ]; then
  say "AVERTISSEMENT disque ${DF_PCT}% > 90% — le crawl sautera le backfill"
fi

# tsx : node --import tsx (résout les imports .ts de lib/replay).
if REPLAY_NIGHTLY_REPORT_FILE="$REPORT" INGEST_SECRET="${INGEST_SECRET:-}" \
   "$NODE" --import tsx scripts/replay-nightly.mjs "$@" \
   --report-file "$REPORT" >>"$LOGS/replay-nightly.log" 2>&1; then
  say "fin OK — rapport $REPORT"
  exit 0
else
  RC=$?
  say "fin en ÉCHEC (exit $RC) — rapport $REPORT (les codes non traités seront repris au prochain run)"
  exit "$RC"
fi
