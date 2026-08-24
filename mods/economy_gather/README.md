# Fisher production
**Status:** Stable

> Not published in-game yet — copy the code (below), or publish it yourself and add the Mod ID here.

## What does this mod do?

It makes the production of every **fishing boat** (the boat that gathers food from fish spots) configurable. Each civilization has its own fisher boat — Europe, Asia, Medieval Europe, Eastern Asia, Western Asia, China and the abstract (generic) one — and each one gets its own setting in the mod's panel, in **food per second**. Want all fishers to gather 9 food per second? Set every field to `9`. Want to only buff the Chinese fisher? Change just `China`.

## Quick install
1. Download `fisher.lua` from this repository.
2. Create a mod in the game's **map editor**: open the editor, go to **Mods** → **My mods** → **+**, give your mod a name and a description, then add it to your map.
3. Start a **private match** on your map with **developer mode** enabled, open your mod, and paste the code with **Edit script**.
4. Relaunch the map — the mod is now active.

Full walkthrough: [docs/modding-guide/installation.md](../../docs/modding-guide/installation.md)

## Settings

Open the mod's settings panel in the mod menu to change these. **Values are displayed numbers in food per second** — type `9` and the boat gathers 9 food per second. Unlike most mods here, there is no ×1000 convention: the code converts to the engine's `perTick` internally (×50).

| Setting name | Default | What it does | Example values |
|--------------|---------|--------------|----------------|
| Europe | 5.4 | Food per second of the European fisher boat (unit 26) | `9` = 9 food/sec |
| Asia | 4.4 | Food per second of the Asian fisher boat (unit 43) | `9` = 9 food/sec |
| MedievalEurope | 7 | Food per second of the Medieval European fisher boat (unit 81) | `9` = 9 food/sec |
| EasternAsia | 7 | Food per second of the Eastern Asian fisher boat (unit 169) | `9` = 9 food/sec |
| WesternAsia | 6 | Food per second of the Western Asian fisher boat (unit 452) | `9` = 9 food/sec |
| China | 8 | Food per second of the Chinese fisher boat (unit 353) | `9` = 9 food/sec |
| Abstract | 10 | Food per second of the abstract/generic fisher boat (unit 244) | `9` = 9 food/sec |

Panel parameter names must match exactly (case-sensitive) — a misnamed parameter silently falls back to its default.

## How it works (for modders)

- Each fisher is a unit type (`root.unitType[id]`, IDs 26, 43, 81, 169, 452, 353, 244) whose gather rate is `movement.gather[0].perTick` — resource `0` = food (see [docs/modding-guide/workers-and-construction.md](../../docs/modding-guide/workers-and-construction.md)).
- Engine scale: `55 perTick = 1.1 food/sec`, i.e. **perTick = food/sec × 50** (5 game ticks per second). The panel takes food/sec and the code multiplies ×50.
- The ×50 conversion is wrapped in `math.floor` — the engine field requires integers, and Lua floats fail with `Type mismatch: Not integer`.
- Reads panel values with `getParameterNumber(name, default, 0, 100)`; defaults are the base-game rates (4.4–10 food/sec).
- Prints the applied values to the developer **Console** at load (`[fisher] Europe fisher (id 26): 9.00/sec (perTick 450)`) — use it to verify that every panel parameter is read (a value falling back to its default means the panel parameter is missing or misnamed).
- Ends with `root.f_recreateModifiedUnitTypes()`.

## Known issues / notes

- Only the food gather rate (`gather[0]`) is changed; carry capacity (`bagSize`) and storage search distance (`findStorageDistance`) keep their base values.
- Very high values (e.g. `100`/sec) may make boats fill up and trip to the warehouse constantly — consider also raising `bagSize` if you push production up.
