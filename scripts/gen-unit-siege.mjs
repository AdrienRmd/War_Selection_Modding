// Génération de lib/replay/unit-siege.json — liste des unités de SIÈGE
// classées par heuristique sur marqueurs PUBLICS du dataset servi
// (content/units/WarSelection/**.json). ws-stats.pl utilise un marqueur
// interne (extraType "siege") absent des données publiques ; notre
// heuristique documentée (mission 06/11) :
//
//   A. unitCategoryLand avec une arme (ou tourelle) de type ranged/turret
//      portant attackGround=true ET une portée minimale ≥ 40
//      → artillerie : catapulte, onagre, baliste, springald, canons,
//        bombards, mortiers, obusiers, lance-roquettes, Big Bertha…
//   B. unitCategoryDefBuild qui n'est PAS un bâtiment statique :
//      - `movement` + arme de mêlée → bélier (ram) ;
//      - tourelle attackGround=true ET portée minimale ≥ 100
//        → trébuchet, canon en position, canon blindé, Kolossal…
//        (écart documenté : le Pillbox défensif, tourelle à frappe au sol
//        de portée min 450, tombe aussi ici alors que ws-stats le classe
//        bâtiment).
//
// Hors périmètre volontaire : unitCategoryAir / Fleet / Worker (les
// bombardiers restent Avions, les navires de siège restent Navires, les
// travailleurs sont comptés à part), décor et faune, ET le tag
// « Heavy vehicle » (unitTag#34 — chars/APC : groupe Blindés, même quand
// leur canon frappe au sol).
//
// Écarts documentés vs ws-stats.pl (marqueur interne non public) : le
// Pillbox défensif, les tours d'artillerie (tower_cannon, seafort, tour
// tutu) et la moto lance-grenades suivent la règle « frappe au sol » et
// tombent en Siège, alors que ws-stats les classe bâtiment/autre.
//
// Usage : node scripts/gen-unit-siege.mjs [racine-du-contenu-servi]
// Le fichier généré est COMMITTÉ — relancer après chaque mise à jour du
// dataset (cf. scripts/gen-unit-supply.mjs, même convention).
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] ?? "/home/ubuntu/War-Selection/datasets/served/content";
const unitsRoot = join(root, "units", "WarSelection");
const out = new URL("../lib/replay/unit-siege.json", import.meta.url);

const EXCLUDED_CATEGORIES = new Set([
  "unitCategoryAir",
  "unitCategoryFleet",
  "unitCategoryWorker",
  "unitCategoryOther",
]);

const weaponsOf = (unit) => {
  const list = [...(unit.weapons ?? [])];
  for (const turret of unit.turrets ?? []) list.push(...(turret.weapons ?? []));
  return list;
};

const isRangedOrTurret = (w) => w.weaponType === "weaponTypeRange" || w.weaponType === "weaponTypeTurret";

const siege = [];
let scanned = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    if (!name.endsWith(".json")) continue;
    scanned += 1;
    let unit;
    try {
      unit = JSON.parse(readFileSync(p, "utf8"));
    } catch {
      continue;
    }
    if (typeof unit.gameId !== "string" || !unit.gameId.startsWith("WarSelection/")) continue;
    if (EXCLUDED_CATEGORIES.has(unit.category)) continue;
    // Chars et véhicules blindés (tag Heavy vehicle #34) → groupe Blindés.
    const isHeavyVehicle = (unit.tags ?? []).some((t) => t.name === "<*unitTag#34>");
    if (isHeavyVehicle) continue;
    const weapons = weaponsOf(unit);
    const groundArtillery = weapons.some(
      (w) => isRangedOrTurret(w) && w.attackGround === true && (w.distance?.min ?? 0) >= 40,
    );
    const mobileEngine = "movement" in unit && weapons.some((w) => w.weaponType === "weaponTypeMelee");
    const positionalEngine = weapons.some(
      (w) => w.weaponType === "weaponTypeTurret" && w.attackGround === true && (w.distance?.min ?? 0) >= 100,
    );
    if (unit.category === "unitCategoryLand" && groundArtillery) {
      siege.push(unit.gameId);
    } else if (unit.category === "unitCategoryDefBuild" && (mobileEngine || positionalEngine)) {
      siege.push(unit.gameId);
    }
  }
}

walk(unitsRoot);
const sorted = [...new Set(siege)].sort();
writeFileSync(
  out,
  JSON.stringify({
    _source:
      "généré par scripts/gen-unit-siege.mjs (heuristique attackGround/portée minimale sur le dataset public) — ids de fiche sans préfixe WarSelection/",
    _generatedAt: new Date().toISOString().slice(0, 10),
    units: sorted.map((g) => g.replace(/^WarSelection\//, "")),
  }) + "\n",
);
console.log(`unit-siege: ${sorted.length}/${scanned} unités classées siège → lib/replay/unit-siege.json`);
