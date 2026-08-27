[← Back to index](README.md)

# Learn by Example — Real Mods Explained

You wrote your first 5-minute mod ([README.md](README.md)) and you've seen the dry parameter pages. This page is the missing middle: we take **real mods from this repository**, from the simplest to the most advanced, and explain how each one works and **why** it's built that way.

Read them in order — each one introduces exactly one new idea. And keep [UNIT_IDS.md](../UNIT_IDS.md) open in a tab: whenever we touch a unit by number, that's where you look up what unit it is (and find the ID for the unit *you* want to change).

## One rule of thumb before we start

Where your code lives decides **when** it runs:

- **Top level of the file** (not inside any function) → runs at **load time**, before the match starts. This is where most stat edits live. You must call `root.f_recreateModifiedUnitTypes()` at the end so the engine rebuilds what you changed.
- **`onStart`** → runs once, when the match starts. Needed when you edit things that only exist in a live match (resource nodes on the map, factions...).
- **`onTick(var, currentMoment)`** → runs every game tick, all match long. `currentMoment` is the match time in **milliseconds**.

You'll see all three below. Don't worry, each mod only uses what it needs.

---

## 1. Warehouse storage — the "config table + loop" pattern

Mod folder: [economy_gather/warehouse](../../mods/economy_gather/warehouse/) · File: [warehouse.lua](../../mods/economy_gather/warehouse/warehouse.lua) (~42 lines)

### What it does

Lets every warehouse's storage capacity be changed from the mod's settings panel, as a percentage of the base game (100 = unchanged). It covers all nine storage buildings, including the cargo elephant and the abstract warehouse.

### The pattern

No hooks at all — everything runs at load time. One table describes *what* to change, one loop does the changing:

```lua
-- One entry per warehouse: a name, a panel parameter, a unit id, a default %
local warehouses = {
    { name = "Stone",  param = "Stone",  id = 2,  default = 100 }, -- stone warehouse
    { name = "Europe", param = "Europe", id = 17, default = 110 }, -- europe warehouse
    -- ... 7 more entries
}

for _, w in ipairs(warehouses) do
    local percentage = getParameterNumber(w.param, w.default, 1, 1000) -- read the panel
    local multiplier = math.ceil(percentage * 65536 / 100) -- 65536 = 100% (engine scale)

    root.unitType[w.id].storageMultiplier = multiplier -- apply it

    print(string.format("[warehouse] %s (id %d): %d%% -> storageMultiplier %d",
        w.name, w.id, percentage, multiplier)) -- prove it in the console
end

root.f_recreateModifiedUnitTypes() -- rebuild the unit types we just edited
```

### What to learn here

- **The config table + loop** is the workhorse of this whole repository: instead of copy-pasting the same three lines nine times, you describe *what* to change in a table and loop over it. Adding a tenth building = adding one line.
- `getParameterNumber("paramName", default, min, max)` reads a value from the mod's settings panel — if the player never touches the panel, they get `default`.
- Percent-style multipliers use the engine's fixed-point scale: **65536 = 100%**. The mod uses `math.ceil` so the result is never *below* the requested percentage.
- `root.f_recreateModifiedUnitTypes()` is mandatory after load-time edits — without it your changes silently don't apply.

### Try it yourself

Add a market or storage building you like to the table: pick an id from [UNIT_IDS.md](../UNIT_IDS.md), add `{ name = "...", param = "...", id = N, default = 150 }`, and check the console shows your new line.

---

## 2. Colossal cannon — deep paths into ONE unit, and the integer rule

Mod folder: [colossal_cannon](../../mods/colossal_cannon/) · File: [colossal_cannon.lua](../../mods/colossal_cannon/colossal_cannon.lua) (~86 lines)

### What it does

Makes the colossal cannon (unit type 284) fully configurable from the settings panel: range, reload, damage, blast radius, turret rotation, health and armor.

### The pattern

