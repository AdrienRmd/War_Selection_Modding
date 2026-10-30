// Génère public/simple-catalog.json (+ .gz) pour le mode simple de l'atelier
// mods (/workbench/simple) à partir du dataset wus-data publié (lecture seule).
//
// Sources (jamais de valeur de jeu codée en dur — tout est lu ci-dessous) :
//   - content/docs/tree/gameplay.root.unitType.<slot>.json : 423 slots, chaque
//     nœud porte `address` (identifiant de fiche) ; valeurs brutes du jeu.
//   - content/docs/tree/gameplay.root.build.json : coûts de construction par
//     Build ID (initCost/buildCost/healthInit), champ `unit` = slot.
//   - lib/units-index.json : noms localisés officiels (fiches), ressources,
//     métadonnées du dataset (gameVersion…).
//   - lib/researches-index.json : noms localisés des recherches (entité upgrade
//     des travaux), par gameId.
//
// Le format de sortie est directement consommable par le moteur d'export v6
// (lib/mod-export.mjs generateGameplayLua) : champs avec path/raw/scale/min/max,
// gardes de production, portées d'armes pour la validation min ≤ max < stop.
import fs from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const servedDir = process.env.WUS_SERVED_DIR ?? "/home/ubuntu/War-Selection/datasets/served";
const unitsIndex = JSON.parse(fs.readFileSync(path.join(root, "lib/units-index.json"), "utf8"));
const researchesIndex = JSON.parse(
  fs.readFileSync(path.join(root, "lib/researches-index.json"), "utf8"),
);
const updatedAt = JSON.parse(fs.readFileSync(path.join(servedDir, "updated-at.json"), "utf8"));

// --- Lecture des arbres du dataset -------------------------------------------------
const num = (v) => (v === undefined || v === null ? undefined : Number(v));
const bool = (v) => (v === "true" ? true : v === "false" ? false : undefined);
/** Trouve un enfant direct ; renvoie le nœud (avec .v/.ch) ou undefined. */
const child = (nodes, key) => (nodes || []).find((n) => n.k === key);
const value = (nodes, key) => {
  const n = child(nodes, key);
  if (!n) return undefined;
  if (n.tp === "num") return num(n.v);
  if (n.tp === "bool") return bool(n.v);
  return n.v;
};
/** Enfants indexés d'un conteneur (skips f_* / size). */
const indexed = (nodes, key) => {
  const c = child(nodes, key);
  if (!c || !c.ch) return [];
  return c.ch
    .filter((n) => /^\d+$/.test(n.k))
    .map((n) => ({ id: Number(n.k), ch: n.ch || [] }));
};

// --- Localisation des noms (fiches unités / recherches) ---------------------------
const pickName = (names = {}) => names.cn || names.tw || names.en || "";
const pickNameFr = (names = {}) => names.fr || names.en || "";
const unitsById = new Map(unitsIndex.units.map((u) => [u.id, u]));
const researchByGameId = new Map(
  (researchesIndex.researches || []).map((r) => [r.gameId, r]),
);

// --- Libellés de ressources (officiels, depuis l'index) ---------------------------
const resources = Object.entries(unitsIndex.resources || {})
  .map(([id, names]) => ({
    id: Number(id),
    zh: pickName(names),
    en: names.en || String(id),
    fr: pickNameFr(names),
  }))
  .sort((a, b) => a.id - b.id);
const resourceLabel = (id, lang) => {
  const r = resources.find((x) => x.id === id);
  return r ? r[lang] : `#${id}`;
};

// --- Étiquettes de tags de dégâts (officielles quand présentes) -------------------
const officialTags = unitsIndex.tags || {};
const tagNames = (tag) => {
  const official = officialTags[`<*unitTag#${tag}>`];
  if (official)
    return {
      zh: pickName(official),
      en: official.en || `tag ${tag}`,
      fr: pickNameFr(official),
    };
  const legacy = {
    0: { zh: "基础伤害", en: "Base damage", fr: "Dégâts de base" },
    2: { zh: "建筑", en: "Building", fr: "Bâtiment" },
    5: { zh: "市政厅", en: "Town hall", fr: "Hôtel de ville" },
    8: { zh: "可拆卸", en: "Dismantlable", fr: "Démontable" },
    23: { zh: "火焰伤害", en: "Fire damage", fr: "Dégâts de feu" },
    24: { zh: "活体", en: "Living", fr: "Vivant" },
    25: { zh: "骑士", en: "Knight", fr: "Chevalier" },
  }[tag];
  return legacy || { zh: `标签 ${tag}`, en: `Tag ${tag}`, fr: `Tag ${tag}` };
};

// --- Ajout de champs ---------------------------------------------------------------
const zhResource = (id) => resourceLabel(id, "zh");
const enResource = (id) => resourceLabel(id, "en");
const frResource = (id) => resourceLabel(id, "fr");

/** Construit un champ compatible moteur v6 + libellés ×3 langues. */
function makeField(unit, def, raw, extra = {}) {
  if (raw === undefined || raw === null || (typeof raw === "number" && !Number.isFinite(raw)))
    return null;
  const isBool = typeof raw === "boolean";
  const rawNum = isBool ? Number(raw) : raw;
  const value = def.scale === 1 ? rawNum : rawNum / def.scale;
  // L'aide est soit un triple {zh,en,fr} direct, soit les trois propriétés.
  const helpTriple =
    def.help && typeof def.help === "object"
      ? def.help
      : { zh: def.help, en: def.helpEn, fr: def.helpFr };
  const f = {
    key: def.key,
    group: def.group,
    label: def.label(rawNum, value),
    labelEn: def.labelEn(rawNum, value),
    labelFr: def.labelFr(rawNum, value),
    help: helpTriple.zh,
    helpEn: helpTriple.en,
    helpFr: helpTriple.fr,
    path: `${def.prefix}${def.suffix}`,
    raw: rawNum,
    scale: def.scale,
    value,
    min: 0,
    max: 1000000,
    step: 1 / def.scale,
    kind: isBool ? "boolean" : "number",
    ...def.extra,
    ...extra,
  };
  f.min = Math.min(f.min, value);
  f.max = Math.max(f.max, value);
  return f;
}

