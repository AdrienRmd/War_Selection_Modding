# <Mod Name>
**Status:** WIP | Stable

## Author: <your name>

*Modified by <name> (<what you changed>)* *(optional — remove this line if the mod is entirely yours)*

## Mod ID: `<mod-xxxxxxxxxxx>`

> [!TIP]
> **The quickest way to use this mod — no code to copy.** Open your map in the editor → **Mods** → **Add a modification**, paste the ID above, save and publish the map. Full instructions: [Add an existing mod to your map](../../docs/modding-guide/installation.md#part-3--add-an-existing-already-published-mod-to-your-map).

*(Fill in the `mod-...` ID once the mod is published. If it is not published yet, remove this section and write instead a note like: "Not published yet — work in progress." If the functions already exist in the base game, say so.)*

## What does this mod do?
<plain-language paragraph for someone who has never installed a mod — no jargon, briefly explain any game terms used>

## Quick install
1. Download `<mod_file>.lua` from this repository.
2. Create a mod in the game's **map editor**: open the editor, go to **Mods** → **My mods** → **+**, give your mod a name and a description, then add it to your map.
3. Start a **private match** on your map with **developer mode** enabled, open your mod, and paste the code with **Edit script**.
4. Relaunch the map — the mod is now active.

Full walkthrough: [docs/modding-guide/installation.md](../../docs/modding-guide/installation.md)

## Settings
Only if the mod has panel parameters (`getParameterNumber`/`getParameter` in the code). Use this table and explain units and the displayed-value ×1000 convention where it applies (e.g. "60000 = 60,000 food displayed"):

| Setting name | Default | What it does | Example values |
|--------------|---------|--------------|----------------|
| <name>       | <default> | <plain-language effect, with units> | `<value>` = <what it means> |

If the mod has no parameters, write instead: "No settings — just enable and play."

## How it works (for modders)
<short technical section: unit/tech ids touched, key code paths, registration hooks (`addMod`, `addStartFunction`, etc.). Keep it concise.>

## Known issues / notes
<anything flagged in code comments (bugs, side effects, load-order requirements), or "None known".>
