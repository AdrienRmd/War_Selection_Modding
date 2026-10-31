# AGENTS.md — instructions projet WS ATLAS

## Déploiement production (règle permanente)

Le site est en ligne sur **https://ws.aremond.ovh** :
- VPS : `ubuntu@51.254.129.80` (SSH par clé, sans mot de passe)
- Clone git serveur : `~/war_selecion` (branche `vps`, tracking `origin/experiments`)
- Service : systemd `ws-atlas` (`npm start` / vinext sur 127.0.0.1:8787), Apache en proxy SSL

**À la fin de chaque tâche qui modifie le code, déployer en ligne :**

1. Commiter et pousser depuis le clone local (branche `vps`) :
   ```bash
   git add -A
   git commit -m "type(scope): description"
   git push origin vps:experiments
   ```
2. Déployer sur le VPS :
   ```bash
   ssh ubuntu@51.254.129.80 "cd ~/war_selecion && git pull --ff-only && ./deploy/vps/update-vps.sh"
   ```
   Le script gère : `install:ci` si `package-lock.json` a changé → `build` → `restart ws-atlas` → health check HTTP sur 127.0.0.1:8787.
3. Vérifier que https://ws.aremond.ovh répond 200.

**Interdictions :**
- Jamais de `git push --force` sur `experiments` (branche de production suivie par le VPS).
- Ne jamais committer de secrets : la config sensible du serveur vit dans `~/war_selecion/.env` (hors git).

## Rapport V3-P2-frontend — durcissement cosmétique (9 items revues, 2026-10-30)

Commits `76721b1..ef8ff88` (branche vps → experiments), déployés via update-vps.sh (health 200).
Suite : 406 tests verts (31 fichiers), `tsc --noEmit` OK, eslint OK. Prettier : non-passant
préexistant (60 fichiers, identique avant/après — hors porte de validation).

| # | Item | Statut | Preuve |
|---|------|--------|--------|
| 1 | `lib/profile.ts:155` ternaire mort PNG | fait | simplifié `return concat(chunks)` ; post-IEND déjà tronqué, comment documenté (diff 76721b1) |
| 2 | JPEG post-EOI tronqué | fait | `stripJpegMetadata` coupe après l'EOI (scan post-en-tête SOS, bourrage FF00/RST géré, multi-scans OK) ; 5 tests profile.test (stocké sans rien après EOI, sortie = JPEG propre) ; fixtures SOS passées conformes spec (profile + map-sharing) |
| 3 | Littéral throttle | fait | test exact bout-en-bout : PATCH #1–#10 → 200, #11 → 429 + Retry-After (DB stateful auth_attempts, RATE_LIMITS_ENABLED forcé production) ; fenêtre expirée → reset ; libellés profile.ts/route/test alignés |
| 4 | Avatar `no-store` → `private, max-age=60` | fait | en-tête dans le bundle route déployé (grep `private, max-age=60`, zéro `no-store` restant) ; 401 anonyme vérifié en ligne (auth intacte) |
| 5 | `DatasetBadge` factorisé | fait | components/dataset-badge.tsx (DatasetBadge + UpdatedDatasetBadge + useDatasetMeta) ; data-badge identiques ; navigateur ×3 locales : fr/en/zh OK post-hydration + atelier simple (0 erreur JS) ; chunk partagé ×4 pages, total JS client 2,11 Mo → 2,11 Mo (−900 o) |
| 6 | delete-creation fragments → clé template | fait | `永久删除「${title}」？` unique (EN/FR ajoutés, fragment mort retiré, `」？` conservé pour submission-dashboard) ; test i18n EN/FR/ZH |
| 7 | saveLocalePreference vs budget PATCH | fait | débounce 1,5 s + doublon ignoré + grâce Retry-After sur 429, sans nouvelle API ; live : rafale 4 clics → 1 PATCH, re-clics même locale → 0 PATCH, cookie immédiat |
| 8 | fetchChildren validation défensive | fait | `sanitizeChildren` (lib, testé) ; JSON inattendu → échec UI failedPaths, pas de crash ; deep links /modding live sans erreur JS |
| 9 | nodeCache borné | fait | 40 entrées, éviction FIFO (`capMapSize`, testé) ; cacheChildren appliqué aux 2 chemins d'écriture |

Non-régression : 20+ routes curl 200/307 attendus, sitemap complet, expansion arbre modding live OK.
Point ouvert (hors périmètre, signalé) : `submission-dashboard.tsx:344/381` garde le même motif
fragments (« 发布「/撤回「 + titre + 」？ ») — même correctif possible par clé template si souhaité.
