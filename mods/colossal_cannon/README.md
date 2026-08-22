# Colossal Cannon
**Status:** Stable

## Mod ID: `mod-bsb2JnTBdh9`

> [!TIP]
> **The quickest way to use this mod — no code to copy.** Open your map in the editor → **Mods** → **Add a modification**, paste the ID above, save and publish the map. Full instructions: [Add an existing mod to your map](../../docs/modding-guide/installation.md#part-3--add-an-existing-already-published-mod-to-your-map).

## What does this mod do?

This mod makes the game's **colossal cannon** (the giant long-range cannon, unit type 284) fully configurable. From the mod's settings panel in-game you can change its **range** (min/max/stop), **reload time**, **damage** to units, **blast radius**, number of **hits per shot**, damage to the **environment**, the turret's **rotation speed**, and its **health** and **armor** — without touching any code. Want a cannon that shoots twice as far but takes 10 seconds to reload? Just change two numbers in the panel.

## Quick install
1. Download `colossal_cannon.lua` from this repository.
2. Create a mod in the game's **map editor**: open the editor, go to **Mods** → **My mods** → **+**, give your mod a name and a description, then add it to your map.
3. Start a **private match** on your map with **developer mode** enabled, open your mod, and paste the code with **Edit script**.
4. Relaunch the map — the mod is now active.

Full walkthrough: [docs/modding-guide/installation.md](../../docs/modding-guide/installation.md)

If you prefer, use the **Mod ID** at the top of this page to add the mod directly, without copying any code.

## Settings

Open the mod's settings panel in the mod menu to change these. **Values are "displayed numbers"** — you type the number exactly as you want it shown in the game (the mod multiplies by 1000 internally to get the engine value). For example, `DistanceMax = 3000` means a 3000 m range. Only `DamagesCount` is used as-is (raw engine value).

| Setting name | Default | What it does | Example values |
|--------------|---------|--------------|----------------|
| DistanceMax | 2000 | Maximum firing range, in meters | `3000` = 3000 m range |
| DistanceMin | 1000 | Minimum firing range, in meters — targets closer than this can't be hit | `500` = can't fire below 500 m |
| DistanceStop | 2050 | Distance at which the cannon gives up chasing a target, in meters — **must be greater than DistanceMax** | `3050` for a 3000 m DistanceMax |
| Recharge | 5 | Reload time between shots, in seconds | `10` = one shot every 10 s |
| Radius | 5 | Blast radius of each shot, in meters | `10` = 10 m splash |
| Damage | 400 | Damage dealt to units per hit | `800` = 800 damage |
| RotationSpeed | 0.5 | Turret rotation speed, in seconds (engine scale: 1000 = 1 s; base value 500 = 0.5 s) | `1` = 1 s |
| DamagesCount | 1 | Number of times damage is applied per attack | `3` = 3 hits per shot |
| EnvDamage | 250 | Damage dealt to environmental objects (trees, etc.) | `500` = 500 damage |
| Health | 1500 | Cannon hit points | `3000` = 3000 HP |
| FirstArmor | 8 | Armor thickness of armor slot 0 | `10` = 10 armor |
| SecondArmor | 12 | Armor thickness of armor slot 1 | `20` = 20 armor |

## How it works (for modders)

- Cannon unit type: `root.unitType[284]`, turret 0, weapon 0 — all changes go through `attack.turret[0].weapon[0]` (ranges, `rechargePeriod`, `damage.radius`, `damage.damages[0]`, `damage.damagesCount`, `damage.envDamage`) plus `attack.turret[0].rotationSpeed`.
- Durability: `deathability.health` (base 1500 HP) and `deathability.armor.data[0]`/`data[1].object.thickness` (armor slots, base 8 and 12) — only thickness is changed; the armor probabilities of the existing entries are left untouched (see [docs/modding-guide/health-and-armor.md](../../docs/modding-guide/health-and-armor.md)).
- Reads panel values with `getParameterNumber(name, default, min, max)`; meters/seconds/damage are displayed values multiplied ×1000, `DamagesCount` is raw.
- `rotationSpeed` engine scale: **1000 = 1 second** (base value 500 = 0.5 s) — the panel takes seconds and converts.
- Safety fixes applied before writing (see [docs/modding-guide/attack.md](../../docs/modding-guide/attack.md)):
  - if `DistanceMin >= DistanceMax` → min is set to `DistanceMax / 2`;
  - if `DistanceStop <= DistanceMax` → stop is set to `DistanceMax + 50 m`;
  - `DamagesCount` is floored to a whole number ≥ 1.
- Ends with `root.f_recreateModifiedUnitTypes()`.

## Known issues / notes

- All panel values except `DamagesCount` are "displayed numbers" multiplied ×1000 in code — do not enter raw engine values for those.
- `distanceStop` must stay greater than `distanceMax` or the cannon stops attacking when the target moves — the mod auto-corrects it, but set it properly to control the behavior.
- Only `damages[0]` (damage vs units) is exposed; damage vs buildings (`damages[2]`) and aircraft (`damages[14]`/`damages[16]`) keep their base values.
