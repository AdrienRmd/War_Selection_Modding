# Adjust Resources
**Status:** Stable

## Mod ID: `mod-w5wFJbOcfL6`

> [!TIP]
> **The quickest way to use this mod — no code to copy.** Open your map in the editor → **Mods** → **Add a modification**, paste the ID above, save and publish the map. Full instructions: [Add an existing mod to your map](../../docs/modding-guide/installation.md#part-3--add-an-existing-already-published-mod-to-your-map).

## What does this mod do?

This mod changes **how much food and raw materials sit on the map** when a game starts. "Resources" are the things your workers gather: berry bushes, fish, wheat fields, stone and iron deposits, and trees (wood). By default some are plentiful and some are scarce — this mod lets you set the exact amount for every bush, fish spot, field, and deposit on the whole map, and to grow or shrink forests by a percentage.

Want a map dripping with food but almost no stone? Set berries to 50000 and stone to 500. Want thicker forests? Set trees to 200 (%). Everything is adjusted automatically the moment the game starts.

## Quick install

1. Download `adjust_resources.lua` from this repository.
2. Create a mod in the game's **map editor**: open the editor, go to **Mods** → **My mods** → **+**, give your mod a name and a description, then add it to your map.
3. Start a **private match** on your map with **developer mode** enabled, open your mod, and paste the code with **Edit script**.
4. Relaunch the map — the mod is now active.

Full walkthrough: [docs/modding-guide/installation.md](../../docs/modding-guide/installation.md)

If you prefer, use the **Mod ID** at the top of this page to add the mod directly, without copying any code.

## Settings

Open the mod's settings panel in the mod menu to change these. **Setting names match the variable names in the mod code**. Amounts are "displayed numbers" — type the number exactly as you want it shown in the game (the mod multiplies by 1000 internally). For example, `10000` means 10,000 wheat per field. The trees setting is different: it is a **percentage**, where 100 = unchanged.

![The Adjust Resources settings panel in the map editor](../../assets/adjust_resources/settings_panel.png)

| Setting name | Default | What it does | Example values |
|--------------|---------|--------------|----------------|
| `BERRY_AMOUNT` | 1000 | Food in each berry bush | `50000` = 50,000 per bush |
| `SMALL_FISH_AMOUNT` | 500 | Food in each small fish spot | `5000` = 5,000 per spot |
| `BIG_FISH_AMOUNT` | 1000 | Food in each big fish spot | `10000` = 10,000 per spot |
| `WHEAT_AMOUNT` | 10000 | Food in each wheat field | `100000` = 100,000 per field |
| `STONE_AMOUNT` | 10000 | Stone in each deposit | `500` = 500 per deposit |
| `IRON_AMOUNT` | 10000 | Iron in each deposit | `50000` = 50,000 per deposit |
| `WOOD_PCT` | 100 | Wood in trees, as a percentage of normal (100 = unchanged; no ×1000 applied) | `200` = double wood, `50` = half wood |

## How it works (for modders)

- Resource tags (engine constants, powers of 2): berry 1, wood 2, small fish 4, big fish 8, iron 16, stone 64, wheat 128.
- Reads panel values with `getParameterNumber(name, default, min, max)`; amounts ×1000, trees kept as a percentage.
- Finds every environmental object on the map via `root.scene[0].envs.f_search(0, 0, 1000000000, tag)` and rewrites `envs[id].health` (the stored quantity): `SetResource` sets an absolute value, `ScaleResource` multiplies by percent.
- Registered via `addMod({ onStart = onStart })`; prints a per-resource count to the log.

## Known issues / notes

- Applies once at game start — it does not respawn or regenerate resources during the match.
- Sets absolute values per resource node; it cannot target specific map regions (whole map only).
