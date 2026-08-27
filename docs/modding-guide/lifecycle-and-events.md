[← Back to index](README.md)

# Lifecycle, Events and Timers

This page documents **when** your mod code runs — the hooks system. Everything below is taken from real mods in [mods/](../../mods/); follow the links to see the full files.

## The two moments your code can run

### 1. Load time — top-level code

Any code at the top level of the file (outside any function) runs when the script loads, **before the match starts**. This is where stat edits belong: nothing is spawned yet, you are just editing the blueprints in `root`. A pure load-time mod is a straight list of assignments that **must end with `root.f_recreateModifiedUnitTypes()`** — without that call, unit-type changes are not applied:

```lua
-- colossal_cannon.lua (abridged) — no hooks at all
local cannon = root.unitType[284].attack.turret[0]
local weapon = cannon.weapon[0]
weapon.distanceMax = math.floor(getParameterNumber("DistanceMax", 2000, 0, 100000) * 1000)
weapon.damage.damages[0] = 400000
-- ...

root.f_recreateModifiedUnitTypes()  -- REQUIRED to apply unit-type edits
```

Pure load-time mods: [colossal_cannon.lua](../../mods/colossal_cannon/colossal_cannon.lua) and [warehouse.lua](../../mods/economy_gather/warehouse/warehouse.lua) — neither registers a single hook. Panel parameters (`getParameterNumber` etc.) can be read at load time too.

### 2. Runtime — inside hooks

Everything else runs inside functions that **the game calls for you** ("hooks"), registered with `addMod`. See below.

## Registering hooks with `addMod`

`addMod` takes one table — hook name on the left, your function on the right. Pass only the hooks you need:

```lua
-- shared_population.lua (abridged) — registers four hooks at once
function onInit(var) end
function onStart(var) end
function onTick(var, currentMoment) end
function onPlayerEliminate(var) end

addMod({
    onInit = onInit,
    onStart = onStart,
    onTick = onTick,
    onPlayerEliminate = onPlayerEliminate,
})
```

### `onInit(var)` — very early setup

Runs earlier than everything else. Use it for setup that must happen first — typically reading panel options and stashing them on `var`:

```lua
-- shared_population.lua
function onInit(var)
    var.keepLimit = getParameterBool("keepLimit", false)  -- panel checkbox -> var
end
```

### `onStart(var)` — match start, one shot

Runs once, when the match starts. The place for one-shot setup: set map resources, build your state tables, print a banner. This is the hook used by the first mod in the [README](README.md):

```lua
-- adjust_resources.lua (abridged)
function onStart(var)
    SetResource(TAG_BERRY, BERRY_AMOUNT, "berries")  -- rewrite every berry bush
    -- ...
end
addMod({ onStart = onStart })
```

Real uses: [adjust_resources.lua](../../mods/adjust_resources/adjust_resources.lua) (map resources), [house_production.lua](../../mods/house_production/house_production.lua) (prints what it will watch), [shared_resources.lua](../../mods/sharing_economy/shared_resources.lua) (builds team tables).

### `onTick(var, currentMoment)` — runs constantly

Called continuously — many times per second. `currentMoment` is the time elapsed since the match started, **in milliseconds** (1000 ms = 1 s). The idiom every mod uses to run something only **once per second**:

```lua
-- shared_resources.lua / house_production.lua (abridged)
function onTick(var, currentMoment)
    if currentMoment % 1000 ~= 0 then return end  -- not a whole second yet: skip

    -- ...work that should happen once per second...
end
addMod({ onTick = onTick })
```

[victory_condition_1.lua](../../mods/victory_conditions/victory_condition_1.lua) uses the equivalent positive form: `if currentMoment % 1000 == 0 then ... end`.

> Be careful: `onTick` fires many times per second. Heavy work on **every single tick** (scanning all units, looping all players) is wasteful and can slow the match down. Gate it with the `% 1000` idiom above — every `onTick` mod in this repository does.

Real uses: [house_production.lua](../../mods/house_production/house_production.lua) (upkeep deductions), [shared_resources.lua](../../mods/sharing_economy/shared_resources.lua) (resource pooling), [victory_condition_1.lua](../../mods/victory_conditions/victory_condition_1.lua) (win check), [gameplay_backend.lua](../../mods/diplomacy/gameplay_backend.lua) (allied-victory check).

### `onSpecialCommand(var)` — custom commands / UI events

Runs when a custom command arrives — a mod-panel button, a UI event, a server message. Read the command's parameters with `getParameter` (values arrive as strings; convert numbers with `tonumber`):

```lua
-- gameplay_backend.lua (abridged)
function ServerDiplomacyHandler(var)
    if getParameter("command") == "Diplomacy" then
        local f1 = tonumber(getParameter("player1"))  -- faction ids as strings
        local f2 = tonumber(getParameter("player2"))
        -- ally / peace / war / pay...
    end
end
addMod({ onSpecialCommand = ServerDiplomacyHandler })
```

