# Warehouse storage capacity
**Status:** Stable
**Author:** AdrienRmd

## Mod ID: `mod-lBzk9Z47Gu3`

> [!TIP]
> **The quickest way to use this mod — no code to copy.** Open your map in the editor → **Mods** → **Add a modification**, paste the ID above, save and publish the map. Full instructions: [Add an existing mod to your map](../../../docs/modding-guide/installation.md#part-3--add-an-existing-already-published-mod-to-your-map).

## What does this mod do?

It makes the **storage capacity** of every **warehouse** (the building that holds the resources your workers gather — how much it can store before it is full) configurable, for every civilization's warehouse, plus the **cargo elephant** (a mobile storage unit) and the **abstract** (generic) warehouse. Each one gets its own setting in the mod's panel. Values are **percentages of the base-game capacity**: `100` = unchanged, `200` = double, `50` = half. It ships with the author's defaults: `100`% Stone Age, `110`% Europe/Asia, `130`% later eras and cargo elephant, `150`% abstract warehouse.

## Quick install
1. Download `warehouse.lua` from this repository.
2. Create a mod in the game's **map editor**: open the editor, go to **Mods** → **My mods** → **+**, give your mod a name and a description, then add it to your map.
3. Start a **private match** on your map with **developer mode** enabled, open your mod, and paste the code with **Edit script**.
4. Relaunch the map — the mod is now active.

Full walkthrough: [docs/modding-guide/installation.md](../../../docs/modding-guide/installation.md)

## Settings

Open the mod's settings panel in the mod menu to change these. **Values are percentages** of the base-game storage capacity (`100` = unchanged). Defaults are the author's tuned capacities (`100` = base game). The code converts to the engine value internally (percentage × 65536 / 100 → `storageMultiplier`).

| Setting name | Default | What it does | Example values |
|--------------|---------|--------------|----------------|
| Stone | 100 | Storage capacity of the stone warehouse (unit 2) | `200` = double capacity |
| Europe | 110 | Storage capacity of the European warehouse (unit 17) | `220` = double capacity |
| Asia | 110 | Storage capacity of the Asian warehouse (unit 30) | `220` = double capacity |
| WesternEurope | 130 | Storage capacity of the Western European warehouse (unit 59) | `260` = double capacity |
| EasternEurope | 130 | Storage capacity of the Eastern European warehouse (unit 60) | `260` = double capacity |
| WesternAsia | 130 | Storage capacity of the Western Asian warehouse (unit 87) | `260` = double capacity |
| EasternAsia | 130 | Storage capacity of the Eastern Asian warehouse (unit 88) | `260` = double capacity |
| ElephantCargo | 130 | Storage capacity of the cargo elephant, the mobile storage unit (unit 124) | `260` = double capacity |
| Abstract | 150 | Storage capacity of the abstract/generic warehouse (unit 191) | `300` = double capacity |

Panel parameter names must match exactly (case-sensitive) — a misnamed parameter silently falls back to its default.

## How it works (for modders)

- Each warehouse is a unit type (`root.unitType[id]`, IDs 2, 17, 30, 59, 60, 87, 88, 124, 191) with a `storageMultiplier` field.
- `storageMultiplier` is a **16.16 fixed-point** value where `65536` (2^16) = 100% — conversion: **storageMultiplier = percentage × 65536 / 100** (110% → 72090).
- The conversion is wrapped in `math.ceil` — engine fields require integers (Lua floats fail with `Type mismatch: Not integer`), and rounding **up** guarantees the stored value is never below the requested percentage: with `math.floor`, 210% became 137625 = 209.999% and the game UI displayed 209%.
- Reads panel values with `getParameterNumber(name, default, min, max)`; bounds are 1–1000, defaults (the author's tuned capacities, 100 = base game) live in the `warehouses` table at the top of the script.
- Prints the applied values to the developer **Console** at load (`[warehouse] Europe (id 17): 110% -> storageMultiplier 72090`) — use it to verify that every panel parameter is read (a value falling back to its default means the panel parameter is missing or misnamed).
- Ends with `root.f_recreateModifiedUnitTypes()`.

## Known issues / notes

- Base value verified in game: `65536` (= 100%) for all nine units (archived in [../DEFAULTS.md](../DEFAULTS.md)).
- Lowering below 100% in a running game where warehouses are already fuller than the new cap is untested.
- Percentages not exactly representable in 16.16 fixed point (e.g. 210% = 137625.6) are stored rounded up (137626 = 210.0015%) — a negligible +0.0015% at most, so the UI displays the requested integer.
