// Reproducible factual extraction. Reads installed game data; never modifies game files.
import fs from "node:fs";
import crypto from "node:crypto";
import { gzipSync } from "node:zlib";
const game = process.argv[2];
if (!game) throw new Error("Pass the installed WarSelection project folder.");
const source = fs.readFileSync(`${game}/gameplay.json`, "utf8");
const data = JSON.parse(source);
const output = new URL("../public/unit-catalog.json", import.meta.url);
const catalog = JSON.parse(fs.readFileSync(output, "utf8"));
if (catalog.provenance.sourceSha256 !== crypto.createHash("sha256").update(source).digest("hex"))
  throw new Error("Baseline changed; rebuild the base catalog before expanding.");
const raw = new Map(data.scenes.units);
const loc = (lang) =>
  Object.fromEntries(
    [
      ...fs
        .readFileSync(`${game}/localization/${lang}.loc`, "utf8")
        .matchAll(/^<\*([^>]+)>(.*)$/gm),
    ].map((m) => [m[1], m[2].trim()]),
  );
const zh = loc("cn"),
  en = loc("en");
const resource = ["食物", "木材", "金属"],
  resourceEn = ["Food", "Wood", "Metal"];
const byId = new Map(catalog.units.map((u) => [u.id, u]));
const num = (v) => typeof v === "number" && Number.isFinite(v);
const add = (u, key, label, labelEn, path, value, scale, group, help, helpEn, extra = {}) => {
  if (!num(value) && typeof value !== "boolean") return;
  const boolean = typeof value === "boolean";
  const f = {
    key,
    label,
    labelEn,
    path,
    raw: boolean ? Number(value) : value,
    scale,
    value: (boolean ? Number(value) : value) / scale,
    group,
    min: 0,
    max: 1000000,
    step: 1 / scale,
    kind: boolean ? "boolean" : "number",
    help,
    helpEn,
    ...extra,
  };
  // Special units can legitimately exceed ordinary editor policies; their baseline remains valid.
  f.min = Math.min(f.min, f.value);
  f.max = Math.max(f.max, f.value);
  const index = u.fields.findIndex((x) => x.key === key);
  if (index >= 0) u.fields[index] = f;
  else u.fields.push(f);
  return f;
};
const costHelp = [
  "修改该阶段支付的资源；下单、开工和生产过程是不同阶段，不要重复计算。",
  "Changes resources paid in this phase. Order, start and process costs are separate stages.",
];
const secondsHelp = [
  "数值越小，完成得越快；不能靠降价自动解锁科技或按钮。",
  "Lower values finish sooner. Cheaper costs do not unlock research or buttons.",
];
const requirementInfo = (req) => ({
  unitsAll: req?.unitsAll !== false,
  units: (req?.units || []).map((r) => ({
    id: r.type,
    min: r.min ?? (r.max === undefined ? 1 : 0),
    max: r.max ?? 65535,
  })),
  researchAny: req?.researchAny || [],
  researchAll: req?.researchAll || [],
});
for (const u of catalog.units) {
  const r = raw.get(u.id),
    p = `root.unitType[${u.id}]`;
  // Keep legacy keys, so existing saved projects remain importable with the same source hash.
  u.fields = u.fields.filter((f) => !f.expanded);
  u.workItems = [];
  u.abilityItems = [];
  u.ruleTargets = [];
  u.buildingCosts = [];
  const a = (key, cn, english, suffix, value, scale, group, help, helpEn, extra = {}) =>
    add(u, key, cn, english, p + suffix, value, scale, group, help, helpEn, {
      expanded: true,
      ...extra,
    });
  a(
    "regeneration",
    "自动回血（HP/秒）",
    "Regeneration (HP/s)",
    ".deathability.regeneration",
    r.deathability?.regeneration,
    50,
    "基础",
    "提高会加快被动回血；不会增加最大生命。",
    "Higher values restore health faster; maximum health is unchanged.",
  );
  a(
    "threat",
    "威胁值",
    "Threat",
    ".deathability.attackThreat",
    r.deathability?.threat,
    1,
    "基础",
    "影响敌人选择攻击目标的倾向，不是伤害加成。",
    "Influences enemy targeting priority; this is not a damage multiplier.",
    { max: 65535 },
  );
  a(
    "radius",
    "单位尺寸",
    "Unit size",
    ".radius",
    r.size,
    1000,
    "基础",
    "影响游戏逻辑中的单位尺寸；不是模型缩放，也不等于完整碰撞半径。",
    "Changes logical unit size, not visual scale or every collision radius.",
    { advanced: true, max: 1000, min: 0.1 },
  );
  a(
    "controllable",
    "玩家可控制",
    "Player controllable",
    ".controllable",
    r.controllable ?? true,
    1,
    "基础",
    "关闭后可能无法给该单位下达玩家命令。",
    "Disabling may prevent player commands.",
    { advanced: true, max: 1, defaulted: r.controllable === undefined },
  );
  if (r.deathability)
    a(
      "receive-friendly",
      "承受友军伤害",
      "Receive friendly damage",
      ".deathability.receiveFriendlyDamage",
      r.deathability.receiveFriendlyDamage ?? true,
      1,
      "基础",
      "仅决定能否承受友军伤害；武器本身也必须允许友伤。",
      "Controls receiving friendly damage; the attacking weapon must also allow it.",
      { advanced: true, max: 1, defaulted: r.deathability.receiveFriendlyDamage === undefined },
    );
  a(
    "rotation",
    "转向速度（原始值）",
    "Turn speed (raw)",
    ".movement.rotationSpeed",
    r.movement?.rotationSpd,
    1,
    "基础",
    "提高后转向更快；角度编码随游戏版本变化，此处保留原始值，勿直接输入角度。",
    "Higher values turn faster. Angle encoding changed across versions; enter raw values, not degrees.",
    { max: 4294967295, advanced: true },
  );
  a(
    "population",
    "人口占用",
    "Population cost",
    ".supply.cost",
    r.supply?.cost_?.[0],
    10,
    "基础",
    "每个单位占用的人口；降低可能增加单位总数和后期负担。",
    "Population used per unit. Lower values may increase unit counts and late-game load.",
    { max: 10000 },
  );
  a(
    "population-provided",
    "提供人口",
    "Population provided",
    ".supply.takes",
    r.supply?.takes_?.[0],
    10,
    "经济",
    "建筑或单位提供的人口空间；不是阵营总人口上限。",
    "Population capacity supplied by this type, not the global faction cap.",
    { max: 10000 },
  );
  a(
    "storage",
    "交资源倍率",
    "Deposit multiplier",
    ".storageMultiplier",
    r.storageMultiplier > 0 ? r.storageMultiplier : undefined,
    65536,
    "经济",
    "1×是100%：改为2×时同样交入10资源可记为20。不会直接加快采集动作。按fixed16精度四舍五入。",
    "1× means 100%. At 2×, depositing 10 credits 20; gathering actions themselves are not faster. Rounded to fixed16 precision.",
    { max: 20, round: true, step: 0.1 },
  );
  if (r.income) {
    a(
      "income-period",
      "被动收入间隔（秒）",
      "Passive income interval (seconds)",
      ".income.period",
      r.income.period,
      1000,
      "经济",
      "间隔越短，收入触发越频繁；只适用于原版已有收入组件的单位。",
      "Shorter intervals pay more often. Only for units with an existing income component.",
      { min: 0.05, max: 86400 },
    );
    (r.income.value || [])
      .slice(0, 3)
      .forEach((v, i) =>
        a(
          `income-${i}`,
          `每次被动收入 · ${resource[i]}`,
          `Income per payment · ${resourceEn[i]}`,
          `.income.value[${i}]`,
          v,
          1000,
          "经济",
          "每次周期发放的资源，不是每秒收入。",
          "Resources awarded per interval, not per second.",
        ),
      );
  }
  a(
    "passenger-volume",
    "乘员占用空间",
    "Passenger volume",
    ".movement.transporting.volume",
    r.movement?.transporting?.ownVolume,
    1,
    "运输与航空",
    "单位登车占用的空间；需与运输载具容量配合，不会赋予登车能力。",
    "Space occupied by this passenger; does not grant boarding capability.",
    { max: 10000, min: 1 },
  );
  a(
    "transport-volume",
    "载具容量",
    "Transport capacity",
    ".transport.volume",
    r.transport?.volume,
    1,
    "运输与航空",
    "增大可容纳更多乘员空间；仍受单位数量和可运输标签限制。",
    "More passenger space; passenger count and eligible tags still apply.",
    { max: 10000, min: 1 },
  );
  a(
    "transport-count",
    "乘员数量上限",
    "Passenger count limit",
    ".transport.unitLimit",
    r.transport?.unitLimit,
    1,
    "运输与航空",
    "独立于容量的乘员数量限制。",
    "Passenger count limit, separate from total volume.",
    { max: 10000, min: 1 },
  );
  const air = r.movement?.airplane;
  a(
    "fuel",
    "燃油续航（秒）",
    "Fuel endurance (seconds)",
    ".movement.airplane.fuel",
    air?.fuel,
    1000,
    "运输与航空",
    "增加空中续航；不改变加油速度。",
    "Increases flight endurance without changing refueling speed.",
    { max: 86400, min: 1 },
  );
  a(
    "refuel",
    "加油速度（原始值）",
    "Refueling rate (raw)",
    ".movement.airplane.aerodrome.refuelingSpeed",
    air?.aerodrome?.refuelingSpeed,
    1,
    "运输与航空",
    "减半通常约需两倍加油时间；保留每tick原始值，实际返航与停靠会额外耗时。",
    "Halving typically doubles refueling time. Raw per-tick value; return flight and docking add time.",
    { max: 100000, min: 1 },
  );
  a(
    "air-heal",
    "机场维修速度（HP/秒）",
    "Airfield repair (HP/s)",
    ".movement.airplane.aerodrome.healingSpeed",
    air?.aerodrome?.healingSpeed,
    50,
    "运输与航空",
    "提高飞机在机场的维修速度，不改变其他修理单位。",
    "Faster aircraft repairs at airfields; other repair units are unchanged.",
  );
  a(
    "flight-height",
    "移动相对高度（原始值）",
    "Movement height (raw)",
    ".movement.airplane.heightAboveSurface",
    air?.heightAboveSurface,
    1,
    "运输与航空",
    "该组件也用于潜艇。改变相对地表高度可能影响弹道、降落和水下移动；需实测。",
    "This component is also used by submarines. Relative height affects projectiles, landing and underwater movement; test in game.",
    { advanced: true, min: -2000000, max: 2000000 },
  );
  a(
    "air-rearm",
    "机场装填周期（秒）",
    "Airfield rearm period (seconds)",
    ".movement.airplane.aerodrome.rechargingPeriod",
    air?.aerodrome?.rechargingPeriod,
    1000,
    "运输与航空",
    "降低可加快机场补弹，不等于飞行中武器的装填间隔。",
    "Lower values rearm faster at the airfield, not during flight.",
    { min: 0.05, max: 86400 },
  );
  for (const [i, g] of (r.movement?.gather || []).entries()) {
    const label = `采集 ${i} · ${resource[g.resource] ?? g.resource}`,
      labelEn = `Gather ${i} · ${resourceEn[g.resource] ?? g.resource}`;
    for (const [key, cn, eng, rk, runtime, scale, help, helpEn] of [
      [
        "bag",
        "携带量",
        "Carry capacity",
        "bagsize",
        "bagSize",
        1000,
        "提高可减少往返次数；不会提高每次采集速度。",
        "Higher capacity reduces deposit trips, not the gathering rate.",
      ],
      [
        "rate",
        "采集速率（资源/秒）",
        "Gather rate (resource/s)",
        "pertick",
        "perTick",
        50,
        "提高资源采集速度；实际收入还受走路和交资源倍率影响。",
        "Faster extraction; travel time and deposit multipliers still affect income.",
      ],
      [
        "distance",
        "采集距离",
        "Gather distance",
        "gatherdistance",
        "gatherDistance",
        1000,
        "增大可在更远处采集；过大容易改变地图玩法。",
        "Allows gathering farther away; large values can change map balance.",
      ],
      [
        "deposit",
        "交资源距离",
        "Deposit distance",
        "putDistance",
        "putDistance",
        1000,
        "增大可缩短交资源所需的移动距离。",
        "Larger distances can reduce movement needed to deposit.",
      ],
    ])
      a(
        `gather-${i}-${key}`,
        `${label} · ${cn}`,
        `${labelEn} · ${eng}`,
        `.movement.gather[${i}].${runtime}`,
        g[rk],
        scale,
        "经济",
        help,
        helpEn,
        {
          max: key === "distance" || key === "deposit" ? 1000 : 100000,
          advanced: key === "distance" || key === "deposit",
        },
      );
  }
  for (const [i, b] of (r.movement?.building || []).entries())
    a(
      `builder-${i}`,
      `建造 #${b.id} · 每tick进度`,
      `Build #${b.id} · progress/tick`,
      `.movement.building[${i}].tickProgress`,
      b.progress,
      1,
      "建造速度",
      "提高可加快工人建造该建筑；不是建筑的造价或升级时间。",
      "Higher values build this building faster; this is neither cost nor upgrade time.",
      { min: 1, max: 10000000, buildWorkerGuard: { unitId: b.id, index: i } },
    );
  if (r.heal) {
    a(
      "repair-rate",
      "治疗/维修速度（HP/秒）",
      "Heal / repair rate (HP/s)",
      ".heal.perTick",
      r.heal.perTick,
      50,
      "经济",
      "提高主动治疗或维修速度；目标标签与费用仍生效。",
      "Faster active healing or repairs; target tags and costs still apply.",
    );
    a(
      "repair-range",
      "治疗/维修距离",
      "Heal / repair range",
      ".heal.distance",
      r.heal.distance,
      1000,
      "经济",
      "增大可在更远处进行原有治疗/维修。",
      "Allows existing healing or repair actions at longer range.",
      { max: 1000 },
    );
  }
  (r.deathability?.healMeCost || [])
    .slice(0, 3)
    .forEach((v, i) =>
      a(
        `repair-cost-${i}`,
        `维修费用参数 · ${resource[i]}`,
        `Repair cost parameter · ${resourceEn[i]}`,
        `.deathability.healMeCost[${i}]`,
        v,
        1000,
        "建造费用",
        "影响修复该单位的资源消耗，不是新建造价；实际扣费节奏需实测。",
        "Affects resource consumption for repairs, not construction. Actual deduction timing requires testing.",
      ),
    );
  for (const w of u.weapons) {
    const wr =
      w.turretId === null
        ? r.attack.weapons[w.weaponId]
        : r.attack.turrets[w.turretId].weapons[w.weaponId];
    const wf = (suffix, cn, eng, prop, v, scale, help, helpEn, extra = {}) => {
      const f = add(
        u,
        `${w.key}-${suffix}`,
        cn,
        eng,
        `${w.path}.${prop}`,
        v,
        scale,
        w.label,
        help,
        helpEn,
        { expanded: true, ...extra },
      );
      if (f && !w.fields.includes(f.key)) w.fields.push(f.key);
    };
    wf(
      "angle",
      "攻击夹角（原始值）",
      "Attack angle (raw)",
      "angle",
      wr.ang,
      1,
      "扩大攻击方向容许范围；角度编码随版本变化，保留原始值而不猜测度数。",
      "Widens the allowed attack direction. Version-dependent angle encoding is kept raw.",
      { max: 4294967295, advanced: true },
    );
    wf(
      "spread",
      "散布（%）",
      "Spread (%)",
      "spread",
      wr.spread_,
      10,
      "降低可让弹着更集中；不是命中率，0也不保证命中移动目标。",
      "Lower spread concentrates shots; this is not hit probability.",
      { max: 100, advanced: true },
    );
    wf(
      "shots",
      "每发射点攻击次数",
      "Attacks per firing point",
      "attacksPerPoint",
      wr.attackscount,
      1,
      "每个动画发射点重复攻击的次数；增大会明显增加输出和弹丸负担，不会改变动画点数。",
      "Attacks at each animation firing point. Higher counts raise damage and projectile load without changing animation points.",
      { min: 1, max: 100, advanced: true },
    );
    wf(
      "charges",
      "武器充能数",
      "Weapon charges",
      "charges",
      wr.charges,
      1,
      "原有充能机制的数量；不保证所有武器都使用充能。",
      "Charge count for an existing charge-based weapon; not every weapon uses charges.",
      { min: 1, max: 100, advanced: true },
    );
    wf(
      "splash",
      "范围伤害半径",
      "Area damage radius",
      "damage.radius",
      wr.damage?.radius_,
      1000,
      "扩大原有范围伤害区域；不会把单体攻击自动变为范围攻击。",
      "Expands an existing area-damage radius; does not convert single-target attacks to area attacks.",
      { max: 1000, advanced: true },
    );
    wf(
      "environment",
      "环境伤害",
      "Environment damage",
      "damage.envDamage",
      wr.damage?.envDamage,
      1000,
      "改变对可破坏环境物体的伤害，不是建筑标签伤害。",
      "Damage to destructible environment objects, not building-tag damage.",
      { advanced: true },
    );
    for (const [key, cn, eng, prop, value, help, helpEn] of [
      [
        "enabled",
        "武器启用",
        "Weapon enabled",
        "enabled",
        wr.enabled ?? true,
        "禁用该武器；启用隐藏武器仍需目标规则、弹道与动画配合。",
        "Disables this weapon; enabling hidden weapons still requires compatible targeting and animations.",
      ],
      [
        "auto",
        "自动攻击",
        "Auto attack",
        "autoAttack",
        wr.autoAttack ?? true,
        "是否自动使用该武器攻击目标；不等于空中单位自动攻击能力。",
        "Whether this weapon attacks automatically; does not grant aircraft-level targeting capabilities.",
      ],
    ])
      wf(key, cn, eng, prop, value, 1, help, helpEn, {
        kind: "boolean",
        max: 1,
        advanced: true,
        defaulted: wr[prop] === undefined,
      });
    if (wr.damage)
      wf(
        "friendly",
        "武器友军伤害",
        "Weapon friendly damage",
        "damage.damageFriendly",
        wr.damage.damageFriendly ?? false,
        1,
        "开启后该武器允许伤害友军；受目标友伤开关影响。",
        "Allows friendly damage if the target also permits it.",
        { max: 1, advanced: true, defaulted: wr.damage.damageFriendly === undefined },
      );
  }
  for (const zone of u.armor) {
    const rz = r.deathability?.armor_?.zonal?.[zone.index];
    a(
      `armor-${zone.index}-weight`,
      `装甲区 ${zone.index} 权重`,
      `Armor zone ${zone.index} weight`,
      `.deathability.armor.zonal[${zone.index}].probability`,
      rz?.probability,
      1,
      "装甲",
      "改变该装甲区被选中的相对权重；所有区域权重不能同时为0。",
      "Relative chance of using this zone; the sum of all zone weights must stay positive.",
      { max: 100000, advanced: true },
    );
  }
  for (const [workId, work] of (r.ability?.work || []).entries()) {
    if (!work) continue;
    const ability = r.ability?.abilities?.[work.ability];
    if (!ability) continue;
    const type = ability.type ?? 0;
    const target = ability.data?.unit,
      research = ability.data?.research;
    const label =
      target !== undefined
        ? `${byId.get(target)?.name ?? "单位"} #${target}`
        : research !== undefined
          ? `${zh[`upgrade${research}`]?.split("|")[0] ?? "科技"} #${research}`
          : `效果 ${work.ability}`;
    const labelEn =
      target !== undefined
        ? `${byId.get(target)?.nameEn ?? "Unit"} #${target}`
        : research !== undefined
          ? `${en[`upgrade${research}`]?.split("|")[0] ?? "Research"} #${research}`
          : `Effect ${work.ability}`;
    const guard = {
      producerId: u.id,
      workId,
      abilityId: work.ability,
      abilityType: type,
      ...(target !== undefined ? { targetId: target } : {}),
      ...(research !== undefined ? { researchId: research } : {}),
    };
    const list = [];
    const push = (f) => {
      if (f) list.push(f.key);
    };
    push(
      a(
        `work-${workId}-enabled`,
        "队列项启用",
        "Queue entry enabled",
        `.ability.work[${workId}].enabled`,
        work.enabled ?? true,
        1,
        "生产与科技",
        "禁用后该队列项不可用；重新启用仍须满足前置与国家规则。",
        "Disables this queue entry. Enabling still requires prerequisites and nation rules.",
        { productionGuard: guard, max: 1, advanced: true, defaulted: work.enabled === undefined },
      ),
    );
    push(
      a(
        `work-${workId}-reserve`,
        "队列储备上限",
        "Queue reserve limit",
        `.ability.work[${workId}].reserveLimit`,
        work.reserve?.limit,
        1,
        "生产与科技",
        "改变原有储备机制的上限，不是单位总数量上限。",
        "Changes the existing reserve limit, not the total unit population cap.",
        { productionGuard: guard, max: 1000, advanced: true },
      ),
    );
    push(
      a(
        `work-${workId}-time`,
        "队列时间（秒）",
        "Queue duration (seconds)",
        `.ability.work[${workId}].makeTime`,
        work.maketime,
        1000,
        "生产与科技",
        ...secondsHelp,
        { productionGuard: guard, min: 0.05, max: 86400 },
      ),
    );
    for (const phase of ["costOrder", "costStart", "costProcess"])
      (work[phase] || [])
        .slice(0, 3)
        .forEach((v, i) =>
          push(
            a(
              `work-${workId}-${phase}-${i}`,
              `${resource[i]} · ${phase === "costOrder" ? "下单" : phase === "costStart" ? "开工" : "生产过程"}`,
              `${resourceEn[i]} · ${phase}`,
              `.ability.work[${workId}].${phase}[${i}]`,
              v,
              1000,
              "生产与科技",
              ...costHelp,
              { productionGuard: guard },
            ),
          ),
        );
    const info = requirementInfo(ability.requirements);
    const ruleKey = `ability-${work.ability}`;
    if (!u.ruleTargets.some((x) => x.key === ruleKey))
      u.ruleTargets.push({
        key: ruleKey,
        label: `Ability ${work.ability} · ${label}`,
        labelEn: `Ability ${work.ability} · ${labelEn}`,
        path: `${p}.ability.ability[${work.ability}].requirements`,
        guard,
        requirements: info,
      });
    u.workItems.push({
      workId,
      abilityId: work.ability,
      type,
      label,
      labelEn,
      fields: list,
      ruleKey,
    });
  }
  const action = r.ability?.abilityOnAction;
  if (action) {
    for (const [key, cn, eng, path, val, scale, help, helpEn, extra] of [
      [
        "action-active",
        "自动技能启用",
        "Action ability active",
        "active",
        action.enabled ?? true,
        1,
        "开启已有的自动触发技能；例如战士冲锋，原版可能默认关闭。",
        "Activates existing action abilities, such as a warrior charge that is disabled by default.",
        { max: 1, advanced: true },
      ],
      [
        "action-agro",
        "仅战斗触发",
        "Only on aggro",
        "onAgro",
        action.onAgro,
        1,
        "开启后仅在进入相应战斗状态时触发。",
        "Restricts triggering to the corresponding combat state.",
        { max: 1 },
      ],
      [
        "action-restore",
        "技能冷却（秒）",
        "Action cooldown (seconds)",
        "restoreDuration",
        action.restore,
        1000,
        "降低可更频繁地触发自动技能。",
        "Lower values trigger the automatic ability more often.",
        { min: 0.05, max: 86400 },
      ],
      [
        "action-min",
        "触发最小距离",
        "Minimum trigger distance",
        "distanceToTargetMin",
        action.distance?.min,
        1000,
        "目标必须满足触发距离区间；最小值不能大于最大值。",
        "Target must be in the distance interval; minimum cannot exceed maximum.",
        { max: 10000 },
      ],
      [
        "action-max",
        "触发最大距离",
        "Maximum trigger distance",
        "distanceToTargetMax",
        action.distance?.max,
        1000,
        "扩大已有自动技能的触发范围。",
        "Extends the triggering range of the existing action ability.",
        { max: 10000 },
      ],
    ])
      a(key, cn, eng, `.ability.onAction.${path}`, val, scale, "技能", help, helpEn, extra);
  }
  for (const [i, ability] of (r.ability?.abilities || []).entries()) {
    if (!ability) continue;
    const effectGuard = {
      abilityId: i,
      type: ability.type ?? 0,
      ...(num(ability.data?.unit) ? { targetId: ability.data.unit } : {}),
      ...(num(ability.data?.research) ? { researchId: ability.data.research } : {}),
    };
    if ([4, 5].includes(ability.type) && num(ability.data?.duration))
      a(
        `ability-${i}-duration`,
        `Ability ${i} · 持续时间（秒）`,
        `Ability ${i} · duration (seconds)`,
        `.ability.ability[${i}].data.duration`,
        ability.data.duration,
        1000,
        "技能",
        "改变已有临时效果的持续时间；不会改变效果本身或创建新按钮。",
        "Changes duration of an existing timed effect, not its content or UI button.",
        {
          min: 0.05,
          max: 86400,
          advanced: true,
          abilityGuard: { abilityId: i, type: ability.type ?? 0 },
        },
      );
    if ((ability.type ?? 0) === 0) {
      a(
        `ability-${i}-count`,
        `Ability ${i} · 每次生成数量`,
        `Ability ${i} · units per activation`,
        `.ability.ability[${i}].data.count`,
        ability.data?.count ?? 1,
        1,
        "技能",
        "同一次生产或触发生成更多单位；造价不自动增加，可能增加卡顿。",
        "Creates more units per activation. Costs do not scale automatically; may increase lag.",
        {
          min: 1,
          max: 100,
          advanced: true,
          defaulted: ability.data?.count === undefined,
          abilityGuard: { abilityId: i, type: 0 },
        },
      );
      a(
        `ability-${i}-lifetime`,
        `Ability ${i} · 生成单位寿命（秒）`,
        `Ability ${i} · spawned lifetime (seconds)`,
        `.ability.ability[${i}].data.lifeTime`,
        ability.data?.lifeTime,
        1000,
        "技能",
        "0表示原有无限寿命约定；正数用于临时生成单位，需核对技能用途。",
        "Zero uses the existing indefinite-lifetime convention; positive values limit spawned lifespan. Check ability behavior.",
        { min: 0, max: 86400, advanced: true, abilityGuard: { abilityId: i, type: 0 } },
      );
    }
    u.abilityItems.push({
      id: i,
      type: ability.type ?? 0,
      research: ability.data?.research,
      researchName: zh[`upgrade${ability.data?.research}`]?.split("|")[0],
      researchNameEn: en[`upgrade${ability.data?.research}`]?.split("|")[0],
      target: ability.data?.unit,
      action: (action?.abilities || []).includes(i),
    });
    for (const f of u.fields) if (f.abilityGuard?.abilityId === i) f.abilityGuard = effectGuard;
  }
}
for (const [buildId, b] of data.build.entries()) {
  const u = byId.get(b?.unit);
  if (!u) continue;
  const prefix = `root.build[${buildId}]`;
  const fields = [];
  for (const [phase, key] of [
    ["costInit", "initCost"],
    ["costBuilding", "buildCost"],
  ])
    (b[phase] || []).slice(0, 3).forEach((v, i) => {
      const f = add(
        u,
        `build-${buildId}-${key}-${i}`,
        `${resource[i]} · ${key === "initCost" ? "地基费用" : "施工费用"}`,
        `${resourceEn[i]} · ${key === "initCost" ? "foundation" : "construction"}`,
        `${prefix}.${key}[${i}]`,
        v,
        1000,
        "建造费用",
        "总造价 = 地基费用 + 施工费用。按 Build ID 同时写入所有现有阵营的建造表，不改训练队列。",
        "Total cost = foundation + construction. Written by Build ID to each existing faction, not a training queue.",
        { expanded: true, scope: "faction-build", buildId },
      );
      if (f) fields.push(f.key);
    });
  const info = requirementInfo(b.requirements);
  const ruleKey = `build-${buildId}`;
  const health = add(
    u,
    `build-${buildId}-health`,
    "地基初始生命参数（原始值）",
    "Foundation health parameter (raw)",
    `${prefix}.healthInit`,
    b.health,
    1,
    "建造费用",
    "引擎初始化参数，不等于界面显示的HP；提高通常增加地基生命，需实测。",
    "Engine initialization parameter, not displayed HP. Higher values generally strengthen foundations; test in game.",
    { expanded: true, scope: "faction-build", buildId, min: 1, max: 1000000, advanced: true },
  );
  if (health) fields.push(health.key);
  u.ruleTargets.push({
    key: ruleKey,
    label: `Build ID ${buildId}`,
    labelEn: `Build ID ${buildId}`,
    path: `${prefix}.requirements`,
    buildId,
    requirements: info,
  });
  u.buildingCosts.push({ buildId, fields, ruleKey });
}
// Explanations for the established v1 fields; key/path/value are unchanged.
for (const u of catalog.units)
  for (const f of u.fields) {
    if (f.help) continue;
    if (f.key === "health") {
      f.help = "提高最大生命值；不会保证把已经受伤的单位立刻补满。建议用新生产单位测试。";
      f.helpEn =
        "Increases maximum health; existing damaged units may not be fully healed. Test newly produced units.";
    } else if (f.key === "view") {
      f.help = "提高可揭开战争迷雾的范围，不会提高武器射程。";
      f.helpEn = "Extends vision through fog of war, not weapon range.";
    } else if (f.key === "speed") {
      f.help = "提高普通移动速度；不会同步改冲锋、转向或动画速度。";
      f.helpEn = "Increases normal movement speed, not charge speed, turning or animation.";
    } else if (f.path.includes(".damages[")) {
      f.help = "改变该目标标签的伤害数值。不会自动赋予对空/对潜能力，也不是实际最终伤害。";
      f.helpEn =
        "Changes damage for this target tag. Does not grant anti-air or anti-submarine targeting; final damage also depends on defenses.";
    } else if (f.path.endsWith(".rechargePeriod")) {
      f.help =
        "降低可更频繁地开始攻击；动画、连射发射点和装填均影响实际攻击周期，不能只用伤害÷间隔计算DPS。";
      f.helpEn =
        "Lower values allow attacks more often. Bursts, animation and reload all affect actual cycles; damage/reload is not complete DPS.";
    } else if (f.path.includes(".distance")) {
      f.help = "调整攻击距离；最小射程≤最大射程<停止攻击距离。停止距离影响已开始攻击的目标保持。";
      f.helpEn =
        "Attack distances must satisfy min ≤ max < stop. Stop distance affects retaining an engaged target.";
    } else if (f.path.includes(".thickness")) {
      f.help = "提高该命中区域的护甲，不会同时改变其他区域。不同武器穿甲和伤害类型会影响减伤。";
      f.helpEn =
        "Adds armor to this hit zone only. Penetration and damage type affect damage reduction.";
    } else if (f.path.endsWith(".makeTime")) [f.help, f.helpEn] = secondsHelp;
    else [f.help, f.helpEn] = costHelp;
  }
catalog.schemaVersion = 2;
catalog.provenance.expandedAt = new Date().toISOString();
catalog.provenance.expansionNote =
  "Runtime paths cross-checked against installed scripts and a prior runtime schema dump; defaults are explicitly marked. No in-game run performed.";
catalog.validation.note =
  "Editor limits are conservative policies, not engine maxima. Only trusted fields exported. Buildings target existing faction build tables. Runtime preflight checks types, mappings and optional strict baselines. Conditions preserve research prerequisites. Does not add units, visuals, buttons or execute imported Lua.";
fs.writeFileSync(output, JSON.stringify(catalog));
fs.writeFileSync(
  new URL("../public/unit-catalog.json.gz", import.meta.url),
  gzipSync(JSON.stringify(catalog), { level: 9 }),
);
console.log(
  JSON.stringify({
    units: catalog.units.length,
    fields: catalog.units.reduce((n, u) => n + u.fields.length, 0),
    workItems: catalog.units.reduce((n, u) => n + u.workItems.length, 0),
    buildings: catalog.units.reduce((n, u) => n + u.buildingCosts.length, 0),
  }),
);