### `onPlayerEliminate(var)` — a player was eliminated

The eliminated player's id arrives via `getParameterNumber("player")`:

```lua
-- shared_population.lua (abridged)
function onPlayerEliminate(var)
    local playerId = getParameterNumber("player")
    -- subtract their contribution from the shared team pool...
end
```

## Alternative registrations

Three other registration functions appear in mods — instead of one table, each registers **one** function under a name:

```lua
-- starting_resources.lua — start hook; the function takes NO arguments
function initOnStartResourcesInit()
    -- set every faction's starting treasury...
end
addStartFunction(initOnStartResourcesInit, "initOnStartResourcesInit")

-- victory_condition_2.lua — tick hook; receives ONLY the elapsed time
function onTickWinLoss(time)
    if time % 1000 == 0 then checkWinLose() end
end
addTickFunction(onTickWinLoss, "onTickWinLoss")

-- victory_condition_2.lua — script/special-command hook; NO arguments
function onScriptWinLoss()
    if getParameter("command") == "leave" then
        -- make the leaving player lose...
    end
end
addScriptFunction(onScriptWinLoss, "onScriptWinLoss")
```

They are roughly equivalent to `onStart`, `onTick` (but with no `var`) and `onSpecialCommand`. They work in the mods that use them, but when in doubt use `addMod` — it is the pattern every recent mod follows and the one this guide documents.

## Panel / map-editor parameters

The values a map maker sets in the mod's settings panel (map editor), read from the script — at load time or inside any hook:

```lua
getParameterNumber("DistanceMax", 2000, 0, 100000)   -- name, default, min, max
local amount = getParameterNumber("res0") or 100     -- "or default" style
local keep   = getParameterBool("keepLimit", false)  -- on/off checkbox
local cmd    = getParameter("command")               -- raw (usually string) value
```

- `getParameterNumber(name, default, min, max)` — numbers, as in [colossal_cannon.lua](../../mods/colossal_cannon/colossal_cannon.lua), [warehouse.lua](../../mods/economy_gather/warehouse/warehouse.lua) and [adjust_resources.lua](../../mods/adjust_resources/adjust_resources.lua).
- `getParameterNumber(name)` — no defaults: returns exactly what the caller passed ([shared_population.lua](../../mods/sharing_economy/shared_population.lua) reads the eliminated player this way).
- `getParameterBool(name, default)` — checkboxes ([shared_population.lua](../../mods/sharing_economy/shared_population.lua)).
- `getParameter(key)` — raw parameter, usually a string: command names, player ids ([gameplay_backend.lua](../../mods/diplomacy/gameplay_backend.lua)).
- Remember the value units from [README.md](README.md): displayed resources / HP / damage are ×1000 in the engine — multiply, then `math.floor`.

## Storing state between ticks on `var`

The `var` table passed to every hook is **yours**: whatever you save on it in one hook is still there in the next. Build expensive data once in `onStart`, then reuse it in every `onTick`:

```lua
-- shared_resources.lua (abridged)
function onStart(var)
    local teams = {}      -- build team groupings once...
    local prevRes = {}    -- ...and each faction's previous resources
    -- ...
    var.teams = teams     -- stash them on var
    var.prevRes = prevRes
end

function onTick(var, currentMoment)
    if currentMoment % 1000 ~= 0 then return end
    local teams = var.teams      -- still there — no rebuild needed
    local prevRes = var.prevRes
    -- pool resources between teammates...
end
```

[shared_population.lua](../../mods/sharing_economy/shared_population.lua) does the same across different hooks: `onInit` saves `var.keepLimit`, and `onPlayerEliminate` reads it back much later.

## Cheat sheet

| Hook | Runs when | Typical use | Real example |
|---|---|---|---|
| *(top-level code)* | script load, before the match | stat edits, ends with `root.f_recreateModifiedUnitTypes()` | [colossal_cannon.lua](../../mods/colossal_cannon/colossal_cannon.lua) |
| `onInit(var)` | very early, before match data | read panel params onto `var` | [shared_population.lua](../../mods/sharing_economy/shared_population.lua) |
| `onStart(var)` | once, when the match starts | one-shot setup, build state | [adjust_resources.lua](../../mods/adjust_resources/adjust_resources.lua) |
| `onTick(var, currentMoment)` | constantly; `currentMoment` = elapsed **ms** | periodic logic, gated by `% 1000` | [house_production.lua](../../mods/house_production/house_production.lua) |
| `onSpecialCommand(var)` | custom command / UI event | react to panel buttons | [gameplay_backend.lua](../../mods/diplomacy/gameplay_backend.lua) |
| `onPlayerEliminate(var)` | a player is eliminated | cleanup, redistribute shared values | [shared_population.lua](../../mods/sharing_economy/shared_population.lua) |
