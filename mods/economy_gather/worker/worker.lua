-----------------------------------------------------------
-- Mod name: Worker gathering
-- Description: Configurable gather speed and carry capacity for every civilization's worker, per resource. No settings panel: edit the VALUES section at the top of this file.
-- Author: JSuisMort
-- Status: Stable
-----------------------------------------------------------

-- ============================================================================
-- 1. VALUES -- EDIT HERE (defaults = base-game values)
--    speed = resource gathered per second (1.1 = 1.1 per second)
--    bag   = resource carried before dropping off at a storage (10 = 10)
--    To leave one entry unchanged, comment out its line or set it to nil.
--    Base-game values are archived in ../DEFAULTS.md (one folder up).
-- ============================================================================

-- Stone Age worker (unit 1)
local stone_age_worker = {
    berries    = { speed = 1.1, bag = 10 },
    wood       = { speed = 1.1, bag = 10 },
    small_fish = { speed = 1.8, bag = 30 },
    meat       = { speed = 1.5, bag = 40 },
}

-- Europe worker (unit 12)
local europe_worker = {
    berries    = { speed = 1.2, bag = 20 },
    wood       = { speed = 1.4, bag = 20 },
    small_fish = { speed = 2.0, bag = 30 },
    metal      = { speed = 0.7, bag = 10 },
    meat       = { speed = 1.6, bag = 10 },
    stone      = { speed = 1.2, bag = 10 },
    wheat      = { speed = 1.3, bag = 10 },
}

-- Asia worker (unit 31)
local asia_worker = {
    berries    = { speed = 1.1, bag = 20 },
    wood       = { speed = 1.2, bag = 10 },
    small_fish = { speed = 2.0, bag = 20 },
    metal      = { speed = 0.6, bag = 10 },
    meat       = { speed = 1.5, bag = 10 },
    stone      = { speed = 1.0, bag = 10 },
}

-- Western Europe worker (unit 55)
local western_europe_worker = {
    wood       = { speed = 1.5, bag = 20 },
    small_fish = { speed = 4.0, bag = 30 },
    metal      = { speed = 0.8, bag = 10 },
    meat       = { speed = 1.5, bag = 20 },
    stone      = { speed = 1.2, bag = 10 },
    wheat      = { speed = 1.5, bag = 10 },
}

-- Eastern Europe worker (unit 56)
local eastern_europe_worker = {
    wood       = { speed = 1.5, bag = 20 },
    small_fish = { speed = 4.0, bag = 20 },
    metal      = { speed = 0.8, bag = 10 },
    meat       = { speed = 1.5, bag = 20 },
    stone      = { speed = 1.1, bag = 10 },
    wheat      = { speed = 1.6, bag = 10 },
}

-- Western Asia worker (unit 89)
local western_asia_worker = {
    wood       = { speed = 1.4, bag = 10 },
    small_fish = { speed = 3.0, bag = 20 },
    metal      = { speed = 0.8, bag = 10 },
    meat       = { speed = 1.6, bag = 10 },
    stone      = { speed = 1.1, bag = 10 },
}

-- Eastern Asia worker (unit 90)
local eastern_asia_worker = {
    wood       = { speed = 1.4, bag = 10 },
    small_fish = { speed = 3.0, bag = 20 },
    metal      = { speed = 0.8, bag = 10 },
    meat       = { speed = 1.6, bag = 10 },
    stone      = { speed = 1.1, bag = 10 },
}

-- Abstract worker (unit 201)
local abstract_worker = {
    wood       = { speed = 1.8, bag = 20 },
    metal      = { speed = 1.2, bag = 10 },
    meat       = { speed = 1.8, bag = 20 },
    stone      = { speed = 1.8, bag = 10 },
    wheat      = { speed = 1.8, bag = 10 },
}

-- China worker (unit 349)
local china_worker = {
    wood       = { speed = 1.5, bag = 20 },
    metal      = { speed = 0.8, bag = 10 },
    meat       = { speed = 1.6, bag = 30 },
    stone      = { speed = 1.4, bag = 10 },
    rice       = { speed = 1.8, bag = 20 },
}

-- ============================================================================
-- 2. WORKER DATA -- DO NOT CHANGE
--    Unit IDs and gather slot order (slots are unit-specific: wood can be
--    slot 1 for one worker and slot 0 for another). Conversions:
--    perTick = speed x 50 (55 = 1.1/sec), bagSize = bag x 1000 (10000 = 10)
-- ============================================================================

local workers = {
    { name = "stone_age_worker",     id = 1,   values = stone_age_worker,     slots = { "berries", "wood", "small_fish", "meat" } },
    { name = "europe_worker",        id = 12,  values = europe_worker,        slots = { "berries", "wood", "small_fish", "metal", "meat", "stone", "wheat" } },
    { name = "asia_worker",          id = 31,  values = asia_worker,          slots = { "berries", "wood", "small_fish", "metal", "meat", "stone" } },
    { name = "western_europe_worker", id = 55, values = western_europe_worker, slots = { "wood", "small_fish", "metal", "meat", "stone", "wheat" } },
    { name = "eastern_europe_worker", id = 56, values = eastern_europe_worker, slots = { "wood", "small_fish", "metal", "meat", "stone", "wheat" } },
    { name = "western_asia_worker",  id = 89,  values = western_asia_worker,  slots = { "wood", "small_fish", "metal", "meat", "stone" } },
    { name = "eastern_asia_worker",  id = 90,  values = eastern_asia_worker,  slots = { "wood", "small_fish", "metal", "meat", "stone" } },
    { name = "abstract_worker",      id = 201, values = abstract_worker,      slots = { "wood", "metal", "meat", "stone", "wheat" } },
    { name = "china_worker",         id = 349, values = china_worker,         slots = { "wood", "metal", "meat", "stone", "rice" } },
}

for _, w in ipairs(workers) do
    for i, res in ipairs(w.slots) do
        local slot = i - 1 -- gather slots start at 0
        local v = w.values[res]

        if v then
            local perTick = math.floor(v.speed * 50) -- engine: integer required
            local bagSize = math.floor(v.bag * 1000) -- engine: integer required

            root.unitType[w.id].movement.gather[slot].perTick = perTick
            root.unitType[w.id].movement.gather[slot].bagSize = bagSize

            print(string.format("[worker] %s (id %d) %s [slot %d]: %.2f/sec (perTick %d), bag %d (bagSize %d)",
                w.name, w.id, res, slot, perTick / 50, perTick, bagSize / 1000, bagSize))
        else
            print(string.format("[worker] %s (id %d) %s [slot %d]: unchanged (no value set)",
                w.name, w.id, res, slot))
        end
    end
end

root.f_recreateModifiedUnitTypes()
