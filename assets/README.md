# Assets

Screenshots and GIFs of the mods in action, used by the READMEs.

## Folder structure — one folder per mod

```
assets/
├── diplomacy/
│   └── diplomacy_buttons.png
├── nuclear_bomb/
├── adjust_resources/
└── ...one folder per mod (same name as the mod folder in mods/)
```

Put each image in the subfolder matching its mod (`assets/<mod_name>/`), named after what it shows.

Examples:

- `assets/diplomacy/diplomacy_buttons.png` — the 3 diplomacy buttons next to the minimap
- `assets/diplomacy/diplomacy_request.png` — an alliance request with Accept/Refuse buttons
- `assets/nuclear_bomb/nuclear_bomb_explosion.png` — the explosion in game

## How to reference in a README

From a mod README (`mods/<mod>/README.md`):

```markdown
![Buttons in game](../../assets/diplomacy/diplomacy_buttons.png)
```

From the root README:

```markdown
![Buttons in game](assets/diplomacy/diplomacy_buttons.png)
```

## How to capture

- Screenshot: `Win + Shift + S` (Windows Snip)
- Video/GIF: `Win + G` (Xbox Game Bar) — record a short clip, then convert to GIF

Contributions welcome: if you play with one of the mods, a good screenshot in a pull request is a great first contribution!
