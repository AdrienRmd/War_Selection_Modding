# Mer Baltique

tout les changements entre celui de base du jeu et avec les mods

## Mods de la map

| Mod                         | Fichier                                                | Rôle                                                                                                                              |
| --------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Economy Gather (tout-en-un) | [mods/economy_gather.lua](mods/economy_gather.lua)     | Vitesse de récolte et capacité transportée des ouvriers et pêcheurs, capacité de stockage des fermes, quais, temples et entrepôts |
| Adjust resources            | [mods/adjust_resources_baltique.lua](mods/adjust_resources_baltique.lua) | Quantités des ressources présentes sur la map (baies, poissons, blé, pierre, fer, arbres)                                         |
| Period piece                | [mods/period_piece_baltique.lua](mods/period_piece_baltique.lua) | Temps de recherche, coûts et ouvriers minimum de chaque recherche d'âge, par temple |
| Better resource | [mods/better_resource_baltique.lua](mods/better_resource_baltique.lua) | Revenus périodiques de chaque maison et mine (positifs = revenus, négatifs = entretien) — réglage dans la section VALEURS du script |
| Better batiment | [mods/better_batiment.lua](mods/better_batiment.lua) | Vitesses globales de construction/travail (40 %) et garnison (transport) de toutes les maisons et temples — documentation complète dans [BETTER_BATIMENT.md](BETTER_BATIMENT.md) |

# Economy Gather — valeurs par défaut du mod

Toutes les valeurs par défaut du mod, d'après [mods/economy_gather.lua](mods/economy_gather.lua) — pour les capacités des bâtiments, 100 % = jeu de base et les 120–300 % sont les réglages normaux du mod.

Rappels :

