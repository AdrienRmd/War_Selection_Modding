# Contributing

Thanks for your interest in contributing! / Merci de votre intérêt !

## Adding a new mod

1. **One folder per mod** under `mods/`:

   ```
   mods/
   └── my-mod/
       ├── my-mod.lua
       └── README.md
   ```

2. The mod's `README.md` must follow the template in [`mods/README_TEMPLATE.md`](mods/README_TEMPLATE.md) and include a **Status** field:

   - `Status: WIP` — work in progress, may be unbalanced or broken
   - `Status: Stable` — tested and working

3. The `.lua` file must start with a header comment block:

   ```lua
   -----------------------------------------------------------
   -- Mod name: My Mod
   -- Description: What the mod does, in one or two lines
   -- Author: YourName
   -- Status: WIP
   -----------------------------------------------------------
   ```

## Improving the guide

The English documentation lives in [`docs/modding-guide/`](docs/modding-guide/). Improvements are welcome:

- Correct or clarify unit conversions and value scales
- Investigate fields marked **"Unknown / to investigate"** and document them
- Add new themes as separate pages and link them in the guide's [`README.md`](docs/modding-guide/README.md)

Keep all code snippets in fenced `lua` blocks with English placeholder names (`unit_id`, `weapon_id`, ...).

## Lua code style

- Add the header comment block (see above) to every mod file
- Use English variable names in placeholders and examples
- Prefer scaling existing values over hard-coding raw numbers when the base value varies (e.g. `tickProgress = tickProgress * 0.75`)

## PR etiquette

- Keep PRs focused: one mod or one documentation page per PR when possible
- Test your mod in-game before submitting; set `Status: WIP` if untested
- Describe what changed and why in the PR description
- Do not commit secrets, personal data, or unrelated formatting changes
