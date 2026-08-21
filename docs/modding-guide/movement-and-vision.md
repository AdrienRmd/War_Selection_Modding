# Movement and Vision

[← Back to index](README.md)

## Speed

Unit speed works in multiples of 16: **160 = 16 speed**.

```lua
root.unitType[unit_id].movement.moveSpeed
```

- Type: `int`

## Vision range

```lua
root.unitType[unit_id].viewRange = 180000
```

- Distance scale: 1000 per meter (so `180000` = 180 m).
