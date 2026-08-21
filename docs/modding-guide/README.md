# Wars Selection Modding Guide — Units & Buildings

English reference for modding unit and building parameters in Wars Selection.

## Table of Contents

- [Movement and Vision](movement-and-vision.md) — moveSpeed, viewRange
- [Attack](attack.md) — unit weapons and building turrets: damage, range, recharge
- [Abilities and Upgrades](abilities-and-upgrades.md) — ability.work, ability.enabled, production
- [Health and Armor](health-and-armor.md) — deathability: HP, regeneration, armor, repairs
- [Resources and Income](resources-and-income.md) — periodic income, resource IDs, production costs
- [Workers and Construction](workers-and-construction.md) — build speed, gathering
- [Misc](misc.md) — radius, transport, research requirements

## How to use this guide

All parameters are accessed through the `root` (or `gameplay.root`) object, indexed by the unit type ID:

```lua
root.unitType[unit_id].movement.moveSpeed
```

### Value units

The game stores values in internal units that differ from what is displayed in-game:

| Quantity | Rule | Example |
|---|---|---|
| Displayed resource/HP/damage values | **1000 = 1 displayed unit** | `11000` = 11 damage |
| Distances | **1000 per meter** | `110000` = 110 m |
| Times | **milliseconds** | `1500` = 1.5 s |

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

You can inspect values in-game, e.g. `gameplay.root.unitType[155].attack.weapon`, or check the game's stats site. A unit can have several weapons (e.g. 3 different shots depending on distance).
