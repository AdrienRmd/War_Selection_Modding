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
root.unitType[unit_id].ability.ability[ability_id].requirements.researchAny[research_id].id
```

Real example (from [nuclear_bomb.lua](../../mods/nuclear_bomb/nuclear_bomb.lua)) — a new ability is created for an aircraft, then locked behind a tech:

```lua
local b = root.unitType[316] -- one of the four aircraft
local newAbilityId = b.ability.ability.f_create()
local newAbility = b.ability.ability[newAbilityId]

newAbility.requirements.researchAny.f_create() -- add an entry to the requirement list
newAbility.requirements.researchAny[0].id = 89 -- tech 89 = aircraft bomb drop
```

The same mod also re-points an existing requirement to another tech:

```lua
root.unitType[195].ability.ability[16].requirements.researchAny[0].id = 25 -- tech 25 = spy nuclear bomb
```

- Tech IDs 25 and 89 are listed in [UNIT_IDS.md](../UNIT_IDS.md).

## Real mod examples

- [nuclear_bomb.lua](../../mods/nuclear_bomb/nuclear_bomb.lua) — the research-requirement example above, plus `lifeTime` (`bomb.lifeTime = 9000`) and `tags` (`bomb.tags[15] = true`, `bomb.tags[16] = true`) on the bomb unit. Look at the full construction loop: `f_clear()` → `f_create()` → fill in `data`, `work`, then `requirements`.
