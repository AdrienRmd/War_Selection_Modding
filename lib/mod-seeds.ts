import { modLibrary } from "@/lib/mod-library";
import { emptyMod, type ModBody, type ModEntry } from "@/lib/mod-types";

type EnglishArchive = {title:string;summary:string;description:string;note:string};

// Editorial translations of the dated local archive; not game-tested releases.
const stalingradEnglish:Record<string,EnglishArchive> = {
  "stalingrad-rules": {
    "title": "Stalingrad · Core Rules",
    "summary": "Assigns nations to 30 player slots, makes nation selection free, initializes age progression, and sets university construction rules.",
    "description": "Assigns nations to 30 player slots, makes nation selection free, initializes age progression, and sets university construction rules.",
    "note": "Industrial Age II requires 40 workers of type 201. Universities require 20 workers, with a limit of 3. The latest costs and simultaneous construction still need to be retested."
  },
  "ground-balance": {
    "title": "Ground and Anti-Air Balance",
    "summary": "Rebalances infantry, vehicles, anti-aircraft units, naval units, and selected armor, healing, and repair values.",
    "description": "Rebalances infantry, vehicles, anti-aircraft units, naval units, and selected armor, healing, and repair values.",
    "note": "Names such as Maxim and half-track describe balance roles, not new models. The next round of buffs for standard nations has not been implemented."
  },
  "air-logistics": {
    "title": "Air Power and Flight Logistics",
    "summary": "Adjusts 10 flying units, expands fuel capacity for 8 aircraft types, and slows refueling.",
    "description": "Adjusts 10 flying units, expands fuel capacity for 8 aircraft types, and slows refueling.",
    "note": "Refueling speed is about 75% of the initial baseline and still needs in-game timing. Italian units 444 and 448 retain their original armor. Additional crash damage has been removed."
  },
  "lean-economy": {
    "title": "Streamlined Economy",
    "summary": "Limits production of industrial worker 201 to 60 and doubles positive resource-delivery efficiency values relative to the baseline.",
    "description": "Limits production of industrial worker 201 to 60 and doubles positive resource-delivery efficiency values relative to the baseline.",
    "note": "Passed offline checks. This is not a hard cap on workers from all ages combined and does not remove existing units. Excess production through simultaneous queues still needs testing. Do not combine with the old Storage mod."
  },
  "late-game": {
    "title": "Late-Game Economy and Wonders",
    "summary": "Mines generate meat, wood, and iron, with an Industrial Age II upgrade that doubles output. Wonders cost more and provide income and a ground-weapon bonus.",
    "description": "Mines generate meat, wood, and iron, with an Industrial Age II upgrade that doubles output. Wonders cost more and provide income and a ground-weapon bonus.",
    "note": "Passed offline checks. Upgrades for all six nations, actual resource deductions, and income still need in-game testing. Nuclear weapon prices are not overridden."
  },
  "legendary-heroes": {
    "title": "Legendary University Heroes",
    "summary": "Adds four hero types to universities. Vasily also has a deployed form. Each hero type is limited to one unit.",
    "description": "Adds four hero types to universities. Vasily also has a deployed form. Each hero type is limited to one unit.",
    "note": "Buttons have previously failed to respond. Statistics and icon slots have been fixed, but successful in-game unit production is not yet confirmed. An explicit Industrial Age II requirement is missing, and heroes for standard nations are not implemented."
  },
  "housing": {
    "title": "Double Housing Capacity",
    "summary": "Doubles the population capacity provided by six types of industrial houses for large-scale battles.",
    "description": "Doubles the population capacity provided by six types of industrial houses for large-scale battles.",
    "note": "Does not lower or change the global hard population limit. Standard houses: 10 → 20; Germany: 11 → 22; Soviet Union: 8 → 16."
  },
  "strongpoints": {
    "title": "Three Urban Strongpoints",
    "summary": "Teams fight over the southern, central, and northern districts. The controlling team receives resources, with chat notifications when control changes.",
    "description": "Teams fight over the southern, central, and northern districts. The controlling team receives resources, with chat notifications when control changes.",
    "note": "Control is checked every 5 seconds. Every 120 seconds, each strongpoint awards 500 of each of the three resources to every player slot on the controlling team. Control is retained when the area is empty or both teams are present."
  },
  "transport": {
    "title": "Vehicle Transport",
    "summary": "Assigns transport capacities to 54 cavalry, vehicle, and ship types.",
    "description": "Assigns transport capacities to 54 cavalry, vehicle, and ship types.",
    "note": "Can coexist with the current balance configuration. Capacity does not mean an unrestricted passenger count: unit size and other restrictions still apply. Reduced lag has not been demonstrated."
  },
  "opening-guide": {
    "title": "Chinese–English Opening Guide",
    "summary": "Displays 10 bilingual rule messages, starting 15 seconds into the match and continuing at 8-second intervals.",
    "description": "Displays 10 bilingual rule messages, starting 15 seconds into the match and continuing at 8-second intervals.",
    "note": "Does not automatically detect loaded mods. Its instructions must be updated to match the actual rules before release."
  },
  "old-territory": {
    "title": "Legacy Territory System",
    "summary": "The old system that converted controlled territory area into population capacity and resources.",
    "description": "The old system that converted controlled territory area into population capacity and resources.",
    "note": "No longer included in this map. This is not the current three-district strongpoint mod."
  },
  "general-winter": {
    "title": "General Winter",
    "summary": "Periodic winter conditions reduce movement speed and vision and apply a cool-toned visual effect. Includes in-game time debugging.",
    "description": "Periodic winter conditions reduce movement speed and vision and apply a cool-toned visual effect. Includes in-game time debugging.",
    "note": "Not being restored at present. Rebuilding unit types during a match still risks a native-engine crash."
  },
  "order-227": {
    "title": "Order No. 227",
    "summary": "Industrial Age II triggers changes to the costs, health, and damage of selected Soviet and German units.",
    "description": "Industrial Age II triggers changes to the costs, health, and damage of selected Soviet and German units.",
    "note": "Excluded from the current balance values and retained as a historical configuration."
  },
  "old-paratroopers": {
    "title": "Legacy Custom Italian Paratroopers",
    "summary": "The old release version of the airdrop mod has been reverted to a no-op that only writes logs.",
    "description": "The old release version of the airdrop mod has been reverted to a no-op that only writes logs.",
    "note": "Errors and crashes were previously reported. Confirm that the old content has been removed from the editor; do not restore it directly."
  },
  "paratrooper-test": {
    "title": "Three-Button Paratroopers · Isolated Test",
    "summary": "Adds three targeted airdrop options each to units 444 and 448 while retaining normal bombing.",
    "description": "Adds three targeted airdrop options each to units 444 and 448 while retaining normal bombing.",
    "note": "Default mode 0 is diagnostic only. Mode 1 enables free airdrops with independent 300-second cooldowns; landed units survive for 180 seconds. Test only in isolation on an empty map. This is not verified content for regular matches."
  },
  "paratrooper-diagnostics": {
    "title": "New Paratrooper API Diagnostics",
    "summary": "Prints the current interfaces for units 444, 448, 450, and 451 to help diagnose compatibility issues.",
    "description": "Prints the current interfaces for units 444, 448, 450, and 451 to help diagnose compatibility issues.",
    "note": "Does not change any values. Do not leave it loaded in regular matches."
  },
  "external-config": {
    "title": "Map Resources and External Configuration",
    "summary": "Resource-node reserves, historical supply-crate records, nuclear weapons, and map-editor settings.",
    "description": "Resource-node reserves, historical supply-crate records, nuclear weapons, and map-editor settings.",
    "note": "The corresponding supply-crate source is missing, and the nuclear configuration actually loaded is unknown. Starting resources cannot be inferred from debug screenshots. Nuclear weapons are configured in-game by the map author."
  }
};

