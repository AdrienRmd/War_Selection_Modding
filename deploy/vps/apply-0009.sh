#!/usr/bin/env bash
# apply-0009.sh — Migration 0009 : index UNIQUE users.display_name COLLATE NOCASE
# (audit dev-secu V2-P4 MAJEUR #1 — badge « créateur vérifié » non forgeable).
#
# Étapes (arrêt sur premier échec) :
#   1. Backup FRAIS de .wrangler/state (base D1 locale de production) AVANT tout.
#   2. Détection des collisions historiques sur trim(display_name) COLLATE NOCASE
#      (sur-ensemble exact de la sémantique de l'index ET du badge, qui compare
#      les noms trimmés).
#   3. Si collisions : le compte le PLUS ANCIEN (created_at, puis rowid) garde
#      son nom exact ; les cadets sont renommés « nom-2 », « nom-3 »… premier
#      suffixe libre (sonde anti-collision : un « Ada-2 » déjà pris mène à
#      « Ada-3 »). Journal : apply-0009-<date>.log à côté de la sauvegarde.
#   4. Application de drizzle/0009_early_mantis.sql (CREATE UNIQUE INDEX).
#   5. Vérifications finales : index présent dans sqlite_master, zéro collision
#      restante (trim + NOCASE).
#
# Usage : cd ~/war_selecion && bash deploy/vps/apply-0009.sh
#         DRY_RUN=1 bash deploy/vps/apply-0009.sh  (détection seule, aucune écriture)
set -euo pipefail
cd "$(dirname "$0")/../.."

STATE_DIR="${STATE_DIR:-.wrangler/state}"
BACKUP_DIR="$HOME/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$BACKUP_DIR/pre-0009-$STAMP.tar.gz"
LOG="$BACKUP_DIR/apply-0009-$STAMP.log"
DRY_RUN="${DRY_RUN:-0}"
W=(node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to "$STATE_DIR")

# Échappe une valeur pour un littéral SQL ('…').
sqlescape() { printf "%s" "$1" | sed "s/'/''/g"; }

mkdir -p "$BACKUP_DIR"

# Exécute une commande SQL et imprime le tableau results en JSON compact.
query() {
  local sql="$1"
  "${W[@]}" --command "$sql" --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(JSON.stringify(j[0].results));})'
}

echo "[0009] D1 locale de production : $STATE_DIR"
[ -d "$STATE_DIR" ] || { echo "[0009] ERREUR : $STATE_DIR introuvable" >&2; exit 1; }

echo "[0009] 1/5 backup frais → $BACKUP"
tar czf "$BACKUP" -C .wrangler state
echo "[0009]    $(du -h "$BACKUP" | cut -f1) — base sauvegardée AVANT toute écriture"
{
  echo "apply-0009 $STAMP — index UNIQUE display_name COLLATE NOCASE"
  echo "backup: $BACKUP"
} > "$LOG"

echo "[0009] 2/5 détection des collisions (trim + NOCASE)"
COLLISIONS=$(query "SELECT trim(display_name) COLLATE NOCASE AS dn, COUNT(*) AS c FROM users GROUP BY trim(display_name) COLLATE NOCASE HAVING c > 1")
echo "[0009]    $COLLISIONS" | tee -a "$LOG"

COUNT=$(node -e "console.log(JSON.parse(process.argv[1]).length)" "$COLLISIONS")
if [ "$COUNT" = "0" ]; then
  echo "[0009] aucune collision historique — rien à renommer (preuve ci-dessus)" | tee -a "$LOG"
