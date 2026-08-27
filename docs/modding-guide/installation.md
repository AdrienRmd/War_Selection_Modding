# Installing a mod

[← Back to index](README.md)

War Selection mods are **not** installed by copying files into a game folder. Mods live inside the game's **map editor**: you create a mod there, attach it to a map, and paste its Lua code through an in-game script editor. No external tools are needed — everything happens inside the game.

This page is the complete walkthrough, in two parts: creating an (empty) mod in the map editor, then writing or pasting its code and testing it. If you downloaded a `.lua` file from this repository, you will paste its contents at step 11.

> UI labels are given in English, with the original French shown in parentheses when the game displays French.

## Part 1 — Create your first mod

You do this once per mod, entirely inside the map editor.

1. **Open the map editor.** Launch War Selection, open the **Map Editor**, then open an existing map or create a new one.
2. **Open the mods screen.** Go to **Modifications** (Mods) → **My modifications** (Mes modifications).
3. **Create the mod.** Click the small **+** button below the **gameplay mod** (mod gameplay).
4. **Name and describe it.** Enter a name for your mod, and a description so other players understand what it does.
5. **Add it to your map and save.** Click your mod in the list and add it to your map, then save the map and quit. You cannot publish yet — the mod is still empty. Its code is added in Part 2.

## Part 2 — Write/paste code and test

Mods are coded in **developer mode**, from inside a private match launched on your map.

6. **Create a private match.** From the main menu, go to **Private match** (Partie privée) → **Create**, and open your custom (personal) map.
7. **Enable developer mode.** Check **Enable developer mode in the match** (Activer le mode développeur dans le match). Without this, you cannot edit your mod. If the checkbox does not appear, see [Troubleshooting](#troubleshooting) — it is a known game bug.
8. **Launch the map.** Once in the match, two new options appear: **Modifications** (Mods) and **Console**.
9. **Note the Console.** The **Console** shows errors and `print()` output — very useful for debugging your code.
10. **Open the script editor.** Go to **Modifications** (Mods), find your mod, and click **Edit script** (Modifier le script).
11. **Paste or write your code.** Paste the downloaded `.lua` file's contents (or write your own Lua) into the script window, save, and publish.
12. **Test it.** Relaunch the map — your mod's changes are now applied in the match.

From here the loop is: edit the script → save/publish → relaunch the map → check the console.

## Part 3 — Add an existing (already published) mod to your map

If a mod already exists — yours, or one shared by another player — you don't need to recreate it. Every published mod has an **ID** in the form `mod-fBB0HwHlfzd` (shown in the editor and in share links).

1. **Open the map** you want to add the mod to, in the map editor.
2. Go to **Modifications** (Mods), and click **Add a modification** (Ajouter une modification).
3. **Add the mod by its ID** — paste or enter the mod's ID (in the form `mod-fBB0HwHlfzd`).
4. **Save the map, then publish.** That's it — the mod now runs on your map.

> Tip: the mods in this repository each have their ID listed in their README once published. Share *your* mods the same way: give other players the `mod-...` ID and they can add them to their own maps with these steps.

## Troubleshooting

- **The "Enable developer mode in the match" checkbox does not appear** — this is a known game bug. Wait a bit and retry: create the private match again until the checkbox shows up.
- **The mod does nothing or misbehaves** — open the **Console** in the match: it shows script errors and `print()` output. Fix the reported error, or add `print()` calls to your code to see what runs and which values you read.
- **Your changes are not applied** — make sure you relaunched the map after saving the script, and that the mod is added to the map in the editor (Part 1, step 5).

## Real mod examples

- [mods/README.md](../../mods/README.md) — the index of every mod in this repository, with the published **mod IDs** you can use directly in Part 3 (add an existing mod to your map by ID).

## Official modding resources

- [Community modding resources (wsunitstats.com)](https://wsunitstats.com/en/modding)
- [Community modding help (help-mod.warselect.io)](https://help-mod.warselect.io/)
