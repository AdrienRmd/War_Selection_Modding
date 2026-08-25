# Base-game default values

Reference of the **unmodified game values** for every unit touched by this mod. If you edit `fisher/fisher.lua`, `worker/worker.lua` or `warehouse/warehouse.lua` and want to revert something, copy the value back from here.

Two formats are shown:

- **Engine** = raw value stored by the game (`perTick`, `bagSize`).
- **Displayed** = the human-readable value used in the scripts (production per second, resources carried).

Conversions: `perTick = speed per second × 50` (55 = 1.1/sec) · `bagSize = carried × 1000` (10000 = 10).

## Fishing boats (`fisher/fisher.lua`)

All fishers gather food on gather slot `0`.

| Unit | ID | perTick (engine) | speed (displayed) | bagSize (engine) | bag (displayed) |
|------|----|------------------|-------------------|------------------|-----------------|
| europe_fisher | 26 | 270 | 5.4 | 70000 | 70 |
| asia_fisher | 43 | 220 | 4.4 | 50000 | 50 |
| medieval_europe_fisher | 81 | 350 | 7 | 150000 | 150 |
| eastern_asia_fisher | 169 | 350 | 7 | 150000 | 150 |
| western_asia_fisher | 452 | 300 | 6 | 60000 | 60 |
| china_fisher | 353 | 400 | 8 | 150000 | 150 |
| abstract_fisher | 244 | 500 | 10 | 250000 | 250 |

## Workers (`worker/worker.lua`)

Gather slots are unit-specific: the slot number is the position of the resource in each worker's list below (first = slot 0, second = slot 1, ...).

### stone_age_worker (unit 1)

| Resource | Slot | perTick (engine) | speed (displayed) | bagSize (engine) | bag (displayed) |
|----------|------|------------------|-------------------|------------------|-----------------|
| berries | 0 | 55 | 1.1 | 10000 | 10 |
| wood | 1 | 55 | 1.1 | 10000 | 10 |
| small_fish | 2 | 90 | 1.8 | 30000 | 30 |
| meat | 3 | 75 | 1.5 | 40000 | 40 |

### europe_worker (unit 12)

| Resource | Slot | perTick (engine) | speed (displayed) | bagSize (engine) | bag (displayed) |
|----------|------|------------------|-------------------|------------------|-----------------|
| berries | 0 | 60 | 1.2 | 20000 | 20 |
| wood | 1 | 70 | 1.4 | 20000 | 20 |
| small_fish | 2 | 100 | 2.0 | 30000 | 30 |
| metal | 3 | 35 | 0.7 | 10000 | 10 |
| meat | 4 | 80 | 1.6 | 10000 | 10 |
| stone | 5 | 60 | 1.2 | 10000 | 10 |
| wheat | 6 | 65 | 1.3 | 10000 | 10 |

### asia_worker (unit 31)

| Resource | Slot | perTick (engine) | speed (displayed) | bagSize (engine) | bag (displayed) |
|----------|------|------------------|-------------------|------------------|-----------------|
| berries | 0 | 55 | 1.1 | 20000 | 20 |
| wood | 1 | 60 | 1.2 | 10000 | 10 |
| small_fish | 2 | 100 | 2.0 | 20000 | 20 |
| metal | 3 | 30 | 0.6 | 10000 | 10 |
| meat | 4 | 75 | 1.5 | 10000 | 10 |
| stone | 5 | 50 | 1.0 | 10000 | 10 |

### western_europe_worker (unit 55)

| Resource | Slot | perTick (engine) | speed (displayed) | bagSize (engine) | bag (displayed) |
|----------|------|------------------|-------------------|------------------|-----------------|
| wood | 0 | 75 | 1.5 | 20000 | 20 |
| small_fish | 1 | 200 | 4.0 | 30000 | 30 |
| metal | 2 | 40 | 0.8 | 10000 | 10 |
| meat | 3 | 75 | 1.5 | 20000 | 20 |
| stone | 4 | 60 | 1.2 | 10000 | 10 |
| wheat | 5 | 75 | 1.5 | 10000 | 10 |

