# Temple (town center) storage capacity
**Status:** Stable

## Author: AdrienRmd

## Mod ID: `mod-ryi4ZIRtmsh`

> [!TIP]
> **The quickest way to use this mod — no code to copy.** Open your map in the editor → **Mods** → **Add a modification**, paste the ID above, save and publish the map. Full instructions: [Add an existing mod to your map](../../../docs/modding-guide/installation.md#part-3--add-an-existing-already-published-mod-to-your-map).

## What does this mod do?

It makes the **storage capacity** of every **temple / town center** (the building each civilization starts with — called "altar" in the game files) and the **wonder** configurable, for every era and civilization, each with its own setting in the mod's panel. Values are **percentages of the base-game capacity**: `100` = unchanged, `200` = double, `50` = half. It ships with the author's defaults: `100`% Stone Age / base temple / wonder, `110`% Europe/Asia, `130`% later eras and nations, `150`% abstract temple.

## Quick install
1. Download `temple.lua` from this repository.
2. Create a mod in the game's **map editor**: open the editor, go to **Mods** → **My mods** → **+**, give your mod a name and a description, then add it to your map.
3. Start a **private match** on your map with **developer mode** enabled, open your mod, and paste the code with **Edit script**.
4. Relaunch the map — the mod is now active.

Full walkthrough: [docs/modding-guide/installation.md](../../../docs/modding-guide/installation.md)

## Settings

Open the mod's settings panel in the mod menu to change these. **Values are percentages** of the base-game storage capacity (`100` = unchanged). Defaults are the author's tuned capacities. The code converts to the engine value internally (percentage × 65536 / 100 → `storageMultiplier`).

| Setting name | Default | What it does | Example values |
|--------------|---------|--------------|----------------|
| Altar | 100 | Storage capacity of the Stone Age altar (unit 0) | `200` = double capacity |
| Temple | 100 | Storage capacity of the base temple (unit 10) | `200` = double capacity |
| Europe | 110 | Storage capacity of the European temple (unit 11) | `220` = double capacity |
| Asia | 110 | Storage capacity of the Asian temple (unit 28) | `220` = double capacity |
| WesternEurope | 130 | Storage capacity of the Western European temple (unit 51) | `260` = double capacity |
| EasternEurope | 130 | Storage capacity of the Eastern European temple (unit 52) | `260` = double capacity |
| WesternAsia | 130 | Storage capacity of the Western Asian temple (unit 83) | `260` = double capacity |
| EasternAsia | 130 | Storage capacity of the Eastern Asian temple (unit 84) | `260` = double capacity |
| Abstract | 150 | Storage capacity of the abstract/generic temple (unit 190) | `300` = double capacity |
| Wonder | 100 | Storage capacity of the wonder (unit 239) | `200` = double capacity |
| GreatBritain | 130 | Storage capacity of the Great Britain temple (unit 254) | `260` = double capacity |
| India | 130 | Storage capacity of the India temple (unit 264) | `260` = double capacity |
| Turkey | 130 | Storage capacity of the Turkey temple (unit 271) | `260` = double capacity |
| Germany | 130 | Storage capacity of the Germany temple (unit 282) | `260` = double capacity |
| Russia | 130 | Storage capacity of the Russian temple (unit 302) | `260` = double capacity |
| France | 130 | Storage capacity of the France temple (unit 323) | `260` = double capacity |
| China | 130 | Storage capacity of the China temple (unit 337) | `260` = double capacity |
| Japan | 130 | Storage capacity of the Japan temple (unit 358) | `260` = double capacity |
| Poland | 130 | Storage capacity of the Poland temple (unit 372) | `260` = double capacity |
| AustriaHungary | 130 | Storage capacity of the Austria-Hungary temple (unit 385) | `260` = double capacity |
| PersiaIran | 130 | Storage capacity of the Persia/Iran temple (unit 402) | `260` = double capacity |
| Italy | 130 | Storage capacity of the Italy temple (unit 436) | `260` = double capacity |

Panel parameter names must match exactly (case-sensitive) — a misnamed parameter silently falls back to its default.

## How it works (for modders)

- Each temple is a unit type (`root.unitType[id]`, IDs 0, 10, 11, 28, 51, 52, 83, 84, 190, 239, 254, 264, 271, 282, 302, 323, 337, 358, 372, 385, 402, 436) with a `storageMultiplier` field — same mechanism as the [warehouse mod](../warehouse/README.md).
- `storageMultiplier` is a **16.16 fixed-point** value where `65536` (2^16) = 100% — conversion: **storageMultiplier = percentage × 65536 / 100** (110% → 72090).
- The conversion is wrapped in `math.ceil` — engine fields require integers (Lua floats fail with `Type mismatch: Not integer`), and rounding **up** guarantees the stored value is never below the requested percentage.
- Reads panel values with `getParameterNumber(name, default, min, max)`; bounds are 1–1000, defaults (the author's tuned capacities, 100 = base game) live in the `temples` table at the top of the script — edit them there if you prefer not to create 22 panel parameters.
- Prints the applied values to the developer **Console** at load (`[temple] Europe (id 11): 110% -> storageMultiplier 72090`) — use it to verify that every panel parameter is read (a value falling back to its default means the panel parameter is missing or misnamed).
- Ends with `root.f_recreateModifiedUnitTypes()`.

## Known issues / notes

- Untested in game — same code path as the warehouse mod (verified there), but the temple `storageMultiplier` base value (`65536` = 100%) is presumed, not verified.
- Lowering below 100% in a running game where temples are already fuller than the new cap is untested.
- Percentages not exactly representable in 16.16 fixed point (e.g. 210% = 137625.6) are stored rounded up (137626 = 210.0015%) — a negligible +0.0015% at most, so the UI displays the requested integer.