const HELP = {
  health: {
    zh: "提高最大生命值；已受伤的旧单位不会自动补满，用新生产的单位测试。",
    en: "Raises maximum health; already-damaged units are not healed retroactively. Test with newly produced units.",
    fr: "Augmente les points de vie maximum ; les unités déjà blessées ne sont pas soignées rétroactivement. Testez avec des unités neuves.",
  },
  view: {
    zh: "提高可揭开战争迷雾的范围，不会提高武器射程。",
    en: "Extends vision through fog of war, not weapon range.",
    fr: "Élargit le champ de vision (brouillard de guerre), pas la portée des armes.",
  },
  speed: {
    zh: "提高普通移动速度；冲锋、转向和动画速度不变。",
    en: "Raises normal movement speed; charge, turning and animations stay unchanged.",
    fr: "Augmente la vitesse de déplacement normale ; charge, rotation et animations restent inchangées.",
  },
  reload: {
    zh: "数值越小攻击越频繁；连发、动画与装填都影响实际周期，不能只用伤害÷间隔算DPS。",
    en: "Lower values attack more often. Bursts, animation and reload all affect the real cycle; damage ÷ interval is not full DPS.",
    fr: "Plus petit = attaques plus fréquentes. Rafales, animation et rechargement influent sur le cycle réel ; dégâts ÷ intervalle ne donne pas le DPS complet.",
  },
  rangeMax: {
    zh: "攻击距离：最小 ≤ 最大 < 停止。加大后可在更远处开火。",
    en: "Attack distance: min ≤ max < stop. Higher values open fire from farther away.",
    fr: "Distance d'attaque : min ≤ max < arrêt. Plus grand = ouvre le feu de plus loin.",
  },
  rangeMin: {
    zh: "最小开火距离；目标更近时无法用该武器攻击。",
    en: "Minimum firing distance; closer targets cannot be attacked by this weapon.",
    fr: "Distance de tir minimale ; les cibles plus proches ne peuvent pas être attaquées par cette arme.",
  },
  rangeStop: {
    zh: "已交战目标的保持距离；超过后停止追击射击。",
    en: "Distance kept on an engaged target; beyond it the unit stops shooting.",
    fr: "Distance maintenue sur une cible engagée ; au-delà, l'unité cesse de tirer.",
  },
  damage: {
    zh: "改变对该类目标的伤害数值；不赋予新的对空/对潜能力，最终伤害还受护甲影响。",
    en: "Changes damage against this target class; does not grant new anti-air/anti-sub capability, final damage still depends on armor.",
    fr: "Modifie les dégâts contre cette classe de cibles ; n'ajoute pas de capacité anti-aérienne/anti-sous-marine, les dégâts finaux dépendent de l'armure.",
  },
  armor: {
    zh: "提高该命中区域的护甲厚度；其他区域不变，穿甲与伤害类型影响减伤。",
    en: "Raises armor thickness of this hit zone only; penetration and damage type affect reduction.",
    fr: "Augmente l'épaisseur d'armure de cette zone de touche uniquement ; la pénétration et le type de dégâts influent sur la réduction.",
  },
  time: {
    zh: "数值越小完成越快；降价不会自动解锁科技或按钮。",
    en: "Lower values finish sooner; cheaper costs do not unlock research or buttons.",
    fr: "Plus petit = achèvement plus rapide ; un coût réduit ne débloque ni recherche ni bouton.",
  },
  costWork: {
    zh: "修改该阶段支付的资源；下单、开工和生产过程是不同阶段，不要重复计算。",
    en: "Changes resources paid in this phase. Order, start and process are separate stages; do not double-count.",
    fr: "Modifie les ressources payées à cette étape. Commande, démarrage et production sont des étapes distinctes ; ne comptez pas deux fois.",
  },
  costBuild: {
    zh: "总造价 = 地基费用 + 施工费用；按 Build ID 写入所有现有阵营的建造表。",
    en: "Total cost = foundation + construction; written by Build ID to every existing faction build table.",
    fr: "Coût total = fondations + construction ; écrit par Build ID dans la table de construction de chaque faction existante.",
  },
  storage: {
    zh: "1× = 100%：2× 时交入 10 资源记为 20。采集动作本身不变快。",
    en: "1× = 100%: at 2×, depositing 10 resources credits 20. Gathering itself is not faster.",
    fr: "1× = 100 % : à 2×, déposer 10 ressources en crédite 20. La récolte elle-même n'est pas accélérée.",
  },
  population: {
    zh: "每个单位占用的人口；降低会增加单位总数与后期负担。",
    en: "Population used per unit; lowering it raises unit counts and late-game load.",
    fr: "Population occupée par unité ; la baisse augmente le nombre d'unités et la charge de fin de partie.",
  },
  populationProvided: {
    zh: "该类型提供的人口空间；不是阵营总人口上限。",
    en: "Population capacity supplied by this type; not the faction-wide cap.",
    fr: "Population fournie par ce type ; ce n'est pas le plafond global de la faction.",
  },
  gatherBag: {
    zh: "提高可减少往返次数；不提高每次采集速度。",
    en: "Higher capacity means fewer deposit trips, not a faster gathering rate.",
    fr: "Plus grande = moins d'allers-retours ; la vitesse de récolte reste la même.",
  },
  gatherRate: {
    zh: "提高资源采集速度；实际收入还受走路与交资源倍率影响。",
    en: "Faster extraction; travel time and the deposit multiplier still affect real income.",
    fr: "Récolte plus rapide ; le temps de trajet et le multiplicateur de dépôt restent déterminants.",
  },
  repair: {
    zh: "提高主动治疗/维修速度；目标标签与费用仍生效。",
    en: "Faster active healing or repair; target tags and costs still apply.",
    fr: "Soin/réparation active plus rapide ; tags de cible et coûts restent applicables.",
  },
  work: {
    zh: "该队列项的参数；由生产者的 Work ID 定位，改动只影响这一项。",
    en: "Parameters of this queue entry, located by the producer's Work ID; only this entry changes.",
    fr: "Paramètres de cette entrée de file, repérée par le Work ID du producteur ; seule cette entrée change.",
  },
};

