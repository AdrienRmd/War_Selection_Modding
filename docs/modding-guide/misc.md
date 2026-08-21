# Misc

[← Back to index](README.md)

## Size (radius)

```lua
root.unitType[unit_id].radius = 2000
```

- Type: `int`

## Transport

Allow a unit to carry other units:

```lua
root.unitType[unit_id].transport.enabled = true
root.unitType[unit_id].transport.volume = 2      -- the volume
root.unitType[unit_id].transport.unitLimit = 1   -- set to 1
```

## Research requirements

Research required to unlock an ability:

```lua
gameplay.root.unitType[unit_id].ability.ability[ability_id].requirements.researchAny[research_id].id
```