Same shape as the warehouse (load time, panel params, final `f_recreateModifiedUnitTypes()`), but it digs deep into one unit's tree:

```lua
-- Panel gives DISPLAYED values (meters, seconds, damage points)
-- math.floor: engine fields need INTEGERS (0.5 * 1000 = 500.0 is a float and fails)
local DISTANCE_MAX = math.floor(getParameterNumber("DistanceMax", 2000, 0, 100000) * 1000)
local DAMAGE       = math.floor(getParameterNumber("Damage",     400, 0, 1000000) * 1000)
-- ... more params

-- Defensive validation: wrong ranges would silently break the weapon
if DISTANCE_STOP <= DISTANCE_MAX then
    DISTANCE_STOP = DISTANCE_MAX + 50000 -- +50 m safety margin
end

-- Deep path: unitType -> attack -> turret 0 -> weapon 0
local weapon = root.unitType[284].attack.turret[0].weapon[0]
weapon.distanceMax       = DISTANCE_MAX
weapon.damage.damages[0] = DAMAGE
weapon.rechargePeriod    = RECHARGE

-- Health/armor live under deathability
root.unitType[284].deathability.health = HEALTH
```

### What to learn here

- **The ×1000 rule**: 1000 = 1 displayed unit of distance/damage/HP/seconds. Read the panel as a human value, multiply by 1000, store the raw value.
- **The integer rule**: `0.5 * 1000` gives `500.0`, a Lua float — the engine rejects it with "Argument 0: Not integer". Wrap conversions in `math.floor` (see the [README](README.md#value-units--read-this-once) units table).
- Paths can be long: `root.unitType[284].attack.turret[0].weapon[0].damage.damages[0]` is "the first damage value of the first weapon of the first turret". Grabbing a sub-table into a local (`local weapon = ...`) keeps the rest readable.
- **Validate before you apply**: if `distanceStop <= distanceMax`, the cannon stops attacking the moment its target moves (explained in [attack.md](attack.md)). Bad panel values would *silently* break the unit — so the code fixes them.
- The big `print(string.format(...))` at the end dumps every applied value: if one shows the base default, the panel parameter is missing or misnamed. Cheap debugging, worth copying.

### Try it yourself

Add a `KillHP`-style sanity clamp: `HEALTH = math.min(HEALTH, 1000000000)` so the panel's max can't create an unkillable cannon. Then add one new parameter (e.g. `SecondArmor`) following the existing lines.

---

## 3. Adjust resources — your first hook, and the map-wide search

Mod folder: [adjust_resources](../../mods/adjust_resources/) · File: [adjust_resources.lua](../../mods/adjust_resources/adjust_resources.lua) (~75 lines)

### What it does

Sets or scales the quantity of every resource node on the map — berries, fish, wheat, stone, iron, trees — from the settings panel.

### What it does differently

Resource nodes don't exist at load time; they're placed on the map. So this mod needs its first **hook**:

```lua
function onStart(var)              -- runs when the match actually starts
    SetResource(TAG_BERRY, BERRY_AMOUNT, "baies")
    ScaleResource(TAG_WOOD, WOOD_PCT, "arbres")
    -- ... more resources
end

addMod({ onStart = onStart })      -- registers the function with the game
```

And the clever part is a generic **transform callback** — one helper, two behaviors:

```lua
-- Find every object with this tag across the whole map,
-- apply transform(health) to its quantity.
function ForEachTagged(tag, name, transform)
    local ids  = root.scene[0].envs.f_search(0, 0, 1000000000, tag) -- whole-map search
    local envs = root.scene[0].envs.list
    for _, id in ipairs(ids) do
        envs[id].health = transform(envs[id].health) -- the node's QUANTITY is its health
    end
end

function SetResource(tag, rawAmount, name)   -- set to a fixed value
    ForEachTagged(tag, name, function(health) return rawAmount end)
end

function ScaleResource(tag, percent, name)   -- multiply by a percentage
    ForEachTagged(tag, name, function(health)
        return math.floor(health * percent / 100)
    end)
end
```

### What to learn here

- `addMod({ onStart = onStart })` is the standard registration; the same table also accepts `onTick`, `onSpecialCommand`, `onPlayerEliminate`...
- Map objects ("environments") are searched by **tag**, and tags are bitmasks: berry 1, wood 2, small fish 4, big fish 8, iron 16, stone 64, wheat 128. `f_search(0, 0, 1000000000, tag)` is just "search everywhere for this tag".
- The surprising bit: the quantity stored in a resource node **is its `health` field**. Cut a berry bush's health to 0 and it's empty.
- The **transform callback** pattern (pass a function that says *how* to change a value) lets one search helper serve both "set" and "scale" — much better than two near-identical loops.

### Try it yourself

Add a `ScaleAll` mode: call `ScaleResource` for every tag with one shared percentage parameter (you'd add the tag constants yourself — they're plain numbers).

---

## 4. Starting resources — factions vs players, and treasury writes

Mod folder: [starting_resources](../../mods/starting_resources/) · File: [starting_resources.lua](../../mods/starting_resources/starting_resources.lua) (~36 lines)

### What it does

Gives every player configurable starting resources (food, wood, iron, gold, oil) and raises their storage caps. The whole mod is 36 lines.

### The pattern

This one registers with the **alternative** API `addStartFunction`, and uses a built-in iterator to reach every player's faction:

```lua
function initOnStartResourcesInit()
    local factions = root.scene[0].faction

    local function func(factionId)
        local treasury = factions[factionId].treasury
        for i = 0, 4 do                        -- 5 resource slots
            treasury.limits[i]    = 4000000000 -- raise the storage cap
            treasury.resources[i] = initResourcesA[i + 1] -- set the amount
        end
    end

    forEachControlledFaction(func) -- run func for every faction a player controls
end

addStartFunction(initOnStartResourcesInit, "initOnStartResourcesInit")
```

with the amounts read at load time into a plain table:

```lua
initResourcesA = {
    getParameterNumber("res0", 100, 0, 1000000) * 1000, -- food  (slot 0)
    getParameterNumber("res1", 250, 0, 1000000) * 1000, -- wood  (slot 1)
    -- res2 = iron, res3 = gold, res4 = oil
}
```

### What to learn here

- **Factions vs players**: a *player* is a human at a slot; a *faction* is the in-game side they control (one player can control several). Resources live on **factions**, so you iterate factions — `forEachControlledFaction(func)` handles that for you.
- Treasury resource slots are fixed: **0 = food, 1 = wood, 2 = iron, 3 = gold, 4 = oil** (same IDs as the [README table](README.md#resource-ids)).
- `addStartFunction(fn, "name")` is an alternative to `addMod({ onStart = fn })` — pick whichever you prefer. Siblings exist: `addTickFunction`, `addScriptFunction`.
- Writing `resources[i]` above the current `limits[i]` does nothing — the cap clamps it. That's why the mod raises both.

### Try it yourself

Give every player 500 gold by default: change the `res3` default from `0` to `500`. One number, done. Then try making the amounts a flat 1000 of everything.

---

## 5. Nuclear bomb — structural edits with f_clear / f_create

Mod folder: [nuclear_bomb](../../mods/nuclear_bomb/) · File: [nuclear_bomb.lua](../../mods/nuclear_bomb/nuclear_bomb.lua) (~66 lines)

### What it does

Lets four aircraft (ids 316, 330, 355, 361) each build and drop one configurable nuclear bomb per flight, gated behind a technology. This is the first mod that doesn't just *tune* values — it *restructures* a unit's ability list.

### The pattern

Tuning the bomb itself is familiar; rebuilding the aircraft's ability list is the new, spicier part:

```lua
local FOOD = (getParameterNumber("CostFood") or 60000) * 1000 -- alternative panel style:
-- ... other costs                                             -- nil = use default, no min/max

local bomb = root.unitType[377]          -- the nuclear bomb
bomb.ability.ability[0].data.radius = RADIUS
bomb.lifeTime  = 9000                    -- 9 s before it despawns
bomb.tags[16]  = true

for _, aircraftId in ipairs({ 316, 330, 355, 361 }) do
    local b = root.unitType[aircraftId]
    b.ability.ability.f_clear()          -- wipe the existing ability list
    b.ability.work.f_clear()             -- and the existing work list

    local newAbilityId = b.ability.ability.f_create() -- create a fresh ability
    local newAbility = b.ability.ability[newAbilityId]
    newAbility.data.unit = 377           -- it drops the bomb (unit 377)

    local newWorkId = b.ability.work.f_create()        -- create a fresh work
    local newWork = b.ability.work[newWorkId]
    newWork.reserveLimit   = 1           -- only one bomb stocked at a time
    newWork.costProcess[0] = FOOD        -- cost: food/wood/iron per slot

    -- Gate the ability behind a technology (id 89)
    newAbility.requirements.researchAny.f_create()
    newAbility.requirements.researchAny[0].id = 89
end
```

### What to learn here

- **`f_clear()` / `f_create()` is the factory pattern for structural edits**: empty the list, create a fresh entry, fill it in. Simple value writes can't add an ability that doesn't exist — these functions can. The cost: you're replacing whatever was there, so know what you're removing.
- **Tech gating** with `newAbility.requirements.researchAny.f_create()` then setting `.id` makes the ability appear only after the tech is researched — the clean way to hide late-game toys.
- `costProcess[slot]` prices a work per resource slot (same 0–4 food/wood/iron/gold/oil order as treasuries).
- A second panel style appears: `(getParameterNumber("CostFood") or 60000) * 1000` — no min/max, and `nil` from the panel falls back via `or`. Handy when you don't want bounds.
- Some values here (like `bomb.tags[16]`, `data.id = 27`, tech id 89) were found by experimenting — treat them as "works in this mod", not as documented API. Copy, don't generalize blindly.

### Try it yourself

Make the bomb cheaper but slower to stock: lower the `CostFood`/`CostWood`/`CostIron` defaults and raise `newWork.reserveTime` (it's in ms — 60000 = 60 s).

---

## 6. Victory condition — logic that runs all game long

Mod folder: [victory_conditions](../../mods/victory_conditions/) · File: [victory_condition_1.lua](../../mods/victory_conditions/victory_condition_1.lua) (37 lines)

### What it does

A new game rule: the last team standing wins. It can't be applied once at load time — it must be *checked*, forever, while the match runs.

### The pattern

The `onTick` hook, throttled down to once per second:

```lua
function onTick(var, currentMoment)          -- currentMoment is in ms
    if currentMoment % 1000 == 0 then        -- only act once per second
        if root.player_size == 1 then return end -- solo game: no victory to declare
        local factions = root.scene[0].faction

        local function func(playerId)
            if not root.player[playerId].eliminated then   -- still alive?
                local function func_(factionId)
                    local teamId = factions[factionId].team -- team of a faction
                    -- ... remember the team; if two different teams are
                    -- still alive, nobody has won yet
                end
                forEachPlayerFaction(playerId, func_)
            end
        end
        forEachPlayerLive(func)

        -- if only ONE team's players are alive: declare victory
        if oneAliveTeam and winTeamId ~= nil then
            winTeam(winTeamId)
        end
    end
end

addMod({ onTick = onTick })
```

### What to learn here

- **`onTick` runs every tick** — that's many times per second. Almost every `onTick` mod starts with `if currentMoment % 1000 == 0 then` to run only once per second. Copy that line; your players' CPUs will thank you.
- `var` is a table that survives across your callbacks — store state in it (like `var.teams` in [sharing_economy](../../mods/sharing_economy/)) instead of globals.
- Two iterators pair up here: `forEachPlayerLive(func)` walks live players, `forEachPlayerFaction(playerId, func_)` walks that player's factions — the mirror image of case study 4.
- `winTeam(teamId)` is a built-in that ends the game. Finding "the last team" is just set bookkeeping — read the full 37 lines, it's genuinely short.

Once this makes sense, look at [victory_condition_king.lua](../../mods/victory_conditions/victory_condition_king.lua): it *replaces* the engine's `checkFactionLose` function with its own. That's intermediate territory — and **load order matters** (it must be enabled after `victory_condition_2.lua`, since it overrides that mod's function). Skim it, don't study it yet.

### Try it yourself

Make the check every 5 seconds instead of every second: change `1000` to `5000` and notice nothing else changes — the throttle is just one number.

---

## 7. Where to go next

You've now seen every core pattern. These mods combine them — no full walkthroughs here, just what each one adds:

- **[house_production](../../mods/house_production/house_production.lua)** — the **hybrid** mod: load-time config for engine-paid income, plus an `onTick` loop that deducts *negative* income (upkeep) once per second, because the engine's income field crashes on negative values. Great next read.
- **[period_piece](../../mods/period_piece/period_piece.lua)** — **data-driven config at scale**: one block per age research, applied to every temple offering it, each write wrapped in `pcall` with applied/skipped/failed counters so one broken entry can't kill the whole mod. The most defensive mod in the repo.
- **[sharing_economy](../../mods/sharing_economy/)** — the **anchor-unit trick**: clones a harmless unit type with `unitTypes.f_create()` / `f_copy(274, id)` and spawns/removes those invisible units to share resources and population between teammates.
- **[diplomacy](../../mods/diplomacy/)** — the capstone for now: a full custom UI via `addInterface`, button clicks through `onSpecialCommand`, and a client/server split between `diplomacy_interface.lua` (frontend) and `gameplay_backend.lua` (backend). Come back to this last.
- **[economy_gather/fisher](../../mods/economy_gather/fisher/fisher.lua) and [worker](../../mods/economy_gather/worker/worker.lua)** — gathering slots: `movement.gather[i].perTick` (per-second rate **× 50**) and `.bagSize` (carried amount **× 1000**), per resource.
- **[economy_gather/DEFAULTS.md](../../mods/economy_gather/DEFAULTS.md)** — an archive of base-game values. Before changing a number, check what the default is.

---

## Cheat sheet

| I want to... | Look at |
|---|---|
| Change one value on several units cleanly | [warehouse](../../mods/economy_gather/warehouse/warehouse.lua) |
| Change one unit's stats deeply (weapon, HP, armor) | [colossal_cannon](../../mods/colossal_cannon/colossal_cannon.lua) |
| Read settings from the mod panel | [warehouse](../../mods/economy_gather/warehouse/warehouse.lua), [colossal_cannon](../../mods/colossal_cannon/colossal_cannon.lua) |
| Run logic when the match starts | [adjust_resources](../../mods/adjust_resources/adjust_resources.lua) |
| Run logic every second during the match | [victory_condition_1](../../mods/victory_conditions/victory_condition_1.lua) |
| Give players resources at the start | [starting_resources](../../mods/starting_resources/starting_resources.lua) |
| Edit resource nodes on the map | [adjust_resources](../../mods/adjust_resources/adjust_resources.lua) |
| Add a new ability / work / cost to a unit | [nuclear_bomb](../../mods/nuclear_bomb/nuclear_bomb.lua) |
| Gate something behind a technology | [nuclear_bomb](../../mods/nuclear_bomb/nuclear_bomb.lua) |
| Change gather speed or carry capacity | [fisher](../../mods/economy_gather/fisher/fisher.lua), [worker](../../mods/economy_gather/worker/worker.lua) |
| Write a custom game rule | [victory_condition_1](../../mods/victory_conditions/victory_condition_1.lua) |
| Make one mod touch many units safely | [period_piece](../../mods/period_piece/period_piece.lua) |
| Find a unit's ID | [UNIT_IDS.md](../UNIT_IDS.md) |
