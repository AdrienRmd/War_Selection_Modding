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
