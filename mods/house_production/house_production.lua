-----------------------------------------------------------
-- Mod name: House income
-- Description: Configurable periodic income for every house. POSITIVE amounts
--              are paid by the engine income field; NEGATIVE amounts act as
--              upkeep, deducted from the faction treasury by a script tick
--              (the engine income field crashes on negative values).
--              No settings panel: edit the VALUES section at the top.
-- Author: AdrienRmd
-- Status: Working (income and upkeep verified in game)
-----------------------------------------------------------

-- ============================================================================
-- 1. VALUES -- EDIT HERE (defaults = base-game values)
--    enabled = income on/off (false = the house pays and costs nothing)
--    period  = seconds between two payouts (5.5 in the base game), shared by
--              every resource of the house (single engine field); upkeep
--              periods are rounded to whole seconds by the tick loop
--    <resource> = { amount = N }: units at each payout, one line per
--              resource: food, wood, iron, gold, oil — all five are listed.
--              POSITIVE = income paid by the engine income field.
--              NEGATIVE = upkeep: the amount is DEDUCTED from the treasury
--              for every house of this kind the faction owns (e.g. -20 iron
--              = 20 iron per house per period). Mixed signs work together.
-- ============================================================================

-- Stone Age house (unit 3) -- base game: 20 iron every 5.5 s
local stone_house = {
    enabled = true,
    period  = 5.5,
    food    = { amount = 0 },
    wood    = { amount = 0 },
    iron    = { amount = 20 },
    gold    = { amount = 0 },
    oil     = { amount = 0 },
}

-- Europe house (unit 16) -- base game: no income
local europe_house = {
    enabled = true,
    period  = 5.5,
    food    = { amount = 0 },
    wood    = { amount = 0 },
    iron    = { amount = 0 },
    gold    = { amount = 0 },
    oil     = { amount = 0 },
}

-- Asia house (unit 29)
local asia_house = {
    enabled = true,
    period  = 5.5,
    food    = { amount = 0 },
    wood    = { amount = 0 },
    iron    = { amount = 0 },
    gold    = { amount = 0 },
    oil     = { amount = 0 },
}

-- Western Europe house (unit 57)
local western_europe_house = {
    enabled = true,
    period  = 5.5,
    food    = { amount = 0 },
    wood    = { amount = 0 },
    iron    = { amount = 0 },
    gold    = { amount = 0 },
    oil     = { amount = 0 },
}

-- Eastern Europe house (unit 58)
local eastern_europe_house = {
    enabled = true,
    period  = 5.5,
    food    = { amount = 0 },
    wood    = { amount = 0 },
    iron    = { amount = 0 },
    gold    = { amount = 0 },
    oil     = { amount = 0 },
}

-- Western Asia house (unit 85)
local western_asia_house = {
    enabled = true,
    period  = 5.5,
    food    = { amount = 0 },
    wood    = { amount = 0 },
    iron    = { amount = 0 },
    gold    = { amount = 0 },
    oil     = { amount = 0 },
}

-- Eastern Asia house (unit 86)
local eastern_asia_house = {
    enabled = true,
    period  = 5.5,
    food    = { amount = 0 },
    wood    = { amount = 0 },
    iron    = { amount = 0 },
    gold    = { amount = 0 },
    oil     = { amount = 0 },
}

-- Abstract (generic) house (unit 192)
local abstract_house = {
    enabled = true,
    period  = 5.5,
    food    = { amount = 0 },
    wood    = { amount = 0 },
    iron    = { amount = 0 },
    gold    = { amount = 0 },
    oil     = { amount = 0 },
}

-- Great Britain house (unit 255)
local great_britain_house = {
    enabled = true,
    period  = 5.5,
    food    = { amount = 0 },
    wood    = { amount = 0 },
    iron    = { amount = 0 },
    gold    = { amount = 0 },
    oil     = { amount = 0 },
}

-- India house (unit 265)
local india_house = {
    enabled = true,
    period  = 5.5,
    food    = { amount = 0 },
    wood    = { amount = 0 },
    iron    = { amount = 0 },
    gold    = { amount = 0 },
    oil     = { amount = 0 },
}

-- Turkey house (unit 272)
local turkey_house = {
    enabled = true,
    period  = 5.5,
    food    = { amount = 0 },
    wood    = { amount = 0 },
    iron    = { amount = 0 },
    gold    = { amount = 0 },
    oil     = { amount = 0 },
}

-- Germany house (unit 283)
local germany_house = {
    enabled = true,
    period  = 5.5,
    food    = { amount = 0 },
    wood    = { amount = 0 },
    iron    = { amount = 0 },
    gold    = { amount = 0 },
    oil     = { amount = 0 },
}

