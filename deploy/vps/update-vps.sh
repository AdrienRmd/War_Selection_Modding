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

# 2. Build production.
echo '[update-vps] build...'
npm run build

# 3. Redemarrage du service (sudo NOPASSWD).
echo '[update-vps] restart ws-atlas...'
sudo systemctl restart ws-atlas

# 4. Health check.
sleep 10
code=$(curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:8787/)
echo "[update-vps] health check 127.0.0.1:8787 -> $code"
if [ "$code" != "200" ]; then
  echo '[update-vps] ECHEC health check' >&2
  exit 1
fi
echo '[update-vps] OK'
