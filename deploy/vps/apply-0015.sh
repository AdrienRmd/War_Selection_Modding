#!/usr/bin/env bash
# apply-0015.sh — Migration 0015 : profils « Créateurs de contenu ».
# ADDITIVE uniquement (règle du repo) :
#   - ALTER TABLE creators : user_id, bio, status (défaut 'published' → les
#     lignes bannière existantes restent publiées telles quelles), moderated_at,
#     note, updated_at + 2 index ;
#   - CREATE TABLE creator_links (réseaux, plateforme whitelistée côté app) ;
#   - CREATE TABLE creator_items (association manuelle maps/mods, unique par
#     créateur+type+item).
#
# Étapes (arrêt sur premier échec) :
#   1. Backup FRAIS de .wrangler/state (base D1 locale de production) AVANT tout.
#   2. Application de drizzle/0015_creator_profiles.sql (SQL paramétré par
#      wrangler d1 execute --local ; aucune valeur littérale n'est interpolée).
#   2bis. Détection des collisions de nom (COLLATE NOCASE, hors retirés) :
#      l'index UNIQUE idx_creators_name_nocase refuse de se créer sur des
#      doublons historiques — échec PROPRE avec la liste à arbitrer (aucun
#      renommage automatique : la bannière est curée par des humains).
#   3. Vérifications : colonnes présentes (PRAGMA table_info), tables
#      creator_links/creator_items présentes, index présents, et CHAQUE
#      créateur existant a bien status='published' (rétro-compatibilité
#      bannière d'accueil — tous les statuts listés, aucun autre attendu).
#
# Usage : cd ~/war_selecion && bash deploy/vps/apply-0015.sh
#         DRY_RUN=1 bash deploy/vps/apply-0015.sh  (vérifications seules)
set -euo pipefail
cd "$(dirname "$0")/../.."

STATE_DIR="${STATE_DIR:-.wrangler/state}"
BACKUP_DIR="$HOME/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$BACKUP_DIR/pre-0015-$STAMP.tar.gz"
LOG="$BACKUP_DIR/apply-0015-$STAMP.log"
DRY_RUN="${DRY_RUN:-0}"
SQL_FILE="drizzle/0015_creator_profiles.sql"

W=(node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to "$STATE_DIR")

mkdir -p "$BACKUP_DIR"

query() {
  local sql="$1"
  "${W[@]}" --command "$sql" --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(JSON.stringify(j[0].results));})'
}

echo "[0015] D1 locale de production : $STATE_DIR"
[ -d "$STATE_DIR" ] || { echo "[0015] ERREUR : $STATE_DIR introuvable" >&2; exit 1; }
[ -f "$SQL_FILE" ] || { echo "[0015] ERREUR : $SQL_FILE introuvable" >&2; exit 1; }

echo "[0015] 1/3 backup frais → $BACKUP"
tar czf "$BACKUP" -C .wrangler state
echo "[0015]    $(du -h "$BACKUP" | cut -f1) — base sauvegardée AVANT toute écriture"
{
  echo "apply-0015 $STAMP — profils créateurs (additif)"
  echo "backup: $BACKUP"
} > "$LOG"

if [ "$DRY_RUN" = "1" ]; then
  echo "[0015] DRY_RUN : arrêt avant application de la migration." | tee -a "$LOG"
  exit 0
fi

echo "[0015] 2/5 collisions de nom (COLLATE NOCASE, hors retirés)"
COLLISIONS=$(query "SELECT lower(name) COLLATE NOCASE AS nm, COUNT(*) AS c FROM creators WHERE status != 'withdrawn' GROUP BY lower(name) COLLATE NOCASE HAVING c > 1")
echo "[0015]    $COLLISIONS" | tee -a "$LOG"
COUNT=$(node -e "console.log(JSON.parse(process.argv[1]).length)" "$COLLISIONS" 2>/dev/null || echo 1)
if [ "$COUNT" != "0" ]; then
  echo "[0015] ERREUR : doublons de nom historiques — arbitrer (renommer via /admin) avant de migrer." | tee -a "$LOG"
  exit 1
fi

echo "[0015] 3/5 application de $SQL_FILE"
"${W[@]}" --file "$SQL_FILE" | tee -a "$LOG"

echo "[0015] 4/5 vérifications structure"
COLS=$(query "SELECT name FROM pragma_table_info('creators')")
echo "[0015]    colonnes creators : $COLS" | tee -a "$LOG"
for col in user_id bio status moderated_at note updated_at; do
  echo "$COLS" | grep -q "\"$col\"" || { echo "[0015] ERREUR : colonne $col absente" | tee -a "$LOG"; exit 1; }
done
TABLES=$(query "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('creator_links','creator_items')")
echo "[0015]    tables : $TABLES" | tee -a "$LOG"
[ "$(echo "$TABLES" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).length))')" = "2" ] || { echo "[0015] ERREUR : tables manquantes" | tee -a "$LOG"; exit 1; }
echo "[0015] 5/5 état des créateurs — TOUS doivent être 'published'"
STATUS=$(query "SELECT status, COUNT(*) AS n FROM creators GROUP BY status")
echo "[0015]    statuts créateurs : $STATUS" | tee -a "$LOG"
node -e '
  const rows = JSON.parse(process.argv[1]);
  const bad = rows.filter((r) => r.status !== "published");
  if (bad.length) { console.error("statuts inattendus : " + JSON.stringify(bad)); process.exit(1); }
  console.log("tous published ✓ (" + rows.length + " groupe(s))");
' "$STATUS" || { echo "[0015] ERREUR : des créateurs existants ne sont pas 'published' (la bannière doit rester inchangée)" | tee -a "$LOG"; exit 1; }
INDEXES=$(query "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_creator%'")
echo "[0015]    index : $INDEXES" | tee -a "$LOG"
echo "$INDEXES" | grep -q "idx_creators_name_nocase" || { echo "[0015] ERREUR : index NOCASE absent" | tee -a "$LOG"; exit 1; }

echo "[0015] OK — migration additive appliquée (bannière inchangée : les créateurs existants restent 'published')."
