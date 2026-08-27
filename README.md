# War Selection Modding

[![Luacheck](https://github.com/AdrienRmd/War_Selection_Modding/actions/workflows/luacheck.yml/badge.svg)](https://github.com/AdrienRmd/War_Selection_Modding/actions/workflows/luacheck.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Language: Lua](https://img.shields.io/badge/language-Lua-2C2D72.svg)](https://www.lua.org/)
[![Game: War Selection](https://img.shields.io/badge/game-War%20Selection-e3493b.svg)](https://store.steampowered.com/app/1022450/War_Selection/)
[![Guide](https://img.shields.io/badge/docs-modding--guide-blue)](docs/modding-guide/)

> Bienvenue sur le hub de modding communautaire de War Selection ! / Welcome to the community modding hub for the game **War Selection**!

**War Selection** is a real-time strategy (RTS) game. Modding it is surprisingly simple: a mod is just **one or a few `.lua` files** that you paste into a mod created in the game's **map editor** — no programming tools or complicated installation required.

This repository is a community hub with two things:

1. **Ready-to-use mods** in [mods/](mods/) that you can download and play with right now.
2. **A beginner-friendly modding guide** in [docs/modding-guide/](docs/modding-guide/) that documents every unit and building parameter you can change.

## I'm a player — I just want to install a mod

1. **Pick a mod** from the list in [mods/README.md](mods/README.md) (e.g. [nuclear_bomb](mods/nuclear_bomb/) or [adjust_resources](mods/adjust_resources/)), and **download its `.lua` file**: open the mod's folder here on GitHub, click the `.lua` file, then the **raw** button (or use the green **Code** button → **Download ZIP** to get the whole repository, then extract the ZIP). Each mod's `README.md` also has installation notes.
2. **Create a mod in the map editor**: open the game's **map editor**, go to **Mods** → **My mods** → **+**, give your mod a name and a description, and add it to your map.
3. **Paste the code**: start a **private match** on your map with **developer mode** enabled, open your mod via **Edit script**, and paste the downloaded code.
4. **Relaunch the map to play** — the mod is now active.

For the full walkthrough (with troubleshooting), see [Installing a mod](docs/modding-guide/installation.md).

**Even simpler — add a published mod by ID:** if a mod has already been published in-game, you don't need to copy any code. Open your map in the editor → **Mods** → **Add a modification**, enter the mod's ID (in the form `mod-fBB0HwHlfzd`), save and publish the map. Published mod IDs are listed in each mod's README. See [Add an existing mod to your map](docs/modding-guide/installation.md#part-3--add-an-existing-already-published-mod-to-your-map).

## I want to make my own mod

Read the [Modding Guide](docs/modding-guide/) — it starts with a **"Your first mod in 5 minutes"** tutorial. A complete, working mod is only a few lines:

```lua
function onStart(var)
    root.unitType[1].deathability.health = 200000 -- unit 1 now has 200 HP
end
addMod({ onStart = onStart })
```

Save that as a `.lua` file, paste it into a mod created in the map editor (see [Installing a mod](docs/modding-guide/installation.md)), and it works. The [guide](docs/modding-guide/README.md) explains the `root` object, the value units (1000 = 1 displayed resource, etc.), and every parameter you can change.

## Modding Guide

The [Modding Guide](docs/modding-guide/) documents how to edit unit and building parameters — speed, attacks, abilities, health/armor, resources, workers, and more:

- [Installing a mod](docs/modding-guide/installation.md) — full walkthrough: create a mod in the map editor, paste the code, test it
- [Lua Basics](docs/modding-guide/lua-basics.md) — the minimum Lua you need, explained for total beginners
- [Lifecycle and Events](docs/modding-guide/lifecycle-and-events.md) — when code runs: onStart, onTick, events, timers, panel parameters
- [Movement and Vision](docs/modding-guide/movement-and-vision.md)
- [Attack](docs/modding-guide/attack.md)
- [Abilities and Upgrades](docs/modding-guide/abilities-and-upgrades.md)
- [Health and Armor](docs/modding-guide/health-and-armor.md)
- [Resources and Income](docs/modding-guide/resources-and-income.md)
- [Workers and Construction](docs/modding-guide/workers-and-construction.md)
- [Misc](docs/modding-guide/misc.md)
- [Examples](docs/modding-guide/examples.md) — real mods from this repository explained step by step, simplest to most complex

## Repository structure

```
wars_selection_mod/
├── mods/                  # Ready-to-use mods (one folder per mod, each with a README)
│   ├── nuclear_bomb/
│   ├── adjust_resources/
│   ├── starting_resources/
│   ├── diplomacy/
│   ├── default_gameplay_functions/
│   ├── victory_conditions/
│   ├── colossal_cannon/
│   ├── economy_gather/
│   ├── sharing_economy/
│   ├── house_production/
│   └── period_piece/
├── assets/                # Screenshots & GIFs of the mods (one subfolder per mod)
│   └── diplomacy/
├── docs/
│   ├── modding-guide/     # The beginner-friendly modding guide (start here)
│   └── UNIT_IDS.md        # Unit & Tech ID reference
├── .github/               # Issue templates & CI (luacheck)
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
└── LICENSE
```

## Contributing

Want to add a mod or improve the guide? Read [CONTRIBUTING.md](CONTRIBUTING.md) — it starts with a **step-by-step guide for GitHub beginners** (quick edits, adding a mod, reporting ideas), followed by the project rules.

## Useful links

- [Unit & Tech ID Reference](docs/UNIT_IDS.md)
- Found a bug or have a mod idea? [Open an issue](../../issues)

## Questions?

Stuck on a step, unsure how something works, or want to discuss mod ideas? [Open an issue](../../issues) — we're happy to help.

## License

This project is licensed under the [MIT License](LICENSE).
