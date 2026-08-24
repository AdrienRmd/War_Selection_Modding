# Fisher production & capacity
**Status:** Stable

> Not published in-game yet — copy the code (below), or publish it yourself and add the Mod ID here.

## What does this mod do?

It makes every **fishing boat** (the boat that gathers food from fish spots) configurable, in two ways: how fast it gathers (**food per second**) and how much it carries before returning to the dock (**food carried**). Each civilization has its own fisher boat — Europe, Asia, Medieval Europe, Eastern Asia, Western Asia, China and the abstract (generic) one — and each one gets its own pair of settings in the mod's panel. Want all fishers to gather 9 food per second? Set every production field to `9`. Want boats to carry more before docking? Raise the capacity fields.

## Quick install
1. Download `fisher.lua` from this repository.
2. Create a mod in the game's **map editor**: open the editor, go to **Mods** → **My mods** → **+**, give your mod a name and a description, then add it to your map.
3. Start a **private match** on your map with **developer mode** enabled, open your mod, and paste the code with **Edit script**.
4. Relaunch the map — the mod is now active.

Full walkthrough: [docs/modding-guide/installation.md](../../docs/modding-guide/installation.md)

## Settings

Open the mod's settings panel in the mod menu to change these. **Values are displayed numbers** — production is in **food per second** (`9` = 9 food/sec), capacity is in **food carried** (`70` = the boat holds 70 food). The code converts to the engine values internally (production ×50 → `perTick`, capacity ×1000 → `bagSize`).

**Production settings** (food per second):

| Setting name | Default | What it does | Example values |
|--------------|---------|--------------|----------------|
| Europe | 5.4 | Food per second of the European fisher boat (unit 26) | `9` = 9 food/sec |
| Asia | 4.4 | Food per second of the Asian fisher boat (unit 43) | `9` = 9 food/sec |
| MedievalEurope | 7 | Food per second of the Medieval European fisher boat (unit 81) | `9` = 9 food/sec |
| EasternAsia | 7 | Food per second of the Eastern Asian fisher boat (unit 169) | `9` = 9 food/sec |
| WesternAsia | 6 | Food per second of the Western Asian fisher boat (unit 452) | `9` = 9 food/sec |
| China | 8 | Food per second of the Chinese fisher boat (unit 353) | `9` = 9 food/sec |
| Abstract | 10 | Food per second of the abstract/generic fisher boat (unit 244) | `9` = 9 food/sec |

**Carry capacity settings** (food carried):

| Setting name | Default | What it does | Example values |
|--------------|---------|--------------|----------------|
| EuropeStockage | 70 | Food carried by the European fisher boat before returning to the dock | `100` = 100 food |
| AsiaStockage | 50 | Food carried by the Asian fisher boat | `100` = 100 food |
| MedievalEuropeStockage | 150 | Food carried by the Medieval European fisher boat | `200` = 200 food |
| EasternAsiaStockage | 150 | Food carried by the Eastern Asian fisher boat | `200` = 200 food |
| WesternAsiaStockage | 60 | Food carried by the Western Asian fisher boat | `100` = 100 food |
| ChinaStockage | 150 | Food carried by the Chinese fisher boat | `200` = 200 food |
| AbstractStockage | 250 | Food carried by the abstract/generic fisher boat | `300` = 300 food |

Panel parameter names must match exactly (case-sensitive) — a misnamed parameter silently falls back to its default.

## How it works (for modders)

- Each fisher is a unit type (`root.unitType[id]`, IDs 26, 43, 81, 169, 452, 353, 244) whose gather parameters live under `movement.gather[0]` — resource `0` = food (see [docs/modding-guide/workers-and-construction.md](../../docs/modding-guide/workers-and-construction.md)).
- Production: `movement.gather[0].perTick`, engine scale `55 perTick = 1.1 food/sec`, i.e. **perTick = food/sec × 50** (5 game ticks per second). The panel takes food/sec and the code multiplies ×50.
- Capacity: `movement.gather[0].bagSize`, engine scale **1000 = 1 food carried** (70000 = 70 food). The panel takes food carried and the code multiplies ×1000.
- Both conversions are wrapped in `math.floor` — engine fields require integers, and Lua floats fail with `Type mismatch: Not integer`.
- Reads panel values with `getParameterNumber(name, default, min, max)`; production defaults are the base-game rates (4.4–10 food/sec) and capacity defaults (50–250 food) come from the `*_stockage` local variables at the top of the script (`europe_stockage`, `asia_stockage`, …).
- Prints the applied values to the developer **Console** at load (`[fisher] Europe fisher (id 26): 9.00/sec (perTick 450)` / `capacity 70 (bagSize 70000)`) — use it to verify that every panel parameter is read (a value falling back to its default means the panel parameter is missing or misnamed).
- Ends with `root.f_recreateModifiedUnitTypes()`.

## Known issues / notes

- Storage search distance (`findStorageDistance`) keeps its base value.
- High production with a small capacity makes boats trip to the warehouse constantly — raise the `*Stockage` settings along with production.
