# Changelog

All notable changes to this project will be documented in this file. Format based on Keep a Changelog; versioning follows SemVer.

## [Unreleased]

### Added

- `colossal_cannon` mod: fully configurable colossal cannon (unit 284) — range, reload, damage, blast radius, hits per shot, environment damage and turret rotation speed, all exposed as settings-panel parameters with safety checks (`distanceStop > distanceMax`, `distanceMin < distanceMax`).
- `colossal_cannon`: new `Health`, `FirstArmor` and `SecondArmor` settings-panel parameters for the cannon's hit points (base 1500) and armor slot thicknesses (base 8 / 12).
- In-game Mod ID for `colossal_cannon` — `mod-bsb2JnTBdh9` (status: Stable).
- `fisher` mod (`mods/economy_gather/fisher/`): configurable fishing boats for every civilization — per-boat production (food per second, engine `perTick` = food/sec × 50) and per-boat carry capacity (`*Stockage` panel parameters, displayed value = food carried, engine `bagSize` = ×1000; defaults 50–250 food).
- In-game Mod ID for `fisher` — `mod-hodZDbghDU6` (status: Stable); mods reorganized into `mods/economy_gather/fisher/` and `mods/economy_gather/worker/` (one folder per mod).
- `worker` mod (`mods/economy_gather/worker/`): per-resource worker gathering (speed per second and carry capacity) for every civilization's worker — no panel (too many values); a beginner-friendly VALUES section at the top of the script holds one labeled block per worker with displayed values (×50 → `perTick`, ×1000 → `bagSize`), pre-filled with base-game data; unit IDs and gather slot order are kept in a separate do-not-change section.
- `fisher`/`worker`: base-game default values (engine and displayed formats) archived in a single `mods/economy_gather/DEFAULTS.md` covering both mods.
- In-game Mod ID for `worker` — `mod-SUkAWpj8Eqe` (status: Stable).
- `wave` mod family (`mods/wave/`, 3 scripts): Wave PVE — AI attacker faction spawns escalating waves (ages follow the players + 1, tiers, per-player scaling, penalty growth, unit caps, nearest/random targeting, elimination re-targeting, wonder victory); Winter — periodic blizzards reducing unit speeds (70%/50%) and vision (50%, aircraft 70%); Winter visual — cold-blue lighting fades matching the blizzards. Scripts by Austin & Nuanyang, translated from Chinese with English texts by AdrienRmd.
- In-game Mod IDs for `wave` — Wave PVE `mod-MtNRIa6lil4`, Winter `mod-RzcO3BQ8KF9`, Winter visual `mod-TbiDQ5Es1k0` (status: Stable).
- `maps/mer_baltique`: new map mod `period_piece_baltique.lua` (age research time, cost and minimum workers for every temple, shared researches defined once) + README section documenting every age's base-game costs.
- `maps/mer_baltique`: new map mod `better_resource_baltique.lua` (configurable periodic income per house — positive = income, negative = upkeep; edited in the script's VALUES section) and `adjust_resources.lua` renamed to `adjust_resources_baltique.lua`.
- `maps/mer_baltique` `better_resource_baltique`: mines added to the periodic income system — generic (253), Turkey (281), Poland (374): 20 gold income, 8 food + 8 wood upkeep every 10 s (units already exist in-game; the mod only overwrites their income values).
- `fast_build` mod (`mods/fast_build/`): workers' construction speed (`root.unitsBuildSpeedRatio`) adjustable **in game** — a "Build: x%" button next to the minimap (native `placingButtons` interface, diplomacy-mod pattern merged into one dual-context script) opens five presets (25/50/100/200/400 %) applied live via `f_specialCommand`; starting value from the `BuildSpeedRatio` panel parameter (default 100). Verified in game: preset changes apply immediately during the match.
- In-game Mod ID for `fast_build` — `mod-1YBwE7CPH9l` (status: Stable).
- `maps/mer_baltique`: new map mod `better_batiment.lua` — global build/work speed ratios (40 %) and configurable garrison (transport: `enabled`, tag set, `unitLimit`, `volume`) for all 20 houses and 22 temples of the map, plus `BETTER_BATIMENT.md` documenting the values, the engine findings (transport tags are a set, `tags.f_clear()` crashes on temple nodes, `f_recreateModifiedUnitTypes()` required) and the full code.

### Changed

- `colossal_cannon`: `RotationSpeed` now follows the displayed-value ×1000 convention (engine scale: 1000 = 1 s, base 500 = 0.5 s) — the panel takes seconds instead of a raw engine value.
- `maps/mer_baltique`: the six `economy_gather` sub-mods (farm, fisher, quays, temple, warehouse, worker) are merged into the single all-in-one mod `maps/mer_baltique/mods/economy_gather.lua`; panel parameter names are prefixed by category (`Farm*`, `Quay*`, `Temple*`, `Warehouse*`, `Fisher*`) to stay unique in the single settings panel, and worker values remain edited directly in the script's VALUES section.
- `maps/mer_baltique/README.md`: reference documentation of the merged `economy_gather` mod — every default value (farms, quays, temples, warehouses, fishers, workers) with panel parameter names and engine conversions.
- `maps/mer_baltique` `economy_gather`: worker gather speeds set to base-game × 0.55, rounded to 1 decimal (bags unchanged) — e.g. China wood 1.5 → 0.8/sec; README worker table updated to match.
- `maps/mer_baltique` `economy_gather`: worker stone gather speed now equals the worker's wood speed (Europe 0.7 → 0.8, Asia 0.6 → 0.7, Western/Eastern Europe and Western/Eastern Asia 0.6/0.7 → 0.8; abstract and China already equal) — README worker table updated.
- `maps/mer_baltique` `economy_gather`: fisher gather speeds set to base-game × 0.55, rounded to 1 decimal (carry capacities unchanged) — e.g. Europe 5.4 → 3/sec, Abstract 10 → 5.5/sec; README fisher table updated to match.
- `maps/mer_baltique` `economy_gather`: warehouse storage defaults raised × 1.2 — Stone 100 → 120 %, Europe/Asia 110 → 132 %, later eras and cargo elephant 130 → 156 %, Abstract 150 → 180 %; README warehouse table updated.
- `maps/mer_baltique` `economy_gather`: temple storage defaults doubled (× 2) — altar/base temple 100 → 200 %, Europe/Asia 110 → 220 %, later eras 130 → 260 %, abstract, wonder and national temples 150 → 300 %; README temple table updated.
- `maps/mer_baltique` `economy_gather`: quay storage defaults raised × 1.3 — Europe/Asia 110 → 143 %, later eras 130 → 169 %, Abstract 150 → 195 %; README quay table updated.
- `maps/mer_baltique` `period_piece_baltique`: the 13 national IR1 age researches (abstract + austro-hungary, france, germany, great britain, italy, russia, poland, turkey, india, persia, china, japan) raised from 300 s / 50 workers / 8000 food · 6000 wood · 4000 iron to 450 s / 100 workers / 18000 food · 15000 wood · 9500 iron; README Period Piece table updated.
- `maps/mer_baltique` `period_piece_baltique`: early/mid age researches retuned — Europe/Asia choice 90 s/20 workers/450 wood -> 120 s/40/1250 wood; `iron_age` 120 s/30/500 iron -> 170 s/55/250 food · 250 wood · 1450 iron; the 4 region choices 150 s/40/2500 wood · 1000 iron -> 220 s/65/4750 food · 4500 wood · 1750 iron; the 4 `late_*_age` 180 s/50/3000 · 2500 · 2000 -> 250 s/85/9500 · 5500 · 3850; README Period Piece table + base-game diff note updated.
- `maps/mer_baltique` `period_piece_baltique`: the 13 IR2 age researches (abstract + the 12 national ones) raised from 240 s / 50 workers / 12000 food · 8000 wood · 5000 iron to 540 s / 150 workers / 34500 food · 19500 wood · 12500 iron; README Period Piece table + diff note updated.
- `maps/mer_baltique` `better_resource_baltique`: the 12 national IR2 houses (great britain, india, turkey, germany, russia, france, china, japan, poland, austro-hungary, persia, italy) aligned with the generic IR2 house — 20 gold income and 8 wood upkeep every 5.5 s (previously nothing); README House income section added.
- `maps/mer_baltique` `better_resource_baltique`: upkeep extended to food (Europe/Asia houses -2, region houses -4, generic + 12 IR2 houses -8 alongside wood), Asia house wood flipped from +2 income to -2 upkeep, IR2 tier period 5.5 s -> 10 s; README House income section resynced and retitled "revenus des maisons et mines".
- Mod "House income" renamed to **Better resource**: map file `maps/mer_baltique/mods/house_production_baltique.lua` -> `better_resource_baltique.lua`, headers updated; published generic copy lives at `mods/better_resource/better_resource.lua` (base-game values, no mines); README links and section retitled.

### Fixed

- `colossal_cannon`: all ×1000 panel conversions are now floored to integers — Lua floats made the script fail with `Type mismatch: "Argument 0: Not integer"`, silently skipping everything after `rotationSpeed` (health, armor, unit-type rebuild).
- `maps/mer_baltique` `period_piece_baltique`: `india_IR2_age` worker requirement fixed from 2 to 50 (now consistent with every other IR2 research).

## [1.0.0] — 2026-08-21

### Added

- Initial public release with 6 mods: `nuclear_bomb`, `adjust_resources`, `starting_resources`, `diplomacy`, `default_gameplay_functions`, `victory_conditions`.
- Beginner modding guide (8 pages): installation, movement/vision, attack, abilities, health/armor, resources/income, workers/construction, misc.
- Unit & tech ID reference.
- Issue templates (bug report, mod idea).
- Luacheck CI.
- Code of conduct.
- Contributing guide.
- MIT license.
- In-game Mod IDs for published mods:
  - `nuclear_bomb` — `mod-ObN4zEbPvC6`
  - `adjust_resources` — `mod-w5wFJbOcfL6`
  - `starting_resources` — `KgbndOUtoob`
  - `diplomacy` (3 scripts) — `mod-s2u4EUGfise`, `mod-HmXZrJBjwM6`, `mod-KbwSsR2og7a`
- `assets` folder with diplomacy screenshot.

### Credits

- `diplomacy` mod created by ShiJueXiangGuan, UIXlangGuan and WaiJiaoMod; English translation and republication by JSuisMort.
