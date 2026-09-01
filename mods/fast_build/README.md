# Fast build
**Status:** WIP

## Author: AdrienRmd

## Mod ID: `mod-1YBwE7CPH9l`

> [!TIP]
> **The quickest way to use this mod — no code to copy.** Open your map in the editor → **Mods** → **Add a modification**, paste the ID above, save and publish the map. Full instructions: [Add an existing mod to your map](../../docs/modding-guide/installation.md#part-3--add-an-existing-already-published-mod-to-your-map).

## What does this mod do?

This mod changes how fast **workers construct buildings**, and lets you change it **during the match**. A blue **"Build: x%"** button appears next to the minimap: click it to open five preset buttons (**25% / 50% / 100% / 200% / 400%** of the base-game construction speed) and click a preset — the new speed applies immediately, for every player. The button label always shows the current speed. The speed at match start comes from the mod's settings panel (default 100% = base game).

## Quick install
1. Download `fast_build.lua` from this repository.
2. Create a mod in the game's **map editor**: open the editor, go to **Mods** → **My mods** → **+**, give your mod a name and a description, then add it to your map.
3. Start a **private match** on your map with **developer mode** enabled, open your mod, and paste the code with **Edit script**.
4. Relaunch the map — the "Build: x%" button is now next to the minimap.

Full walkthrough: [docs/modding-guide/installation.md](../../docs/modding-guide/installation.md)

## Settings

| Setting name | Default | What it does | Example values |
|--------------|---------|--------------|----------------|
| `BuildSpeedRatio` | `100` | Construction speed of all builders at match start, in % of the base game (100 = unchanged). | `50` = half speed · `400` = four times faster |

The in-game buttons override this value at any time.

## How it works (for modders)

- Single script with **two roles** (the diplomacy-mod pattern merged into one file): the **visual** context creates an interface from the native `/project/Tools/placingButtons` template (`addInterface`), positions nodes 12-16 / 18 next to the minimap in `onTick`, and sends clicks with `root.session_visual_commands.f_specialCommand`. The **gameplay** context receives the `FastBuild` command, writes `root.unitsBuildSpeedRatio` live (plus `root.f_recreateModifiedUnitTypes()` in a pcall) and confirms with `root.f_playerSpecialCommand` so every player's button updates. Every context-specific call is wrapped in `pcall` — the same script runs in both contexts.
- `placerButton` button ids of the template: 1-5 = nodes 12-16 (presets), 7 = node 18 (menu toggle).
- Presets are the `PRESETS` table at the top of the script.

## Known issues / notes

- **Untested in game** (status WIP): whether the engine applies `root.unitsBuildSpeedRatio` changes made after the match starts, and whether this single-file dual-context layout works, must be confirmed by testing. If the buttons do nothing, the fallback is to split the script into two mods (interface + backend) like the diplomacy mod.
- If another mod of the map also writes `root.unitsBuildSpeedRatio` at load (e.g. `better_batiment` sets 40), the value at match start depends on the mod load order — fix it live with the buttons.
- The preset buttons reuse native "placing" buttons: if the game waits for a terrain click after pressing one, click anywhere on the map to validate.
