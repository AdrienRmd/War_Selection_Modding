# Wars Selection Modding Guide — Units & Buildings

English reference for modding unit and building parameters in Wars Selection — written for total beginners. No prior modding experience needed: a mod is just a small text file with a few lines of Lua.

## Your first mod in 5 minutes

This mod changes one unit's health. You don't need to install anything except the game itself.

1. **Create the file** — open any text editor (Notepad works), and copy-paste this:

   ```lua
   function onStart(var)
       root.unitType[1].deathability.health = 200000 -- unit 1 now has 200 HP
   end
   addMod({ onStart = onStart })
   ```

2. **Save it** as `my_first_mod.lua` (make sure it ends in `.lua`, not `.txt`).
3. **Install it** — place the file in the game's mod folder (TODO: confirm the exact path in your Wars Selection installation).
4. **Enable it** — start the game, open the **mod menu**, and enable `my_first_mod`.
5. **Test in game** — start a match with unit 1 and check its health: it now shows 200 instead of 100.

It worked? Congratulations — every other mod in this repository follows the exact same pattern, only with different parameters changed.

## How the code works

Every mod follows this shape (this is the real pattern used by the mods in [mods/](../../mods/), e.g. [adjust_resources.lua](../../mods/adjust_resources/adjust_resources.lua)):

```lua
function onStart(var)   -- runs once, when the game starts
    -- your changes go here
end
addMod({ onStart = onStart })  -- registers the mod with the game
```

- **All your code goes inside the function** passed to `addMod` (or in other callbacks like `onTick` — see the theme pages below).
- **`root` is the game's data tree** — the whole game configuration, loaded by your mod. You never rebuild it; you just reach into it and change values.
- **`root.unitType[id]` addresses one unit type**: pick the unit's ID (see [UNIT_IDS.md](../UNIT_IDS.md)), then walk down to the parameter you want, e.g. `root.unitType[1].movement.moveSpeed`. Buildings are unit types too — same access.
- A quick way to explore: inspect values in-game, e.g. `gameplay.root.unitType[155].attack.weapon`. A unit can have several weapons (up to 3 different shots depending on distance).

## Value units — read this once

The game stores values in internal units that differ from what you see on screen:

| What you want | Internal rule | Example |
|---|---|---|
| 1 displayed resource / HP / damage | **1000** | `11000` = 11 damage, `100000` HP = 100 HP |
| 1 meter of distance | **1000** | `110000` = 110 m |
| 1 second of time | **1000 ms** | `1500` = 1.5 s |
| Move speed | use **multiples of 16** | `32`, `48`, `64`… |

So if you want "11 damage", write `11 * 1000 = 11000` in the code.

## Table of Contents

- [Movement and Vision](movement-and-vision.md) — moveSpeed, viewRange
- [Attack](attack.md) — unit weapons and building turrets: damage, range, recharge
- [Abilities and Upgrades](abilities-and-upgrades.md) — ability.work, ability.enabled, production
- [Health and Armor](health-and-armor.md) — deathability: HP, regeneration, armor, repairs
- [Resources and Income](resources-and-income.md) — periodic income, resource IDs, production costs
- [Workers and Construction](workers-and-construction.md) — build speed, gathering
- [Misc](misc.md) — radius, transport, research requirements

## How to read this guide

Sections are tagged with a color legend telling you how safe a change is:

- 🟢 **Easy and safe** — change the value, it just works.
- 🟡 **Be careful** — works, but has side effects you should know about.
- 🔴 **Known bugs / avoid** — documented to misbehave; better left alone.
- ⚠️ **Unknown behavior** — not fully tested; experiment at your own risk.

> Pages that currently contain ⚠️ unknown sections: [Abilities and Upgrades](abilities-and-upgrades.md), [Health and Armor](health-and-armor.md), [Workers and Construction](workers-and-construction.md).

### Resource IDs

Used everywhere a resource index appears (`cost.Order`, `income.value`, `costProcess`, `healMeCost`, `destroyReward`, `movement.gather`):

| ID | Resource |
|---|---|
| 0 | Food |
| 1 | Wood |
| 2 | Iron |
| 3 | Gold |
| 4 | Oil |

### Finding IDs

Unit and tech IDs are listed in [UNIT_IDS.md](../UNIT_IDS.md). You can also inspect values in-game, e.g. `gameplay.root.unitType[155].attack.weapon`, or check the game's stats site.
