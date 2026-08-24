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

### Changed

- `colossal_cannon`: `RotationSpeed` now follows the displayed-value ×1000 convention (engine scale: 1000 = 1 s, base 500 = 0.5 s) — the panel takes seconds instead of a raw engine value.

### Fixed

- `colossal_cannon`: all ×1000 panel conversions are now floored to integers — Lua floats made the script fail with `Type mismatch: "Argument 0: Not integer"`, silently skipping everything after `rotationSpeed` (health, armor, unit-type rebuild).

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
  - `adjust_resources` — `mod-GFwbdOCoN77`
  - `starting_resources` — `KgbndOUtoob`
  - `diplomacy` (3 scripts) — `mod-s2u4EUGfise`, `mod-HmXZrJBjwM6`, `mod-KbwSsR2og7a`
- `assets` folder with diplomacy screenshot.

### Credits

- `diplomacy` mod created by ShiJueXiangGuan, UIXlangGuan and WaiJiaoMod; English translation and republication by JSuisMort.
