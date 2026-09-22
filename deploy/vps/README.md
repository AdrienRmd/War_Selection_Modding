# Déploiement VPS OVH — ws.aremond.ovh (WS ATLAS)

Kit de déploiement pour servir WS ATLAS sur un VPS OVH (Ubuntu/Debian) derrière un
reverse proxy nginx, à l'adresse `http(s)://ws.aremond.ovh`.

Le VPS héberge déjà d'autres sites : ce kit n'ajoute qu'un server block nginx
dedicé et un service systemd `ws-atlas`. Il ne touche à aucune configuration
existante, et **ne modifie pas la zone DNS OVH au-delà d'une simple entrée A**
(voir étape 5).

---

## 1. Architecture

```
Internet ──> nginx (:80/:443, server_name ws.aremond.ovh)
                └── proxy_pass ──> wrangler (workerd) sur 127.0.0.1:8787
                                       ├── D1  (binding DB)  → .wrangler/state (SQLite local)
                                       └── R2  (binding BUCKET) → .wrangler/state (simulation locale)
```

L'application est un Worker Cloudflare (runtime workerd) buildé par `npm run build`
vers `dist/server` (code du worker) + `dist/client` (assets statiques). Sur le VPS
elle est exécutée par `wrangler dev --local`, qui fait tourner le **vrai runtime
workerd** en local, avec les bindings D1/R2 simulés sur disque dans
`.wrangler/state`.

### Configuration générée par le build (dist/server/wrangler.json)

Valeurs relevées dans `dist/server/wrangler.json` (généré par `npm run build`) :

| Champ | Valeur |
|---|---|
| `main` | `index.js` (soit `dist/server/index.js`) |
| `assets.directory` | `../client` (soit `dist/client`) |
| `compatibility_date` | `2026-05-15` |
| `compatibility_flags` | `["nodejs_compat"]` |
| `d1_databases` | `[{ "binding": "DB", "database_name": "site-creator-d1", "database_id": "00000000-0000-4000-8000-000000000000" }]` |
| `r2_buckets` | `[{ "binding": "BUCKET", "bucket_name": "site-creator-r2" }]` |

Le `database_id` est un placeholder : normal, tout tourne en `--local` (persisté
dans `.wrangler/state`), rien ne se connecte à Cloudflare.

---

## 2. Contenu du kit

| Fichier | Rôle |
|---|---|
| `README.md` | ce guide |
| `setup-vps.sh` | script d'installation idempotent (à exécuter **en root** sur le VPS, repo présent dans `/opt/ws-atlas`) |
| `ws-atlas.service` | unité systemd du service |
| `nginx-ws-aremond.conf` | server block nginx pour `ws.aremond.ovh` |
| `Caddyfile.exemple` | alternative Caddy (HTTPS automatique) si vous préférez Caddy à nginx |

---

## 3. Prérequis

