# Contributing

Thanks for your interest in contributing! / Merci de votre intérêt !

**New to GitHub?** Start with the step-by-step guide below — no tools to install, everything happens in your browser.

---

## How to contribute — step by step (for beginners)

There are 3 ways to contribute, from easiest to most involved.

### Option 1 — Quick edit (2 minutes, no setup) ✏️

Use this to fix a typo, improve a sentence in the guide, or tweak a value in a mod file.

1. **Open the file** you want to change in this repository (e.g. a guide page in `docs/modding-guide/`, or a mod's `.lua` file).
2. Click the **pencil icon (✏️)** at the top right of the file view. GitHub creates your own copy of the project (a *fork*) automatically.
3. **Make your changes** in the editor.
4. Click **Propose changes**, write a short description (e.g. "Fix typo in attack.md"), then click **Create pull request**.
5. Done! The maintainer will review your change and merge it if it looks good.

> Don't worry about breaking something — your edit is only a *proposal*. Nothing is merged before being reviewed. Beginners welcome!

### Option 2 — Add a file or a new mod 🧩

Use this to add a new mod, a screenshot, or a new guide page.

1. **Fork the repository**: click the **Fork** button (top right of the repo page). You now have your own copy at `https://github.com/<your-name>/War_Selection_Modding`.
2. In your fork, navigate to the folder where the file belongs, click **Add file → Create new file**.
   - New mod? Create `mods/<your-mod-name>/your-mod-name.lua` and `mods/<your-mod-name>/README.md` (follow [`mods/README_TEMPLATE.md`](mods/README_TEMPLATE.md) for the README).
   - Screenshot? Put it in `assets/<mod-name>/` — see [`assets/README.md`](assets/README.md).
3. Write your file(s), then click **Commit changes**.
4. Go back to your fork's home page — GitHub shows a banner: **"This branch is X commits ahead"** → click **Contribute → Open pull request**.
5. Write a short title and description, then click **Create pull request**.

### Option 3 — No code, just an idea or a bug report 💡

- **Mod idea or doc suggestion**: open an [issue](https://github.com/AdrienRmd/War_Selection_Modding/issues) with the *Mod idea* template.
- **Bug in a mod**: open an [issue](https://github.com/AdrienRmd/War_Selection_Modding/issues) with the *Bug report* template.
- **Question or discussion**: use the [Discussions](https://github.com/AdrienRmd/War_Selection_Modding/discussions) tab.

### What happens after you submit a pull request?

1. An automatic check (**Luacheck**) runs on your Lua code. A green check ✅ = your code passes the lint; a red cross ❌ = something to fix (click *Details* to see what).
2. The maintainer reviews your changes (tab **Files changed** in the PR). They may ask for small adjustments — that's normal, just edit the file in your fork and the PR updates automatically.
3. Once approved, the PR is **merged** — your change is now part of the project. 🎉

### Good to know

- **You can't break anything.** A pull request is only a proposal, and the maintainer always reviews before merging.
- **Small PRs are better** — one fix or one mod per pull request.
- **Test your mod in-game** before submitting; if untested, mention it (and keep `Status: WIP` in the README).
- Stuck at any step? Open a [Discussion](https://github.com/AdrienRmd/War_Selection_Modding/discussions) — we'll help.

---

## Project rules

### Adding a new mod

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

### Screenshots

A picture is worth a thousand words — mods with screenshots get used much more. If you play with a mod:

1. Capture it in game (`Win + Shift + S` for a screenshot, `Win + G` for a video/GIF)
2. Put the image in `assets/<mod_name>/` (same name as the mod's folder in `mods/`), named after what it shows — e.g. `assets/diplomacy/diplomacy_buttons.png`
3. Reference it in the mod's `README.md`:

   ```markdown
   ![Buttons in game](../../assets/diplomacy/diplomacy_buttons.png)
   ```

See [`assets/README.md`](assets/README.md) for the full conventions.

### Improving the guide

The English documentation lives in [`docs/modding-guide/`](docs/modding-guide/). Improvements are welcome:

- Correct or clarify unit conversions and value scales
- Investigate fields marked **"Unknown / to investigate"** and document them
- Add new themes as separate pages and link them in the guide's [`README.md`](docs/modding-guide/README.md)

Keep all code snippets in fenced `lua` blocks with English placeholder names (`unit_id`, `weapon_id`, ...).

### Lua code style

- Add the header comment block (see above) to every mod file
- Use English variable names in placeholders and examples
- Prefer scaling existing values over hard-coding raw numbers when the base value varies (e.g. `tickProgress = tickProgress * 0.75`)

### PR etiquette

- Keep PRs focused: one mod or one documentation page per PR when possible
- Test your mod in-game before submitting; set `Status: WIP` if untested
- Describe what changed and why in the PR description
- Do not commit secrets, personal data, or unrelated formatting changes