else
  if [ "$DRY_RUN" = "1" ]; then
    echo "[0009] DRY_RUN : $COUNT collision(s) détectée(s), arrêt avant tout renommage." | tee -a "$LOG"
    exit 0
  fi
  echo "[0009] 3/5 renommage des cadets (l'aîné garde son nom exact)" | tee -a "$LOG"
  for DN in $(node -e "const c=JSON.parse(process.argv[1]);for(const x of c)console.log(x.dn)" "$COLLISIONS"); do
    DN_SQL=$(sqlescape "$DN")
    MEMBERS=$(query "SELECT id, display_name, created_at FROM users WHERE trim(display_name) COLLATE NOCASE = '$DN_SQL' ORDER BY created_at ASC, rowid ASC")
    # Tous les pseudos existants (trim + minuscules) : la sonde de suffixe doit
    # éviter TOUTE collision, pas seulement celle du groupe (un « Ada-2 »
    # historique déjà porté par un compte tiers mène à « Ada-3 »).
    ALL_NAMES=$(query "SELECT lower(trim(display_name)) AS k FROM users")
    # Le premier (aîné) garde son nom exact ; les suivants prennent « base-2 »,
    # « base-3 »… premier suffixe non déjà porté (toute la table considérée).
    RENAMES=$(node -e '
      const members = JSON.parse(process.argv[1]);
      const taken = new Set(JSON.parse(process.argv[2]).map((r) => r.k));
      const plan = [];
      for (let i = 1; i < members.length; i++) {
        let n = 2;
        while (taken.has((process.argv[3] + "-" + n).toLowerCase())) n++;
        const target = process.argv[3] + "-" + n;
        taken.add(target.toLowerCase());
        plan.push({ id: members[i].id, from: members[i].display_name, to: target });
      }
      console.log(JSON.stringify(plan));
    ' "$MEMBERS" "$ALL_NAMES" "$DN")
    node -e '
      const plan = JSON.parse(process.argv[1]);
      for (const r of plan) console.log(`${r.id}\t${r.from}\t${r.to}`);
    ' "$RENAMES" | while IFS=$'\t' read -r ID FROM TO; do
      [ -z "$ID" ] && continue
      echo "[0009]    renommé : « $FROM » (id $ID) → « $TO » — l'aîné garde « $DN »" | tee -a "$LOG"
      TO_SQL=$(sqlescape "$TO")
      ID_SQL=$(sqlescape "$ID")
      "${W[@]}" --command "UPDATE users SET display_name = '$TO_SQL' WHERE id = '$ID_SQL'" >/dev/null
    done
  done
  LEFT=$(query "SELECT trim(display_name) COLLATE NOCASE AS dn, COUNT(*) AS c FROM users GROUP BY trim(display_name) COLLATE NOCASE HAVING c > 1")
  if [ "$LEFT" != "[]" ]; then
    echo "[0009] ERREUR : collisions restantes après renommage : $LEFT" | tee -a "$LOG" >&2
    exit 1
  fi
  echo "[0009]    dédoublonnage terminé, journal : $LOG" | tee -a "$LOG"
fi

if [ "$DRY_RUN" = "1" ]; then
  echo "[0009] DRY_RUN : arrêt avant application de la migration." | tee -a "$LOG"
  exit 0
fi

echo "[0009] 4/5 application de drizzle/0009_early_mantis.sql"
"${W[@]}" --file drizzle/0009_early_mantis.sql

echo "[0009] 5/5 vérifications finales"
IDX=$(query "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_users_display_name_nocase'")
if [ "$IDX" != '[{"name":"idx_users_display_name_nocase"}]' ]; then
  echo "[0009] ERREUR : index absent ($IDX)" | tee -a "$LOG" >&2
  exit 1
fi
LEFT2=$(query "SELECT trim(display_name) COLLATE NOCASE AS dn, COUNT(*) AS c FROM users GROUP BY trim(display_name) COLLATE NOCASE HAVING c > 1")
if [ "$LEFT2" != "[]" ]; then
  echo "[0009] ERREUR : collisions restantes : $LEFT2" | tee -a "$LOG" >&2
  exit 1
fi
echo "[0009] OK — index UNIQUE posé, zéro collision. Relancez ensuite ./deploy/vps/update-vps.sh." | tee -a "$LOG"