- VPS OVH sous Ubuntu 20.04+ ou Debian 11+ (amd64), accès SSH root ou sudo.
- **Node.js >= 22.13** et npm (le `package.json` l'exige). Si votre Node est plus
  ancien ou absent, `setup-vps.sh` installe automatiquement Node 22 LTS via
  NodeSource. Installation manuelle :

  ```sh
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
  sudo apt-get install -y nodejs
  ```

- nginx installé (déjà présent si le VPS sert d'autres sites) :
  `sudo apt-get install -y nginx`
- Un client git sur le VPS si vous clonez le dépôt (sinon transférez les fichiers).
- Accès à la console OVH pour la zone DNS `aremond.ovh` (étape 5).

---

## 4. Étape 1 — Récupérer le code sur le VPS

Le repo doit se trouver dans **`/opt/ws-atlas`** (chemin attendu par le service
systemd et le script) :

```sh
# par clone git :
sudo git clone <URL_DU_DEPOT> /opt/ws-atlas

# ou par transfert direct depuis votre machine :
rsync -av --exclude node_modules --exclude .wrangler --exclude dist \
  ./ user@IP_VPS:/opt/ws-atlas/
```

## 5. Étape 2 — Installation automatisée (recommandé)

```sh
cd /opt/ws-atlas
sudo bash deploy/vps/setup-vps.sh
```

Le script est **idempotent** (relançable sans casse) et enchaîne, dans l'ordre :

1. Vérifie Node >= 22.13, sinon installe Node 22 LTS (NodeSource) ;
2. Crée le user système dédié `wsatlas` (si absent) et lui donne `/opt/ws-atlas` ;
3. `npm run install:ci` puis `npm run build` (exécutés en tant que `wsatlas`) ;
4. Crée `.env` depuis `.env.example` si absent — **éditez alors `ADMIN_EMAILS`**
   (voir encadré ci-dessous) ;
5. Applique les 3 migrations D1 locales (`drizzle/0000_steady_bucky.sql`,
   `0001_public_dark_beast.sql`, `0002_crazy_goblin_queen.sql`) — sautées si la
   base existe déjà ;
6. Installe `ws-atlas.service` dans `/etc/systemd/system`, `daemon-reload`,
   `enable --now`, `restart` ;
7. Vérifie `curl -fsS http://127.0.0.1:8787`.

> **ADMIN_EMAILS — à personnaliser** : si le script vient de créer `.env`,
> ouvrez-le et remplacez la valeur d'exemple (`seedy@sites.test`) par vos vrais
> emails administrateurs, séparés par des virgules, puis
> `sudo systemctl restart ws-atlas`. C'est le seul réglage obligatoire.

### Installation manuelle (équivalent pas à pas)

```sh
cd /opt/ws-atlas
npm run install:ci
cp .env.example .env        # puis ÉDITER ADMIN_EMAILS
npm run build

# Migrations D1 locales — UNIQUEMENT sur une base vide neuve
# (commandes exactes du repo, cf. DEVELOPMENT.md lignes 32-34) :
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_steady_bucky.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_public_dark_beast.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_crazy_goblin_queen.sql

sudo cp deploy/vps/ws-atlas.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ws-atlas
curl -fsS http://127.0.0.1:8787    # doit renvoyer le HTML du site
```

## 6. Étape 3 — nginx

```sh
sudo cp /opt/ws-atlas/deploy/vps/nginx-ws-aremond.conf /etc/nginx/sites-available/ws.aremond.ovh
sudo ln -sf /etc/nginx/sites-available/ws.aremond.ovh /etc/nginx/sites-enabled/ws.aremond.ovh
sudo nginx -t && sudo systemctl reload nginx
```

Le server block écoute sur le port 80 pour `ws.aremond.ovh` et proxifie vers
`127.0.0.1:8787` (`client_max_body_size 20m`, l'application limitant elle-même
les uploads à ~13 MB). Il ne touche à aucun autre site du VPS.

## 7. Étape 4 — DNS OVH : simple entrée A, rien d'autre

> **IMPORTANT — PAS de changement de nameservers.** Le domaine utilise déjà la
> zone OVH existante (les autres sites du VPS en dépendent). Il faut
> **SIMPLEMENT ajouter une entrée** dans cette zone :

1. Console OVH → **Web Cloud** → domaine `aremond.ovh` → onglet **Zone DNS**.
2. **Ajouter une entrée** de type **A** :
   - Sous-domaine : `ws`
   - Cible : l'adresse IPv4 **publique de votre VPS** (ex. `51.xx.xx.xx`)
   - TTL : par défaut (60–3600 s).
3. Enregistrer. Propagation généralement quelques minutes.

Vérification : `dig +short ws.aremond.ovh` doit renvoyer l'IP du VPS.

## 8. Étape 5 — HTTPS avec certbot

Une fois le DNS propagé :

```sh
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ws.aremond.ovh
```

Certbot édite lui-même le server block (port 443 + redirection 80 → 443) et
installe le renouvellement automatique. Test :
`curl -I https://ws.aremond.ovh` → `HTTP/2 200`.

### Alternative : Caddy (HTTPS automatique intégré)

Si vous préférez Caddy, voir `Caddyfile.exemple` : il suffit d'ajouter son
contenu au `Caddyfile` du serveur (`sudo systemctl reload caddy`). Caddy gère
seul le certificat Let's Encrypt.

---

## 9. Mise à jour du site

```sh
cd /opt/ws-atlas
sudo -u wsatlas git pull          # ou rsync des sources
sudo -u wsatlas npm run install:ci
sudo -u wsatlas npm run build
sudo systemctl restart ws-atlas
curl -fsS http://127.0.0.1:8787   # vérification
```

Les migrations ne se rejouent **pas** à chaque mise à jour : uniquement si un
nouveau fichier `drizzle/00XX_*.sql` apparaît, et dans l'ordre, une seule fois
(`setup-vps.sh` fait déjà ce détecte via la table `maps` — pour une migration
suivante, appliquez-la à la main comme en étape 2). Les données vivent dans
`.wrangler/state` et survivent aux rebuilds.

## 10. Sauvegarde / restauration

**Tout l'état** (base D1 = SQLite + objets R2 + journaux wrangler) tient dans
`.wrangler/state` :

```sh
sudo systemctl stop ws-atlas
sudo tar -czf /root/ws-atlas-backup-$(date +%F).tar.gz -C /opt/ws-atlas .wrangler/state
sudo systemctl start ws-atlas
```

Restauration :

```sh
sudo systemctl stop ws-atlas
sudo rm -rf /opt/ws-atlas/.wrangler/state
sudo tar -xzf /root/ws-atlas-backup-AAAA-MM-JJ.tar.gz -C /opt/ws-atlas
sudo chown -R wsatlas:wsatlas /opt/ws-atlas/.wrangler
sudo systemctl start ws-atlas
```

Automatisez avec un cron root, par exemple quotidien à 4 h :

```
0 4 * * * systemctl stop ws-atlas && tar -czf /root/ws-atlas-backup-$(date +\%F).tar.gz -C /opt/ws-atlas .wrangler/state && systemctl start ws-atlas
```

## 11. Dépannage

| Symptôme | Diagnostic / correction |
|---|---|
| `curl 127.0.0.1:8787` refuse la connexion | `journalctl -u ws-atlas -n 100 --no-pager` — le worker met quelques secondes à démarrer ; réessayez. |
| Port 8787 déjà occupé | `sudo ss -ltnp \| grep 8787` — identifiez le process ; le port doit rester exclusivement pour ws-atlas (bind 127.0.0.1). |
| Erreurs de permissions (`EACCES` sur `.wrangler` ou `.sites-runtime`) | `sudo chown -R wsatlas:wsatlas /opt/ws-atlas` puis `sudo systemctl restart ws-atlas`. |
| Site joignable en HTTP mais pas HTTPS | Certbot n'a pas encore tourné ou DNS non propagé : `dig +short ws.aremond.ovh`, puis relancez `sudo certbot --nginx -d ws.aremond.ovh`. |
| 502 Bad Gateway depuis nginx | Le service est mort : `sudo systemctl status ws-atlas`, `journalctl -u ws-atlas -f`, puis redémarrez. Vérifiez que le worker bind bien 127.0.0.1. |
| `npm run build` échoue sur le VPS | Vérifiez `node -v` (>= 22.13) et refaites `npm run install:ci` complet. |
| Base vide / erreurs SQL au premier lancement | Les 3 migrations D1 n'ont pas été appliquées — voir étape 2. |
| Logs applicatifs | `sudo journalctl -u ws-atlas -f` (sortie stdout/stderr du worker). |

## 12. Limites et avertissements (à lire)

- **Runtime workerd via wrangler en mode local** : le VPS exécute l'app avec
  `wrangler dev --local`, c'est-à-dire le **vrai runtime workerd** de Cloudflare,
  mais dans un mode d'exécution conçu pour le développement. Cloudflare ne le
  supporte pas officiellement en production. En pratique, pour cette application
  statique/read-only, ça fonctionne ; c'est un choix assumé et documenté.
- **App read-only pour le public** : les visiteurs anonymes ne font que consulter.
  Les uploads / écritures sont désactivés tant qu'aucune couche d'authentification
  n'est branchée. L'authentification par en-têtes d'identité était une mécanique
  du gateway d'origine : le wrapper actuel ignore les en-têtes forgés envoyés
  directement (validé : un `GET /` avec `oai-authenticated-user-id` /
  `oai-authenticated-user-email` forgés renvoie exactement le corps anonyme), mais
  ne comptez pas dessus comme mécanisme de sécurité.
- **NE JAMAIS exposer le port 8787 directement** (ni sur Internet, ni via une
  autre règle de proxy sans filtrage). Le worker écoute uniquement sur
  `127.0.0.1` et seul nginx doit le joindre. Bloquez 8787 en entrée si un
  pare-feu (ufw) est actif : `sudo ufw deny 8787/tcp`.
- **Pas de haute disponibilité** : un seul process systemd, un seul VPS. La
  sauvegarde tar (section 10) est votre filet.
- **Performances** : wrangler ajoute une surcouche par rapport à un déploiement
  Cloudflare natif ; suffisant pour ce trafic, mais pas dimensionné pour des
  pics massifs.
