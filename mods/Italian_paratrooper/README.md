# Italian Paratrooper
**Status:** Stable

## Author: Austin

*Modified by AdrienRmd (English texts)*

## Mod ID: `mod-7KUQPxJeq67`

> [!TIP]
> **The quickest way to use this mod — no code to copy.** Open your map in the editor → **Mods** → **Add a modification**, paste the ID above, save and publish the map. Full instructions: [Add an existing mod to your map](../../docs/modding-guide/installation.md#part-3--add-an-existing-already-published-mod-to-your-map).

## What does this mod do?

This mod lets you change **which soldiers jump out of the two paratrooper transport planes, and how many of them land**. "Paratroopers" are infantry units that a plane drops by parachute behind enemy lines. By default, the first plane (unit 444) drops 7 of one soldier type and the second plane (unit 448) drops 7 of another. With this mod you can pick any unit ID for each plane's drop and set the squad size (1 to 20) — for example, making a plane drop 10 elite infantry instead of 7 regular ones.

## Quick install

1. Download `italian_paratrooper.lua` from this repository.
2. Create a mod in the game's **map editor**: open the editor, go to **Mods** → **My mods** → **+**, give your mod a name and a description, then add it to your map.
3. Start a **private match** on your map with **developer mode** enabled, open your mod, and paste the code with **Edit script**.
4. Relaunch the map — the mod is now active.

Full walkthrough: [docs/modding-guide/installation.md](../../docs/modding-guide/installation.md)

If you prefer, use the **Mod ID** at the top of this page to add the mod directly, without copying any code.

## Settings

Open the mod's settings panel in the mod menu to change these. **Setting names match the parameter names in the mod code.** Unit IDs are the game's internal unit numbers — use the ID of a unit that exists on your map.

| Setting name | Default | What it does | Example values |
|--------------|---------|--------------|----------------|
| `unit444` | 205 | Unit ID dropped by the 444 plane (1–999) | `210` = drop unit 210 instead |
| `count444` | 7 | How many units the 444 plane drops (1–20) | `10` = drop 10 units |
| `unit448` | 181 | Unit ID dropped by the 448 plane (1–999) | `185` = drop unit 185 instead |
| `count448` | 7 | How many units the 448 plane drops (1–20) | `5` = drop 5 units |

## How it works (for modders)

- Unit types touched: **444** and **448** (the two transport planes) and **450** / **451** (their paratrooper container unit types).
- `onInit` reads the four panel values with `getParameterNumber(name, default, min, max)`.
- `onStart` rewrites plane 444's first ability parameters to `"ability=paratroopers,pType=450,pCount=<count444>"` and sets container 450's `ability[0].data.unit` to `unit444`; same for 448 → 451.
- Changes are applied with `root.f_recreateModifiedUnitTypes()`; registered via `addMod({ onInit, onStart })`; the chosen configuration is printed to the log.

## Known issues / notes

- The map must actually contain unit types 444/448 and their containers 450/451 — the mod only reconfigures them, it does not create them.
- The chosen unit IDs must be valid, spawnable units for the plane's faction.
