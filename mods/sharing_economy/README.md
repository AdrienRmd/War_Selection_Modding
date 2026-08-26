# Sharing economy
**Status:** WIP

Not published yet — work in progress.

Two **independent scripts** (one script = one mod in the game): install one or both.

- **`shared_resources.lua`** — team shared treasury
- **`shared_population.lua`** — team shared population (supply) limit

## What do these mods do?

**Team shared resources** pools the treasury of every faction on the same team: each player's income and spending is synced across their allies once per second, for **all five resources** (food, wood, iron, gold, oil). When a player is eliminated, their faction leaves the pool and keeps its current resources.

**Team shared population** shares the team's population limit: every faction of a team sees the team's total supply, so one ally can keep building units using another ally's unused population headroom.

## Quick install
1. Download the script(s) from this repository.
2. Create a mod in the game's **map editor**: open the editor, go to **Mods** → **My mods** → **+**, give your mod a name and a description, then add it to your map. Repeat for the second script if you want both.
3. Start a **private match** on your map with **developer mode** enabled, open your mod, and paste the code with **Edit script**.
4. Relaunch the map — the mod is now active.

Full walkthrough: [docs/modding-guide/installation.md](../../docs/modding-guide/installation.md)

## Settings

Only `shared_population.lua` has a panel parameter:

| Setting name | Default | What it does | Example values |
|--------------|---------|--------------|----------------|
| keepLimit | false | Keep an eliminated player's contribution to the team supply limit | `true` = the team keeps the dead player's population headroom |

## How it works (for modders)

- **shared_resources**: builds teams from live players (`player.controlledFactions`), then every second (`moment % 1000 == 0`) runs a delta sync — each faction's change since the last snapshot is added to a pool, every allied faction is set to the pooled value, snapshots refreshed (no double counting). `onPlayerEliminate` removes the eliminated player's factions from the pool (a team below 2 factions stops syncing).
- **shared_population**: the engine has no API to transfer supply between factions, so the mod spawns invisible **anchor units** (copies of unit type 274 with `viewRange = 0` and selection tags off) at map corner (0,0). A *consumer* anchor takes 10 supply from its faction, a *provider* anchor gives 10 back. Each tick the mod compares each live faction's supply to the team total and creates/removes anchors in steps of 10, keeping the remainder for the next tick.
- Both scripts use the `addMod({ onStart = ..., onTick = ..., onPlayerEliminate = ... })` lifecycle; the eliminated player index is read via `getParameterNumber("player")` (engine-injected event parameter).
- Fix vs the original (mod `wu9w4OL2oV9`): the player↔faction matching now checks `player.controlledFactions[fid]` — the previous version assigned the last alive player to every faction, which broke elimination handling.

## Known issues / notes

- **Needs testing in a private match before publishing** (both scripts).
- Anchor units inherit unit 274's visuals and sit at (0,0) — they should be invisible and non-selectable; verify in game. The original companion `shared_population_visual.lua` was **removed**: it created orphan visual types never linked to the anchors (a no-op).
- `SUPPLY_PER_ANCHOR` (10) is hardcoded — it is the amount of supply transferred per anchor unit.
- Resource sync covers resources 0–4 only (the five treasury resources).
