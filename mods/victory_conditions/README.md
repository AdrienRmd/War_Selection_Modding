# Victory Conditions
**Status:** WIP

## Description
A set of alternative victory/defeat rule overrides for the game engine.

- `victory_condition_1.lua` — simple team-annihilation check: once per second, if all surviving players belong to a single team, that team wins (`winTeam`).
- `victory_condition_2.lua` — full win/loss engine override: `checkFactionLose`, `losePlayer`, `winTeam`, handling of `leave`/`serverkick` commands, elimination bookkeeping, and server match-state reporting. `checkFactionLose` always returns `false` by default, so it is meant to be combined with an add-on rule such as the king mode.
- `victory_condition_king.lua` — "King" victory mode: each player must keep their king unit alive; a player whose king dies is eliminated, and the last team with a living king wins. It overrides `checkFactionLose` from `victory_condition_2.lua` and must be loaded **after** it.

## Installation
Place the chosen `.lua` file(s) in the game's mod folder (TODO: confirm exact path in the Wars Selection installation) and enable them in the in-game mod menu. If using the king mode, load order matters: enable `victory_condition_2.lua` first, then `victory_condition_king.lua`.

## Parameters
`victory_condition_1.lua` and `victory_condition_2.lua` have no panel parameters.

`victory_condition_king.lua`:
| Name       | Default | Effect                                             |
|------------|---------|----------------------------------------------------|
| idUniteRoi | 0       | Unit id of the "king" unit (e.g. 253); 0 disables the mode (normal behavior) |

## Technical details
- Engine callbacks used: `addMod({ onTick = ... })` (v1, king), `addTickFunction(onTickWinLoss, ...)` and `addScriptFunction(onScriptWinLoss, ...)` (v2); checks run every 1000 ticks.
- Player/faction iteration helpers: `forEachPlayerLive`, `forEachPlayerFaction`, `forEachControlledFaction`, `forEachPlayerUnit`, `getPlayerOfFaction`.
- v2 kills units of type 253 or 374 on elimination (`scene.kill`), stops other units (`scene.unitStop`), and reports match state to the server via `root.sendDataToServer = toJson(json)`.
- King mode counts the player's units via `root.scene_0.unit` and treats a player with zero units (game start) as not eliminated.
