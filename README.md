# Wars Selection Modding

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Guide](https://img.shields.io/badge/docs-modding--guide-blue)](docs/modding-guide/)

> Bienvenue sur le hub de modding communautaire de Wars Selection ! / Welcome to the community modding hub for the game **Wars Selection**!

**Wars Selection** is a real-time strategy (RTS) game. Modding it is surprisingly simple: a mod is just **a single `.lua` file** that you place in the game's mod folder and enable from the **in-game mod menu** — no programming tools or complicated installation required.

This repository is a community hub with two things:

1. **Ready-to-use mods** in [mods/](mods/) that you can download and play with right now.
2. **A beginner-friendly modding guide** in [docs/modding-guide/](docs/modding-guide/) that documents every unit and building parameter you can change.

## I'm a player — I just want to install a mod

1. **Pick a mod** from the list in [mods/README.md](mods/README.md) (e.g. [nuclear_bomb](mods/nuclear_bomb/) or [adjust_resources](mods/adjust_resources/)).
2. **Download the `.lua` file**: open the mod's folder here on GitHub, click the `.lua` file, then the **raw** button (or use the green **Code** button → **Download ZIP** to get the whole repository, then extract the ZIP). Each mod's `README.md` also has installation notes.
3. **Place the file in the game's mod folder and enable it**: drop the `.lua` file into the Wars Selection mod folder (TODO: confirm the exact path in your game installation — check the mod's README first), then start the game and enable the mod in the **in-game mod menu**.

That's it — start a game and the mod is active.

## I want to make my own mod

Read the [Modding Guide](docs/modding-guide/) — it starts with a **"Your first mod in 5 minutes"** tutorial. A complete, working mod is only a few lines:

```lua
function onStart(var)
    root.unitType[1].deathability.health = 200000 -- unit 1 now has 200 HP
end
addMod({ onStart = onStart })
```

Save that as a `.lua` file, place it in the game's mod folder, enable it in the mod menu, and it works. The [guide](docs/modding-guide/README.md) explains the `root` object, the value units (1000 = 1 displayed resource, etc.), and every parameter you can change.

## Modding Guide

The [Modding Guide](docs/modding-guide/) documents how to edit unit and building parameters — speed, attacks, abilities, health/armor, resources, workers, and more:

- [Movement and Vision](docs/modding-guide/movement-and-vision.md)
- [Attack](docs/modding-guide/attack.md)
- [Abilities and Upgrades](docs/modding-guide/abilities-and-upgrades.md)
- [Health and Armor](docs/modding-guide/health-and-armor.md)
- [Resources and Income](docs/modding-guide/resources-and-income.md)
- [Workers and Construction](docs/modding-guide/workers-and-construction.md)
- [Misc](docs/modding-guide/misc.md)

## Repository structure

```
wars_selection_mod/
├── mods/                  # Ready-to-use mods (one folder per mod, each with a README)
│   ├── nuclear_bomb/
│   ├── adjust_resources/
│   ├── starting_resources/
│   ├── default_gameplay_functions/
│   └── victory_conditions/
├── docs/
│   ├── modding-guide/     # The beginner-friendly modding guide (start here)
│   └── UNIT_IDS.md        # Unit & Tech ID reference
├── CONTRIBUTING.md
└── LICENSE
```

## Contributing

Want to add a mod or improve the guide? Read [CONTRIBUTING.md](CONTRIBUTING.md).

## Useful links

- [Unit & Tech ID Reference](docs/UNIT_IDS.md)
- Found a bug or have a mod idea? [Open an issue](../../issues)

## Questions?

Stuck on a step, unsure how something works, or want to discuss mod ideas? [Open an issue](../../issues) — we're happy to help.

## License

This project is licensed under the [MIT License](LICENSE).