// --- Extraction des champs d'un slot ----------------------------------------------
function fieldsForSlot(slot, treeNodes, unitEntry, buildEntries, bySlot) {
  const fields = [];
  const weapons = [];
  const prefix = `root.unitType[${slot}]`;
  const push = (def, raw, extra) => {
    const f = makeField(unitEntry, def, raw, extra);
    if (f && !fields.some((x) => x.key === f.key)) fields.push(f);
    return f;
  };

  // Combat — caractéristiques
  const death = child(treeNodes, "deathability")?.ch || [];
  push(
    {
      key: "health",
      group: "combat",
      prefix,
      suffix: ".deathability.health",
      scale: 1000,
      label: () => "生命值",
      labelEn: () => "Health",
      labelFr: () => "Points de vie",
      help: HELP.health.zh,
      helpEn: HELP.health.en,
      helpFr: HELP.health.fr,
      extra: { min: 1 },
    },
    value(death, "health"),
  );
  push(
    {
      key: "view",
      group: "combat",
      prefix,
      suffix: ".viewRange",
      scale: 1000,
      label: () => "视野",
      labelEn: () => "Vision",
      labelFr: () => "Champ de vision",
      help: HELP.view.zh,
      helpEn: HELP.view.en,
      helpFr: HELP.view.fr,
      extra: { max: 10000 },
    },
    value(treeNodes, "viewRange"),
  );
  push(
    {
      key: "regeneration",
      group: "combat",
      prefix,
      suffix: ".deathability.regeneration",
      scale: 50,
      label: () => "自动回血（HP/秒）",
      labelEn: () => "Regeneration (HP/s)",
      labelFr: () => "Régénération (PV/s)",
      help: HELP.health.zh,
      helpEn: HELP.health.en,
      helpFr: HELP.health.fr,
    },
    value(death, "regeneration"),
  );
  push(
    {
      key: "threat",
      group: "combat",
      prefix,
      suffix: ".deathability.attackThreat",
      scale: 1,
      label: () => "威胁值",
      labelEn: () => "Threat",
      labelFr: () => "Menace",
      help: {
        zh: "影响敌方选择攻击目标的倾向，不是伤害加成。",
        en: "Influences enemy targeting priority; not a damage bonus.",
        fr: "Influence la priorité de ciblage ennemie ; ce n'est pas un bonus de dégâts.",
      },
      extra: { max: 65535, advanced: true },
    },
    value(death, "attackThreat"),
  );

  // Combat — mouvement
  const movement = child(treeNodes, "movement");
  const mch = movement?.ch || [];
  if (value(mch, "enabled") !== false) {
    push(
      {
        key: "speed",
        group: "combat",
        prefix,
        suffix: ".movement.moveSpeed",
        scale: 16,
        label: () => "移动速度",
        labelEn: () => "Movement speed",
        labelFr: () => "Vitesse de déplacement",
        help: HELP.speed.zh,
        helpEn: HELP.speed.en,
        helpFr: HELP.speed.fr,
        extra: { max: 1000 },
      },
      value(mch, "moveSpeed"),
    );
    push(
      {
        key: "rotation",
        group: "combat",
        prefix,
        suffix: ".movement.rotationSpeed",
        scale: 1,
        label: () => "转向速度（原始值）",
        labelEn: () => "Turn speed (raw)",
        labelFr: () => "Vitesse de rotation (brute)",
        help: {
          zh: "角度编码随游戏版本变化，保留原始值，勿直接输入角度。",
          en: "Angle encoding changed across versions; enter raw values, not degrees.",
          fr: "L'encodage des angles change selon les versions ; saisissez la valeur brute, pas des degrés.",
        },
        extra: { max: 4294967295, advanced: true },
      },
      value(mch, "rotationSpeed"),
    );
    // Aviation (avancé)
    const air = child(mch, "airplane")?.ch || [];
    push(
      {
        key: "fuel",
        group: "combat",
        prefix,
        suffix: ".movement.airplane.fuel",
        scale: 1000,
        label: () => "燃油续航（秒）",
        labelEn: () => "Fuel endurance (s)",
        labelFr: () => "Autonomie de carburant (s)",
        help: {
          zh: "增加空中续航；不改变加油速度。",
          en: "Longer flight endurance; refueling speed unchanged.",
          fr: "Plus longue autonomie de vol ; la vitesse de ravitaillement ne change pas.",
        },
        extra: { max: 86400, min: 1, advanced: true },
      },
      value(air, "fuel"),
    );
    const aerodrome = child(air, "aerodrome")?.ch || [];
    push(
      {
        key: "refuel",
        group: "combat",
        prefix,
        suffix: ".movement.airplane.aerodrome.refuelingSpeed",
        scale: 1,
        label: () => "加油速度（原始值）",
        labelEn: () => "Refueling rate (raw)",
        labelFr: () => "Vitesse de ravitaillement (brute)",
        help: {
          zh: "减半通常约需两倍加油时间；返航与停靠另计。",
          en: "Halving usually doubles refueling time; return flight and docking add more.",
          fr: "Diviser par deux double environ le temps de ravitaillement ; retour et amarrage s'ajoutent.",
        },
        extra: { max: 100000, min: 1, advanced: true },
      },
      value(aerodrome, "refuelingSpeed"),
    );
    push(
      {
        key: "air-heal",
        group: "combat",
        prefix,
        suffix: ".movement.airplane.aerodrome.healingSpeed",
        scale: 50,
        label: () => "机场维修速度（HP/秒）",
        labelEn: () => "Airfield repair (HP/s)",
        labelFr: () => "Réparation à l'aérodrome (PV/s)",
        help: {
          zh: "提高飞机在机场的维修速度，不影响其他修理单位。",
          en: "Faster aircraft repair at airfields; other repair units unchanged.",
          fr: "Réparation des avions plus rapide sur les aérodromes ; les autres unités de réparation ne changent pas.",
        },
        extra: { advanced: true },
      },
      value(aerodrome, "healingSpeed"),
    );
    // Vitesse de construction par le worker (avancé)
    for (const b of indexed(mch, "building")) {
      const target = value(b.ch, "unit");
      const targetName = bySlot.get(target);
      push(
        {
          key: `builder-${b.id}`,
          group: "construction",
          prefix,
          suffix: `.movement.building[${b.id}].tickProgress`,
          scale: 1,
          label: () => `建造速度 · ${targetName ? targetName.zh : "#" + target}`,
          labelEn: () => `Build speed · ${targetName ? targetName.en : "#" + target}`,
          labelFr: () => `Vitesse de construction · ${targetName ? targetName.fr : "#" + target}`,
          help: {
            zh: "提高该工人建造此建筑的速度；不是建筑的造价。",
            en: "The worker builds this building faster; this is not the building's cost.",
            fr: "L'ouvrier construit ce bâtiment plus vite ; ce n'est pas son coût.",
          },
          extra: {
            min: 1,
            max: 10000000,
            advanced: true,
            buildWorkerGuard: { unitId: target, index: b.id },
          },
        },
        value(b.ch, "tickProgress"),
      );
    }
    // Économie — récolte
    for (const g of indexed(mch, "gather")) {
      const rid = value(g.ch, "resource");
      push(
        {
          key: `gather-${g.id}-bag`,
          group: "economy",
          prefix,
          suffix: `.movement.gather[${g.id}].bagSize`,
          scale: 1000,
          label: () => `携带量 · ${zhResource(rid)}`,
          labelEn: () => `Carry capacity · ${enResource(rid)}`,
          labelFr: () => `Capacité de transport · ${frResource(rid)}`,
          help: HELP.gatherBag.zh,
          helpEn: HELP.gatherBag.en,
          helpFr: HELP.gatherBag.fr,
          extra: { max: 100000 },
        },
        value(g.ch, "bagSize"),
      );
      push(
        {
          key: `gather-${g.id}-rate`,
          group: "economy",
          prefix,
          suffix: `.movement.gather[${g.id}].perTick`,
          scale: 50,
          label: () => `采集速率 · ${zhResource(rid)}（资源/秒）`,
          labelEn: () => `Gather rate · ${enResource(rid)} (resource/s)`,
          labelFr: () => `Vitesse de récolte · ${frResource(rid)} (ressource/s)`,
          help: HELP.gatherRate.zh,
          helpEn: HELP.gatherRate.en,
          helpFr: HELP.gatherRate.fr,
          extra: { max: 100000 },
        },
        value(g.ch, "perTick"),
      );
      push(
        {
          key: `gather-${g.id}-distance`,
          group: "economy",
          prefix,
          suffix: `.movement.gather[${g.id}].gatherDistance`,
          scale: 1000,
          label: () => `采集距离 · ${zhResource(rid)}`,
          labelEn: () => `Gather distance · ${enResource(rid)}`,
          labelFr: () => `Distance de récolte · ${frResource(rid)}`,
          help: {
            zh: "增大可在更远处采集；过大容易改变地图玩法。",
            en: "Allows gathering farther away; large values can change map balance.",
            fr: "Permet de récolter plus loin ; de grandes valeurs bouleversent l'équilibre de la carte.",
          },
          extra: { max: 1000, advanced: true },
        },
        value(g.ch, "gatherDistance"),
      );
      push(
        {
          key: `gather-${g.id}-deposit`,
          group: "economy",
          prefix,
          suffix: `.movement.gather[${g.id}].putDistance`,
          scale: 1000,
          label: () => `交资源距离 · ${zhResource(rid)}`,
          labelEn: () => `Deposit distance · ${enResource(rid)}`,
          labelFr: () => `Distance de dépôt · ${frResource(rid)}`,
          help: {
            zh: "增大可缩短交资源所需的移动距离。",
            en: "Larger distances reduce movement needed to deposit.",
            fr: "Une distance plus grande réduit les déplacements pour déposer.",
          },
          extra: { max: 1000, advanced: true },
        },
        value(g.ch, "putDistance"),
      );
    }
  }

  // Combat — armure zonale
  const armor = child(death, "armor")?.ch || [];
  for (const z of indexed(armor, "zonal")) {
    const obj = child(z.ch, "object")?.ch || [];
    push(
      {
        key: `armor-${z.id}`,
        group: "combat",
        prefix,
        suffix: `.deathability.armor.zonal[${z.id}].object.thickness`,
        scale: 1000,
        label: () => `装甲区 ${z.id} 厚度`,
        labelEn: () => `Armor zone ${z.id} thickness`,
        labelFr: () => `Épaisseur d'armure · zone ${z.id}`,
        help: HELP.armor.zh,
        helpEn: HELP.armor.en,
        helpFr: HELP.armor.fr,
        extra: {},
      },
      value(obj, "thickness"),
    );
    if (!fields.at(-1)?.raw) fields.at(-1).advanced = true; // zone sans armure : champ exotique
  }

  // Combat — armes (plates et sur tourelles)
  const attack = child(treeNodes, "attack");
  const ach = attack?.ch || [];
  const weaponDefs = [];
  if (value(ach, "enabled") !== false) {
    for (const w of indexed(ach, "weapon"))
      weaponDefs.push({ turret: null, weapon: w.id, ch: w.ch, key: `weapon-${w.id}` });
    for (const t of indexed(ach, "turret"))
      for (const w of indexed(t.ch, "weapon"))
        weaponDefs.push({
          turret: t.id,
          weapon: w.id,
          ch: w.ch,
          key: `turret-${t.id}-weapon-${w.id}`,
        });
  }
  for (const wd of weaponDefs) {
    const wpath = wd.turret === null
      ? `${prefix}.attack.weapon[${wd.weapon}]`
      : `${prefix}.attack.turret[${wd.turret}].weapon[${wd.weapon}]`;
    const wfields = [];
    const addW = (def, raw, extra = {}) => {
      const f = push({ ...def, prefix: wpath }, raw, extra);
      if (f) wfields.push(f.key);
      return f;
    };
    addW(
      {
        key: `${wd.key}-reload`,
        group: "combat",
        suffix: ".rechargePeriod",
        scale: 1000,
        label: () => `武器 ${wd.weapon} · 攻击间隔（秒）${wd.turret !== null ? `（炮塔 ${wd.turret}）` : ""}`,
        labelEn: () => `Weapon ${wd.weapon} · attack interval (s)${wd.turret !== null ? ` (turret ${wd.turret})` : ""}`,
        labelFr: () => `Arme ${wd.weapon} · intervalle d'attaque (s)${wd.turret !== null ? ` (tourelle ${wd.turret})` : ""}`,
        help: HELP.reload.zh,
        helpEn: HELP.reload.en,
        helpFr: HELP.reload.fr,
        extra: { min: 0.05, max: 86400 },
      },
      value(wd.ch, "rechargePeriod"),
    );
    const dMin = value(wd.ch, "distanceMin");
    const dMax = value(wd.ch, "distanceMax");
    const dStop = value(wd.ch, "distanceStop");
    addW(
      {
        key: `${wd.key}-range-max`,
        group: "combat",
        suffix: ".distanceMax",
        scale: 1000,
        label: () => `武器 ${wd.weapon} · 射程`,
        labelEn: () => `Weapon ${wd.weapon} · range`,
        labelFr: () => `Arme ${wd.weapon} · portée`,
        help: HELP.rangeMax.zh,
        helpEn: HELP.rangeMax.en,
        helpFr: HELP.rangeMax.fr,
        extra: { max: 10000 },
      },
      dMax,
    );
    addW(
      {
        key: `${wd.key}-range-min`,
        group: "combat",
        suffix: ".distanceMin",
        scale: 1000,
        label: () => `武器 ${wd.weapon} · 最小射程`,
        labelEn: () => `Weapon ${wd.weapon} · min range`,
        labelFr: () => `Arme ${wd.weapon} · portée min.`,
        help: HELP.rangeMin.zh,
        helpEn: HELP.rangeMin.en,
        helpFr: HELP.rangeMin.fr,
        extra: { max: 10000, advanced: true },
      },
      dMin,
    );
    addW(
      {
        key: `${wd.key}-range-stop`,
        group: "combat",
        suffix: ".distanceStop",
        scale: 1000,
        label: () => `武器 ${wd.weapon} · 停止攻击距离`,
        labelEn: () => `Weapon ${wd.weapon} · stop distance`,
        labelFr: () => `Arme ${wd.weapon} · distance d'arrêt`,
        help: HELP.rangeStop.zh,
        helpEn: HELP.rangeStop.en,
        helpFr: HELP.rangeStop.fr,
        extra: { max: 10000, advanced: true },
      },
      dStop,
    );
    addW(
      {
        key: `${wd.key}-spread`,
        group: "combat",
        suffix: ".spread",
        scale: 10,
        label: () => `武器 ${wd.weapon} · 散布（%）`,
        labelEn: () => `Weapon ${wd.weapon} · spread (%)`,
        labelFr: () => `Arme ${wd.weapon} · dispersion (%)`,
        help: {
          zh: "降低可让弹着更集中；这不是命中率。",
          en: "Lower spread concentrates shots; this is not hit probability.",
          fr: "Une dispersion plus faible concentre les tirs ; ce n'est pas une probabilité de toucher.",
        },
        extra: { max: 100, advanced: true },
      },
      value(wd.ch, "spread"),
    );
    addW(
      {
        key: `${wd.key}-shots`,
        group: "combat",
        suffix: ".attacksPerPoint",
        scale: 1,
        label: () => `武器 ${wd.weapon} · 每发射点攻击次数`,
        labelEn: () => `Weapon ${wd.weapon} · attacks per firing point`,
        labelFr: () => `Arme ${wd.weapon} · attaques par point de tir`,
        help: {
          zh: "每个动画发射点重复攻击的次数；会明显增加输出与弹丸负担。",
          en: "Attacks repeated at each animation firing point; clearly raises damage and projectile load.",
          fr: "Attaques répétées à chaque point de tir animé ; augmente nettement dégâts et charge en projectiles.",
        },
        extra: { min: 1, max: 100, advanced: true },
      },
      value(wd.ch, "attacksPerPoint"),
    );
    const damage = child(wd.ch, "damage");
    const dch = damage?.ch || [];
    addW(
      {
        key: `${wd.key}-splash`,
        group: "combat",
        suffix: ".damage.radius",
        scale: 1000,
        label: () => `武器 ${wd.weapon} · 范围伤害半径`,
        labelEn: () => `Weapon ${wd.weapon} · area damage radius`,
        labelFr: () => `Arme ${wd.weapon} · rayon de dégâts de zone`,
        help: {
          zh: "扩大原有范围伤害区域；不会把单体攻击变成范围攻击。",
          en: "Widens an existing area-damage radius; does not turn single-target attacks into area attacks.",
          fr: "Élargit un rayon de dégâts de zone existant ; ne transforme pas une attaque ciblée en attaque de zone.",
        },
        extra: { max: 1000, advanced: true },
      },
      value(dch, "radius"),
    );
    for (const tagNode of (child(dch, "damages")?.ch || []).filter((n) => /^\d+$/.test(n.k))) {
      const tag = Number(tagNode.k);
      const tagRaw = num(tagNode.v);
      const names = tagNames(tag);
      const nonzero = tagRaw > 0;
      addW(
        {
          key: `${wd.key}-damage-${tag}`,
          group: "combat",
          suffix: `.damage.damages[${tag}]`,
          scale: 1000,
          label: () => `武器 ${wd.weapon} · 伤害 · ${names.zh}`,
          labelEn: () => `Weapon ${wd.weapon} · damage · ${names.en}`,
          labelFr: () => `Arme ${wd.weapon} · dégâts · ${names.fr}`,
          help: HELP.damage.zh,
          helpEn: HELP.damage.en,
          helpFr: HELP.damage.fr,
          extra: { advanced: !nonzero },
        },
        tagRaw,
      );
    }
    weapons.push({
      key: wd.key,
      fields: wfields,
      rangeMin: dMin === undefined ? null : dMin / 1000,
      rangeMax: dMax === undefined ? null : dMax / 1000,
      rangeStop: dStop === undefined ? null : dStop / 1000,
    });
  }

  // Économie — stockage, population
  push(
    {
      key: "storage",
      group: "economy",
      prefix,
      suffix: ".storageMultiplier",
      scale: 65536,
      label: () => "交资源倍率",
      labelEn: () => "Deposit multiplier",
      labelFr: () => "Multiplicateur de dépôt",
      help: HELP.storage.zh,
      helpEn: HELP.storage.en,
      helpFr: HELP.storage.fr,
      extra: { max: 20, min: 0, round: true, step: 0.1 },
    },
    (() => {
      const v = value(treeNodes, "storageMultiplier");
      return v > 0 ? v : undefined;
    })(),
  );
  const supply = child(treeNodes, "supply")?.ch || [];
  if (value(supply, "enabled") !== false) {
    push(
      {
        key: "population",
        group: "economy",
        prefix,
        suffix: ".supply.cost",
        scale: 10,
        label: () => "人口占用",
        labelEn: () => "Population cost",
        labelFr: () => "Population occupée",
        help: HELP.population.zh,
        helpEn: HELP.population.en,
        helpFr: HELP.population.fr,
        extra: { max: 10000 },
      },
      value(supply, "cost"),
    );
    push(
      {
        key: "population-provided",
        group: "economy",
        prefix,
        suffix: ".supply.takes",
        scale: 10,
        label: () => "提供人口",
        labelEn: () => "Population provided",
        labelFr: () => "Population fournie",
        help: HELP.populationProvided.zh,
        helpEn: HELP.populationProvided.en,
        helpFr: HELP.populationProvided.fr,
        extra: { max: 10000 },
      },
      value(supply, "takes"),
    );
  }

  // Économie — soin/réparation
  const heal = child(treeNodes, "heal");
  if (heal && value(heal.ch, "enabled") !== false) {
    push(
      {
        key: "repair-rate",
        group: "economy",
        prefix,
        suffix: ".heal.perTick",
        scale: 50,
        label: () => "治疗/维修速度（HP/秒）",
        labelEn: () => "Heal / repair rate (HP/s)",
        labelFr: () => "Vitesse de soin / réparation (PV/s)",
        help: HELP.repair.zh,
        helpEn: HELP.repair.en,
        helpFr: HELP.repair.fr,
      },
      value(heal.ch, "perTick"),
    );
    push(
      {
        key: "repair-range",
        group: "economy",
        prefix,
        suffix: ".heal.distance",
        scale: 1000,
        label: () => "治疗/维修距离",
        labelEn: () => "Heal / repair range",
        labelFr: () => "Portée de soin / réparation",
        help: {
          zh: "增大可在更远处进行原有治疗/维修。",
          en: "Allows existing healing or repair actions at longer range.",
          fr: "Permet le soin ou la réparation existant à plus grande distance.",
        },
        extra: { max: 1000, advanced: true },
      },
      value(heal.ch, "distance"),
    );
  }
  // Économie — paramètre de coût de réparation (avancé)
  const healMeCost = child(death, "healMeCost")?.ch || [];
  for (const c of healMeCost.filter((n) => /^\d+$/.test(n.k))) {
    const rid = Number(c.k);
    push(
      {
        key: `repair-cost-${rid}`,
        group: "economy",
        prefix,
        suffix: `.deathability.healMeCost[${rid}]`,
        scale: 1000,
        label: () => `维修费用 · ${zhResource(rid)}`,
        labelEn: () => `Repair cost · ${enResource(rid)}`,
        labelFr: () => `Coût de réparation · ${frResource(rid)}`,
        help: {
          zh: "影响修复该单位的资源消耗，不是新建造价。",
          en: "Affects resource consumption for repairs, not new construction cost.",
          fr: "Concerne la consommation de ressources pour réparer, pas le coût de construction.",
        },
        extra: { advanced: true },
      },
      num(c.v),
    );
  }
  // Économie — revenu passif (avancé)
  const income = child(treeNodes, "income");
  if (income && value(income.ch, "enabled") !== false) {
    push(
      {
        key: "income-period",
        group: "economy",
        prefix,
        suffix: ".income.period",
        scale: 1000,
        label: () => "被动收入间隔（秒）",
        labelEn: () => "Passive income interval (s)",
        labelFr: () => "Intervalle de revenu passif (s)",
        help: {
          zh: "间隔越短收入触发越频繁；仅适用于原版已有收入组件的单位。",
          en: "Shorter intervals pay more often; only for units with an existing income component.",
          fr: "Un intervalle plus court paie plus souvent ; uniquement pour les unités ayant déjà un composant de revenu.",
        },
        extra: { min: 0.05, max: 86400, advanced: true },
      },
      value(income.ch, "period"),
    );
    const incomeValues = child(income.ch, "value")?.ch || [];
    for (const v of incomeValues.filter((n) => /^\d+$/.test(n.k)).slice(0, 3)) {
      const rid = Number(v.k);
      push(
        {
          key: `income-${rid}`,
          group: "economy",
          prefix,
          suffix: `.income.value[${rid}]`,
          scale: 1000,
          label: () => `每次被动收入 · ${zhResource(rid)}`,
          labelEn: () => `Income per payment · ${enResource(rid)}`,
          labelFr: () => `Revenu par versement · ${frResource(rid)}`,
          help: {
            zh: "每次周期发放的资源，不是每秒收入。",
            en: "Resources awarded per interval, not per second.",
            fr: "Ressources versées par intervalle, pas par seconde.",
          },
          extra: { advanced: true },
        },
        num(v.v),
      );
    }
  }

  // Construction — coûts de bâtiment (Build ID, toutes factions)
  for (const b of buildEntries.filter((x) => x.unit === slot)) {
    const bprefix = `root.build[${b.id}]`;
    for (const [phase, phaseZh, phaseEn, phaseFr] of [
      ["initCost", "地基费用", "Foundation cost", "Coût des fondations"],
      ["buildCost", "施工费用", "Construction cost", "Coût de construction"],
    ]) {
      const costs = child(b.ch, phase)?.ch || [];
      for (const c of costs.filter((n) => /^\d+$/.test(n.k))) {
        const rid = Number(c.k);
        const raw = num(c.v);
        if (!raw) continue; // mode simple : seules les ressources réellement payées
        push(
          {
            key: `build-${b.id}-${phase}-${rid}`,
            group: "construction",
            prefix: bprefix,
            suffix: `.${phase}[${rid}]`,
            scale: 1000,
            label: () => `${phaseZh} · ${zhResource(rid)}`,
            labelEn: () => `${phaseEn} · ${enResource(rid)}`,
            labelFr: () => `${phaseFr} · ${frResource(rid)}`,
            help: HELP.costBuild.zh,
            helpEn: HELP.costBuild.en,
            helpFr: HELP.costBuild.fr,
            extra: { scope: "faction-build", buildId: b.id },
          },
          raw,
        );
      }
    }
    push(
      {
        key: `build-${b.id}-health`,
        group: "construction",
        prefix: bprefix,
        suffix: ".healthInit",
        scale: 1,
        label: () => "地基初始生命（原始值）",
        labelEn: () => "Foundation health (raw)",
        labelFr: () => "Points de vie des fondations (brut)",
        help: {
          zh: "引擎初始化参数，不等于界面显示HP；提高通常增加地基生命。",
          en: "Engine initialization parameter, not displayed HP; higher generally strengthens foundations.",
          fr: "Paramètre d'initialisation du moteur, pas les PV affichés ; plus grand renforce généralement les fondations.",
        },
        extra: { min: 1, advanced: true, scope: "faction-build", buildId: b.id },
      },
      value(b.ch, "healthInit"),
    );
  }

  // Construction — files de production / recherches du producteur
  const ability = child(treeNodes, "ability")?.ch || [];
  const abilities = child(ability, "ability")?.ch || [];
  const abilityInfo = (id) => {
    const a = abilities.find((n) => n.k === String(id));
    if (!a || !a.ch) return {};
    const data = child(a.ch, "data")?.ch || [];
    return {
      type: value(a.ch, "type") ?? 0,
      target: value(data, "unit"),
      research: value(data, "research"),
    };
  };
  for (const w of indexed(ability, "work")) {
    const abilityId = value(w.ch, "ability");
    if (abilityId === undefined) continue;
    const info = abilityInfo(abilityId);
    const guard = {
      producerId: slot,
      workId: w.id,
      abilityId,
      abilityType: info.type,
      ...(info.target !== undefined ? { targetId: info.target } : {}),
      ...(info.research !== undefined ? { researchId: info.research } : {}),
    };
    // Libellé de l'entité produite (unité ou recherche), localisé ×3.
    let entity = { zh: `效果 ${abilityId}`, en: `Effect ${abilityId}`, fr: `Effet ${abilityId}` };
    if (info.target !== undefined) {
      const t = bySlot.get(info.target);
      if (t) entity = { zh: t.zh, en: t.en, fr: t.fr };
    } else if (info.research !== undefined) {
      const r = researchByGameId.get(info.research);
      if (r?.names)
        entity = { zh: pickName(r.names), en: r.names.en || `#${info.research}`, fr: pickNameFr(r.names) };
    }
    push(
      {
        key: `work-${w.id}-time`,
        group: "construction",
        prefix,
        suffix: `.ability.work[${w.id}].makeTime`,
        scale: 1000,
        label: () => `${entity.zh} · 时间（秒）`,
        labelEn: () => `${entity.en} · duration (s)`,
        labelFr: () => `${entity.fr} · durée (s)`,
        help: HELP.time.zh + HELP.work.zh,
        helpEn: HELP.time.en + " " + HELP.work.en,
        helpFr: HELP.time.fr + " " + HELP.work.fr,
        extra: { min: 0.05, max: 86400, productionGuard: guard },
      },
      value(w.ch, "makeTime"),
    );
    for (const [phase, phaseZh, phaseEn, phaseFr] of [
      ["costOrder", "下单", "order", "commande"],
      ["costStart", "开工", "start", "démarrage"],
      ["costProcess", "生产过程", "process", "production"],
    ]) {
      const costs = child(w.ch, phase)?.ch || [];
      for (const c of costs.filter((n) => /^\d+$/.test(n.k))) {
        const rid = Number(c.k);
        const raw = num(c.v);
        if (!raw) continue;
        push(
          {
            key: `work-${w.id}-${phase}-${rid}`,
            group: "construction",
            prefix,
            suffix: `.ability.work[${w.id}].${phase}[${rid}]`,
            scale: 1000,
            label: () => `${entity.zh} · ${zhResource(rid)} · ${phaseZh}`,
            labelEn: () => `${entity.en} · ${enResource(rid)} · ${phaseEn}`,
            labelFr: () => `${entity.fr} · ${frResource(rid)} · ${phaseFr}`,
            help: HELP.costWork.zh + HELP.work.zh,
            helpEn: HELP.costWork.en + " " + HELP.work.en,
            helpFr: HELP.costWork.fr + " " + HELP.work.fr,
            extra: { productionGuard: guard },
          },
          raw,
        );
      }
    }
    push(
      {
        key: `work-${w.id}-enabled`,
        group: "construction",
        prefix,
        suffix: `.ability.work[${w.id}].enabled`,
        scale: 1,
        label: () => `${entity.zh} · 队列项启用`,
        labelEn: () => `${entity.en} · queue entry enabled`,
        labelFr: () => `${entity.fr} · entrée de file active`,
        help: {
          zh: "禁用后该队列项不可用；重新启用仍须满足前置与国家规则。",
          en: "Disables this queue entry; re-enabling still requires prerequisites and nation rules.",
          fr: "Désactive cette entrée de file ; la réactivation exige toujours les prérequis et règles de nation.",
        },
        extra: { max: 1, advanced: true, productionGuard: guard, defaulted: value(w.ch, "enabled") === undefined },
      },
      (() => {
        const v = value(w.ch, "enabled");
        return v === undefined ? true : v;
      })(),
    );
  }

  return { fields, weapons };
}

