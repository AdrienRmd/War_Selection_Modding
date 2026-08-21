# Starting Resources
**Status:** Stable

## Description
Sets each controlled faction's starting treasury resources at the beginning of a game, and raises the storage limit of all five resource slots to the maximum. All amounts are configurable in-game from the mod panel (displayed values; the code converts to raw engine values by multiplying by 1000).

## Installation
Place `starting_resources.lua` in the game's mod folder (TODO: confirm exact path in the Wars Selection installation) and enable the mod in the in-game mod menu.

## Parameters
| Name | Default | Effect                                          |
|------|---------|-------------------------------------------------|
| res0 | 100     | Starting amount of resource slot 0 (displayed, ×1000 applied) |
| res1 | 250     | Starting amount of resource slot 1 (displayed, ×1000 applied) |
| res2 | 0       | Starting amount of resource slot 2 (displayed, ×1000 applied) |
| res3 | 0       | Starting amount of resource slot 3 (displayed, ×1000 applied) |
| res4 | 0       | Starting amount of resource slot 4 (displayed, ×1000 applied) |

## Technical details
- Runs at game start via `addStartFunction(initOnStartResourcesInit, "initOnStartResourcesInit")`.
- Iterates factions with `forEachControlledFaction`, writing `factions[id].treasury.resources[0..4]` and setting `limits[i] = 4000000000` for each slot.
