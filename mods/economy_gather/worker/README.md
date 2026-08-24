# Worker gathering
**Status:** Stable

## Mod ID: `mod-SUkAWpj8Eqe`

> [!TIP]
> **The quickest way to use this mod — no code to copy.** Open your map in the editor → **Mods** → **Add a modification**, paste the ID above, save and publish the map. Full instructions: [Add an existing mod to your map](../../../docs/modding-guide/installation.md#part-3--add-an-existing-already-published-mod-to-your-map).

## What does this mod do?

It makes every civilization's **worker** (the villager that gathers berries, wood, fish, metal, meat, stone, wheat, rice) configurable **per resource**: each worker × resource pair has its own gather speed (**resource per second**) and bag size (**resource carried** before dropping off at a storage). There are ~44 combinations — too many for a settings panel — so instead you edit the values directly in the **VALUES section at the top of the script**, which is labeled and commented for beginners.

## Quick install
1. Download `worker.lua` from this repository.
2. Create a mod in the game's **map editor**: open the editor, go to **Mods** → **My mods** → **+**, give your mod a name and a description, then add it to your map.
3. Start a **private match** on your map with **developer mode** enabled, open your mod, and paste the code with **Edit script**.
4. Relaunch the map — the mod is now active.

Full walkthrough: [docs/modding-guide/installation.md](../../../docs/modding-guide/installation.md)

## Configuration (no panel — edit the code)

Open `worker.lua` and edit the **VALUES section at the top**: one clearly-labeled block per worker, one line per resource:

```lua
-- Europe worker (unit 12)
local europe_worker = {
    berries    = { speed = 1.2, bag = 20 },
    wood       = { speed = 1.4, bag = 20 },
    small_fish = { speed = 2.0, bag = 30 },
    ...
```

- `speed` = resource per second (`1.1` = 1.1/sec; base values 0.6–4.0 depending on worker and resource).
- `bag` = resource carried before dropping off at a storage (`10` = 10; base values 10–40).
- To leave one entry unchanged, comment out its line — that worker × resource pair keeps its base-game values.
- Workers covered (with unit IDs in the file): Stone Age (1), Europe (12), Asia (31), Western Europe (55), Eastern Europe (56), Western Asia (89), Eastern Asia (90), abstract (201), China (349).
- Resources covered: berries, wood, small fish, metal, meat, stone, wheat, rice — as available per worker.
- Everything below the VALUES section (unit IDs, gather slot order, conversions) is plumbing — don't change it: slots are unit-specific (wood is slot 1 for the Stone Age worker but slot 0 for the Western Europe worker).
- The unmodified base-game values (engine and displayed formats) are archived in [../DEFAULTS.md](../DEFAULTS.md) — use them to revert any change.

## How it works (for modders)

- Each worker is a unit type (`root.unitType[id]`, IDs 1, 12, 31, 55, 56, 89, 90, 201, 349) whose gather parameters live under `movement.gather[slot]` (see [docs/modding-guide/workers-and-construction.md](../../../docs/modding-guide/workers-and-construction.md)). Slot numbers are unit-specific: each worker's slot order is stored in the `workers` table (do-not-change section) and matches the in-game gather array.
- Speed: `movement.gather[slot].perTick`, engine scale `55 perTick = 1.1 /sec`, i.e. **perTick = /sec × 50** (5 game ticks per second). Bag: `movement.gather[slot].bagSize`, engine scale **1000 = 1 carried** (10000 = 10).
- Both conversions are wrapped in `math.floor` — engine fields require integers, and Lua floats fail with `Type mismatch: Not integer`.
- Prints the applied values to the developer **Console** at load (`[worker] europe_worker (id 12) wood [slot 1]: 1.40/sec (perTick 70), bag 20 (bagSize 20000)`); entries left without a value print `unchanged (no value set)`.
- Ends with `root.f_recreateModifiedUnitTypes()`.

## Known issues / notes

- Storage search distance (`findStorageDistance`) keeps its base value.
- High speed with a small bag makes workers trip to the warehouse constantly — raise `bag` along with `speed`.
