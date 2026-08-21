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

## Production costs (costProcess)

Cost of a unit produced by a building:

```lua
root.unitType[building_id].ability.work[unit_index].costProcess[resource_id] = 50000
```

- `unit_index` starts at 0 — check the stats site to identify entries.
- Scale: **1000 = 1 displayed unit**.
- Example: `costProcess (object): 70000 / 20000 / 0 / 0 / 0` → 70 food + 20 wood.
- `resource_id`: see the table above.
