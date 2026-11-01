#!/usr/bin/env node
/** Génère lib/collection-i18n.json — dictionnaire trilingue des fiches cartes
 *  (mission finitions 01/11, chantier 4c). Source de vérité : les relevés
 *  d'origine (lib/collection-seeds.json + lib/discord-map-seeds.json fusionnés
 *  par lib/collection.ts). Structure par id :
 *    { "en": { "name"?, "note"? },   — corrections : titres EN non anglais
 *                                      (titres zh/ru/pl) et nettoyage public
 *                                      des mentions « unconfirmed » ;
 *      "fr": { "name", "note"? } }   — traduction française (noms propres
 *      universels conservés). Repli runtime : langue d'origine si absent.
 *  Les fiches sans nom n'entrent PAS dans le dictionnaire : le défaut propre
 *  « Carte <code> » / « Map <code> » / « 地图 <code> » est calculé à l'affichage.
 *  Usage : node scripts/gen-collection-i18n.mjs   (régénère depuis la table) */
import { writeFileSync } from "node:fs";

const T = {
  // ── Titres non anglais / nettoyage public ────────────────────────────
  "map-982084b8": {
    en: {
      name: "Trench Attack/Defense (Okopy)",
      note: "20 attackers face five defenders, with the defending side's wonder as the objective and a 1-hour-45-minute wonder timer.",
    },
    fr: {
      name: "Attaque/défense de tranchées (Okopy)",
      note: "20 attaquants affrontent 5 défenseurs ; l'objectif est la merveille du camp défenseur, avec un minuteur de merveille de 1 h 45.",
    },
  },
  "map-981104b9": {
    en: {
      name: "Westerplatte",
      note: "A Westerplatte attack-and-defense scenario for up to 10 German-side and 15 Polish-side players, with a 20-minute peace period and landing restrictions.",
    },
    fr: {
      name: "Westerplatte",
      note: "Scénario d'attaque-défense de la Westerplatte pour jusqu'à 10 joueurs côté allemand et 15 côté polonais, avec 20 minutes de paix et des restrictions de débarquement.",
    },
  },
  "map-00318438": {
    en: { name: "Lying-Flat Survival" },
    fr: {
      name: "Survie « tang ping »",
      note: "Défense centrale à 12 joueurs contre des attaques venant de toutes les directions, visant la victoire par merveille ; les maisons fournissent des ressources.",
    },
  },
  "map-902180b0": {
    en: { name: "Guard Your Brain" },
    fr: {
      name: "Défendez votre cerveau",
      note: "Défense à 4 joueurs avec construction et production très rapides ; tenez le centre avec les unités de départ pour la victoire par merveille.",
    },
  },
  "map-00358408": {
    en: { name: "Defensive Gap Map" },
    fr: {
      name: "Carte de défense à brèches",
      note: "Défense coordonnée à 6 joueurs ; les joueurs arrière soutiennent le front pendant que l'équipe avance les âges sans perdre de coéquipier et protège la merveille.",
    },
  },
  "map-08348088": {
    en: { name: "The Last Fortress: The First Dark Tide War" },
    fr: {
      name: "La Dernière Forteresse : première guerre de la marée sombre",
      note: "Huit joueurs défendent une forteresse humaine centrale, se développent vers la merveille et résistent aux attaques de toutes les directions.",
    },
  },
  "map-086004a8": {
    en: { name: "South America" },
    fr: {
      name: "Amérique du Sud",
      note: "Répertoriée comme carte à 4 joueurs ; le gameplay n'est pas testé et les mods n'ont pas été vérifiés.",
    },
  },
  "map-00658421": {
    en: { name: "Map for 6 Players" },
    fr: {
      name: "Carte pour 6 joueurs",
      note: "Carte navale à 6 joueurs, aux mers étendues et aux ressources disputées.",
    },
  },
  "map-1c558088": {
    fr: {
      name: "iran map v2",
      note: "Correction d'une ancienne carte d'Iran signalée par l'auteur ; nombre de joueurs et règles détaillées à confirmer.",
    },
  },
  "map-903504a4": { fr: { name: "Europe Map · Original sans mod", note: NOMOD_NOTE_FR() } },
  "map-903104b4": { fr: { name: "Asia Map · Original sans mod", note: NOMOD_NOTE_FR() } },
  "map-903504b4": { fr: { name: "Africa Map · Original sans mod", note: NOMOD_NOTE_FR() } },
  "map-90310494": { fr: { name: "World Map · Original sans mod", note: NOMOD_NOTE_FR() } },
  "map-90358404": { fr: { name: "Giant Europe Map · Original sans mod", note: NOMOD_NOTE_FR() } },
  "map-903104a4": { fr: { name: "Fantasy World Map · Original sans mod", note: NOMOD_NOTE_FR() } },
  "map-90318414": { fr: { name: "British Isles Map · Original sans mod", note: NOMOD_NOTE_FR() } },
  "map-90318404": { fr: { name: "America Map · Original sans mod", note: NOMOD_NOTE_FR() } },

  // ── Noms propres / titres établis, notes traduites ────────────────────
  "map-1021008c": {
    fr: {
      name: "Mer Noire et Caspienne",
      note: "Carte Mer Noire–Caspienne à 11 joueurs avec diplomatie et merveilles activées.",
    },
  },
  "map-102180a8": {
    fr: {
      name: "Le Débarquement de Normandie",
      note: "Carte du débarquement de Normandie à 6 joueurs, 3 contre 3.",
    },
  },
  "map-14140429": {
    fr: {
      name: "World Map · Diplomatie",
      note: "L'édition diplomatie de la World Map de Max.",
    },
  },
  "map-9844843c": {
    fr: {
      name: "Atlantic Map",
      note: "Ancienne carte de l'Atlantique dont le post indique des effectifs contradictoires : 17 puis 20 joueurs.",
    },
  },
  "map-88208080": {
    fr: {
      name: "Zealandia Map · Original",
      note: "Carte de géographie alternative à 15 joueurs imaginant une Zélande non submergée.",
    },
  },
  "map-98308088": {
    fr: {
      name: "Zealandia Map · Diplomatie",
      note: "L'édition diplomatie à 15 joueurs de Zealandia Map.",
    },
  },
  "map-102580b4": {
    fr: {
      name: "Guerre de la mer Égée, 1389",
      note: "Carte chacun-pour-soi à 10 joueurs autour de la mer Égée.",
    },
  },
  "map-8061803d": {
    fr: { name: "Guerre de Chypre", note: "Carte chacun-pour-soi à 11 joueurs sur le thème de Chypre." },
  },
  "map-80210099": {
    fr: {
      name: "Asia Map - MGracz · Original",
      note: "Grande carte d'Asie pour des événements à 43 joueurs et du jeu de rôle.",
    },
  },
  "map-90658094": {
    fr: {
      name: "3 Players Independent",
      note: "Chacun-pour-soi à 3 joueurs, avec des économies contrastées entre continent et îles.",
    },
  },
  "map-0820801c": {
    fr: {
      name: "La Dernière Forteresse : la première guerre de la marée sombre",
      note: "Carte coopérative de défense contre des vagues, pour 4 à 8 joueurs recommandés, protégeant une merveille.",
    },
  },
  "map-90710020": {
    fr: {
      name: "Guerre russo-ukrainienne",
      note: "Scénario à 3 joueurs et 2 équipes dans un cadre de 2022.",
    },
  },
  "map-1021043c": {
    fr: { name: "ASİAN WAR", note: "Carte chacun-pour-soi à 8 joueurs dans un cadre asiatique." },
  },
  "map-00710034": {
    fr: {
      name: "BLACK SEA WAR 1399",
      note: "Carte chacun-pour-soi à 12 joueurs autour de la mer Noire.",
    },
  },
  "map-00658004": {
    fr: {
      name: "Péninsule ibérique / İberya Yarımadası",
      note: "Carte chacun-pour-soi à 12 joueurs sur le thème de la péninsule ibérique.",
    },
  },
  "map-0065002c": {
    fr: {
      name: "WELCOME TO HELL · 15 contre 15",
      note: "Bataille par équipes asymétrique à 30 joueurs, avec commandants et rôles de combat spécialisés.",
    },
  },
  "map-80350494": {
    fr: {
      name: "MOYEN-ORIENT / Orta Doğu",
      note: "Carte chacun-pour-soi à 15 joueurs sur le thème du Moyen-Orient.",
    },
  },
  "map-00318414": {
    fr: {
      name: "Supreme · Recommandé 8 contre 8",
      note: "Carte terrestre et navale par équipes, référençant Supreme de Beyond All Reason.",
    },
  },
  "map-0031049c": {
    fr: {
      name: "Portrait artistique de Jérusalem · 5 contre 4",
      note: "Carte artistique sur le thème de Jérusalem, présentée comme un scénario 5 contre 4.",
    },
  },
  "map-0031000c": {
    fr: {
      name: "D-Day Invasion · 3 contre 1 · Modifiable",
      note: "Scénario compact de débarquement 3 contre 1 sur les plages Dog-Green et Dog-White.",
    },
  },
  "map-90618038": {
    fr: {
      name: "Allemagne : RFA contre RDA",
      note: "Petite carte 1 contre 1 sur le thème de l'Allemagne de l'Ouest et de l'Est.",
    },
  },
  "map-80310488": {
    fr: {
      name: "Région de la mer Jaune",
      note: "Carte 3v3 de la mer Jaune avec départs par villes et montagnes défendables.",
    },
  },
  "map-803000b5": {
    fr: {
      name: "America Map · Diplomatie",
      note: "Carte des Amériques pour chacun-pour-soi et événements à 20 joueurs, estampillée Diplomatie d'après le post de collection ultérieur.",
    },
  },
  "map-10308029": {
    fr: {
      name: "Ram Pam Selection · 2 contre 2",
      note: "Mode 2v2 avec béliers rapides et très destructeurs, revenus de kills et ressources d'équipe partagées.",
    },
  },
  "map-10348419": {
    fr: {
      name: "Ram Pam Selection · 4 contre 4",
      note: "Mode 4v4 avec béliers rapides et très destructeurs, revenus de kills et ressources d'équipe partagées.",
    },
  },
  "map-90348434": {
    fr: {
      name: "War Selection : la chute de la Scanie",
      note: "Lutte à 25 joueurs pour un continent après l'effondrement d'un empire fictif.",
    },
  },
  "map-00740404": {
    fr: {
      name: "King Team 8v8",
      note: "Bataille 8v8 du roi : levez une armée et gardez votre roi en vie.",
    },
  },
  "map-1c45048d": {
    fr: {
      name: "British Isles Map · Diplomatie",
      note: "Chacun-pour-soi diplomatique à 36 joueurs à travers la Grande-Bretagne et l'Irlande.",
    },
  },
  "map-1c458435": {
    fr: {
      name: "British Isles [Original] · Mode 3 équipes",
      note: "Variante à 3 équipes de la Grande-Bretagne et de l'Irlande ; le nombre de joueurs demande clarification.",
    },
  },
  "map-181100bd": {
    fr: {
      name: "Africa Map · Diplomatie",
      note: "Carte d'Afrique à 20 joueurs pour événements et jeu de rôle, avec diplomatie et population par territoire.",
    },
  },
  "map-044580ad": {
    fr: {
      name: "Giant Europe Map · Diplomatie",
      note: "Immense carte d'Europe à 50 joueurs avec diplomatie, population par territoire et chargement en véhicules.",
    },
  },
  "map-9c110424": {
    fr: {
      name: "island by normal",
      note: "Bataille insulaire 2v2v2v2 à hautes ressources, avec une IA entre les joueurs et au centre.",
    },
  },
  "map-90708088": {
    fr: {
      name: "Survie des montagnes marécageuses",
      note: "Survie à 7 joueurs entre marais et montagnes contre des vagues venant de l'est, qui progressent avec la technologie des joueurs.",
    },
  },
  "map-906400a0": {
    fr: {
      name: "Archipel sismique",
      note: "Bataille d'archipel 5v5 avec ressources et population d'équipe partagées.",
    },
  },
  "map-00200088": {
    fr: {
      name: "Bataille de Stalingrad · original de Yurky",
      note: "Le Stalingrad original de Yurky : combat soviéto-allemand en 10v10, archivé à part de l'adaptation d'Austin.",
    },
  },
  "map-88018419": {
    fr: {
      name: "Asia Map · Diplomatie",
      note: "Chacun-pour-soi d'événement en Asie à 20 joueurs, avec diplomatie et population par territoire.",
    },
  },
  "map-8c450024": {
    fr: {
      name: "Middle East Map",
      note: "2v2 à 4 joueurs au Moyen-Orient : Iran et Irak contre Turquie et Égypte.",
    },
  },
  "map-8c1180bc": {
    fr: {
      name: "Ulthuan",
      note: "Chacun-pour-soi fantastique à 10 joueurs, inspiré de l'île des Hauts Elfes de Warhammer Fantasy.",
    },
  },
  "map-0c50802d": {
    fr: {
      name: "Fantasy World Map · Diplomatie",
      note: "Carte géante de monde fantastique à 63 joueurs pour événements, incluant Duksaaland et d'autres régions ajoutées.",
    },
  },
  "map-8030008c": {
    fr: {
      name: "Tree Wall",
      note: "Bataille 15v15 de mur d'arbres : tracez des passages dans la forêt ou empruntez les abords de la rivière.",
    },
  },
  "map-0030042c": {
    fr: {
      name: "It's Not Pacific",
      note: "Bataille navale 15v15 à ressources partagées avec progression chronométrée en fin de partie.",
    },
  },
  "map-8c010004": {
    fr: {
      name: "Le champ de bataille du Roi",
      note: "Bataille royale à 12 joueurs : rasez des villages pour des ressources et rapprochez-vous du centre pour échapper à la pluie de feu.",
    },
  },
  "map-90640038": {
    fr: {
      name: "La forteresse de fer de la Mère-Patrie",
      note: "Bataille de forteresse 15v15 à ressources partagées, centrée sur les mines de fer des montagnes et des renforts coordonnés.",
    },
  },
  "map-902484a8": {
    fr: {
      name: "No Mans Land",
      note: "Carte d'usure à points d'étranglement, conçue pour le 8v8 et aussi jouable en 4v4.",
    },
  },
  "map-1c550095": {
    fr: {
      name: "Training Map [Original]",
      note: "Prévue pour l'entraînement à 2 joueurs en vision partagée et les exercices de vitesse technologique, mais les effectifs annoncés se contredisent.",
    },
  },
  "map-9c448099": {
    fr: {
      name: "Iron Wars",
      note: "Iron Wars à 8 joueurs en 2v2v2v2 ou chacun-pour-soi, avec construction accélérée et population accrue.",
    },
  },
  "map-1c118095": {
    fr: {
      name: "[fiction] Traverser la Prest-Vilovas",
      note: "Scénario explicitement fictif de franchissement de rivière soviéto-allemand, avec objectifs et règles de victoire chronométrée.",
    },
  },
  "map-9c100019": {
    fr: {
      name: "Russian-Ukr War",
      note: "Carte de bataille à 2 équipes permettant d'organiser librement forces et fortifications.",
    },
  },
  "map-1c550091": {
    fr: {
      name: "Invasion",
      note: "Assaut asymétrique avec 5 attaquants, 3 défenseurs et 3 emplacements de spectateurs supplémentaires.",
    },
  },
  "map-8c118039": {
    fr: {
      name: "Alaska 8 Player FFA",
      note: "Grand chacun-pour-soi en Alaska à 8 joueurs, diplomatie activée et merveilles désactivées.",
    },
  },
  "map-8c450429": {
    fr: {
      name: "Kill for Resources, couloir étendu (KfR 7vs7)",
      note: "Bataille KfR 7v7 en couloir étendu, sans ouvriers, aux revenus issus de la destruction d'unités et de bâtiments.",
    },
  },
  "map-8c50801d": {
    fr: {
      name: "Kill for Resources, couloir des tours (KfR 5v5)",
      note: "Couloir KfR 5v5 sans ouvriers : gagnez des récompenses de kills, recrutez des troupes et détruisez le hall ennemi.",
    },
  },
  "map-1c508489": {
    fr: {
      name: "Deer Race",
      note: "Course de cerfs à 31 joueurs dans un parcours dangereux, d'après le concept Lethal Run.",
    },
  },
  "map-1c1584ac": {
    fr: {
      name: "Skull Island",
      note: "Bataille 4v4 par défaut sur l'île aux monstres : vaincre les créatures débloque les ressources nécessaires à la progression.",
    },
  },
  "map-9c4580b8": {
    fr: {
      name: "Viking Invasion",
      note: "Invasion nomade 5v5 : transformez le roi en autel, choisissez votre point de départ et gagnez des revenus de kills.",
    },
  },
  "map-1c1104bc": {
    fr: {
      name: "All War",
      note: "Bataille combinée 10v10 avec rôles technologiques/de soutien et un mod d'équilibrage dédié.",
    },
  },
  "map-0c118430": {
    fr: {
      name: "AfroEuroAsia",
      note: "Chacun-pour-soi Europe–Asie–Afrique avec 500 de population de base et une capacité accrue par les territoires.",
    },
  },
  "map-0c048424": {
    fr: {
      name: "Henry's World Map",
      note: "Entrée de carte du monde ; le post d'origine ne fournit pas de règles détaillées.",
    },
  },
  "map-0411808c": {
    fr: {
      name: "Débarquement de Normandie · bras de fer",
      note: "Bras de fer 3v3 sur le thème de la Normandie, avec IA interactive et vagues chronométrées.",
    },
  },
  "map-0c148410": {
    fr: {
      name: "Bataille des 3 forteresses",
      note: "Bataille de forteresses médiévales 10v10 avec trois fronts et des rôles défensifs distincts.",
    },
  },
  "map-04418094": {
    fr: {
      name: "Europe Map · Diplomatie",
      note: "Chacun-pour-soi européen à 16 joueurs avec diplomatie, territoires et règles de population.",
    },
  },
  "map-141180a5": {
    fr: {
      name: "Romania Map 2v2",
      note: "Bataille terrestre 2v2 sur le thème de la Roumanie, sans marine et avec 200 % de population.",
    },
  },
  "map-0c158420": {
    fr: {
      name: "Le château de la Tortue",
      note: "Combat 15v15 pour plusieurs zones de ressources, remporté en détruisant le bâtiment principal.",
    },
  },
  "map-8c00009d": {
    fr: {
      name: "Chine contre OTAN",
      note: "Débarquement insulaire fictif de guerre froide en 4v5, avec population élevée et construction accélérée.",
    },
  },
  "map-0c040025": {
    fr: {
      name: "Débarquement de Normandie",
      note: "Scénario 5v5 sur le thème de la Normandie, avec 15 ouvriers de départ et des règles accélérées.",
    },
  },
  "map-8c448418": {
    fr: {
      name: "4FFA",
      note: "Chacun-pour-soi carré à 4 joueurs, avec population et réglages de ressources par défaut.",
    },
  },
  "map-1c408009": {
    fr: {
      name: "Carte de Hongrie",
      note: "Chacun-pour-soi diplomatique à 18 joueurs sur le thème de la Hongrie, plafonné à l'Âge industriel II avec merveilles activées.",
    },
  },
  "map-9c040011": {
    fr: {
      name: "La Pologne et ses environs",
      note: "Carte à 8 départs de la Pologne et des régions voisines, avec 250 % de population.",
    },
  },
  "map-9c048499": {
    fr: {
      name: "Pleb's Giant 2v2",
      note: "Carte géante 2v2 aux ressources illimitées et vitesse de tâches à 200 %, d'après le post.",
    },
  },
  "map-0c4000a1": {
    fr: {
      name: "Biélorussie",
      note: "Carte par équipes 8v8 de la Biélorussie, est contre ouest, publiée sans mod.",
    },
  },
  "map-9c1084b4": {
    fr: {
      name: "Australie",
      note: "Carte 11v11 de l'Australie, est contre ouest, avec ajustements navals et de transport.",
    },
  },
  "map-1c108009": {
    fr: {
      name: "Feudalism Gone Wrong 2v1",
      note: "Deux roturiers affrontent un roi au royaume établi ; détruisez le temple pour l'emporter.",
    },
  },
  "map-9c40002c": {
    fr: {
      name: "Autour de la Baltique",
      note: "Chacun-pour-soi terrestre et naval à 12 joueurs en Baltique, axé sur la défense et la diplomatie.",
    },
  },
  "map-1c540034": {
    fr: {
      name: "République de Californie — match par équipes",
      note: "Carte d'équipe à 16 joueurs de la Californie, nord contre sud, avec le Nevada en hors-jeu.",
    },
  },
  "map-1c508024": {
    fr: {
      name: "L'Œil de Teky",
      note: "Grande carte 8v8 avec routes terrestres de chaque côté et champ de bataille combiné au centre.",
    },
  },
  "map-0c50048c": {
    fr: {
      name: "Jebus (HOMM 3)",
      note: "Inspiré de Jebus Cross : zones de départ pauvres et centre riche, de 2 à 4 équipes possibles.",
    },
  },
  "map-0c448034": {
    fr: {
      name: "Finlande 1940 (printemps)",
      note: "Carte printanière de l'isthme de Carélie inspirée de la guerre d'Hiver, restreinte aux nations européennes.",
    },
  },
  "map-9c508480": {
    fr: {
      name: "Jungle Team Fight",
      note: "Bataille d'équipe 4v4 dans la jungle, où il faut d'abord sécuriser le territoire.",
    },
  },
  "map-9c400018": {
    fr: {
      name: "Murica!!!",
      note: "Carte d'équipe 7v7 sur le thème des États-Unis, aux ressources distribuées et au poisson de mer abondant.",
    },
  },
  "map-9c040438": {
    fr: {
      name: "Marée basse",
      note: "Carte 5v5 en eaux peu profondes où forces terrestres et navales traversent les zones inondées.",
    },
  },
  "map-8c500430": {
    fr: {
      name: "Maple Lanes",
      note: "Grande carte 4v4 aux longs couloirs, routes de contournement centrales et longues distances de renfort.",
    },
  },
  "map-0c548010": {
    fr: {
      name: "Run Out of Iron",
      note: "Chacun-pour-soi pauvre en ressources avec gisements centraux et en coins, et faune dangereuse.",
    },
  },
  "map-0c1000b8": {
    fr: {
      name: "War Islands",
      note: "Carte d'équipe insulaire 10v10 avec passages peu profonds et routes navales à travers les points d'étranglement.",
    },
  },
  "map-0c108038": {
    fr: {
      name: "Carte 2 contre 2 de Max",
      note: "Carte de match amical à 4 joueurs, titrée 2v2 mais aussi estampillée chacun-pour-soi à 4 dans le texte.",
    },
  },
  "map-0c000030": {
    fr: {
      name: "Carte 1 contre 1 de Max",
      note: "Carte 1v1 à population standard, plafonnée à l'Âge industriel II avec merveilles activées.",
    },
  },
  "map-0c1000a0": {
    fr: {
      name: "Carte de test 3v3 d'Alastibur",
      note: "Carte communautaire visant le 3v3, avec des configurations plus petites de 1v1 jusqu'à 2v3.",
    },
  },
  "map-0c0400b8": {
    fr: {
      name: "VIP Lager (arcade 1v1, 2v2, 3v3)",
      note: "Petite carte d'arcade sans eau inspirée de Brick-force, jouable du 1v1 au 3v3.",
    },
  },
  "map-9415002d": {
    fr: {
      name: "Iron Clash Arcade",
      note: "Gameplay PVP/PVE à production rapide où la nourriture limite la croissance des armées ; les effectifs annoncés se contredisent.",
    },
  },
  "map-14158014": {
    fr: {
      name: "lil yawgs Custom Map — modification corrigée de Firco",
      note: "Adaptation à 32 joueurs par Firco d'une carte de lil yawgs, ajoutant des ressources de départ et modifiant les entrées.",
    },
  },
  "map-14410000": {
    fr: {
      name: "Carte aléatoire 5v5v5v5v5v5 — corrigée",
      note: "Carte aléatoire pour 6 équipes de 5, aux placements de départ équilibrés et au poisson central supplémentaire.",
    },
  },
  "map-14550439": {
    fr: {
      name: "Coastal Skirmish — 18 contre 18",
      note: "Bataille côtière à 36 joueurs avec unités et bâtiments supplémentaires en première ligne, axée sur la coopération terre-mer.",
    },
  },
  "map-94010485": {
    fr: {
      name: "Coastal Skirmish Plus — 23 contre 23",
      note: "Bataille côtière étendue à 46 joueurs, avec un code distinct de l'édition 18v18.",
    },
  },
  "map-0411802d": {
    fr: {
      name: "Madness of Woofs",
      note: "Carte à population illimitée plafonnée au Moyen Âge tardif, avec merveilles désactivées.",
    },
  },
  "map-845184b9": {
    fr: {
      name: "Tropical 12v12",
      note: "Carte d'équipe tropicale à 24 joueurs, à la distribution de ressources en miroir et sans tours de départ.",
    },
  },
  // ── Fiches sans titre mais avec note : note FR uniquement ────────────
  "map-90700095": {
    fr: { note: "Mention d'origine : 15 contre 15. Aucun autre détail n'a été fourni." },
  },
  "map-10640005": {
    fr: { note: "Mention d'origine : 10 contre 10. Aucun autre détail n'a été fourni." },
  },
};

function NOMOD_NOTE_FR() {
  return "Original sans mod listé à part dans la collection de Max, avec son propre code de carte.";
}

// Cohérence : les 8 « no-mod » partagent la même note EN en données.
writeFileSync(
  new URL("../lib/collection-i18n.json", import.meta.url),
  JSON.stringify(
    Object.fromEntries(
      Object.entries(T)
        .filter(([, v]) => v.fr?.name || v.fr?.note || v.en?.name || v.en?.note)
        .map(([id, v]) => [
          id,
          { en: v.en ?? undefined, fr: v.fr ?? undefined },
        ]),
    ),
    null,
    2,
  ) + "\n",
);
console.log("lib/collection-i18n.json régénéré :", Object.keys(T).length, "entrées");
