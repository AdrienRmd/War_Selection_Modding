# Period piece
**Status:** Stable

## Author: AdrienRmd

## Mod ID: `mod-fnXiRjawrEb`

> [!TIP]
> **The quickest way to use this mod — no code to copy.** Open your map in the editor → **Mods** → **Add a modification**, paste the ID above, save and publish the map. Full instructions: [Add an existing mod to your map](../../docs/modding-guide/installation.md#part-3--add-an-existing-already-published-mod-to-your-map).

## Fast variant — Mod ID: `mod-ARJwbLUGnHj`

> [!TIP]
> **The quickest way to use this mod — no code to copy.** Open your map in the editor → **Mods** → **Add a modification**, paste the ID above, save and publish the map. Full instructions: [Add an existing mod to your map](../../docs/modding-guide/installation.md#part-3--add-an-existing-already-published-mod-to-your-map).

**`fast_period_piece.lua`** is the same mod with sandbox test values: **every research takes 3 seconds, needs 1 worker and costs nothing** — meant for quickly walking through the ages while testing a map, not for balanced games. Use the regular mod above (`mod-fnXiRjawrEb`) for real matches. Setting a block to `enabled = false` in the fast variant still falls back to the full reference balance (the `defaults` table is unchanged), and the console lines are prefixed `[fast]` so you can tell which variant is loaded.

## What does this mod do?

This mod re-balances **every age research in every temple** — how long each research takes, what it costs (food, wood, iron, gold, oil), and the minimum number of workers needed to start it. Ages are the big evolutions you research in temples (Europe, Asia, Iron Age, Western/Eastern Europe/Asia, the nation choices, the late "IR2" industrial researches, and the Wonder). A research offered by several temples (Iron Age, Abstract age, Wonder) is defined once and applied to all of them.

Every block has an `enabled` flag: set it to `true` to apply your edited values, or `false` to fall back to the mod's stored reference balance.

## Quick install

1. Download `period_piece.lua` from this repository.
2. Create a mod in the game's **map editor**: open the editor, go to **Mods** → **My mods** → **+**, give your mod a name and a description, then add it to your map.
3. Start a **private match** on your map with **developer mode** enabled, open your mod, and paste the code with **Edit script**.
4. Relaunch the map — the mod is now active.

Full walkthrough: [docs/modding-guide/installation.md](../../docs/modding-guide/installation.md)

If you prefer, use the **Mod ID** at the top of this page to add the mod directly, without copying any code.

## Settings

No settings panel — all values are edited directly in the `1. VALUES` section at the top of `period_piece.lua`. Each research block has these fields:

| Field | What it does |
|-------|--------------|
| `enabled = true/false` | `true` applies the block's values; `false` applies the stored DEFAULT values (the `defaults` table in section 2 of the file) |
| `time = N` | research time in seconds (`0` still leaves a 1-second wait: engine minimum) |
| `worker_requirements_addition = N` | minimum workers to START the research; the worker unit type is chosen by the temple automatically |
| `food/wood/iron/gold/oil = { amount = N }` | cost, one line per resource, in displayed units (x1000 internally) |

Default balance shipped in the file:

| Research | time | workers | food / wood / iron |
|----------|------|---------|--------------------|
| europe_age, asia_age | 90 s | 20 | – / 450 / – |
| iron_age (shared) | 120 s | 30 | – / – / 500 |
| western/eastern_europe_age, western/eastern_asia_age | 150 s | 40 | – / 2500 / 1000 |
| late_western/eastern_europe_age, late_western/eastern_asia_age | 180 s | 50 | 3000 / 2500 / 2000 |
| abstract_age + the 12 nation ages | 300 s | 50 | 8000 / 6000 / 4000 |
| wonder_age (shared, work 5 of the 13 IR2 temples) | 240 s | 50 | 10000 / 7000 / 5000 |
| the 13 IR2 researches | 240 s | 50 | 12000 / 8000 / 5000 |

## Example — one research, explained

Every research (age/tech) in this mod is configured by a small block like this one at the top of `period_piece.lua` — here is what each field does. This block is real: `great_britain_IR2_age` is the late industrial (IR2) research of the Great Britain temple (unit 254).

```lua
local great_britain_IR2_age = {
    enabled = true,
    time  = 240,
    worker_requirements_addition = 50,
    food  = { amount = 12000 },
    wood  = { amount = 8000 },
    iron  = { amount = 5000 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}
```

| Field | Meaning |
|-------|---------|
| `enabled` | `true` applies this block's values; `false` falls back to the mod's stored reference balance for that research (the `defaults` table in the file) |
| `time` | research time in **seconds** (240 = 4 minutes; converted to milliseconds internally) |
| `worker_requirements_addition` | minimum number of workers that must stand in the temple to start the research (written directly as the requirement's minimum; the worker unit type is chosen by the temple) |
| `food/wood/iron/gold/oil = { amount = N }` | the research **cost** in displayed units (12000 food = 12,000 food); `0` = that resource is not charged — only positive amounts make sense here |

Costs and times are "displayed numbers" — the mod converts them (×1000) internally, so type them as you want to see them in game.

## How it works (for modders)

- 20 temples, 56 (temple, work id) pairs, 38 research value blocks; shared blocks referenced by several temples (iron_age, late_western_europe_age, abstract_age, austro_hungary_age, india_age, wonder_age).
- Engine writes: `root.unitType[id].ability.work[wid].makeTime` (milliseconds), `.costProcess[rid]` (x1000; 0 food, 1 wood, 2 iron, 3 gold, 4 oil).
- Worker requirement: `root.unitType[id].ability.ability[wid].requirements.unit[0]` set to `{ type = worker_type, min = N, max = 65535 }`, element created with `f_create()` when missing. Per-temple `worker_type`: 55/56/89/90 (era temples 51/52/83/84), 201 (the 13 IR2 temples); temples 10/11/28 have none — only `min` is written and the game-chosen type is kept.
- Every entry runs inside `pcall` with `[age] WARN/ERROR` console lines and a final `[age] done: X applied, Y skipped, Z failed` summary; `root.f_recreateModifiedUnitTypes()` after the loop; registered with `addMod({ onStart = ... })`.
- Fast variant: `fast_period_piece.lua` — identical structure and logic; all 38 value blocks set to `time = 3`, `worker_requirements_addition = 1`, zero costs; same `defaults` table.

## Known issues / notes

- `time = 0` still leaves a 1-second wait (engine minimum).
- `worker_requirements_addition = 0` lets a player pass the age immediately — but everything from the previous age is deleted when the age changes.
- All changes happen at script load: after editing the Lua file you must re-paste the script into your in-game mod (the game does not read this repository).
- The committed `india_IR2_age` block carries a test value (2 workers instead of 50); the `defaults` entry still holds 50.
