# Movement and Vision

[← Back to index](README.md)

## Speed

Unit speed values sit on a grid of **multiples of 16** (`32`, `48`, `64`, `160`…). The speed shown in game is the internal value **÷ 10**: `160` = speed 16, `32` = speed 3.2. This is the rule behind the "Move speed" row of the value-units table in the [index](README.md#value-units--read-this-once).

> The ÷ 10 conversion is inferred from the observed `160` = 16 example — not systematically verified in game. Test before relying on it.

```lua
root.unitType[unit_id].movement.moveSpeed
```

- Type: `int`

## Vision range

```lua
root.unitType[unit_id].viewRange = 180000
```

- Distance scale: 1000 per meter (so `180000` = 180 m).

## Real mod examples

- [fisher.lua](../../mods/economy_gather/fisher/fisher.lua) — the fishing-boat mod edits gather values that live in the same `movement` tree (`movement.gather[0].perTick`, `movement.gather[0].bagSize`). Look at how the displayed values (food/sec, food carried) are converted to engine values (`× 50`, `× 1000`) and applied to every civilization's boat.
