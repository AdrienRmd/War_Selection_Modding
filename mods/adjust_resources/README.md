# Adjust Resources
**Status:** Stable

## Description
Adjusts the quantities of environmental resources on the whole map at the start of a game. Berries, small fish, big fish, wheat, stone and iron deposits are set to absolute values, while trees are scaled by a percentage. All values are configurable in-game from the mod panel (displayed values; the code converts to raw engine values by multiplying by 1000).

## Installation
Place `adjust_resources.lua` in the game's mod folder (TODO: confirm exact path in the Wars Selection installation) and enable the mod in the in-game mod menu.

## Parameters
| Name             | Default | Effect                                              |
|------------------|---------|-----------------------------------------------------|
| baies            | 1000    | Berries amount per bush (displayed, ×1000 applied)  |
| petitsPoissons   | 500     | Small fish amount (displayed, ×1000 applied)        |
| grosPoissons     | 1000    | Big fish amount (displayed, ×1000 applied)          |
| ble              | 10000   | Wheat amount per field (displayed, ×1000 applied)   |
| pierre           | 10000   | Stone amount per deposit (displayed, ×1000 applied) |
| fer              | 10000   | Iron amount per deposit (displayed, ×1000 applied)  |
| arbresPourcent   | 100     | Tree amount in percent (100 = unchanged, no ×1000)  |

## Technical details
- Resource tags (powers of 2, engine constants): berry 1, wood 2, small fish 4, big fish 8, iron 16, stone 64, wheat 128.
- Finds objects via `root.scene[0].envs.f_search(0, 0, 1000000000, tag)` and rewrites `envs[id].health`.
- Registered with `addMod({ onStart = onStart })`.
