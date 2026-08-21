# Nuclear Bomb
**Status:** Stable

## What does this mod do?

This mod adds a **nuclear bomb** to the game — the most powerful weapon available. Four late-game aircraft get a new ability: for a big pile of resources, each aircraft can build and drop **one** nuclear bomb, wiping out everything in a huge area (both troops and buildings). The bomb is locked behind a late-game technology (the industrial-era aircraft tech), so it cannot be used right at the start of a match. The mod also makes the spy's nuclear bomb unlockable through its own technology instead of being free.

You control how expensive, how big, and how deadly the bomb is from the mod's settings panel in-game.

## Quick install

1. Download `nuclear_bomb.lua` from this repository.
2. Create a mod in the game's **map editor**: open the editor, go to **Mods** → **My mods** → **+**, give your mod a name and a description, then add it to your map.
3. Start a **private match** on your map with **developer mode** enabled, open your mod, and paste the code with **Edit script**.
4. Relaunch the map — the mod is now active.

Full walkthrough: [docs/modding-guide/installation.md](../../docs/modding-guide/installation.md)

**Already published?** If this mod has been published in-game, you can add it to your map directly by its ID instead of copying the code — see [Add an existing mod to your map](../../docs/modding-guide/installation.md#part-3--add-an-existing-already-published-mod-to-your-map).

Mod ID: `N/A — not published yet` *(edit this line with the `mod-...` ID once published)*

## Settings

Open the mod's settings panel in the mod menu to change these. **Values are "displayed numbers"** — you type the number exactly as you want it shown in the game (the mod multiplies by 1000 internally to get the engine value). For example, `60000` means 60,000 food.

| Setting name | Default | What it does | Example values |
|--------------|---------|--------------|----------------|
| CostFood | 60000 | Food needed for an aircraft to build one bomb (displayed value, so 60000 = 60,000 food) | `120000` for a pricier bomb |
| CostWood | 60000 | Wood needed to build one bomb | `10000` for a cheaper bomb |
| CostIron | 60000 | Iron needed to build one bomb | `60000` (default) |
| Radius | 440 | Size of the explosion area — bigger = wider destruction | `880` for double the blast area |
| Damage | 3500 | Damage dealt to everything hit by the blast | `3500` (default) |

## How it works (for modders)

- Bomb unit type: `root.unitType[377]` — ability 0 gets `damages[0]`/`damages[5]` = Damage, `radius` = Radius, ability id 27, lifetime 9000, tags 15/16 enabled.
- Aircraft unit types 316, 330, 355, 361: their ability/work lists are cleared (`f_clear`) and rebuilt with one ability spawning unit 377 (lifetime 10000, count 1) and one work entry (makeTime 1, reserveLimit 1, reserveTime 60000, `costProcess[0..2]` = Food/Wood/Iron costs).
- Tech ids: 89 (aircraft bomb drop, industrial era) gates the aircraft ability via `requirements.researchAny`; 25 (spy nuclear bomb) is set on `root.unitType[195].ability.ability[16]`.
- Ends with `root.f_recreateModifiedUnitTypes()`.

## Known issues / notes

- All panel values are "displayed numbers" multiplied by ×1000 in code — do not enter raw engine values in the panel.
- Each aircraft can only drop a single bomb per game (`reserveLimit = 1`).
