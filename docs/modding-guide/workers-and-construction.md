# Workers and Construction

[← Back to index](README.md)

## Construction speed

### Outside territory

```lua
root.unitType[worker_id].movement.building[building_id].tickProgress = 30000
```

`30000` is just an example — values vary a lot between buildings. A more reliable approach is to scale the existing value:

```lua
root.unitType[worker_id].movement.building[building_id].tickProgress =
    root.unitType[worker_id].movement.building[building_id].tickProgress * 0.75
```

Empirical conversion (the "magic number", measured by timing construction in-game — decent precision but not a 100% match with in-game values):

```
rate (%/sec) = tickProgress * 0.00024
```

So a `tickProgress` of about **4167** gives a construction rate of **1%/sec with 1 worker**.

### Inside territory

```lua
root.unitType[worker_id].movement.building[building_id].tickProgressTerritory
```

- Same scale/mechanics as `tickProgress`, applied when building inside your territory.

## Gathering

All `gather` parameters are per resource (`resource_id`: 0 food, 1 wood, 2 iron, 3 gold, 4 oil).

### Storage search distance

How far the worker searches for a storage/drop-off building:

```lua
root.unitType[worker_id].movement.gather[resource_id].findStorageDistance = 10000
```

- `10000` = 10 m.

### Carry capacity (bagSize)

```lua
root.unitType[worker_id].movement.gather[resource_id].bagSize = 10000
```

- `10000` = 10 of the resource the worker can carry.

### Gather rate (perTick)

```lua
root.unitType[worker_id].movement.gather[resource_id].perTick = 55
```

- `55` = 1.1 per second, i.e. **perTick of 5 = 0.1/sec** → 10 s to gather 1 resource.

## Unknown / to investigate

> Unknown behavior — needs investigation.

- The exact in-game formula behind the "magic number" `0.00024` in the construction rate. The current value was derived empirically and does not perfectly correlate with in-game values.

## Real mod examples

- [worker.lua](../../mods/economy_gather/worker/worker.lua) — sets `movement.gather[slot].perTick` and `.bagSize` for every civilization's worker, per resource. Look at the conversions `perTick = speed × 50` and `bagSize = carried × 1000`, and at the slot lists: gather slots are unit-specific (wood can be slot 1 for one worker and slot 0 for another).
- [fisher.lua](../../mods/economy_gather/fisher/fisher.lua) — the same two fields applied to fishing boats via the settings panel (`perTick = food/sec × 50`, `bagSize = capacity × 1000`), all on gather slot 0 (food).