-- Russia house (unit 303)
local russian_house = {
    enabled = true,
    period  = 5.5,
    food    = { amount = 0 },
    wood    = { amount = 0 },
    iron    = { amount = 0 },
    gold    = { amount = 0 },
    oil     = { amount = 0 },
}

-- France house (unit 324)
local france_house = {
    enabled = true,
    period  = 5.5,
    food    = { amount = 0 },
    wood    = { amount = 0 },
    iron    = { amount = 0 },
    gold    = { amount = 0 },
    oil     = { amount = 0 },
}

-- China house (unit 338)
local china_house = {
    enabled = true,
    period  = 5.5,
    food    = { amount = 0 },
    wood    = { amount = 0 },
    iron    = { amount = 0 },
    gold    = { amount = 0 },
    oil     = { amount = 0 },
}

-- Japan house (unit 359)
local japan_house = {
    enabled = true,
    period  = 5.5,
    food    = { amount = 0 },
    wood    = { amount = 0 },
    iron    = { amount = 0 },
    gold    = { amount = 0 },
    oil     = { amount = 0 },
}

-- Poland house (unit 373)
local poland_house = {
    enabled = true,
    period  = 5.5,
    food    = { amount = 0 },
    wood    = { amount = 0 },
    iron    = { amount = 0 },
    gold    = { amount = 0 },
    oil     = { amount = 0 },
}

-- Austro-Hungary house (unit 386)
local austro_hungary_house = {
    enabled = true,
    period  = 5.5,
    food    = { amount = 0 },
    wood    = { amount = 0 },
    iron    = { amount = 0 },
    gold    = { amount = 0 },
    oil     = { amount = 0 },
}

-- Persia/Iran house (unit 403)
local persia_iran_house = {
    enabled = true,
    period  = 5.5,
    food    = { amount = 0 },
    wood    = { amount = 0 },
    iron    = { amount = 0 },
    gold    = { amount = 0 },
    oil     = { amount = 0 },
}

-- Italy house (unit 437)
local italy_house = {
    enabled = true,
    period  = 5.5,
    food    = { amount = 0 },
    wood    = { amount = 0 },
    iron    = { amount = 0 },
    gold    = { amount = 0 },
    oil     = { amount = 0 },
}

-- ============================================================================
-- 2. HOUSE DATA -- DO NOT CHANGE
--    Unit IDs and treasury resource slot IDs (fixed for every house:
--    0 food, 1 wood, 2 iron, 3 gold, 4 oil — unlike worker gather slots).
--    Conversions: amount x 1000 (1000 = 1 displayed unit), period x 1000
--    in milliseconds. Integers required (math.floor), like every engine field.
-- ============================================================================

local houses = {
    { name = "stone_house",         id = 3,   values = stone_house },
    { name = "europe_house",        id = 16,  values = europe_house },
    { name = "asia_house",          id = 29,  values = asia_house },
    { name = "western_europe_house", id = 57, values = western_europe_house },
    { name = "eastern_europe_house", id = 58, values = eastern_europe_house },
    { name = "western_asia_house",  id = 85, values = western_asia_house },
    { name = "eastern_asia_house",  id = 86, values = eastern_asia_house },
    { name = "abstract_house",      id = 192, values = abstract_house },
    { name = "great_britain_house", id = 255, values = great_britain_house },
    { name = "india_house",         id = 265, values = india_house },
    { name = "turkey_house",        id = 272, values = turkey_house },
    { name = "germany_house",       id = 283, values = germany_house },
    { name = "russian_house",       id = 303, values = russian_house },
    { name = "france_house",        id = 324, values = france_house },
    { name = "china_house",         id = 338, values = china_house },
    { name = "japan_house",         id = 359, values = japan_house },
    { name = "poland_house",        id = 373, values = poland_house },
    { name = "austro_hungary_house", id = 386, values = austro_hungary_house },
    { name = "persia_iran_house",   id = 403, values = persia_iran_house },
    { name = "italy_house",         id = 437, values = italy_house },
}

local resource_ids = { food = 0, wood = 1, iron = 2, gold = 3, oil = 4 }

-- Load-time setup: positive amounts go through the engine income field
-- (safe), negative amounts are NEVER written to it (crash) — they are
-- registered here for the runtime tick below.
local upkeep = {}

