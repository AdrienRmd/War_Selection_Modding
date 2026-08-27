# Attack — Unit Weapons & Building Turrets

[← Back to index](README.md)

A unit can have several weapons — e.g. `root.unitType[155].attack.weapon` — allowing up to 3 different shots depending on distance. Buildings use the same structure, nested under `attack.turret[turret_id].weapon[weapon_id]`.

## Damage

Damage values are per target category, stored in `damage.damages[]`. Scale: **1000 = 1 displayed damage**.

### Against units (index 0)

```lua
root.unitType[unit_id].attack.weapon[weapon_id].damage.damages[0] = 11000
```

- Deals 11 damage to units.

### Against buildings (index 2)

```lua
root.unitType[unit_id].attack.weapon[weapon_id].damage.damages[2] = 4000
```

- Deals 4 damage to buildings.

### Against aircraft (indices 14 and 16)

```lua
root.unitType[unit_id].attack.weapon[weapon_id].damage.damages[14] = 8000
```

- Deals 8 damage to aircraft.

```lua
root.unitType[unit_id].attack.weapon[weapon_id].damage.damages[16] = 5000
```

- Deals 5 damage to aircraft.

> Only indices 0 (units), 2 (buildings) and 14/16 (aircraft) are documented. The meaning of the other indices in `damage.damages[]` is unknown — investigate (e.g. by inspecting a unit in the console or on the [stats site](https://wsunitstats.com/en/modding)) before using them. Unit and tech IDs: [UNIT_IDS.md](../UNIT_IDS.md).

### Hits per attack (damagesCount)

Number of times damage is applied per attack:

```lua
root.unitType[unit_id].attack.weapon[weapon_id].damage.damagesCount = 1
```

- `1` = damage applied once per attack.
- Type: `uinteger`

## Range

Distance scale: **1000 per meter**.

### Maximum range

```lua
root.unitType[unit_id].attack.weapon[weapon_id].distanceMax = 110000
```

- `110000` = 110 m.

### Minimum range

> Be careful: units with a long minimum range can't hit enemies that get too close.

```lua
root.unitType[unit_id].attack.weapon[weapon_id].distanceMin = 25000
```

- `25000` = 25 m.

### Stop distance

> Be careful: this value **must stay greater than `distanceMax`** — a wrong value makes the unit stop attacking when the target moves.

Distance at which the attack stops hitting if the target leaves the maximum attack circle:

```lua
root.unitType[unit_id].attack.weapon[weapon_id].distanceStop = 120000
```

- `120000` = 120 m — must be greater than `distanceMax`.

## Attack speed

```lua
root.unitType[unit_id].attack.weapon[weapon_id].rechargePeriod = 1500
```

- `1500` = 1.5 s (milliseconds).

## Building turrets

> Be careful: turret IDs vary per building — check the building's existing turret/weapon indices in-game before editing.

Same parameters as unit weapons, but accessed through the turret:

```lua
root.unitType[unit_id].attack.turret[turret_id].weapon[weapon_id].damage.damages[0] = 11000
```

- Deals 11 damage to units.

```lua
root.unitType[unit_id].attack.turret[turret_id].weapon[weapon_id].damage.damages[2] = 4000
```

- Deals 4 damage to buildings.

```lua
root.unitType[unit_id].attack.turret[turret_id].weapon[weapon_id].damage.damages[14] = 8000
```

- Deals 8 damage to aircraft.

```lua
root.unitType[unit_id].attack.turret[turret_id].weapon[weapon_id].damage.damages[16] = 5000
```

- Deals 5 damage to aircraft.

### Recharge

```lua
root.unitType[unit_id].attack.turret[turret_id].weapon[weapon_id].rechargePeriod
```

### Range

```lua
root.unitType[unit_id].attack.turret[turret_id].weapon[weapon_id].distanceMax = 350000
```

- `350000` = 350 m.

```lua
root.unitType[unit_id].attack.turret[turret_id].weapon[weapon_id].distanceMin = 150000
```

- `150000` = 150 m.

```lua
root.unitType[unit_id].attack.turret[turret_id].weapon[weapon_id].distanceStop = 450000
```

- Stop distance (`450000` = 450 m) must be greater than `distanceMax`.

## Real mod examples

- [colossal_cannon.lua](../../mods/colossal_cannon/colossal_cannon.lua) — turret, weapon, damage and armor editing in a single file (`root.unitType[284].attack.turret[0].weapon[0]`). Look at the safety checks before the values are applied: `distanceMin` is forced below `distanceMax`, and `distanceStop` is forced above it.