- Capacités des bâtiments en **% du jeu de base** : `100 %` = inchangé (moteur : `storageMultiplier`, 65536 = 100 %).
- Pêcheurs : vitesse en nourriture/seconde · capacité en nourriture transportée. Ouvriers : vitesse en ressource/seconde · sac = ressources transportées avant dépôt.
- **Les 120–300 % des bâtiments sont les valeurs normales du mod** (réglages par défaut de l'auteur). **Pêcheurs : vitesses = jeu de base × 0.55** (arrondies à 1 décimale), capacités transportées inchangées. **Ouvriers : vitesses = jeu de base × 0.55** (arrondies à 1 décimale), sacs inchangés. Tout se change via le panneau de réglages (bâtiments, pêcheurs) ou la section 6a VALEURS du script (ouvriers).
- Noms de ressources (clé Lua) : baies (`berries`), bois (`wood`), petits poissons (`small_fish`), métal (`metal`), viande (`meat`), pierre (`stone`), blé (`wheat`), riz (`rice`).
- Un paramètre de panneau manquant ou mal nommé retombe silencieusement sur sa valeur par défaut. La liste complète des paramètres est dans l'en-tête du fichier du mod.

## Résumé des changements

Multiplicateurs appliqués aux valeurs du jeu de base :

| Catégorie                           | Changement                                    | Valeurs actuelles                 |
| ----------------------------------- | --------------------------------------------- | --------------------------------- |
| Fermes                              | réglages de l'auteur (aucun multiplicateur)   | 130–210 %                         |
| Quais                               | capacité × 1.3                                | 143–195 %                         |
| Temples / merveilles                | capacité × 2                                  | 200–300 %                         |
| Entrepôts (incl. éléphant de cargo) | capacité × 1.2                                | 120–180 %                         |
| Pêcheurs                            | vitesse × 0.55, capacité inchangée            | 2.4–5.5/sec · 50–250 transportées |
| Ouvriers                            | vitesse × 0.55, sacs inchangés, pierre = bois | 0.3–2.2/sec · sacs 10–40          |

## 1. Fermes — capacité de stockage

| Ferme             | ID  | Défaut du mod | Paramètre panneau   |
| ----------------- | --- | ------------- | ------------------- |
| Europe            | 54  | **130 %**     | `FarmEurope`        |
| Asia              | 63  | **130 %**     | `FarmAsia`          |
| Europe de l'Est   | 70  | **160 %**     | `FarmEasternEurope` |
| Europe de l'Ouest | 95  | **160 %**     | `FarmWesternEurope` |
| Asie de l'Ouest   | 112 | **160 %**     | `FarmWesternAsia`   |
| Asie de l'Est     | 139 | **160 %**     | `FarmEasternAsia`   |
| Abstraite         | 193 | **210 %**     | `FarmAbstract`      |
| Chine             | 339 | **210 %**     | `FarmChina`         |
| Perse/Iran        | 412 | **210 %**     | `FarmPersiaIran`    |

## 2. Quais — capacité de stockage

| Quai              | ID  | Défaut du mod | Paramètre panneau   |
| ----------------- | --- | ------------- | ------------------- |
| Europe            | 21  | **143 %**     | `QuayEurope`        |
| Asia              | 35  | **143 %**     | `QuayAsia`          |
| Europe de l'Est   | 68  | **169 %**     | `QuayEasternEurope` |
| Europe de l'Ouest | 93  | **169 %**     | `QuayWesternEurope` |
| Asie de l'Ouest   | 118 | **169 %**     | `QuayWesternAsia`   |
| Asie de l'Est     | 144 | **169 %**     | `QuayEasternAsia`   |
| Abstrait          | 247 | **195 %**     | `QuayAbstract`      |

## 3. Temples / centres-villes et merveilles — capacité de stockage

| Temple                | ID  | Défaut du mod | Paramètre panneau      |
| --------------------- | --- | ------------- | ---------------------- |
| Autel (âge de pierre) | 0   | **100 %**     | `TempleAltar`          |
| Temple de base        | 10  | **200 %**     | `TempleBase`           |
| Europe                | 11  | **220 %**     | `TempleEurope`         |
| Asia                  | 28  | **220 %**     | `TempleAsia`           |
| Europe de l'Ouest     | 51  | **260 %**     | `TempleWesternEurope`  |
| Europe de l'Est       | 52  | **260 %**     | `TempleEasternEurope`  |
| Asie de l'Ouest       | 83  | **260 %**     | `TempleWesternAsia`    |
| Asie de l'Est         | 84  | **260 %**     | `TempleEasternAsia`    |
| Abstrait              | 190 | **300 %**     | `TempleAbstract`       |
| Merveille             | 239 | **300 %**     | `TempleWonder`         |
| Grande-Bretagne       | 254 | **300 %**     | `TempleGreatBritain`   |
| Inde                  | 264 | **300 %**     | `TempleIndia`          |
| Turquie               | 271 | **300 %**     | `TempleTurkey`         |
| Allemagne             | 282 | **300 %**     | `TempleGermany`        |
| Russie                | 302 | **300 %**     | `TempleRussia`         |
| France                | 323 | **300 %**     | `TempleFrance`         |
| Chine                 | 337 | **300 %**     | `TempleChina`          |
| Japon                 | 358 | **300 %**     | `TempleJapan`          |
| Pologne               | 372 | **300 %**     | `TemplePoland`         |
| Autriche-Hongrie      | 385 | **300 %**     | `TempleAustriaHungary` |
| Perse/Iran            | 402 | **300 %**     | `TemplePersiaIran`     |
| Italie                | 436 | **300 %**     | `TempleItaly`          |

## 4. Entrepôts (incl. éléphant de cargo) — capacité de stockage

| Entrepôt               | ID  | Défaut du mod | Paramètre panneau        |
| ---------------------- | --- | ------------- | ------------------------ |
| Pierre (âge de pierre) | 2   | **120 %**     | `WarehouseStone`         |
| Europe                 | 17  | **132 %**     | `WarehouseEurope`        |
| Asia                   | 30  | **132 %**     | `WarehouseAsia`          |
| Europe de l'Ouest      | 59  | **156 %**     | `WarehouseWesternEurope` |
| Europe de l'Est        | 60  | **156 %**     | `WarehouseEasternEurope` |
| Asie de l'Ouest        | 87  | **156 %**     | `WarehouseWesternAsia`   |
| Asie de l'Est          | 88  | **156 %**     | `WarehouseEasternAsia`   |
| Éléphant de cargo      | 124 | **156 %**     | `WarehouseElephantCargo` |
| Abstrait               | 191 | **180 %**     | `WarehouseAbstract`      |

## 5. Pêcheurs — vitesse de récolte · capacité transportée

Par défaut le mod applique les vitesses du jeu de base **× 0.55** (arrondies à 1 décimale) ; les capacités transportées gardent les valeurs du jeu de base.

| Pêcheur          | ID  | Défaut du mod (vitesse = jeu de base × 0.55) | Paramètres panneau                                      |
| ---------------- | --- | -------------------------------------------- | ------------------------------------------------------- |
| Europe           | 26  | 3/sec · 70                                   | `FisherEurope` / `FisherEuropeStockage`                 |
| Asia             | 43  | 2.4/sec · 50                                 | `FisherAsia` / `FisherAsiaStockage`                     |
| Europe médiévale | 81  | 3.9/sec · 150                                | `FisherMedievalEurope` / `FisherMedievalEuropeStockage` |
| Asie de l'Est    | 169 | 3.9/sec · 150                                | `FisherEasternAsia` / `FisherEasternAsiaStockage`       |
| Asie de l'Ouest  | 452 | 3.3/sec · 60                                 | `FisherWesternAsia` / `FisherWesternAsiaStockage`       |
| Chine            | 353 | 4.4/sec · 150                                | `FisherChina` / `FisherChinaStockage`                   |
| Abstrait         | 244 | 5.5/sec · 250                                | `FisherAbstract` / `FisherAbstractStockage`             |

## 6. Ouvriers — vitesse de récolte · sac, par ressource

Par défaut le mod applique les vitesses du jeu de base **× 0.55** (arrondies à 1 décimale) ; les sacs gardent les valeurs du jeu de base. Pour changer une valeur, édite la section **6a. VALEURS** du script (les slots sont spécifiques à chaque ouvrier, ne pas réordonner).

**Règle bois = pierre :** la vitesse de la **pierre** est égale à celle du **bois** pour chaque ouvrier qui récolte les deux (l'ouvrier de l'Âge de Pierre n'a pas d'entrée pierre) :

| Ouvrier           | Bois | Pierre |
| ----------------- | ---- | ------ |
| Europe            | 0.8  | 0.8    |
| Asia              | 0.7  | 0.7    |
| Europe de l'Ouest | 0.8  | 0.8    |
| Europe de l'Est   | 0.8  | 0.8    |
| Asie de l'Ouest   | 0.8  | 0.8    |
| Asie de l'Est     | 0.8  | 0.8    |
| Abstrait          | 1.0  | 1.0    |
| Chine             | 0.8  | 0.8    |

| Ouvrier           | ID  | Ressource       | Slot | Vitesse/sec · sac (vitesse = jeu de base × 0.55) |
| ----------------- | --- | --------------- | ---- | ------------------------------------------------ |
| Âge de pierre     | 1   | baies           | 0    | 0.6 · 10                                         |
| Âge de pierre     | 1   | bois            | 1    | 0.6 · 10                                         |
| Âge de pierre     | 1   | petits poissons | 2    | 1.0 · 30                                         |
| Âge de pierre     | 1   | viande          | 3    | 0.8 · 40                                         |
| Europe            | 12  | baies           | 0    | 0.7 · 20                                         |
| Europe            | 12  | bois            | 1    | 0.8 · 20                                         |
| Europe            | 12  | petits poissons | 2    | 1.1 · 30                                         |
| Europe            | 12  | métal           | 3    | 0.4 · 10                                         |
| Europe            | 12  | viande          | 4    | 0.9 · 10                                         |
| Europe            | 12  | pierre          | 5    | 0.8 · 10                                         |
| Europe            | 12  | blé             | 6    | 0.7 · 10                                         |
| Asia              | 31  | baies           | 0    | 0.6 · 20                                         |
| Asia              | 31  | bois            | 1    | 0.7 · 10                                         |
| Asia              | 31  | petits poissons | 2    | 1.1 · 20                                         |
| Asia              | 31  | métal           | 3    | 0.3 · 10                                         |
| Asia              | 31  | viande          | 4    | 0.8 · 10                                         |
| Asia              | 31  | pierre          | 5    | 0.7 · 10                                         |
| Europe de l'Ouest | 55  | bois            | 0    | 0.8 · 20                                         |
| Europe de l'Ouest | 55  | petits poissons | 1    | 2.2 · 30                                         |
| Europe de l'Ouest | 55  | métal           | 2    | 0.4 · 10                                         |
| Europe de l'Ouest | 55  | viande          | 3    | 0.8 · 20                                         |
| Europe de l'Ouest | 55  | pierre          | 4    | 0.8 · 10                                         |
| Europe de l'Ouest | 55  | blé             | 5    | 0.8 · 10                                         |
| Europe de l'Est   | 56  | bois            | 0    | 0.8 · 20                                         |
| Europe de l'Est   | 56  | petits poissons | 1    | 2.2 · 20                                         |
| Europe de l'Est   | 56  | métal           | 2    | 0.4 · 10                                         |
| Europe de l'Est   | 56  | viande          | 3    | 0.8 · 20                                         |
| Europe de l'Est   | 56  | pierre          | 4    | 0.8 · 10                                         |
| Europe de l'Est   | 56  | blé             | 5    | 0.9 · 10                                         |
| Asie de l'Ouest   | 89  | bois            | 0    | 0.8 · 10                                         |
| Asie de l'Ouest   | 89  | petits poissons | 1    | 1.7 · 20                                         |
| Asie de l'Ouest   | 89  | métal           | 2    | 0.4 · 10                                         |
| Asie de l'Ouest   | 89  | viande          | 3    | 0.9 · 10                                         |
| Asie de l'Ouest   | 89  | pierre          | 4    | 0.8 · 10                                         |
| Asie de l'Est     | 90  | bois            | 0    | 0.8 · 10                                         |
| Asie de l'Est     | 90  | petits poissons | 1    | 1.7 · 20                                         |
| Asie de l'Est     | 90  | métal           | 2    | 0.4 · 10                                         |
| Asie de l'Est     | 90  | viande          | 3    | 0.9 · 10                                         |
| Asie de l'Est     | 90  | pierre          | 4    | 0.8 · 10                                         |
| Abstrait          | 201 | bois            | 0    | 1.0 · 20                                         |
| Abstrait          | 201 | métal           | 1    | 0.7 · 10                                         |
| Abstrait          | 201 | viande          | 2    | 1.0 · 20                                         |
| Abstrait          | 201 | pierre          | 3    | 1.0 · 10                                         |
| Abstrait          | 201 | blé             | 4    | 1.0 · 10                                         |
| Chine             | 349 | bois            | 0    | 0.8 · 20                                         |
| Chine             | 349 | métal           | 1    | 0.4 · 10                                         |
| Chine             | 349 | viande          | 2    | 0.9 · 30                                         |
| Chine             | 349 | pierre          | 3    | 0.8 · 10                                         |
| Chine             | 349 | riz             | 4    | 1.0 · 20                                         |

## Conversions moteur (pour info)

- `storageMultiplier` = pourcentage × 65536 / 100, arrondi au-dessus (110 % → 72090).
- `perTick` = par seconde × 50 (55 = 1.1/sec).
- `bagSize` = transporté × 1000 (10000 = 10).

# Period Piece — coûts de base des âges

Le mod [mods/period_piece_baltique.lua](mods/period_piece_baltique.lua) configure la durée, le coût et le nombre d'ouvriers minimum de chaque recherche d'âge. Le tableau ci-dessous donne les **valeurs actuelles du mod** (`enabled = true`) ; les écarts avec le jeu de base sont listés sous le tableau.

- Ressources non listées = 0 ; l'or et le pétrole sont à **0 partout**.
- Une recherche **partagée** par plusieurs temples (ex. `iron_age`, `wonder_age`) est définie une seule fois : durée et coûts identiques dans chaque temple qui l'offre.
- `worker_requirements_addition` = nombre minimum d'ouvriers pour lancer la recherche.
- Échelles moteur : durée en millisecondes (`time` × 1000), montants ×1000 (1000 = 1 unité affichée).

| Âge (recherche) | Temple(s) | Durée | Ouvriers min | Nourriture | Bois | Fer |
|-----------------|-----------|-------|--------------|------------|------|-----|
| europe_age · asia_age | temple de pierre (10) | 120 s | 40 | 0 | 1250 | 0 |
| iron_age (partagée) | temple Europe (11) + temple Asia (28) | 170 s | 55 | 250 | 250 | 1450 |
| western_europe_age · eastern_europe_age | temple Europe (11) | 220 s | 65 | 4750 | 4500 | 1750 |
| western_asia_age · eastern_asia_age | temple Asia (28) | 220 s | 65 | 4750 | 4500 | 1750 |
| late_western_europe_age | temple Europe de l'Ouest (51) | 250 s | 85 | 9500 | 5500 | 3850 |
| late_eastern_europe_age | temple Europe de l'Est (52) | 250 s | 85 | 9500 | 5500 | 3850 |
| late_western_asia_age | temple Asie de l'Ouest (83) | 250 s | 85 | 9500 | 5500 | 3850 |
| late_eastern_asia_age | temple Asie de l'Est (84) | 250 s | 85 | 9500 | 5500 | 3850 |
| abstract_age (partagée) | temples d'ère 51 / 52 / 83 / 84 | 450 s | 100 | 18000 | 15000 | 9500 |
| austro_hungary_age (partagée) | temples 51 + 52 | 450 s | 100 | 18000 | 15000 | 9500 |
| france_age · germany_age · great_britain_age · italy_age | temple Europe de l'Ouest (51) | 450 s | 100 | 18000 | 15000 | 9500 |
| russian_age · poland_age | temple Europe de l'Est (52) | 450 s | 100 | 18000 | 15000 | 9500 |
| turkey_age · persia_age | temple Asie de l'Ouest (83) | 450 s | 100 | 18000 | 15000 | 9500 |
| india_age (partagée) | temples 83 + 84 | 450 s | 100 | 18000 | 15000 | 9500 |
| china_age · japan_age | temple Asie de l'Est (84) | 450 s | 100 | 18000 | 15000 | 9500 |
| wonder_age (partagée) | les 13 temples IR2 (190, 254, 264, 271, 282, 302, 323, 337, 358, 372, 385, 402, 436) | 240 s | 50 | 10000 | 7000 | 5000 |
| les 13 recherches IR2 (abstract, Grande-Bretagne, Inde, Turquie, Allemagne, Russie, France, Chine, Japon, Pologne, Autriche-Hongrie, Perse, Italie) | chacune dans son temple national (work 7) | 540 s | 150 | 34500 | 19500 | 12500 |

**Modifications par rapport au jeu de base :**

- Choix Europe / Asie (`europe_age` · `asia_age`) : 90 s / 20 ouvriers / 450 bois → **120 s / 40 ouvriers / 1250 bois**.
- `iron_age` (partagée) : 120 s / 30 ouvriers / 500 fer → **170 s / 55 ouvriers / 250 nourriture · 250 bois · 1450 fer**.
- Choix de région (`western/eastern_europe_age`, `western/eastern_asia_age`) : 150 s / 40 ouvriers / 2500 bois · 1000 fer → **220 s / 65 ouvriers / 4750 nourriture · 4500 bois · 1750 fer**.
- `late_*_age` (4 recherches) : 180 s / 50 ouvriers / 3000 nourriture · 2500 bois · 2000 fer → **250 s / 85 ouvriers / 9500 nourriture · 5500 bois · 3850 fer**.
- Palier « âge national IR1 » (abstract_age + les 12 âges nationaux) : 300 s / 50 ouvriers / 8000 nourriture · 6000 bois · 4000 fer → **450 s / 100 ouvriers / 18000 nourriture · 15000 bois · 9500 fer**.
- Palier IR2 (abstract_IR2_age + les 12 IR2 nationaux) : 240 s / 50 ouvriers / 12000 nourriture · 8000 bois · 5000 fer → **540 s / 150 ouvriers / 34500 nourriture · 19500 bois · 12500 fer**.
- `wonder_age` reste aux valeurs de base.

# Better resource — revenus des maisons et mines

Le mod [mods/better_resource_baltique.lua](mods/better_resource_baltique.lua) configure un revenu périodique pour chaque maison et mine. Réglage en VALEURS en haut du fichier (pas de panneau).

- Montants **positifs** = revenus payés par le champ engine `income` ; montants **négatifs** = entretien, déduit du trésor par un tick script (le champ engine plante sur les valeurs négatives).
- `period` = secondes entre deux versements (5.5 s dans le jeu de base), partagé par toutes les ressources de l'unité ; l'entretien est arrondi à la seconde.
- Échelles moteur : montants ×1000 (1000 = 1 unité affichée), période en millisecondes.

| Unité | Id | Période | Nourriture | Bois | Fer | Or | Pétrole |
|-------|----|---------|------------|------|-----|----|---------|
| Maison de pierre | 3 | 30 s | 0 | 0 | 0 | 1 | 0 |
| Maison Europe | 16 | 10 s | -2 | -2 | 0 | 5 | 0 |
| Maison Asie | 29 | 10 s | -2 | -2 | 0 | 5 | 0 |
| Maisons Europe de l'Ouest / Est | 57 · 58 | 10 s | -4 | -4 | 0 | 10 | 0 |
| Maisons Asie de l'Ouest / Est | 85 · 86 | 10 s | -4 | -4 | 0 | 10 | 0 |
| Maison générique (abstract) | 192 | 10 s | -8 | -8 | 0 | 20 | 0 |
| Les 12 maisons nationales IR2 (Grande-Bretagne, Inde, Turquie, Allemagne, Russie, France, Chine, Japon, Pologne, Autriche-Hongrie, Perse, Italie) | 255, 265, 272, 283, 303, 324, 338, 359, 373, 386, 403, 437 | 10 s | -8 | -8 | 0 | 20 | 0 |
| Mine générique · mine turque · mine polonaise | 253 · 281 · 374 | 10 s | -8 | -8 | 0 | 20 | 0 |

**Modifications par rapport au jeu de base :** dans le jeu de base, seule la maison de pierre rapporte (20 fer toutes les 5.5 s) ; toutes les autres maisons ne rapportent rien. Les mines existent déjà dans le jeu avec leurs propres revenus — le mod écrase leurs valeurs.

- Maison de pierre : 20 fer toutes les 5.5 s → **1 or toutes les 30 s**.
- Maison Europe / Asie : rien → **5 or et entretien 2 nourriture · 2 bois toutes les 10 s**.
- Maisons des 4 régions (Europe de l'Ouest/Est, Asie de l'Ouest/Est) : rien → **10 or et entretien 4 nourriture · 4 bois toutes les 10 s**.
- Maison générique + les 12 maisons nationales IR2 : rien → **20 or et entretien 8 nourriture · 8 bois toutes les 10 s** (période initialement 5.5 s, passée à 10 s).
- Mines (générique 253, Turquie 281, Pologne 374) : ajoutées au mod → **20 or et entretien 8 nourriture · 8 bois toutes les 10 s**.
