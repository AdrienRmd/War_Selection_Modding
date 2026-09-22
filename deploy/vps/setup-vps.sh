#!/usr/bin/env bash
# setup-vps.sh — installation idempotente de WS ATLAS sur un VPS Ubuntu/Debian.
# À exécuter EN ROOT, avec le repo déjà présent dans /opt/ws-atlas.
# Relançable sans risque : chaque étape détecte ce qui est déjà fait.
set -euo pipefail

readonly APP_DIR="/opt/ws-atlas"
readonly SERVICE_USER="wsatlas"
readonly SERVICE_NAME="ws-atlas"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log()  { echo -e "[setup-vps] $*"; }
fail() { echo -e "[setup-vps] ERREUR: $*" >&2; exit 1; }

# ---------------------------------------------------------------- 0. Garde-fous
[ "$(id -u)" -eq 0 ] || fail "à exécuter en root (sudo bash deploy/vps/setup-vps.sh)"
[ -d "$APP_DIR" ]    || fail "repo absent de $APP_DIR (clonez/transférez le repo d'abord)"
[ -f "$APP_DIR/package.json" ] || fail "$APP_DIR/package.json introuvable — repo incomplet ?"

# ---------------------------------------------------------------- 1. Dépendances de base
if ! command -v curl >/dev/null 2>&1 || ! command -v apt-get >/dev/null 2>&1; then
  apt-get update
  apt-get install -y curl ca-certificates
fi

# Node >= 22.13 requis (sinon Node 22 LTS via NodeSource).
node_ok=0
if command -v node >/dev/null 2>&1; then
  node_major="$(node -p 'process.versions.node.split(".")[0]')"
  node_minor="$(node -p 'process.versions.node.split(".")[1]')"
  if [ "${node_major:-0}" -gt 22 ] || { [ "${node_major:-0}" -eq 22 ] && [ "${node_minor:-0}" -ge 13 ]; }; then
    node_ok=1
    log "Node $(node -v) détecté (>= 22.13) : OK"
  else
    log "Node $(node -v) trop ancien (< 22.13)"
  fi
else
  log "Node absent"
fi
if [ "$node_ok" -ne 1 ]; then
  log "Installation de Node 22 LTS via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
  log "Node $(node -v) installé"
fi

# ---------------------------------------------------------------- 2. User système dédié
if id "$SERVICE_USER" >/dev/null 2>&1; then
  log "User système $SERVICE_USER déjà présent"
else
  useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
  log "User système $SERVICE_USER créé"
fi
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"

# Wrapper : exécute une commande en tant que $SERVICE_USER dans $APP_DIR.
as_user() {
  su -s /bin/bash "$SERVICE_USER" -c "cd '$APP_DIR' && $1"
}

# ---------------------------------------------------------------- 3. .env (ADMIN_EMAILS à personnaliser)
if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  chown "$SERVICE_USER:$SERVICE_USER" "$APP_DIR/.env"
  log ".env créé depuis .env.example"
  echo ""
  echo "  >>> EDIT ME : éditez $APP_DIR/.env et personnalisez ADMIN_EMAILS"
  echo "  >>> (remplacez seedy@sites.test par vos vrais emails admin),"
  echo "  >>> puis relancez ce script ou faites : systemctl restart $SERVICE_NAME"
  echo ""
else
  log ".env déjà présent (ADMIN_EMAILS non modifié)"
fi

# ---------------------------------------------------------------- 4. Dépendances + build
log "npm run install:ci (en tant que $SERVICE_USER)..."
as_user "npm run install:ci"

log "npm run build (en tant que $SERVICE_USER)..."
as_user "npm run build"
[ -f "$APP_DIR/dist/server/wrangler.json" ] || fail "build incomplet : dist/server/wrangler.json absent"

# ---------------------------------------------------------------- 5. Migrations D1 locales
# Commandes exactes du repo (DEVELOPMENT.md lignes 32-34), en --local.
# On ne les rejoue JAMAIS sur une base existante : si la table 'maps'
# (créée par 0000_steady_bucky.sql) existe déjà, on saute.
if as_user "node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --command \"SELECT name FROM sqlite_master WHERE type='table' AND name='maps'\" --json" 2>/dev/null | grep -q '"name"'; then
  log "Base D1 locale déjà initialisée : migrations sautées"
else
  log "Application des 3 migrations D1 locales (base neuve)..."
  as_user "node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_steady_bucky.sql"
  as_user "node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_public_dark_beast.sql"
  as_user "node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_crazy_goblin_queen.sql"
  log "Migrations appliquées"
fi
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR/.wrangler" "$APP_DIR/.sites-runtime" 2>/dev/null || true

# ---------------------------------------------------------------- 6. Service systemd
log "Installation de l'unité systemd $SERVICE_NAME..."
cp -f "$SCRIPT_DIR/ws-atlas.service" "/etc/systemd/system/${SERVICE_NAME}.service"
chown root:root "/etc/systemd/system/${SERVICE_NAME}.service"
chmod 644 "/etc/systemd/system/${SERVICE_NAME}.service"
systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"   # repart sur le build fraîchement installé

# ---------------------------------------------------------------- 7. Vérification HTTP locale
log "Vérification de http://127.0.0.1:8787 (le worker peut mettre ~10 s à démarrer)..."
http_ok=0
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8787 >/dev/null 2>&1; then
    http_ok=1
    break
  fi
  sleep 2
done

if [ "$http_ok" -eq 1 ]; then
  log "OK : le worker répond sur 127.0.0.1:8787."
  log "Suite manuelle : nginx (deploy/vps/nginx-ws-aremond.conf), entrée DNS A 'ws', puis certbot --nginx -d ws.aremond.ovh."
  log "N'oubliez pas ADMIN_EMAILS dans $APP_DIR/.env si le fichier vient d'être créé."
else
  journalctl -u "$SERVICE_NAME" -n 50 --no-pager || true
  fail "le worker ne répond pas sur 127.0.0.1:8787 — voir les logs ci-dessus (journalctl -u $SERVICE_NAME)"
fi