// --- Parcours des slots ------------------------------------------------------------
const treeDir = path.join(servedDir, "content/docs/tree");
const slotFiles = fs
  .readdirSync(treeDir)
  .filter((f) => /^gameplay\.root\.unitType\.\d+\.json$/.test(f))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
const buildTree = JSON.parse(fs.readFileSync(path.join(treeDir, "gameplay.root.build.json"), "utf8"));
const buildEntries = buildTree
  .filter((n) => /^\d+$/.test(n.k))
  .map((n) => ({ id: Number(n.k), ch: n.ch || [], unit: value(n.ch, "unit") }));

const units = [];
const bySlot = new Map();
for (const file of slotFiles) {
  const slot = Number(file.match(/(\d+)\.json$/)[1]);
  const nodes = JSON.parse(fs.readFileSync(path.join(treeDir, file), "utf8"));
  const address = value(nodes, "address");
  if (!address) continue;
  const shortId = address.replace(/^WarSelection\//, "");
  const entry = unitsById.get(shortId);
  if (!entry) continue;
  bySlot.set(slot, {
    zh: pickName(entry.names) || shortId,
    en: entry.names?.en || shortId,
    fr: pickNameFr(entry.names) || shortId,
  });
}

for (const file of slotFiles) {
  const slot = Number(file.match(/(\d+)\.json$/)[1]);
  const nodes = JSON.parse(fs.readFileSync(path.join(treeDir, file), "utf8"));
  const address = value(nodes, "address");
  if (!address) continue;
  const shortId = address.replace(/^WarSelection\//, "");
  const entry = unitsById.get(shortId);
  if (!entry) continue;
  const names = bySlot.get(slot);
  const { fields, weapons } = fieldsForSlot(slot, nodes, entry, buildEntries, bySlot);
  if (!fields.length) continue;
  units.push({
    id: shortId,
    slot,
    name: names.zh,
    nameEn: names.en,
    nameFr: names.fr,
    fields,
    weapons,
  });
}

const parts = String(updatedAt.gameVersion || "").split(/[._]/);
const gameVersionNumber = Number(parts[1]) || 0;
const catalog = {
  format: "ws-atlas-simple-catalog",
  schemaVersion: 1,
  provenance: {
    datasetId: updatedAt.datasetId,
    gameVersion: updatedAt.gameVersion,
    gameVersionNumber,
    steamBuild: parts[2] || "",
    gameplayVersion: gameVersionNumber,
    catalogGeneratedAt: updatedAt.publishedAt,
    unitSlots: slotFiles.length,
    unitCount: units.length,
    ficheCount: unitsIndex.units.length,
  },
  resources,
  units,
};

const out = path.join(root, "public/simple-catalog.json");
fs.writeFileSync(out, JSON.stringify(catalog));
fs.writeFileSync(out + ".gz", gzipSync(JSON.stringify(catalog), { level: 9 }));
console.log(
  JSON.stringify({
    units: units.length,
    slots: slotFiles.length,
    fields: units.reduce((n, u) => n + u.fields.length, 0),
    bytes: fs.statSync(out).size,
  }),
);
