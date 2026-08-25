-----------------------------------------------------------
-- Mod name: Warehouse storage capacity
-- Description: Configurable storage capacity for every warehouse (plus the cargo elephant and the abstract warehouse), via the settings panel. Values are percentages of the base-game capacity: 100 = unchanged.
-- Author: AdrienRmd
-- Status: Stable
-----------------------------------------------------------
-- ============================================================================
-- The mod panel expects percentages of the base-game storage capacity:
--   100 = base-game capacity (no change)
--   110 = +10% capacity, 200 = double, 50 = half...
-- Engine scale (16.16 fixed point): 65536 (2^16) = 100%
--   storageMultiplier = percentage x 65536 / 100
--   e.g. 110% -> 65536 x 110 / 100 = 72089.6 -> rounded UP to 72090
--   Rounding UP (not floor): floor can store less than requested
--   (210% -> 137625 = 209.999% -> game UI shows 209%); ceil never does.
-- ============================================================================

-- Unit type IDs: warehouses and storage units
-- default = author's tuned capacity in % (100 = base game)
local warehouses = {
    { name = "Stone",         param = "Stone",         id = 2,   default = 100 }, -- stone warehouse
    { name = "Europe",        param = "Europe",        id = 17,  default = 110 }, -- europe warehouse
    { name = "Asia",          param = "Asia",          id = 30,  default = 110 }, -- asia warehouse
    { name = "WesternEurope", param = "WesternEurope", id = 59,  default = 130 }, -- western europe warehouse
    { name = "EasternEurope", param = "EasternEurope", id = 60,  default = 130 }, -- eastern europe warehouse
    { name = "WesternAsia",   param = "WesternAsia",   id = 87,  default = 130 }, -- western asia warehouse
    { name = "EasternAsia",   param = "EasternAsia",   id = 88,  default = 130 }, -- eastern asia warehouse
    { name = "ElephantCargo", param = "ElephantCargo", id = 124, default = 130 }, -- cargo elephant (mobile storage)
    { name = "Abstract",      param = "Abstract",      id = 191, default = 150 }, -- abstract warehouse
}

for _, w in ipairs(warehouses) do
    local percentage = getParameterNumber(w.param, w.default, 1, 1000) -- wanted % of base capacity
    local multiplier = math.ceil(percentage * 65536 / 100)             -- engine: integer required (ceil: never below requested %)

    root.unitType[w.id].storageMultiplier = multiplier

    print(string.format("[warehouse] %s (id %d): %d%% -> storageMultiplier %d",
        w.name, w.id, percentage, multiplier))
end

root.f_recreateModifiedUnitTypes()
