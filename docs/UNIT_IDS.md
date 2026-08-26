# Unit & Tech ID Reference

Known unit, tech, and resource IDs for **War Selection**, collected from the mods in [mods/](../mods/) and the [Modding Guide](modding-guide/).

> **This list is incomplete.** If you discover new IDs, please add them via a pull request — one row per ID, with the source where you found it. Rows marked *(draft)* come from [mods/economy_gather/economy_gather.lua](../mods/economy_gather/economy_gather.lua), a working ID list not yet verified in game.

## Units — Workers

Gather rates and carry capacity configurable per resource in [economy_gather/worker](../mods/economy_gather/worker/).

| ID | Type | Name/Role | Source |
|----|------|-----------|--------|
| 1 | unit | Stone Age worker | [worker mod](../mods/economy_gather/worker/worker.lua) |
| 12 | unit | Europe worker | [worker mod](../mods/economy_gather/worker/worker.lua) |
| 31 | unit | Asia worker | [worker mod](../mods/economy_gather/worker/worker.lua) |
| 55 | unit | Western Europe worker | [worker mod](../mods/economy_gather/worker/worker.lua) |
| 56 | unit | Eastern Europe worker | [worker mod](../mods/economy_gather/worker/worker.lua) |
| 89 | unit | Western Asia worker | [worker mod](../mods/economy_gather/worker/worker.lua) |
| 90 | unit | Eastern Asia worker | [worker mod](../mods/economy_gather/worker/worker.lua) |
| 201 | unit | Abstract (generic) worker | [worker mod](../mods/economy_gather/worker/worker.lua) |
| 349 | unit | China worker | [worker mod](../mods/economy_gather/worker/worker.lua) |

## Units — Fishing boats

| ID | Type | Name/Role | Source |
|----|------|-----------|--------|
| 26 | unit | Europe fisher | [fisher mod](../mods/economy_gather/fisher/fisher.lua) |
| 43 | unit | Asia fisher | [fisher mod](../mods/economy_gather/fisher/fisher.lua) |
| 81 | unit | Medieval Europe fisher | [fisher mod](../mods/economy_gather/fisher/fisher.lua) |
| 169 | unit | Eastern Asia fisher | [fisher mod](../mods/economy_gather/fisher/fisher.lua) |
| 244 | unit | Abstract (generic) fisher | [fisher mod](../mods/economy_gather/fisher/fisher.lua) |
| 353 | unit | China fisher | [fisher mod](../mods/economy_gather/fisher/fisher.lua) |
| 452 | unit | Western Asia fisher | [fisher mod](../mods/economy_gather/fisher/fisher.lua) |

## Units — Special / military

| ID | Type | Name/Role | Source |
|----|------|-----------|--------|
| 155 | unit | Example unit (multi-weapon, used in guide) | [Modding Guide: Attack](modding-guide/attack.md) |
| 195 | unit | Spy | [nuclear_bomb mod](../mods/nuclear_bomb/nuclear_bomb.lua) |
| 268 | unit | Sikh soldier (chops wood, converts to food) *(draft)* | [economy_gather draft](../mods/economy_gather/economy_gather.lua) |
| 301 | unit | Engineer (chops wood without gathering) *(draft)* | [economy_gather draft](../mods/economy_gather/economy_gather.lua) |
| 316 | unit | Aircraft (bomb-capable) | [nuclear_bomb mod](../mods/nuclear_bomb/nuclear_bomb.lua) |
| 330 | unit | Aircraft (bomb-capable) | [nuclear_bomb mod](../mods/nuclear_bomb/nuclear_bomb.lua) |
| 355 | unit | Aircraft (bomb-capable) | [nuclear_bomb mod](../mods/nuclear_bomb/nuclear_bomb.lua) |
| 361 | unit | Aircraft (bomb-capable) | [nuclear_bomb mod](../mods/nuclear_bomb/nuclear_bomb.lua) |
| 377 | unit | Nuclear bomb (air-dropped) | [nuclear_bomb mod](../mods/nuclear_bomb/nuclear_bomb.lua) |

## Buildings — Storage (warehouses)

Capacity configurable in [economy_gather/warehouse](../mods/economy_gather/warehouse/).

| ID | Type | Name/Role | Source |
|----|------|-----------|--------|
| 2 | building | Stone Age warehouse | [warehouse mod](../mods/economy_gather/warehouse/warehouse.lua) |
| 17 | building | Europe warehouse | [warehouse mod](../mods/economy_gather/warehouse/warehouse.lua) |
| 30 | building | Asia warehouse | [warehouse mod](../mods/economy_gather/warehouse/warehouse.lua) |
| 59 | building | Western Europe warehouse | [warehouse mod](../mods/economy_gather/warehouse/warehouse.lua) |
| 60 | building | Eastern Europe warehouse | [warehouse mod](../mods/economy_gather/warehouse/warehouse.lua) |
| 87 | building | Western Asia warehouse | [warehouse mod](../mods/economy_gather/warehouse/warehouse.lua) |
| 88 | building | Eastern Asia warehouse | [warehouse mod](../mods/economy_gather/warehouse/warehouse.lua) |
| 124 | unit | Cargo elephant (mobile storage) | [warehouse mod](../mods/economy_gather/warehouse/warehouse.lua) |
| 191 | building | Abstract (generic) warehouse | [warehouse mod](../mods/economy_gather/warehouse/warehouse.lua) |

