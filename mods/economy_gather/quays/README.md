# Quay storage capacity
**Status:** Stable

## Author: AdrienRmd

## Mod ID: `mod-ZssXoR5h0V3`

> [!TIP]
> **The quickest way to use this mod — no code to copy.** Open your map in the editor → **Mods** → **Add a modification**, paste the ID above, save and publish the map. Full instructions: [Add an existing mod to your map](../../../docs/modding-guide/installation.md#part-3--add-an-existing-already-published-mod-to-your-map).

## What does this mod do?

It makes the **storage capacity** of every **quay** (the dock where fishing boats drop off food) configurable, for every civilization's quay, each with its own setting in the mod's panel. Values are **percentages of the base-game capacity**: `100` = unchanged, `200` = double, `50` = half. It ships with the author's defaults: `110`% Europe/Asia, `130`% later eras, `150`% abstract quay.

## Quick install
1. Download `quays.lua` from this repository.
2. Create a mod in the game's **map editor**: open the editor, go to **Mods** → **My mods** → **+**, give your mod a name and a description, then add it to your map.
3. Start a **private match** on your map with **developer mode** enabled, open your mod, and paste the code with **Edit script**.
4. Relaunch the map — the mod is now active.

Full walkthrough: [docs/modding-guide/installation.md](../../../docs/modding-guide/installation.md)

## Settings

Open the mod's settings panel in the mod menu to change these. **Values are percentages** of the base-game storage capacity (`100` = unchanged). Defaults are the author's tuned capacities. The code converts to the engine value internally (percentage × 65536 / 100 → `storageMultiplier`).

| Setting name | Default | What it does | Example values |
|--------------|---------|--------------|----------------|
| Europe | 110 | Storage capacity of the European quay (unit 21) | `220` = double capacity |
| Asia | 110 | Storage capacity of the Asian quay (unit 35) | `220` = double capacity |
| EasternEurope | 130 | Storage capacity of the Eastern European quay (unit 68) | `260` = double capacity |
| WesternEurope | 130 | Storage capacity of the Western European quay (unit 93) | `260` = double capacity |
| WesternAsia | 130 | Storage capacity of the Western Asian quay (unit 118) | `260` = double capacity |
| EasternAsia | 130 | Storage capacity of the Eastern Asian quay (unit 144) | `260` = double capacity |
| Abstract | 150 | Storage capacity of the abstract/generic quay (unit 247) | `300` = double capacity |

Panel parameter names must match exactly (case-sensitive) — a misnamed parameter silently falls back to its default.

## How it works (for modders)

- Each quay is a unit type (`root.unitType[id]`, IDs 21, 35, 68, 93, 118, 144, 247) with a `storageMultiplier` field — same mechanism as the [warehouse](../warehouse/README.md), [temple](../temple/README.md) and [farm](../farm/README.md) mods.
- `storageMultiplier` is a **16.16 fixed-point** value where `65536` (2^16) = 100% — conversion: **storageMultiplier = percentage × 65536 / 100** (110% → 72090).
- The conversion is wrapped in `math.ceil` — engine fields require integers (Lua floats fail with `Type mismatch: Not integer`), and rounding **up** guarantees the stored value is never below the requested percentage.
- Reads panel values with `getParameterNumber(name, default, min, max)`; bounds are 1–1000, defaults (the author's tuned capacities, 100 = base game) live in the `quays` table at the top of the script — edit them there if you prefer not to create 7 panel parameters.
- Prints the applied values to the developer **Console** at load (`[quay] Europe (id 21): 110% -> storageMultiplier 72090`) — use it to verify that every panel parameter is read (a value falling back to its default means the panel parameter is missing or misnamed).
- Ends with `root.f_recreateModifiedUnitTypes()`.

## Known issues / notes

- Untested in game — same code path as the warehouse mod (verified there), but the quay `storageMultiplier` base value (`65536` = 100%) is presumed, not verified.
- Lowering below 100% in a running game where quays are already fuller than the new cap is untested.
- Percentages not exactly representable in 16.16 fixed point (e.g. 210% = 137625.6) are stored rounded up (137626 = 210.0015%) — a negligible +0.0015% at most, so the UI displays the requested integer.
