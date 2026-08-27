# Mods

New to mods? Start here — the [quick start guide in the root README](../README.md) explains how to install your first mod in a couple of minutes.

Index of all mods in this repository. Each mod lives in its own folder with its `.lua` file(s) and a `README.md` (see `README_TEMPLATE.md`).

How to read the table: **Mod** links to the mod's folder, **Author** credits the mod's author (from the `.lua` file headers; `—` means unknown), **Description** tells you what it changes in one line, **Status** is a colored badge showing how mature it is (![Stable](https://img.shields.io/badge/Status-Stable-brightgreen.svg) = safe for normal games, ![WIP](https://img.shields.io/badge/Status-WIP-orange.svg) = work-in-progress), and **Mod ID** is the in-game ID to add an already-published mod directly to your map (see [how to add a mod by ID](../docs/modding-guide/installation.md#part-3--add-an-existing-already-published-mod-to-your-map) — `—` means not published).

| Mod | Author | Description | Status | Mod ID |
|-----|--------|-------------|--------|--------|
| [nuclear_bomb](nuclear_bomb/) | AdrienRmd | Configurable nuclear bomb; four aircraft can build and drop one bomb each. | ![Stable](https://img.shields.io/badge/Status-Stable-brightgreen.svg) | **`mod-ObN4zEbPvC6`** |
| [adjust_resources](adjust_resources/) | Austin *(modified by AdrienRmd)* | Sets/scales map resource quantities (berries, fish, wheat, stone, iron, trees). | ![Stable](https://img.shields.io/badge/Status-Stable-brightgreen.svg) | **`mod-w5wFJbOcfL6`** |
| [starting_resources](starting_resources/) | AdrienRmd | Configurable starting treasury resources per faction. | ![Stable](https://img.shields.io/badge/Status-Stable-brightgreen.svg) | **`KgbndOUtoob`** *(in base game)* |
| [diplomacy](diplomacy/) | ShiJueXiangGuan, UIXlangGuan, WaiJiaoMod | Player-to-player diplomacy: 3 new buttons — request alliance, declare neutral (peace), declare enemy (war), plus a shared allied victory. | ![Stable](https://img.shields.io/badge/Status-Stable-brightgreen.svg) | 3 scripts — [see README](diplomacy/#mod-ids) |
| [default_gameplay_functions](default_gameplay_functions/) | AdrienRmd | Three variants of the age/civilization gameplay function overrides (load one). | ![WIP](https://img.shields.io/badge/Status-WIP-orange.svg) | — *(in base game)* |
| [victory_conditions](victory_conditions/) | AdrienRmd | Alternative victory/defeat rules: team annihilation, full win/loss engine, king mode. | ![WIP](https://img.shields.io/badge/Status-WIP-orange.svg) | — |
| [colossal_cannon](colossal_cannon/) | JSuisMort | Fully configurable colossal cannon: range, reload, damage, blast radius, turret rotation. | ![Stable](https://img.shields.io/badge/Status-Stable-brightgreen.svg) | **`mod-bsb2JnTBdh9`** |
| [fisher](economy_gather/fisher/) | AdrienRmd | Configurable fishing boats: gather speed (food/sec) and carry capacity, via the settings panel. | ![Stable](https://img.shields.io/badge/Status-Stable-brightgreen.svg) | **`mod-hodZDbghDU6`** |
| [worker](economy_gather/worker/) | AdrienRmd | Per-resource worker gathering: speed and carry capacity for every civilization's worker, edited in code. | ![Stable](https://img.shields.io/badge/Status-Stable-brightgreen.svg) | **`mod-SUkAWpj8Eqe`** |
| [warehouse](economy_gather/warehouse/) | AdrienRmd | Configurable storage capacity (percentage) for every civilization's warehouse, the cargo elephant and the abstract warehouse, via the settings panel. | ![Stable](https://img.shields.io/badge/Status-Stable-brightgreen.svg) | **`mod-lBzk9Z47Gu3`** |
| [temple](economy_gather/temple/) | AdrienRmd | Configurable storage capacity (percentage) for every temple / town center (altar) and the wonder, via the settings panel. | ![Stable](https://img.shields.io/badge/Status-Stable-brightgreen.svg) | **`mod-ryi4ZIRtmsh`** |
| [farm](economy_gather/farm/) | AdrienRmd | Configurable storage capacity (percentage) for every civilization's farm, via the settings panel. | ![Stable](https://img.shields.io/badge/Status-Stable-brightgreen.svg) | **`mod-2CvqnwKDhjl`** |
| [quays](economy_gather/quays/) | AdrienRmd | Configurable storage capacity (percentage) for every civilization's quay (fishing dock), via the settings panel. | ![Stable](https://img.shields.io/badge/Status-Stable-brightgreen.svg) | **`mod-ZssXoR5h0V3`** |
| [sharing_economy](sharing_economy/) | Austin | Team sharing: pooled treasury across allies (all five resources) and shared team population limit — two scripts. | ![WIP](https://img.shields.io/badge/Status-WIP-orange.svg) | — |
| [house_production](house_production/) | AdrienRmd | Configurable periodic income for houses: enable/disable, amount, resource(s) and period, edited in code; negative amounts act as upkeep. | ![Stable](https://img.shields.io/badge/Status-Stable-brightgreen.svg) | **`mod-6WoX8dg4gpk`** |
| [period_piece](period_piece/) | AdrienRmd | Configurable age research: time, cost and minimum workers for every research in every temple, with per-block enable and a stored default balance. | ![Stable](https://img.shields.io/badge/Status-Stable-brightgreen.svg) | **`mod-fnXiRjawrEb`** |
| [fast_period_piece](period_piece/fast_period_piece.lua) | AdrienRmd | Sandbox variant of period_piece: every research takes 3 s, needs 1 worker and costs nothing — for quick age testing. | ![Stable](https://img.shields.io/badge/Status-Stable-brightgreen.svg) | **`mod-ARJwbLUGnHj`** |
| [Italian_paratrooper](Italian_paratrooper/) | Austin *(modified by AdrienRmd)* | Configurable paratrooper drops for the two transport planes: which unit lands and how many. | ![Stable](https://img.shields.io/badge/Status-Stable-brightgreen.svg) | **`mod-7KUQPxJeq67`** |

The six `economy_gather/*` mods in the table form a family — see [economy_gather/README.md](economy_gather/README.md) for the family overview.
