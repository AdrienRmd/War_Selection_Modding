# <Mod Name>
**Status:** WIP | Stable

## What does this mod do?
<plain-language paragraph for someone who has never installed a mod — no jargon, briefly explain any game terms used>

## Quick install
1. Download `<mod_file>.lua` from this repository.
2. Put the file in the game's mod folder: `[TODO: exact game mod folder path]`
3. Start the game, open the mod menu, and enable "<Mod Name>".
4. Start a game — the mod is now active.

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