const usageByStatus:Record<string,string> = {
  "保留方案":"active","待测试":"testing","待修复验收":"repair","可选":"optional",
  "暂停":"paused","弃用":"retired","仅诊断":"reference","待核对":"unverified"
};

function curatedSeed(id:string, body:Partial<ModBody>, date:string, origin:string):ModEntry {
  return {
    ...emptyMod,
    ...body,
    id,
    origin,
    status:"approved",
    revision:0,
    created_at:date+"T00:00:00.000Z",
    updated_at:date+"T00:00:00.000Z",
    file_name:"",
    file_size:0,
    sha256:"",
    has_file:false
  };
}

const stalingradSeeds:ModEntry[] = modLibrary.map(m => {
  const english = stalingradEnglish[m.slug];
  if (!english) throw new Error("Missing Stalingrad translation: "+m.slug);
  const paired = m.kind.includes("V");
  return curatedSeed(m.slug, {
    title:m.name,
    title_en:english.title,
    author:"Austin",
    summary:m.description,
    summary_en:english.summary,
    description:m.description+"\n\n"+m.note+"\n\n参考文件："+m.file,
    description_en:english.description+"\n\n"+english.note+"\n\nReference files: "+m.file,
    instructions:"本条目是斯大林格勒资料归档，不含下载文件或已核实的游戏内代码。请核对作者实际挂载版本，先在私人测试局验证。"+(paired?"玩法与视觉脚本必须配套。":""),
    instructions_en:"This is a Stalingrad archive entry, without a downloadable file or verified in-game code. Check the author's actual loaded version and verify it in a private match first."+(paired?" Pair the gameplay and visual scripts.":""),
    compatibility:m.note+"\n\n资料日期："+m.asOf+"。保留方案不等于已实机验收；暂停、弃用及诊断项不要直接加入正式对局。",
    compatibility_en:english.note+"\n\nArchive date: "+m.asOf+". Retained does not mean verified in-game. Do not add paused, retired, or diagnostic entries directly to regular matches.",
    mod_code:"",
    map_slug:"stalingrad",
    kind:m.status==="仅诊断"?"tool":paired?"bundle":"gameplay",
    usage_status:usageByStatus[m.status] || "unverified"
  }, m.asOf, "stalingrad");
});

