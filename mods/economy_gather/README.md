# Economy Gather
**Status:** Stable

## Author: AdrienRmd

This folder is a **family of six independent mods** that adjust the game's economy values — how fast workers and fishing boats gather, how much they carry, and how much buildings store. Install only the ones you want: each sub-mod is a separate mod with its own settings, its own README and its own published Mod ID.

| Mod | What it configures | Configured via | Mod ID |
|-----|--------------------|----------------|--------|
| [farm](farm/) | Farm storage capacity, as a percentage of the base game, for every civilization's farm | Settings panel | `mod-2CvqnwKDhjl` |
| [fisher](fisher/) | Fishing boat gather speed (food/sec) and carry capacity (food carried), per civilization | Settings panel | `mod-hodZDbghDU6` |
| [quays](quays/) | Quay (fishing dock) storage capacity, as a percentage of the base game, per civilization | Settings panel | `mod-ZssXoR5h0V3` |
| [temple](temple/) | Temple / town center and wonder storage capacity, as a percentage of the base game | Settings panel | `mod-ryi4ZIRtmsh` |
| [warehouse](warehouse/) | Warehouse storage capacity (including the cargo elephant and the abstract warehouse), as a percentage | Settings panel | `mod-lBzk9Z47Gu3` |
| [worker](worker/) | Worker gathering per resource — speed (resource/sec) and bag size (resource carried), per civilization | Edit the VALUES section in the code (~44 worker × resource pairs, too many for a panel) | `mod-SUkAWpj8Eqe` |

Five of the six are configured from the mod's settings panel; **worker** is edited directly in its script. In every mod the code converts your values to the engine's internal scales — see each sub-mod's README for the exact settings and defaults.

## Base-game values (DEFAULTS.md)

Before changing a value, check [DEFAULTS.md](DEFAULTS.md) — the archive of every unit's base-game gather speeds, carry capacities and storage multipliers, in both engine and displayed formats, including the conversion rules used by the engine (`perTick` = speed per second × 50, `bagSize` = carried × 1000, and `storageMultiplier` where 65536 = 100%). Use it to revert any change.

## About economy_gather.lua

[economy_gather.lua](economy_gather.lua) holds internal working notes (unit ID lists) — it is not a mod you install.

## Installation

Each sub-mod's README has a **Quick install** section (see the table above). For the general walkthrough — creating a mod in the map editor, pasting the code, troubleshooting — read [docs/modding-guide/installation.md](../../docs/modding-guide/installation.md).
