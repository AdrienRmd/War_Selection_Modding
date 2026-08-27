# Default Gameplay Functions
**Status:** WIP

## Author: AdrienRmd

## What does this mod do?

This mod fixes/extends a hidden part of the game rules: how the game decides **which "age" (technology era) and which civilization a player has reached**, based on the technologies they have researched. The game uses this internally for things like what units and upgrades you can access. The three files here are three versions of the same override — they differ only in how many civilizations they support at the industrial age (version 1 supports up to civilization 18, version 2 up to 19, version 3 up to 20).

**You only need this mod if the base game mis-detects your age or civilization** (for example after a game update added new civilizations). For most players it changes nothing visible.

## Quick install

1. Download **exactly one** of `mod_default_gameplay_functions_1.lua`, `mod_default_gameplay_functions_2.lua`, or `mod_default_gameplay_functions_3.lua` from this repository — pick the version matching your game's civilization count (when in doubt, try version 3, the most complete).
2. Create a mod in the game's **map editor**: open the editor, go to **Mods** → **My mods** → **+**, give your mod a name and a description, then add it to your map.
3. Start a **private match** on your map with **developer mode** enabled, open your mod, and paste the code with **Edit script**.
4. Relaunch the map — the mod is now active.

Full walkthrough: [docs/modding-guide/installation.md](../../docs/modding-guide/installation.md)

> [!NOTE]
> These functions already exist in the base game — there is no mod ID to add. This repository keeps the source code for reference and customization.

**Important:** never enable two versions at the same time — they are alternatives, not add-ons.

## Settings

No settings — just enable and play.

## How it works (for modders)

- Overrides the engine helpers `getAgeFaction(faction)` and `getAgeFactionIndustrial(researchesState, default)`, returning `{age, civilization}`.
- `getAgeFaction` reads `root.faction[faction].researchState` and walks a research tree: ids 3/4 select the branch, 1/2 age 1, 5/6/7/8 plus 15/16/17/9 the age-3 civilizations.
- `getAgeFactionIndustrial` maps industrial research id pairs to civilizations via `isResearchComplete`: e.g. 93/59 → civ 8, 114/64 → 9, ... 136/61 → 18 (v1), 145/69 → 19 (v2), 146/71 → 20 (v3).
- The three files are identical except for how many industrial pairs are listed.

## Known issues / notes

- Loading more than one version together is not supported — the functions have the same names and would conflict (last loaded wins).
- The correct version depends on your game version's civilization count; no auto-detection is performed.