## Buildings — Town halls (temples)

*(draft — from the [economy_gather ID list](../mods/economy_gather/economy_gather.lua), not yet verified in game)*

| ID | Type | Name/Role | Source |
|----|------|-----------|--------|
| 0 | building | Altar (Stone Age town hall) | economy_gather draft |
| 10 | building | Temple (base) | economy_gather draft |
| 11 | building | Europe temple | economy_gather draft |
| 28 | building | Asia temple | economy_gather draft |
| 51 | building | Western Europe temple | economy_gather draft |
| 52 | building | Eastern Europe temple | economy_gather draft |
| 83 | building | Western Asia temple | economy_gather draft |
| 84 | building | Eastern Asia temple | economy_gather draft |
| 190 | building | Abstract (generic) temple | economy_gather draft |
| 239 | building | Wonder | economy_gather draft |
| 254 | building | Great Britain temple | economy_gather draft |
| 264 | building | India temple | economy_gather draft |
| 271 | building | Turkey temple | economy_gather draft |
| 282 | building | Germany temple | economy_gather draft |
| 302 | building | Russia temple | economy_gather draft |
| 323 | building | France temple | economy_gather draft |
| 337 | building | China temple | economy_gather draft |
| 358 | building | Japan temple | economy_gather draft |
| 372 | building | Poland temple | economy_gather draft |
| 385 | building | Austro-Hungary temple | economy_gather draft |
| 402 | building | Persia/Iran temple | economy_gather draft |
| 436 | building | Italy temple | economy_gather draft |

## Buildings — Farms

*(draft — from the [economy_gather ID list](../mods/economy_gather/economy_gather.lua), not yet verified in game)*

| ID | Type | Name/Role | Source |
|----|------|-----------|--------|
| 54 | building | Europe farm | economy_gather draft |
| 63 | building | Asia farm | economy_gather draft |
| 70 | building | Eastern Europe farm | economy_gather draft |
| 95 | building | Western Europe farm | economy_gather draft |
| 112 | building | Western Asia farm | economy_gather draft |
| 139 | building | Eastern Asia farm | economy_gather draft |
| 193 | building | Abstract (generic) farm | economy_gather draft |
| 339 | building | China farm | economy_gather draft |
| 412 | building | Persia/Iran farm | economy_gather draft |

## Buildings — Other

| ID | Type | Name/Role | Source |
|----|------|-----------|--------|
| 274 | building | Supply anchor template (copied by the shared population mod; base role unconfirmed) | [sharing_economy mod](../mods/sharing_economy/shared_population.lua) |
| 284 | building | Colossal cannon (turreted heavy cannon, turret 0 / weapon 0) | [colossal_cannon mod](../mods/colossal_cannon/colossal_cannon.lua) |

## Techs

| ID | Type | Name/Role | Source |
|----|------|-----------|--------|
| 25 | tech | Spy nuclear bomb | [nuclear_bomb mod](../mods/nuclear_bomb/nuclear_bomb.lua) |
| 89 | tech | Aircraft bomb drop (industrial wonder) | [nuclear_bomb mod](../mods/nuclear_bomb/nuclear_bomb.lua) |

## Treasury resources (fixed IDs)

Used for example in `treasury.resources[id]`, `income.value[id]`, `destroyReward[id]` — see [resources-and-income](modding-guide/resources-and-income.md).

| ID | Resource |
|----|----------|
| 0 | Food |
| 1 | Wood |
| 2 | Iron |
| 3 | Gold |
| 4 | Oil |

## Resource node tags (bitmask)

Tags matching map resource nodes, from [adjust_resources](../mods/adjust_resources/adjust_resources.lua) — combine several with `+`.

| Value | Tag | Resource node |
|-------|-----|---------------|
| 1 | TAG_BERRY | Berries |
| 2 | TAG_WOOD | Trees |
| 4 | TAG_SMALL_FISH | Small fish |
| 8 | TAG_BIG_FISH | Big fish |
| 16 | TAG_IRON | Iron |
| 64 | TAG_STONE | Stone |
| 128 | TAG_WHEAT | Wheat |

## How to find unit IDs

- **[WS Unit Stats](https://wsunitstats.com/en)** — the community site with full unit/tech stats and a [modding section](https://wsunitstats.com/en/modding). This is the easiest way to look up an ID.
- Inspect values in-game, e.g. `gameplay.root.unitType[155].attack.weapon` (see the [Modding Guide README](modding-guide/README.md)).
- Grep the existing mods and guide for `unitType[<id>]` and `researchAny` / tech IDs.

Once you have confirmed an ID, please open a pull request to add it to the tables above.
