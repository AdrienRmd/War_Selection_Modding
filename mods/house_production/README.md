# House income
**Status:** Stable

## Author: AdrienRmd

## Mod ID: `mod-6WoX8dg4gpk`

> [!TIP]
> **The quickest way to use this mod — no code to copy.** Open your map in the editor → **Mods** → **Add a modification**, paste the ID above, save and publish the map. Full instructions: [Add an existing mod to your map](../../docs/modding-guide/installation.md#part-3--add-an-existing-already-published-mod-to-your-map).

## What does this mod do?

It makes the **periodic income** of **houses** configurable (the small trickle of resources a building adds to your treasury on its own, like a mine). For **every civilization's house** (20 houses: Stone Age to Italy) you can **turn the income on or off**, choose the **amount**, the **resource(s)** (food, wood, iron, gold, oil — several at once is possible) and the **period** between two payouts.

**Negative amounts are also supported**: they act as **upkeep** — instead of paying, the house *costs* resources every period, deducted from your treasury for each house of that kind you own (e.g. `-20` iron = -20 iron per house per period). Verified working in game.

Shipped defaults are the base-game values, so the mod changes nothing until you edit it: the Stone Age house keeps its 20 iron every 5.5 s, later houses keep no income.

## Quick install
1. Download `house_production.lua` from this repository.
2. Create a mod in the game's **map editor**: open the editor, go to **Mods** → **My mods** → **+**, give your mod a name and a description, then add it to your map.
3. Start a **private match** on your map with **developer mode** enabled, open your mod, and paste the code with **Edit script**.
4. Relaunch the map — the mod is now active.

Full walkthrough: [docs/modding-guide/installation.md](../../docs/modding-guide/installation.md)

## Settings

No settings panel — edit the **VALUES section** at the top of the script (same principle as the [worker mod](../economy_gather/worker/worker.lua)), one table per house:

```lua
-- Stone Age house (unit 3) -- base game: 20 iron every 5.5 s
local stone_house = {
    enabled = true,
    period  = 5.5,
    food    = { amount = 0 },
    wood    = { amount = 0 },
    iron    = { amount = 20 },   -- set -20 for 20 iron of upkeep per payout instead
    gold    = { amount = 0 },
    oil     = { amount = 0 },
}
```

- `enabled` — `true`/`false`: income on/off (`false` = the house pays and costs nothing).
- `period` — seconds between two payouts (shared by every resource of the house: single engine field). Income keeps the exact value; upkeep periods are rounded to whole seconds by the tick loop.
- `food` / `wood` / `iron` / `gold` / `oil` — `{ amount = N }`: units at each payout. The five lines are all present: **positive** = income, **negative** = upkeep (deducted per house owned), `0` = nothing. Several non-zero resources (any mix of signs) apply all at once.

The treasury is floored at 0: upkeep can drain a faction to zero but never below.

One table per house — all 20 are in the script: `stone_house` (3), `europe_house` (16), `asia_house` (29), `western_europe_house` (57), `eastern_europe_house` (58), `western_asia_house` (85), `eastern_asia_house` (86), `abstract_house` (192), `great_britain_house` (255), `india_house` (265), `turkey_house` (272), `germany_house` (283), `russian_house` (303), `france_house` (324), `china_house` (338), `japan_house` (359), `poland_house` (373), `austro_hungary_house` (386), `persia_iran_house` (403), `italy_house` (437). To give, say, every modern house the Stone Age trickle, copy the `stone_house` fields into its table and set the amounts you want.

## How it works (for modders)

### Income (positive amounts)

- Each house is a unit type (`root.unitType[id]`) with an `income` field — see [resources-and-income](../../docs/modding-guide/resources-and-income.md).
- Engine scales: `income.value = amount × 1000` (1000 = 1 displayed unit), `income.period` in **milliseconds** as an integer (5500 = 5.5 s). ×1000 conversions are wrapped in `math.floor` — engine fields require integers, and Lua floats fail with `Type mismatch: Not integer`.
- When a house is **disabled**, only `income.enabled = false` is written (no amount/period — matches the base-game disabled state). When **enabled**, all five `income.value` slots are reset to 0 before the chosen resource slots are set, so editing the table never leaves an old trickle behind.
- Treasury resource slots are fixed for every house (unlike worker gather slots): 0 food, 1 wood, 2 iron, 3 gold, 4 oil.
- Prints the applied values to the developer **Console** at load (`[house] stone_house (id 3): +20 iron every 5500 ms`; upkeep lines are marked `(negative = upkeep by tick)`).
- Ends with `root.f_recreateModifiedUnitTypes()`.

### Upkeep (negative amounts)

Negative amounts are **never written to `income.value`**: the engine rejects them with `Type mismatch: "Argument 0: Negative value."` and the game **crashes at load** (confirmed in game with a -20 iron test). Instead:

- At load, negative amounts of every enabled house are registered in an `upkeep` table (amount × 1000, period in ms).
- An `onTick` function runs every whole second; when a house kind's period is due, it counts the houses owned by every live player and deducts `count × cost` from the treasury of each faction that player controls (`faction.treasury.resources[rid]`), floored at 0.
- Set `DEBUG = true` in section 3 of the script to print every step to the developer Console (`tick`, house counts per player, before → after treasury values).

### Engine API notes (relevant to any unit-counting mod)

- `forEachPlayerUnit` is **obsolete**: it still runs but its shim crashes every tick with `No match address "findAll"` — use **`forEachPlayerUnit2`** (the engine itself recommends it in a warning).
- Reading `controlledFactions` on `root.player` warns `obsolete property`; read it on **`scene.player[pid].controlledFactions`** instead.
- The per-unit unit list is `scene.units.list` (verified in [shared_population](../sharing_economy/shared_population.lua)).

## Known issues / notes

- House IDs collected from the unit stats site; only the Stone Age house's base income (20 iron / 5.5 s) verified in game — the others presumed to have none (all shipped with base-game defaults).
- **Upkeep is charged per house of that kind**, including houses under construction if the engine lists them as units — not yet verified.
- A player controlling several factions is charged once **per faction** (each faction's treasury pays the full upkeep for the player's houses).
- Upkeep periods are rounded to whole seconds by the tick loop (5.5 s → fires at 6 s marks); income periods keep their exact engine value.
- The upkeep deduction writes to `treasury.resources` directly, so it interacts with [sharing_economy](../sharing_economy/)'s resource pooling: both write the same fields each second. Test before combining.
