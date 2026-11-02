#!/usr/bin/env bash
set -euo pipefail
cd ~/war_selecion

# 1. Déps npm UNIQUEMENT si package-lock.json a changé depuis le pull précédent.
#    Premier run : ORIG_HEAD absent -> on regarde si node_modules existe.
if git rev-parse -q --verify ORIG_HEAD >/dev/null; then
  if git diff --name-only ORIG_HEAD HEAD | grep -q '^package-lock\.json$'; then
    echo '[update-vps] package-lock.json a change -> npm run install:ci'
    npm run install:ci
  else
    echo '[update-vps] package-lock.json inchange -> skip install:ci'
  fi
else
  echo '[update-vps] premier run (pas de ORIG_HEAD) -> npm run install:ci'
  npm run install:ci
fi

# 2. HOTFIX 31/10 (onglets Safari périmés) : archiver l'arborescence
#    _next/static du build ACTUELLEMENT déployé AVANT que `npm run build`
#    ne réécrive dist (les chunks des builds précédents devaient rester
#    servis aux onglets déjà ouverts — cf. deploy/vps/preserve-static-assets.sh).
echo '[update-vps] archivage du static du build courant...'
bash "$(pwd)/deploy/vps/preserve-static-assets.sh" "$(pwd)" archive-current

# 3. Build production.
#    CHANTIER 9 (post-mortem incident 01/11) : le build racine est verrouillé
#    par scripts/guard-build.mjs — il ne s'exécute QUE si WS_ATLAS_DEPLOY=1,
#    posé ici par le déploiement (jamais à la main pour de la validation).
echo '[update-vps] build...'
export WS_ATLAS_DEPLOY=1
npm run build

# 4. HOTFIX 31/10 : refusionner les chunks des builds précédents dans le
#    nouveau dist (rotation : 5 derniers buildIds). Idempotent + journalisé.
echo '[update-vps] préservation des chunks des builds précédents...'
bash "$(pwd)/deploy/vps/preserve-static-assets.sh" "$(pwd)" restore-previous

# 5. Redemarrage du service (sudo NOPASSWD).
echo '[update-vps] restart ws-atlas...'
sudo systemctl restart ws-atlas

# 6. Health check.
sleep 10
code=$(curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:8787/)
echo "[update-vps] health check 127.0.0.1:8787 -> $code"
if [ "$code" != "200" ]; then
  echo '[update-vps] ECHEC health check' >&2
  exit 1
fi
echo '[update-vps] OK'
