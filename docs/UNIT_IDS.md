# Unit & Tech ID Reference

A starter table of known unit, tech, and resource IDs for **War Selection**, collected from the mods in [mods/](../mods/) and the [Modding Guide](modding-guide/).

> **This list is incomplete.** If you discover new IDs, please add them via a pull request — one row per ID, with the source where you found it.

| ID | Type | Name/Role | Source |
|----|------|-----------|--------|
| 377 | unit | Nuclear bomb (air-dropped) | [nuclear_bomb mod](../mods/nuclear_bomb/nuclear_bomb.lua) |
| 316 | unit | Aircraft (bomb-capable) | [nuclear_bomb mod](../mods/nuclear_bomb/nuclear_bomb.lua) |
| 330 | unit | Aircraft (bomb-capable) | [nuclear_bomb mod](../mods/nuclear_bomb/nuclear_bomb.lua) |
| 355 | unit | Aircraft (bomb-capable) | [nuclear_bomb mod](../mods/nuclear_bomb/nuclear_bomb.lua) |
| 361 | unit | Aircraft (bomb-capable) | [nuclear_bomb mod](../mods/nuclear_bomb/nuclear_bomb.lua) |
| 89 | tech | Aircraft bomb drop (industrial wonder) | [nuclear_bomb mod](../mods/nuclear_bomb/nuclear_bomb.lua) |
| 25 | tech | Spy nuclear bomb | [nuclear_bomb mod](../mods/nuclear_bomb/nuclear_bomb.lua) |
| 195 | unit | Spy | [nuclear_bomb mod](../mods/nuclear_bomb/nuclear_bomb.lua) |
| 155 | unit | Example unit (multi-weapon, used in guide) | [Modding Guide: Attack](modding-guide/attack.md) |
| 284 | building | Colossal cannon (turreted heavy cannon, turret 0 / weapon 0) | [colossal_cannon mod](../mods/colossal_cannon/colossal_cannon.lua) |

## How to find unit IDs

- **[WS Unit Stats](https://wsunitstats.com/en)** — the community site with full unit/tech stats and a [modding section](https://wsunitstats.com/en/modding). This is the easiest way to look up an ID.
- Inspect values in-game, e.g. `gameplay.root.unitType[155].attack.weapon` (see the [Modding Guide README](modding-guide/README.md)).
- Grep the existing mods and guide for `unitType[<id>]` and `researchAny` / tech IDs.

Once you have confirmed an ID, please open a pull request to add it to the table above.
