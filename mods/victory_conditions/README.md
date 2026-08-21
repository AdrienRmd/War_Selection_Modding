# Victory Conditions
**Status:** WIP

## What does this mod do?

This mod changes **how a match is won or lost**. It contains three files; you choose the rule set you want:

- `victory_condition_1.lua` — **"Last team standing" (simple):** the game ends and the surviving team wins as soon as only one team's players are left alive. Losing means every one of your units is destroyed.
- `victory_condition_2.lua` — **"Last team standing" (full engine):** the same basic idea, but it also handles players leaving, being kicked, score positions, and reporting results to the server. On its own nobody can lose; it is designed to be combined with the king mode below.
- `victory_condition_king.lua` — **"King" mode:** every player gets a special "king" unit. If your king dies, you are eliminated on the spot. The last team with a living king wins. Combine it with `victory_condition_2.lua` for a "protect your king" match type.

## Quick install

1. Download the `.lua` file(s) you want from this repository — either `victory_condition_1.lua` alone, or `victory_condition_2.lua` plus `victory_condition_king.lua` for king mode.
2. Create a mod in the game's **map editor**: open the editor, go to **Mods** → **My mods** → **+**, give your mod a name and a description, then add it to your map.
3. Start a **private match** on your map with **developer mode** enabled, open your mod, and paste the code with **Edit script**.
4. Relaunch the map — the mod is now active.

Full walkthrough: [docs/modding-guide/installation.md](../../docs/modding-guide/installation.md)

**Already published?** If this mod has been published in-game, you can add it to your map directly by its ID instead of copying the code — see [Add an existing mod to your map](../../docs/modding-guide/installation.md#part-3--add-an-existing-already-published-mod-to-your-map).

Mod ID: `N/A — not published yet` *(king mode is still in development)*

**Important for king mode:** load order matters. Enable `victory_condition_2.lua` **first**, then `victory_condition_king.lua` (the king file must override functions from the other).

## Settings

`victory_condition_1.lua` and `victory_condition_2.lua` have no settings.

`victory_condition_king.lua` has one setting, changed in the mod's settings panel in-game:

| Setting name | Default | What it does | Example values |
|--------------|---------|--------------|----------------|
| VictoryConditionUnitId (victory condition unit id) | 0 | The unit type that **is** the victory condition: if a player has units but none of this type alive (their "king" is dead), that player is eliminated. 0 = king mode disabled (normal rules) | `253` (a common king/leader unit), `0` to turn it off |

## How it works (for modders)

- v1: `addMod({ onTick = onTick })`, checks once per second (`currentMoment % 1000 == 0`) whether all surviving players share one team, then calls `winTeam(winTeamId)`.
- v2: registers `addTickFunction(onTickWinLoss, ...)` and `addScriptFunction(onScriptWinLoss, ...)`; defines `checkFactionLose` (returns `false` by default), `losePlayer`, `winTeam`, plus `leave`/`serverkick` command handling via `getParameter("command")`/`getParameter("player")`. On elimination it kills units of type 253/374 (`scene.kill`), stops the rest (`scene.unitStop`), and reports match state via `root.sendDataToServer = toJson(json)`.
- King mode: overrides `checkFactionLose(factionId, faction)` — returns true (faction lost) when the player has units but none of type `VictoryConditionUnitId`; players with zero units (game start) are never eliminated.
- Iteration helpers used: `forEachPlayerLive`, `forEachPlayerFaction`, `forEachControlledFaction`, `forEachPlayerUnit`, `getPlayerOfFaction`.

## Known issues / notes

- King mode **must** be enabled after `victory_condition_2.lua`; otherwise the wrong `checkFactionLose` wins and king mode silently does nothing.
- With the default `VictoryConditionUnitId = 0`, king mode is disabled — you must set a unit id in the panel for it to take effect.
- v2's `checkFactionLose` always returns `false` on its own, so v2 without king mode never eliminates anyone by itself.