for _, h in ipairs(houses) do
    local v = h.values
    local income = root.unitType[h.id].income

    income.enabled = v.enabled

    if v.enabled then
        for i = 0, 4 do
            income.value[i] = 0
        end

        local paid, owed, has_owed = {}, {}, false
        for res, r in pairs(v) do
            local rid = resource_ids[res]
            if rid and r and r.amount and r.amount ~= 0 then
                if r.amount > 0 then
                    income.value[rid] = math.floor(r.amount * 1000)
                else
                    owed[rid] = math.floor(-r.amount * 1000)
                    has_owed = true
                end
                table.insert(paid, string.format("%+d %s", r.amount, res))
            end
        end

        income.period = math.floor(v.period * 1000)

        if has_owed then
            upkeep[h.name] = {
                id      = h.id,
                period  = income.period,
                next    = income.period,
                amounts = owed,
            }
        end

        print(string.format("[house] %s (id %d): %s every %d ms%s",
            h.name, h.id, table.concat(paid, ", "), income.period,
            has_owed and " (negative = upkeep by tick)" or ""))
    else
        print(string.format("[house] %s (id %d): disabled", h.name, h.id))
    end
end

root.f_recreateModifiedUnitTypes()

-- ============================================================================
-- 3. RUNTIME UPKEEP TICK
--    Every whole second, for each due house kind: count the houses owned by
--    every live player (forEachPlayerUnit2 — the old forEachPlayerUnit is
--    obsolete and its shim crashes with "No match address findAll") and
--    deduct cost x count from each faction the player controls
--    (scene.player[].controlledFactions — root.player is obsolete for it),
--    floored at 0.
--    DEBUG = true prints every step to the developer Console; set to false
--    once everything is confirmed working (verified in game).
-- ============================================================================

local DEBUG = false

function onStart(var)
    local n = 0
    for _ in pairs(upkeep) do n = n + 1 end
    print(string.format("[house][upkeep] mod started, watching %d house kind(s)", n))
end

function onTick(var, currentMoment)
    if currentMoment % 1000 ~= 0 then return end

    local due = {}
    for _, st in pairs(upkeep) do
        if currentMoment >= st.next then
            st.next = currentMoment + st.period
            table.insert(due, st)
        end
    end
    if #due == 0 then return end

    local scene = root.scene[0]
    local factions = scene.faction

    -- Modern scene player (reading controlledFactions on root.player warns)
    local players = scene.player
    if players == nil then players = root.player end

    -- Engine-recommended replacement for the obsolete forEachPlayerUnit
    local forEachUnits = forEachPlayerUnit2
    if forEachUnits == nil then forEachUnits = forEachPlayerUnit end

    -- Verified unit list API: scene.units.list (shared_population mod)
    local units = nil
    if scene.units ~= nil then units = scene.units.list or scene.units end
    if units == nil then units = scene.unit end
    if units == nil then
        print("[house][upkeep] ERROR: no unit list (scene.units.list / scene.unit) — report this")
        return
    end

    if DEBUG then
        print(string.format("[house][upkeep] tick %d ms: %d house kind(s) due", currentMoment, #due))
    end

    for pid = 0, players.size - 1 do
        local player = players[pid]
        if player ~= nil and not player.eliminated then
            local fids = {}
            if player.controlledFactions ~= nil then
                for fid = 0, factions.size - 1 do
                    if factions[fid] ~= nil and player.controlledFactions[fid] then
                        table.insert(fids, fid)
                    end
                end
            end

            if #fids == 0 then
                if DEBUG then
                    print(string.format("[house][upkeep] player %d: no controlled faction", pid))
                end
            else
                local counts = {}
                for _, st in ipairs(due) do
                    counts[st.id] = 0
                end

                -- The callback may receive a unit id OR the unit itself:
                -- accept both.
                local function func(unitIdOrUnit)
                    local u = type(unitIdOrUnit) == "number" and units[unitIdOrUnit] or unitIdOrUnit
                    if u ~= nil then
                        local t = u.type
                        if counts[t] ~= nil then
                            counts[t] = counts[t] + 1
                        end
                    end
                end
                forEachUnits(pid, func)

                for _, st in ipairs(due) do
                    local n = counts[st.id]
                    if n > 0 then
                        if DEBUG then
                            print(string.format("[house][upkeep] player %d: %d x house id %d",
                                pid, n, st.id))
                        end
                        for _, fid in ipairs(fids) do
                            local res = factions[fid].treasury.resources
                            for rid, cost in pairs(st.amounts) do
                                local before = res[rid]
                                res[rid] = math.max(0, math.floor(before - n * cost))
                                if DEBUG then
                                    print(string.format("[house][upkeep] faction %d res[%d]: %d -> %d",
                                        fid, rid, before, res[rid]))
                                end
                            end
                        end
                    elseif DEBUG then
                        print(string.format("[house][upkeep] player %d: 0 house id %d (nothing deducted)",
                            pid, st.id))
                    end
                end
            end
        end
    end
end

addMod({ onStart = onStart, onTick = onTick })
