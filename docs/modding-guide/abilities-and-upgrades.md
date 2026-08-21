# Abilities and Upgrades

[← Back to index](README.md)

This page covers `ability.work` (upgrades and unit production from a building) and the global `ability.enabled` toggle.

## Upgrades / production entries (ability.work)

Each entry in `ability.work` is one upgrade or producible unit:

```lua
root.unitType[unit_id].ability.work[work_id]
```

### Required resource (cost.Order)

```lua
root.unitType[unit_id].ability.work[work_id].cost.Order[resource_id]
```

- `resource_id`: 0 food, 1 wood, 2 iron, 3 gold, 4 oil (see [index](README.md#resource-ids)).

### Enable / disable the entry

```lua
gameplay.root.unitType[unit_id].ability.work[work_id].enabled = false
```

- Type: `bool` — `false` = unavailable, `true` = available.

### Ability ID of the produced unit

```lua
root.unitType[building_id].ability.work[work_id].ability
```

- Gives you the unit ID of the produced unit.

### Creation time (makeTime)

```lua
root.unitType[building_id].ability.work[work_id].makeTime = 19000
```

- `19000` = 19 s.
- Type: `uInteger`

### Reserve size (reserveLimit)

```lua
root.unitType[building_id].ability.work[work_id].reserveLimit = 0
```

- Type: `uInteger`

### Time before going to reserve (reserveTime)

```lua
root.unitType[building_id].ability.work[work_id].reserveTime = 1000
```

- `1000` = 1 s.
- Type: `uInteger`

## ability.enabled

Makes the ability usable or not:

- `true` = works
- `false` = does not work

```lua
root.unitType[unit_id].ability.enabled = true
```

- On a production building, this blocks its ability to produce.
- On a unit, this creates a display bug — **avoid at all costs**.

## Unknown / to investigate

> ⚠️ Unknown behavior — needs investigation.

```lua
root.unitType[unit_id].ability.ability
```

- How this works is unknown.

```lua
root.unitType[1].ability.forcedRallyPoint
```

- Behavior unknown.

```lua
root.unitType[building_id].ability.work[work_id].costOrder[int] = 30
```

- Observed shape: `costOrder (object): 0 / 0 / 0 / 0 / 0`.

```lua
root.unitType[building_id].ability.work[work_id].costStart[int] = 20
```

- Observed shape: `costStart (object): 0 / 0 / 0 / 0 / 0`; `int` ranges from 0 to 3.

```lua
root.unitType[building_id].ability.work[work_id].final = false
```

- Type: `bool`; purpose unknown.
