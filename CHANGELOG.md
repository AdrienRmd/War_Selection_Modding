# Changelog

All notable changes to this project will be documented in this file. Format based on Keep a Changelog; versioning follows SemVer.

## [Unreleased]

### Added

- `colossal_cannon` mod: fully configurable colossal cannon (unit 284) — range, reload, damage, blast radius, hits per shot, environment damage and turret rotation speed, all exposed as settings-panel parameters with safety checks (`distanceStop > distanceMax`, `distanceMin < distanceMax`).

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
