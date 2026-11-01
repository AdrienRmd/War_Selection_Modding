#!/usr/bin/env bash
# HOTFIX 31/10/2026 — préservation des chunks des builds précédents.
#
# Incident : un onglet resté ouvert sur la version N-1 (HTML périmé, ex.
# ec80248) référence des scripts /_next/static/... émis par le build N-1. Or
# `vinext build` recrée intégralement dist/client/_next : après un
# redéploiement, ces URLs répondent 404 → hydratation impossible, boutons
# inertes, version figée (constaté sur iPhone/Safari le 31/10 après 4
# redéploiements dans la journée).
#
# Arborescence vérifiée sur dist réel (build v4018+, buildId = uuid tiré à
# chaque build, cf. dist/server/BUILD_ID) :
#   dist/client/_next/static/
#     <buildId>/_buildManifest.js, _ssgManifest.js   → namespacé par build
#     chunks/<module>-<hashcontenu>.js (~96 fichiers) → hash de contenu
#     css/index-<hashcontenu>.css                     → hash de contenu
# Conséquence clé : fusionner les arborescences static de plusieurs builds ne
# crée AUCUNE collision — même nom de fichier = même contenu (hash), et les
# dossiers <buildId> sont disjoints par construction.
#
# Mécanisme :
#   archive-current   (avant `npm run build`)  : archive l'arborescence static
#                    du build ACTUELLEMENT déployé sous $ARCHIVE_DIR/<buildId>/
#                    (rsync --delete → entrée fidèle, ré-exécution = no-op) ;
#   restore-previous  (après `npm run build`) : archive aussi l'arborescence du
#                    NOUVEAU build, applique la rotation (KEEP derniers
#                    buildIds, purge des plus vieux), puis re-fusionne sans
#                    suppression (rsync sans --delete) chaque build archivé
#                    dans dist/client/_next/static. Post-condition vérifiée :
#                    chaque fichier archivé doit exister après fusion.
#
# Résultat : un onglet ouvert sur une version N-1..N-4 recharge ses chunks
# (404 → 200), l'hydratation React se fait, et le bandeau « nouvelle version
# disponible » (composants/update-banner.tsx) peut lui proposer le reload.
#
# Idempotent, journalisé (stdout + $ARCHIVE_DIR/preserve.log).
# Usage :
#   preserve-static-assets.sh [REPO_DIR] [ARCHIVE_DIR] [KEEP] <archive-current|restore-previous>
# REPO_DIR par défaut : ~/war_selecion ; ARCHIVE_DIR par défaut :
# ~/ws-atlas-backups/static-builds (hors git, à côté des dist-rollback-*).

set -euo pipefail

REPO_DIR="${1:-$HOME/war_selecion}"
ARCHIVE_DIR="${2:-$HOME/ws-atlas-backups/static-builds}"
KEEP="${3:-5}"
ACTION="${4:-}"

STATIC_DIR="$REPO_DIR/dist/client/_next/static"
BUILD_ID_FILE="$REPO_DIR/dist/server/BUILD_ID"

mkdir -p "$ARCHIVE_DIR"
LOG_FILE="$ARCHIVE_DIR/preserve.log"

log() {
  local line
  line="[preserve-static] $*"
  echo "$line"
  printf '%s %s\n' "$(date -Is)" "$line" >>"$LOG_FILE"
}

read_build_id() {
  local id=""
  if [ -f "$BUILD_ID_FILE" ]; then
    id=$(tr -d '[:space:]' <"$BUILD_ID_FILE")
  fi
  printf '%s' "$id"
}

valid_build_id() {
  case "$1" in
    "" | *[!A-Za-z0-9._-]*) return 1 ;;
    *) return 0 ;;
  esac
}

archive_current() {
  local id
  id=$(read_build_id)
  if [ ! -d "$STATIC_DIR" ] || ! valid_build_id "$id"; then
    # Premier déploiement de la machine (pas de build courant) : rien à
    # archiver, ce n'est pas une erreur.
    log "archive-current : pas de build courant à archiver (dist absent ou BUILD_ID illisible) — ignoré"
    return 0
  fi
  mkdir -p "$ARCHIVE_DIR/$id"
  rsync -a --delete "$STATIC_DIR/" "$ARCHIVE_DIR/$id/"
  log "archive-current : buildId=$id archivé ($(find "$ARCHIVE_DIR/$id" -type f | wc -l) fichiers)"
}

restore_previous() {
  local new_id entry id merged_count total
  new_id=$(read_build_id)
  if [ ! -d "$STATIC_DIR" ] || ! valid_build_id "$new_id"; then
    log "restore-previous : ECHEC build produit incomplet (dist/client/_next/static ou dist/server/BUILD_ID manquant)"
    return 1
  fi

  # 1. Le nouveau build devient une entrée d'archive à part entière (liste
  #    de référence pour la rotation).
  mkdir -p "$ARCHIVE_DIR/$new_id"
  rsync -a --delete "$STATIC_DIR/" "$ARCHIVE_DIR/$new_id/"
  log "restore-previous : nouveau buildId=$new_id archivé"

  # 2. Rotation : garder les KEEP entrées les plus récentes (mtime), purger
  #    les plus vieilles. ls -1t sur des répertoires uniquement.
  while IFS= read -r old; do
    rm -rf -- "$ARCHIVE_DIR/$old"
    log "rotation : buildId=$old purgé (au-delà des $KEEP derniers)"
  done < <(ls -1pt "$ARCHIVE_DIR" | grep '/$' | sed 's:/$::' | tail -n +"$((KEEP + 1))")

  # 3. Fusion sans suppression de chaque build conservé (y compris plus
  #    anciens que le précédent : un onglet peut être ouvert sur N-3).
  merged_count=0
  for entry in "$ARCHIVE_DIR"/*/; do
    id=$(basename "$entry")
    [ "$id" = "$new_id" ] && continue
    rsync -a "$entry" "$STATIC_DIR/"
    merged_count=$((merged_count + 1))
    log "restore-previous : chunks du buildId=$id refusionnés"
  done

  # 4. Post-condition : chaque fichier archivé doit être servi par dist
  #    (un seul manquant = un onglet cassé → on échoue le déploiement).
  #    Le chemin servi s'obtient en retirant le préfixe d'entrée d'archive
  #    ($ARCHIVE_DIR/<buildId>/), PAS le préfixe d'archive racine.
  total=0
  for entry in "$ARCHIVE_DIR"/*/; do
    while IFS= read -r -d '' f; do
      rel=${f#"$entry"}
      if [ ! -f "$STATIC_DIR/$rel" ]; then
        log "restore-previous : ECHEC fichier archivé absent après fusion : $rel"
        return 1
      fi
      total=$((total + 1))
    done < <(find "$entry" -type f -print0)
  done
  log "restore-previous : OK — $merged_count build(s) précédent(s) fusionné(s), $total fichiers statiques vérifiés, $(find "$STATIC_DIR" -type f | wc -l) fichiers servis"
}

case "$ACTION" in
  archive-current) archive_current ;;
  restore-previous) restore_previous ;;
  *)
    echo "Usage : $0 [REPO_DIR] [ARCHIVE_DIR] [KEEP] <archive-current|restore-previous>" >&2
    exit 2
    ;;
esac