### eastern_europe_worker (unit 56)

| Resource | Slot | perTick (engine) | speed (displayed) | bagSize (engine) | bag (displayed) |
|----------|------|------------------|-------------------|------------------|-----------------|
| wood | 0 | 75 | 1.5 | 20000 | 20 |
| small_fish | 1 | 200 | 4.0 | 20000 | 20 |
| metal | 2 | 40 | 0.8 | 10000 | 10 |
| meat | 3 | 75 | 1.5 | 20000 | 20 |
| stone | 4 | 55 | 1.1 | 10000 | 10 |
| wheat | 5 | 80 | 1.6 | 10000 | 10 |

### western_asia_worker (unit 89)

| Resource | Slot | perTick (engine) | speed (displayed) | bagSize (engine) | bag (displayed) |
|----------|------|------------------|-------------------|------------------|-----------------|
| wood | 0 | 70 | 1.4 | 10000 | 10 |
| small_fish | 1 | 150 | 3.0 | 20000 | 20 |
| metal | 2 | 40 | 0.8 | 10000 | 10 |
| meat | 3 | 80 | 1.6 | 10000 | 10 |
| stone | 4 | 55 | 1.1 | 10000 | 10 |

### eastern_asia_worker (unit 90)

| Resource | Slot | perTick (engine) | speed (displayed) | bagSize (engine) | bag (displayed) |
|----------|------|------------------|-------------------|------------------|-----------------|
| wood | 0 | 70 | 1.4 | 10000 | 10 |
| small_fish | 1 | 150 | 3.0 | 20000 | 20 |
| metal | 2 | 40 | 0.8 | 10000 | 10 |
| meat | 3 | 80 | 1.6 | 10000 | 10 |
| stone | 4 | 55 | 1.1 | 10000 | 10 |

### abstract_worker (unit 201)

| Resource | Slot | perTick (engine) | speed (displayed) | bagSize (engine) | bag (displayed) |
|----------|------|------------------|-------------------|------------------|-----------------|
| wood | 0 | 90 | 1.8 | 20000 | 20 |
| metal | 1 | 60 | 1.2 | 10000 | 10 |
| meat | 2 | 90 | 1.8 | 20000 | 20 |
| stone | 3 | 90 | 1.8 | 10000 | 10 |
| wheat | 4 | 90 | 1.8 | 10000 | 10 |

### china_worker (unit 349)

| Resource | Slot | perTick (engine) | speed (displayed) | bagSize (engine) | bag (displayed) |
|----------|------|------------------|-------------------|------------------|-----------------|
| wood | 0 | 75 | 1.5 | 20000 | 20 |
| metal | 1 | 40 | 0.8 | 10000 | 10 |
| meat | 2 | 80 | 1.6 | 30000 | 30 |
| stone | 3 | 70 | 1.4 | 10000 | 10 |
| rice | 4 | 90 | 1.8 | 20000 | 20 |

## Warehouses (`warehouse/warehouse.lua`)

Capacity is set via `storageMultiplier`, 16.16 fixed point: `65536` (2^16) = 100%. The base value is **verified in game**: `65536` (= 100%) for all nine units. The capacity column below lists the mod's default settings (the author's tuned capacities, applied as `ceil(percentage × 65536 / 100)`).

| Unit | ID | storageMultiplier (engine) | capacity (displayed) |
|------|----|----------------------------|----------------------|
| stone_warehouse | 2 | 65536 | 100% |
| europe_warehouse | 17 | 65536 | 110% |
| asia_warehouse | 30 | 65536 | 110% |
| western_europe_warehouse | 59 | 65536 | 130% |
| eastern_europe_warehouse | 60 | 65536 | 130% |
| western_asia_warehouse | 87 | 65536 | 130% |
| eastern_asia_warehouse | 88 | 65536 | 130% |
| elephant_cargo | 124 | 65536 | 130% |
| abstract_warehouse | 191 | 65536 | 150% |
