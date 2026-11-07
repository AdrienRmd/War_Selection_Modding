#!/usr/bin/env bash
# apply-0016.sh — Migration 0016 : replays.source TEXT DEFAULT 'user' + index
# (source, created_at) — socle de la récolte automatique (additive, aucune
# suppression ; patron apply-0015 corrigé : backup du STATE_DIR réel, détection
# d'état par pragma, idempotence, DRY_RUN).
#
# Étapes (arrêt sur premier échec) :
#   1. Backup FRAIS du STATE_DIR ciblé AVANT toute écriture.
#   2. Détection d'état : la colonne `source` existe-t-elle déjà ?
#      (jamais de requête filtrant sur une colonne non posée — incident 0015).
#   3. Application de drizzle/0016_replays_source.sql (SAUTÉE si déjà migrée).
#   4. Vérifications : colonne présente, index présent, et TOUTES les lignes
#      existantes portent source='user' (défaut — aucune ligne auto avant
#      activation du crawler).
#
# Usage : cd ~/war_selecion && bash deploy/vps/apply-0016.sh
#         DRY_RUN=1 bash deploy/vps/apply-0016.sh
#         STATE_DIR=/chemin/vers/state bash deploy/vps/apply-0016.sh (réplique)
set -euo pipefail
cd "$(dirname "$0")/../.."

STATE_DIR="${STATE_DIR:-.wrangler/state}"
BACKUP_DIR="$HOME/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$BACKUP_DIR/pre-0016-$STAMP.tar.gz"
LOG="$BACKUP_DIR/apply-0016-$STAMP.log"
DRY_RUN="${DRY_RUN:-0}"
SQL_FILE="drizzle/0016_replays_source.sql"

W=(node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to "$STATE_DIR")

mkdir -p "$BACKUP_DIR"

query() {
  local sql="$1"
  "${W[@]}" --command "$sql" --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(JSON.stringify(j[0].results));})'
}

echo "[0016] D1 locale de production : $STATE_DIR"
[ -d "$STATE_DIR" ] || { echo "[0016] ERREUR : $STATE_DIR introuvable" >&2; exit 1; }
[ -f "$SQL_FILE" ] || { echo "[0016] ERREUR : $SQL_FILE introuvable" >&2; exit 1; }
echo "[0016] 1/4 backup frais → $BACKUP"
STATE_ROOT="$(dirname "$STATE_DIR")"
STATE_LEAF="$(basename "$STATE_DIR")"
if [ ! -d "$STATE_ROOT/$STATE_LEAF" ]; then
  echo "[0016] ERREUR : dossier d'état $STATE_DIR introuvable" | tee -a "$LOG" >&2
  exit 1
fi
tar czf "$BACKUP" -C "$STATE_ROOT" "$STATE_LEAF"
echo "[0016]    $(du -h "$BACKUP" | cut -f1) — base ($STATE_DIR) sauvegardée AVANT toute écriture"
{
  echo "apply-0016 $STAMP — replays.source (additif)"
  echo "backup: $BACKUP"
} > "$LOG"

echo "[0016] 2/4 détection d'état (colonne source)"
HAS_SOURCE=$(query "SELECT COUNT(*) AS n FROM pragma_table_info('replays') WHERE name = 'source'")
if [ "$(node -e "console.log(JSON.parse(process.argv[1])[0]?.n ?? 0)" "$HAS_SOURCE" 2>/dev/null || echo 0)" != "0" ]; then
  MIGRATED=1
else
  MIGRATED=0
fi
echo "[0016]    base $([ "$MIGRATED" = "1" ] && echo 'déjà 0016' || echo 'pré-0016')" | tee -a "$LOG"

if [ "$DRY_RUN" = "1" ]; then
  echo "[0016] DRY_RUN : arrêt avant application de la migration." | tee -a "$LOG"
  exit 0
fi

echo "[0016] 3/4 application de $SQL_FILE"
if [ "$MIGRATED" = "1" ]; then
  echo "[0016]    base déjà 0016 — application SAUTÉE (idempotence)" | tee -a "$LOG"
else
  "${W[@]}" --file "$SQL_FILE" | tee -a "$LOG"
fi

echo "[0016] 4/4 vérifications"
COLS=$(query "SELECT name FROM pragma_table_info('replays')")
echo "[0016]    colonnes replays : $COLS" | tee -a "$LOG"
echo "$COLS" | grep -q '"source"' || { echo "[0016] ERREUR : colonne source absente" | tee -a "$LOG"; exit 1; }
INDEXES=$(query "SELECT name FROM sqlite_master WHERE type='index' AND name = 'idx_replays_source_created'")
echo "[0016]    index : $INDEXES" | tee -a "$LOG"
echo "$INDEXES" | grep -q "idx_replays_source_created" || { echo "[0016] ERREUR : index absent" | tee -a "$LOG"; exit 1; }
SRCS=$(query "SELECT source, COUNT(*) AS n FROM replays GROUP BY source")
echo "[0016]    sources : $SRCS" | tee -a "$LOG"
node -e '
  const rows = JSON.parse(process.argv[1]);
  const bad = rows.filter((r) => r.source !== "user");
  if (bad.length) { console.error("sources inattendues avant activation du crawler : " + JSON.stringify(bad)); process.exit(1); }
  console.log("toutes les lignes existantes sont source=user ✓");
' "$SRCS" || { echo "[0016] ERREUR : des lignes non-user existent déjà (inattendu avant activation)" | tee -a "$LOG"; exit 1; }

echo "[0016] OK — migration additive appliquée (source='user' par défaut, aucune ligne auto)."