// Public metadata from the source READMEs, checked 2026-09-22.
// No third-party scripts, images, or game assets are bundled here.
const githubBodies:(ModBody & {id:string})[] = [
  {
    "id": "github-diplomacy",
    "title": "外交系统",
    "title_en": "Diplomacy",
    "author": "ShiJueXiangGuan, UIXlangGuan, WaiJiaoMod",
    "summary": "通过结盟、和平与宣战按钮改变玩家关系，支持盟友共同胜利。",
    "summary_en": "Player diplomacy with alliance, peace, war, and shared allied victory.",
    "description": "这是完整的玩家外交组合。选择操作后点击对方领土，即可发出提议或宣战；结盟与和平需要对方回应，宣战立即生效。所有存活玩家互为盟友时可共同获胜。默认至少三名玩家存活才能结盟，每人最多五名盟友。\n\n原作者：ShiJueXiangGuan、UIXlangGuan、WaiJiaoMod；英文翻译与重发布：JSuisMort。",
    "description_en": "A coordinated diplomacy bundle: choose an action, then target another player's territory. Alliance and peace require a response; war takes effect immediately. Surviving players can win together when all are mutual allies. Defaults require at least three living players to form alliances and allow five allies per player.\n\nOriginal authors: ShiJueXiangGuan, UIXlangGuan, WaiJiaoMod. English translation and republication: JSuisMort.",
    "instructions": "在地图编辑器打开地图，进入 Mods → Add a modification，逐个添加所需代码，然后保存并发布地图。组合项目须遵循各条目的依赖说明。\n\n必须同时添加三个代码。英文界面；与复用同一原生界面节点的 Mod 可能冲突。",
    "instructions_en": "Open the map in the editor, choose Mods → Add a modification, add the required codes, then save and publish the map. Follow each bundle's dependency notes.\n\nInstall all three codes. English interface; mods reusing the same native UI nodes may conflict.",
    "compatibility": "必须同时添加三个代码。英文界面；与复用同一原生界面节点的 Mod 可能冲突。\n\nMod 代码已与作者公开文档核对；未在当前游戏版本中实测，不能保证发布 ID 仍可用。Stable 是来源标记，并非 WS ATLAS 测试结论。",
    "compatibility_en": "Install all three codes. English interface; mods reusing the same native UI nodes may conflict.\n\nMod codes match the authors' public documentation. Current in-game availability and compatibility have not been tested. Stable is the source's label, not a WS ATLAS certification.",
    "game_version": "",
    "mod_code": "Diplomacy interface: mod-s2u4EUGfise\nGameplay backend: mod-HmXZrJBjwM6\nUI framework: mod-KbwSsR2og7a",
    "source_url": "https://github.com/AdrienRmd/War_Selection_Modding/blob/main/mods/diplomacy/README.md",
    "license": "MIT (repository-level declaration)",
    "map_slug": "",
    "kind": "bundle",
    "usage_status": "unverified"
  },
  {
    "id": "github-wave-winter",
    "title": "PVE 波次与寒冬",
    "title_en": "Wave PVE & General Winter",
    "author": "Austin & Nuanyang",
    "summary": "递增 AI 攻势与周期暴风雪，可组合成生存防守地图。",
    "summary_en": "Escalating AI waves and recurring blizzards for survival-defense maps.",
    "description": "波次系统让专用 AI 阵营持续进攻玩家基地，随阶段与存活人数调整压力，并支持奇观胜利。寒冬部分降低移动和视野，配合冷蓝光照。可单用 PVE，或使用寒冬双脚本，或全部组合；不是无需配置即可运行的完整地图。\n\nAustin 与 Nuanyang 原作；AdrienRmd 英文化。",
    "description_en": "Wave PVE sends a dedicated AI faction against player bases, scaling pressure by progression and survivors, with wonder victory support. Winter adds movement and vision penalties with cold-blue lighting. Use PVE alone, the Winter pair, or the full bundle; this is not a preconfigured standalone map.\n\nOriginal work by Austin and Nuanyang; English texts by AdrienRmd.",
    "instructions": "在地图编辑器打开地图，进入 Mods → Add a modification，逐个添加所需代码，然后保存并发布地图。组合项目须遵循各条目的依赖说明。\n\nPVE 需要进攻阵营、攻守旗标和波次表。寒冬数值效果须搭配视觉脚本并手动同步时间。文档提示 v229+ 移动接口及奇观检测兼容风险。",
    "instructions_en": "Open the map in the editor, choose Mods → Add a modification, add the required codes, then save and publish the map. Follow each bundle's dependency notes.\n\nPVE needs an attacker faction, flags, and wave tables. Winter effects need the visual partner and manually matched timings. README notes v229+ movement and wonder-check compatibility concerns.",
    "compatibility": "PVE 需要进攻阵营、攻守旗标和波次表。寒冬数值效果须搭配视觉脚本并手动同步时间。文档提示 v229+ 移动接口及奇观检测兼容风险。\n\nMod 代码已与作者公开文档核对；未在当前游戏版本中实测，不能保证发布 ID 仍可用。Stable 是来源标记，并非 WS ATLAS 测试结论。",
    "compatibility_en": "PVE needs an attacker faction, flags, and wave tables. Winter effects need the visual partner and manually matched timings. README notes v229+ movement and wonder-check compatibility concerns.\n\nMod codes match the authors' public documentation. Current in-game availability and compatibility have not been tested. Stable is the source's label, not a WS ATLAS certification.",
    "game_version": "",
    "mod_code": "Wave PVE: mod-MtNRIa6lil4\nWinter: mod-RzcO3BQ8KF9\nWinter visual: mod-TbiDQ5Es1k0",
    "source_url": "https://github.com/AdrienRmd/War_Selection_Modding/blob/main/mods/wave/README.md",
    "license": "MIT (repository-level declaration)",
    "map_slug": "",
    "kind": "bundle",
    "usage_status": "unverified"
  },
  {
    "id": "github-nuclear-bomb",
    "title": "可配置核弹",
    "title_en": "Nuclear Bomb",
    "author": "AdrienRmd",
    "summary": "让四种后期飞机获得可配置成本与威力的核弹能力。",
    "summary_en": "Configurable nuclear-bomb capability for four late-game aircraft.",
    "description": "在后期科技后开放飞机核弹，并为间谍核弹设置独立科技门槛。设置面板可调整食物、木材、铁的成本，以及爆炸范围和伤害。每架飞机每局只能投放一枚，适合设计高代价的后期打击规则。",
    "description_en": "Adds technology-gated aircraft nukes and a separate research requirement for the spy's bomb. The settings panel controls food, wood and iron costs, blast radius, and damage. Each aircraft can drop only one bomb per game, creating a costly late-game strike option.",
    "instructions": "在地图编辑器打开地图，进入 Mods → Add a modification，逐个添加所需代码，然后保存并发布地图。组合项目须遵循各条目的依赖说明。\n\n添加单个代码。面板填游戏显示值，不要填乘以 1000 后的引擎原值；先测试科技解锁与其他飞机 Mod 的组合。",
    "instructions_en": "Open the map in the editor, choose Mods → Add a modification, add the required codes, then save and publish the map. Follow each bundle's dependency notes.\n\nAdd the single code. Enter displayed values, not raw engine-scaled numbers. ATLAS advice: test research unlocks and interactions with other aircraft mods.",
    "compatibility": "添加单个代码。面板填游戏显示值，不要填乘以 1000 后的引擎原值；先测试科技解锁与其他飞机 Mod 的组合。\n\nMod 代码已与作者公开文档核对；未在当前游戏版本中实测，不能保证发布 ID 仍可用。Stable 是来源标记，并非 WS ATLAS 测试结论。",
    "compatibility_en": "Add the single code. Enter displayed values, not raw engine-scaled numbers. ATLAS advice: test research unlocks and interactions with other aircraft mods.\n\nMod codes match the authors' public documentation. Current in-game availability and compatibility have not been tested. Stable is the source's label, not a WS ATLAS certification.",
    "game_version": "",
    "mod_code": "mod-ObN4zEbPvC6",
    "source_url": "https://github.com/AdrienRmd/War_Selection_Modding/blob/main/mods/nuclear_bomb/README.md",
    "license": "MIT (repository-level declaration)",
    "map_slug": "",
    "kind": "gameplay",
    "usage_status": "unverified"
  },
  {
    "id": "github-adjust-resources",
    "title": "地图资源调整",
    "title_en": "Adjust Resources",
    "author": "Austin",
    "summary": "统一调整地图中食物、矿物与树木的可采集资源量。",
    "summary_en": "Tune gatherable food, minerals, and wood across a map.",
    "description": "开局时统一重设浆果、鱼群、小麦、石矿和铁矿的单点资源量；树木使用百分比缩放储量。它改变地图经济的起始条件，不是玩家初始国库设置，也不提供资源再生。\n\nAustin 原作，AdrienRmd 修改英文文本。",
    "description_en": "At match start, sets per-node quantities for berries, fish, wheat, stone, and iron, while scaling tree wood by a percentage. It changes the map's resource supply, not the player's starting treasury, and does not regenerate exhausted resources.\n\nOriginal by Austin; English-text modifications by AdrienRmd.",
    "instructions": "在地图编辑器打开地图，进入 Mods → Add a modification，逐个添加所需代码，然后保存并发布地图。组合项目须遵循各条目的依赖说明。\n\n添加单个代码。作用范围是全图且只执行一次；树木 100 表示保持原量，并非增加树木数量。",
    "instructions_en": "Open the map in the editor, choose Mods → Add a modification, add the required codes, then save and publish the map. Follow each bundle's dependency notes.\n\nAdd the single code. Applies once, map-wide. Tree value 100 preserves the original wood quantity; it does not add trees.",
    "compatibility": "添加单个代码。作用范围是全图且只执行一次；树木 100 表示保持原量，并非增加树木数量。\n\nMod 代码已与作者公开文档核对；未在当前游戏版本中实测，不能保证发布 ID 仍可用。Stable 是来源标记，并非 WS ATLAS 测试结论。",
    "compatibility_en": "Add the single code. Applies once, map-wide. Tree value 100 preserves the original wood quantity; it does not add trees.\n\nMod codes match the authors' public documentation. Current in-game availability and compatibility have not been tested. Stable is the source's label, not a WS ATLAS certification.",
    "game_version": "",
    "mod_code": "mod-w5wFJbOcfL6",
    "source_url": "https://github.com/AdrienRmd/War_Selection_Modding/blob/main/mods/adjust_resources/README.md",
    "license": "MIT (repository-level declaration)",
    "map_slug": "",
    "kind": "gameplay",
    "usage_status": "unverified"
  },
  {
    "id": "github-economy-gather",
    "title": "采集与仓储工具组",
    "title_en": "Economy Gather",
    "author": "AdrienRmd",
    "summary": "按需调整工人与渔船效率，以及农田、码头、神庙和仓库储量。",
    "summary_en": "Independent gathering, carrying, and building-storage adjustments.",
    "description": "六个独立模块覆盖工人与渔船的采集／携带能力，以及多类建筑的储量比例。地图作者可仅选需要的部分，而不必整套启用。除 Worker 需要直接编辑脚本外，其余五项通过设置面板调整；默认数值另有参考表。",
    "description_en": "Six independent modules cover worker and fishing-boat gathering/carrying plus storage multipliers for several building groups. Map makers can enable only the components they need. Five modules use settings panels; Worker is configured in its script. A separate defaults reference supports baseline comparisons.",
    "instructions": "在地图编辑器打开地图，进入 Mods → Add a modification，逐个添加所需代码，然后保存并发布地图。组合项目须遵循各条目的依赖说明。\n\n没有整套通用代码，逐个添加所选模块。顶层 economy_gather.lua 只是工作笔记，不能作为 Mod 安装。",
    "instructions_en": "Open the map in the editor, choose Mods → Add a modification, add the required codes, then save and publish the map. Follow each bundle's dependency notes.\n\nThere is no single bundle code: add selected modules individually. The top-level economy_gather.lua contains working notes and is not an installable mod.",
    "compatibility": "没有整套通用代码，逐个添加所选模块。顶层 economy_gather.lua 只是工作笔记，不能作为 Mod 安装。\n\nMod 代码已与作者公开文档核对；未在当前游戏版本中实测，不能保证发布 ID 仍可用。Stable 是来源标记，并非 WS ATLAS 测试结论。",
    "compatibility_en": "There is no single bundle code: add selected modules individually. The top-level economy_gather.lua contains working notes and is not an installable mod.\n\nMod codes match the authors' public documentation. Current in-game availability and compatibility have not been tested. Stable is the source's label, not a WS ATLAS certification.",
    "game_version": "",
    "mod_code": "Farm: mod-2CvqnwKDhjl\nFisher: mod-hodZDbghDU6\nQuays: mod-ZssXoR5h0V3\nTemple: mod-ryi4ZIRtmsh\nWarehouse: mod-lBzk9Z47Gu3\nWorker: mod-SUkAWpj8Eqe",
    "source_url": "https://github.com/AdrienRmd/War_Selection_Modding/blob/main/mods/economy_gather/README.md",
    "license": "MIT (repository-level declaration)",
    "map_slug": "",
    "kind": "bundle",
    "usage_status": "unverified"
  },
  {
    "id": "github-wsunitstats",
    "title": "WS Unit Stats 数据与 Modding 参考",
    "title_en": "WS Unit Stats — Data & Modding Reference",
    "author": "IbubussI (repository owner)",
    "summary": "查询单位与科技属性，并辅助浏览 Modding 引擎数据结构。",
    "summary_en": "Unit/research statistics and engine-data navigation for modders.",
    "description": "这是 wsunitstats.com 的源码项目，不是可安装玩法 Mod。网站提供单位和科技数据、研究后的属性比较及引擎数据浏览；Java 导出器从游戏数据生成网站所需内容。可作为设计与核对参数的参考入口。",
    "description_en": "The source project behind wsunitstats.com, not an installable gameplay mod. Its website covers unit/research statistics, research-adjusted values, and engine-data browsing. A Java exporter prepares data for the React interface. Use it as a reference when inspecting or designing mod parameters.",
    "instructions": "参考网站：https://wsunitstats.com\n普通读者可访问网站；自行构建导出器需要 Java 17 与 Maven。没有已核实的游戏内 Mod 代码。",
    "instructions_en": "Reference website: https://wsunitstats.com\nReaders can use the website. Building the exporter requires Java 17 and Maven. No in-game Mod code was verified.",
    "compatibility": "已查看的仓库根目录与 README 未列出明确许可证；不据此推断代码或素材可再分发。",
    "compatibility_en": "No explicit license appeared in the inspected repository root or README; do not infer redistribution rights for code or assets.",
    "game_version": "",
    "mod_code": "",
    "source_url": "https://github.com/IbubussI/wsunitstats-static",
    "license": "",
    "map_slug": "",
    "kind": "tool",
    "usage_status": "reference"
  }
];

