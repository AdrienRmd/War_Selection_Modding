# Health and Armor (deathability)

[← Back to index](README.md)

## Invincibility

```lua
root.unitType[unit_id].deathability.enabled = true
```

- `invincible = false` — set `enabled = false` for invincibility.
- Type: `bool`

## Maximum HP

If HP is increased, the unit/building will need to be repaired or healed to reach it.

```lua
root.unitType[unit_id].deathability.health = 100000
```

- `100000` = 100 HP.

## Regeneration

```lua
root.unitType[unit_id].deathability.regeneration = 40
```

- `40` = 1 HP per second.
- Type: `integer`

## Armor

### Number of armor entries

```lua
root.unitType[unit_id].deathability.armor.data.size = 1
```

- Type: `integer`

### Armor configuration

Probabilities across armor entries must total 100. Adding new armor entries is not understood — you can only modify existing armor.

```lua
root.unitType[unit_id].deathability.armor.data[armor_id].probability = 50
```

- `50` = 50% out of 100.
- Type: `int`

```lua
root.unitType[unit_id].deathability.armor.data[armor_id].object.thickness = 5000
```

- `5000` = 5 armor.

## Repair cost (healMeCost)

```lua
root.unitType[unit_id].deathability.healMeCost[resource_id] = 1000000
```

- `1000000` = 1000.
- `resource_id`: 0 food, 1 wood, 2 iron, 3 gold, 4 oil.

## Destroy reward

Destroying the building grants resources:

```lua
root.unitType[unit_id].deathability.destroyReward[resource_id] = 1000000
```

- `1000000` = 1000.
- Type: `int`
- `resource_id`: 0 food, 1 wood, 2 iron, 3 gold, 4 oil.

## Friendly damage

- `true` = the unit receives friendly damage
- `false` = it does not

```lua
root.unitType[unit_id].deathability.receiveFriendlyDamage = true
```

- Type: `bool`

## Attack reaction (attackReaction)

### Enabled

```lua
root.unitType[unit_id].deathability.attackReaction.enabled = true
```

- Type: `bool`

### Period

```lua
root.unitType[unit_id].deathability.attackReaction.period = 10000
```

- `10000` = 10 s.
- Type: `int`

### Call ally distance

```lua
root.unitType[unit_id].deathability.attackReaction.callAllyDistance = 100000
```

- `100000` = 100.
- Type: `int`

## Unknown / to investigate

> ⚠️ Unknown behavior — needs investigation.

- How to **add** a new armor entry (only modifying existing armor is currently understood). See [Armor configuration](#armor-configuration) above.
