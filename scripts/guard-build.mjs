#!/usr/bin/env node
/** Verrou anti-build racine (chantier 9, post-mortem incident 01/11 22:50).
 *
 *  CONTEXTE : un `npm run build` lancé à la racine du repo a écrasé dist/ —
 *  le dist/ servi en production par ws-atlas.service — avec un build
 *  INCOMPLET (interruption avant la copie des assets publics et
 *  write-version : /version.json 404, images manquantes, og:image cassé).
 *
 *  RÈGLE : le build racine n'est réservé QU'AU DÉPLOIEMENT (update-vps.sh)
 *  et au build ISOLÉ (~/War-Selection/validation/design/field-archive/
 *  build-isolated.sh, qui build dans ~/ws-atlas-build SANS toucher au dist/
 *  de prod). Les deux exportent WS_ATLAS_DEPLOY=1. Sans cette variable, ce
 *  script échoue AVANT que vinext build ne touche quoi que ce soit.
 *
 *  La validation quotidienne passe par le build isolé — jamais `npm run
 *  build` à la racine du repo de prod. */
if (!process.env.WS_ATLAS_DEPLOY) {
  console.error(
    [
      "",
      "⛔  BUILD REFUSÉ — dist/ de production servie par ws-atlas.service.",
      "",
      "   Le build racine est réservé au déploiement (deploy/vps/update-vps.sh)",
      "   et au build isolé (build-isolated.sh), qui posent WS_ATLAS_DEPLOY=1.",
      "",
      "   Pour valider du code : utiliser le build isolé",
      "   (~/War-Selection/validation/design/field-archive/build-isolated.sh)",
      "   — il build dans ~/ws-atlas-build sans toucher au dist/ de prod.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
