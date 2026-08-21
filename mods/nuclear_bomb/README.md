# Nuclear Bomb
**Status:** Stable

## Description
Adds a configurable nuclear bomb to the game. The nuclear bomb unit (id 377) gets its damage and explosion radius set from the mod panel, and four aircraft (ids 316, 330, 355, 361) are equipped with the ability to build and drop one nuclear bomb each, unlocked by the industrial wonder aircraft-drop tech. The spy's nuclear bomb (unit 195, ability 16) is gated behind its own tech.

The mod panel expects "displayed numbers" (e.g. 60000 for 60k); the code multiplies by 1000 to convert to raw engine values.

## Installation
Place `nuclear_bomb.lua` in the game's mod folder (TODO: confirm exact path in the Wars Selection installation) and enable the mod in the in-game mod menu.

## Parameters
| Name       | Default | Effect                                                      |
|------------|---------|-------------------------------------------------------------|
| CostFood   | 60000   | Food cost to build a bomb (displayed value, ×1000 applied)  |
| CostWood   | 60000   | Wood cost to build a bomb (displayed value, ×1000 applied)  |
| CostIron   | 60000   | Iron cost to build a bomb (displayed value, ×1000 applied)  |
| Radius     | 440     | Explosion radius (displayed value, ×1000 applied)           |
| Damage     | 3500    | Bomb damage (displayed value, ×1000 applied)                |

## Technical details
- Bomb unit type: `root.unitType[377]`; ability 0 damages slots 0 and 5, ability id 27, lifetime 9000, tags 15/16 enabled.
- Aircraft unit types: 316, 330, 355, 361 — each gets a new ability spawning unit 377 (lifetime 10000, count 1) and a work entry (makeTime 1, reserveLimit 1, reserveTime 60000, costs from panel).
- Tech ids: 89 (aircraft bomb drop, industrial wonder), 25 (spy nuclear bomb, set on `root.unitType[195].ability.ability[16]`).
- Calls `root.f_recreateModifiedUnitTypes()` after modification.