export type SourceReference = {
  author:string;
  url:string;
  codes:{label:string;code:string}[];
  verifiedAt:string;
  testedInGame:boolean;
};

// Source verification is deliberately distinct from current in-game testing.
export const sourceReferences:Record<string,SourceReference> = {
  "github-diplomacy": {
    "author": "ShiJueXiangGuan, UIXlangGuan, WaiJiaoMod",
    "url": "https://github.com/AdrienRmd/War_Selection_Modding/blob/main/mods/diplomacy/README.md",
    "codes": [
      {
        "label": "Diplomacy interface",
        "code": "mod-s2u4EUGfise"
      },
      {
        "label": "Gameplay backend",
        "code": "mod-HmXZrJBjwM6"
      },
      {
        "label": "UI framework",
        "code": "mod-KbwSsR2og7a"
      }
    ],
    "verifiedAt": "2026-09-22",
    "testedInGame": false
  },
  "github-wave-winter": {
    "author": "Austin & Nuanyang",
    "url": "https://github.com/AdrienRmd/War_Selection_Modding/blob/main/mods/wave/README.md",
    "codes": [
      {
        "label": "Wave PVE",
        "code": "mod-MtNRIa6lil4"
      },
      {
        "label": "Winter",
        "code": "mod-RzcO3BQ8KF9"
      },
      {
        "label": "Winter visual",
        "code": "mod-TbiDQ5Es1k0"
      }
    ],
    "verifiedAt": "2026-09-22",
    "testedInGame": false
  },
  "github-nuclear-bomb": {
    "author": "AdrienRmd",
    "url": "https://github.com/AdrienRmd/War_Selection_Modding/blob/main/mods/nuclear_bomb/README.md",
    "codes": [
      {
        "label": "Nuclear Bomb",
        "code": "mod-ObN4zEbPvC6"
      }
    ],
    "verifiedAt": "2026-09-22",
    "testedInGame": false
  },
  "github-adjust-resources": {
    "author": "Austin",
    "url": "https://github.com/AdrienRmd/War_Selection_Modding/blob/main/mods/adjust_resources/README.md",
    "codes": [
      {
        "label": "Adjust Resources",
        "code": "mod-w5wFJbOcfL6"
      }
    ],
    "verifiedAt": "2026-09-22",
    "testedInGame": false
  },
  "github-economy-gather": {
    "author": "AdrienRmd",
    "url": "https://github.com/AdrienRmd/War_Selection_Modding/blob/main/mods/economy_gather/README.md",
    "codes": [
      {
        "label": "Farm",
        "code": "mod-2CvqnwKDhjl"
      },
      {
        "label": "Fisher",
        "code": "mod-hodZDbghDU6"
      },
      {
        "label": "Quays",
        "code": "mod-ZssXoR5h0V3"
      },
      {
        "label": "Temple",
        "code": "mod-ryi4ZIRtmsh"
      },
      {
        "label": "Warehouse",
        "code": "mod-lBzk9Z47Gu3"
      },
      {
        "label": "Worker",
        "code": "mod-SUkAWpj8Eqe"
      }
    ],
    "verifiedAt": "2026-09-22",
    "testedInGame": false
  },
  "github-wsunitstats": {
    "author": "IbubussI (repository owner)",
    "url": "https://github.com/IbubussI/wsunitstats-static",
    "codes": [],
    "verifiedAt": "2026-09-22",
    "testedInGame": false
  }
};

export const seedMods:ModEntry[] = [
  ...stalingradSeeds,
  ...githubBodies.map(({id,...body}) => curatedSeed(id,body,"2026-09-22","github"))
];

