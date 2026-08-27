[← Back to index](README.md)

# Lua Basics for Modding

Every mod in this repository is a small [Lua](https://www.lua.org) script. This page teaches just enough Lua to read and write those scripts — it is **not** a full Lua course. All examples use unit 1, the Stone Age worker (full ID list: [UNIT_IDS.md](../UNIT_IDS.md)).

> The one trap to remember: **Lua counts from 1, but the game's arrays count from 0** — see [Tables](#tables).

## Comments

Anything after `--` on a line is ignored. Use comments to leave notes for yourself:

```lua
root.unitType[1].movement.moveSpeed = 64  -- unit 1 = Stone Age worker
-- speed values are multiples of 16: 32, 48, 64...
```

## Variables and `local`

A variable is a name that stores a value. `local` keeps it inside this file:

```lua
local speed = 64                 -- a number
local worker = root.unitType[1]  -- a shortcut to part of the game tree
worker.movement.moveSpeed = speed  -- same as root.unitType[1].movement...
```

Mods declare their editable values as `local` at the **top of the file**, so everything you might want to tweak sits in one place — e.g. the house tables in [house_production.lua](../../mods/house_production/house_production.lua).

## Numbers — engine fields must be integers

Lua numbers can have decimals, but the game's engine fields cannot. A float like `200500.0` fails with a "Not integer" error, so round explicitly — `math.floor` (down) or `math.ceil` (up):

```lua
root.unitType[1].deathability.health = 200 * 1000              -- OK: 200000
root.unitType[1].deathability.health = math.floor(200.5 * 1000) -- OK: 200500
-- WRONG: 200.5 * 1000 gives 200500.0, a float — the engine rejects it
```

Remember the ×1000 scale: 1000 = 1 displayed HP / resource / damage (see the table in [README.md](README.md)).

## Strings, concatenation and `print()`

Strings are text in quotes. `..` glues strings together, `string.format` builds formatted text, and `print()` writes to the developer Console — your main debugging tool:

```lua
local name = "worker 1"
print("boosted " .. name)                       -- .. concatenates
print(string.format("speed %d, hp %d", 64, 200)) -- %d = number, %s = text
```

## Functions

A function is a named block of code you can run on demand — define it once, call it by name:

```lua
function setWorkerSpeed(speed)      -- define: function name(parameter)
    root.unitType[1].movement.moveSpeed = speed
end

setWorkerSpeed(64)                  -- call: runs the block now
```

The classic mod idiom: define `onStart`, hand it to `addMod`, and the game calls it for you when the match starts:

```lua
function onStart(var)
    setWorkerSpeed(64)
end
addMod({ onStart = onStart })  -- all hooks explained in lifecycle-and-events.md
```

## Tables

A table is Lua's single container: a list, a dictionary, or both at once.

```lua
local list = { "worker", "house" }              -- list-style table
print(list[1])                                  --> worker  (Lua counts from 1!)
list[2] = "farm"                                -- write by index

local config = { name = "stone_house", id = 3 } -- named keys
print(config.name)                              --> stone_house
```

> **Crucial:** tables *you* write in Lua are 1-based (`list[1]`, `ipairs`). But the game's arrays inside `root` are **0-based**: the first weapon is `weapon[0]`, the first damage slot is `damages[0]`, resources run `gather[0]` to `gather[4]`. Index from **0** whenever you touch `root`:

```lua
local weapon = root.unitType[284].attack.turret[0].weapon[0]  -- first weapon, NOT weapon[1]
weapon.damage.damages[0] = 400000   -- first damage slot = 400 damage (x1000)

for i = 0, 4 do                     -- 5 resource slots: 0, 1, 2, 3, 4
    root.unitType[3].income.value[i] = 0  -- real loop from house_production
end
```

## `for` loops

Two forms cover every mod:

```lua
for i = 0, 4 do            -- numeric form: i takes 0, 1, 2, 3, 4
    print(i)
end

for i, v in ipairs(list) do  -- ipairs walks a 1-based list: 1, 2, 3...
    print(i, v)               -- stops at the first nil entry
end
```

The classic mod pattern — a config table at the top of the file, applied with one `ipairs` loop:

```lua
local houses = {                        -- edit here
    { name = "stone_house",  id = 3,  hp = 150000 },
    { name = "europe_house", id = 16, hp = 150000 },
}

for _, h in ipairs(houses) do           -- _ = "I ignore the position"
    root.unitType[h.id].deathability.health = h.hp
end
```

Real examples of this exact pattern: [warehouse.lua](../../mods/economy_gather/warehouse/warehouse.lua) and [house_production.lua](../../mods/house_production/house_production.lua).

## `if`, comparisons, `and` / `or` / `not`

```lua
local hp = root.unitType[1].deathability.health

if hp <= 100000 then            -- 100000 = 100 HP
    print("worker still at base health")
else
    print("worker boosted")
end
```

- Compare with `==` (equal) and `~=` (not equal — Lua has no `!=`), plus `<`, `<=`, `>`, `>=`.
- Combine conditions with `and`, `or`, `not`:

```lua
if hp > 100000 and not alreadyReported then
    print("boost active")
end
```

## `nil` and guarding

`nil` means "nothing here". Reading a key that doesn't exist gives `nil` — and reading a field *of* nil crashes, so check first:

```lua
local prev = var.prevRes       -- nil the first time around
if prev ~= nil then            -- guard: shared_resources.lua does exactly this
    print("previous resources known")
end
```

The `or default` idiom replaces nil in one line:

```lua
local amount = tonumber(getParameter("amount")) or 0  -- nil or bad text -> 0
```

## `pcall` — survive a bad value

`pcall(function, ...)` runs the function and **catches any error**, returning `false` plus the error message instead of stopping the whole script:

```lua
local ok, err = pcall(function()
    root.unitType[10].ability.work[0].makeTime = 90000  -- this slot might not exist
end)
if not ok then
    print("ERROR: " .. tostring(err))  -- log it, keep going
end
```

That is why [period_piece.lua](../../mods/period_piece/period_piece.lua) wraps every engine write in `pcall`: one broken temple/research prints an ERROR line while the hundreds of other writes still apply.

## Where to learn more

- The official Lua reference manual: <https://www.lua.org/manual/>
- [examples.md](examples.md) — every technique above, in real complete mods from this repository
- The theme pages linked from the [index](README.md) for each game parameter
