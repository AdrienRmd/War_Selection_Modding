# Starting Resources
**Status:** Stable

## What does this mod do?

This mod changes **how many resources you start a game with** — the stockpile in your warehouse/treasury at the very beginning, before anyone has gathered anything. Normally you start with a small fixed amount; with this mod you decide exactly how much of each of the five resources every player begins with. It also removes the storage cap so your starting stockpile is never clipped.

Great for skipping the slow early game, or for a quick "build anything you want" sandbox match.

## Quick install

1. Download `starting_resources.lua` from this repository.
2. Put the file in the game's mod folder: `[TODO: exact game mod folder path]`
3. Start the game, open the mod menu, and enable "Starting Resources".
4. Start a game — the mod is now active.

## Settings

Open the mod's settings panel in the mod menu to change these. Values are "displayed numbers" — type the number exactly as you want it shown in the game (the mod multiplies by 1000 internally). For example, `100` means 100 of that resource shown in your treasury. The slots (res0 to res4) follow the game's resource order shown in your treasury bar.

| Setting name | Default | What it does | Example values |
|--------------|---------|--------------|----------------|
| res0 | 100 | Starting amount of resource slot 0 | `1000` = 1,000 of that resource |
| res1 | 250 | Starting amount of resource slot 1 | `250` (default) |
| res2 | 0 | Starting amount of resource slot 2 | `500` = 500 of that resource |
| res3 | 0 | Starting amount of resource slot 3 | `0` (default) |
| res4 | 0 | Starting amount of resource slot 4 | `0` (default) |

## How it works (for modders)

- Reads panel values with `getParameterNumber("res0".."res4", default, 0, 1000000)` and multiplies ×1000 for raw engine values.
- Runs at game start via `addStartFunction(initOnStartResourcesInit, "initOnStartResourcesInit")`.
- Iterates factions with `forEachControlledFaction` and writes `factions[id].treasury.resources[0..4]`, setting `limits[i] = 4000000000` (max storage cap) for each slot.

## Known issues / notes

- Applies to every player/faction symmetrically — it cannot give one player more than another.
- The ×1000 displayed-to-raw conversion means the effective per-slot panel maximum is 1,000,000 displayed.
