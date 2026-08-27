# Resources and Income

[← Back to index](README.md)

## Resource IDs

| ID | Resource |
|---|---|
| 0 | Food |
| 1 | Wood |
| 2 | Iron |
| 3 | Gold |
| 4 | Oil |

## Periodic income (like the mine)

### Enable the income

```lua
root.unitType[unit_id].income.enabled = true
```

- Type: `bool`

### Income amount

```lua
root.unitType[unit_id].income.value[resource_id] = 1000000
```

- Scale: **1000 = 1 displayed unit**, so `1000000` = 1000.
- `resource_id`: see the table above.

### Income period

```lua
root.unitType[unit_id].income.period = 5500
```

- `5500` = 5.5 s (milliseconds).
- Type: `integer`

### Complete example — give a house an income

Income is **disabled by default** (`enabled = false`) — most buildings pay nothing until you enable it. Here is the full sequence, exactly what [house_production.lua](../../mods/house_production/house_production.lua) does for every house:

```lua
-- Give the Europe house (unit 16) +5 food every 10 s.
-- By default income.enabled is false: nothing is paid until you enable it.
local income = root.unitType[16].income

income.enabled = true        -- required, false by default

for i = 0, 4 do              -- the engine always has 5 resource slots (0-4)
    income.value[i] = 0      -- zero them all first...
end
income.value[0] = 5 * 1000   -- ...then set the one you want: +5 food

income.period = 10 * 1000    -- every 10 s (milliseconds)

root.f_recreateModifiedUnitTypes()  -- apply load-time unit-type edits
```

- Zeroing `value[0]` to `value[4]` before setting your resource is what house_production does — leftover values in other slots would pay resources you didn't ask for.
- Values must be integers: wrap computed values in `math.floor` (`math.floor(amount * 1000)`).
- Only **positive** amounts: negative values crash the engine field — [house_production.lua](../../mods/house_production/house_production.lua) deducts upkeep (negative income) with a runtime `onTick` loop instead (see also [Lifecycle and Events](lifecycle-and-events.md)).

## Production costs (costProcess)

Cost of a unit produced by a building:

```lua
root.unitType[building_id].ability.work[unit_index].costProcess[resource_id] = 50000
```

- `unit_index` starts at 0 — check the [stats site](https://wsunitstats.com/en/modding) to identify entries.
- Scale: **1000 = 1 displayed unit**.
- Example: `costProcess (object): 70000 / 20000 / 0 / 0 / 0` → 70 food + 20 wood.
- `resource_id`: see the table above.

## Real mod examples

- [house_production.lua](../../mods/house_production/house_production.lua) — sets `income.enabled`, `income.value` and `income.period` for every house. Look at the runtime `onTick` upkeep: negative amounts are deducted from the faction treasury by script, because the engine `income` field crashes on negative values.
- [starting_resources.lua](../../mods/starting_resources/starting_resources.lua) — writes the treasury each faction starts with (`root.scene[0].faction[id].treasury.resources`) plus its storage limits.
- [DEFAULTS.md](../../mods/economy_gather/DEFAULTS.md) — archive of the base-game economy values (gather speeds, carry capacities, storage multipliers) used by the economy_gather mods, handy as a reference before editing.
