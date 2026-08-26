-----------------------------------------------------------
-- Mod name: Farm storage capacity
-- Description: Configurable storage capacity for every farm, via the settings panel. Values are percentages of the base-game capacity: 100 = unchanged.
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

-- Unit type IDs: farms
-- default = author's tuned capacity in % (100 = base game)
local farms = {
    { name = "Europe",        param = "Europe",        id = 54,  default = 110 }, -- europe farm
    { name = "Asia",          param = "Asia",          id = 63,  default = 110 }, -- asia farm
    { name = "EasternEurope", param = "EasternEurope", id = 70,  default = 130 }, -- eastern europe farm
    { name = "WesternEurope", param = "WesternEurope", id = 95,  default = 130 }, -- western europe farm
    { name = "WesternAsia",   param = "WesternAsia",   id = 112, default = 130 }, -- western asia farm
    { name = "EasternAsia",   param = "EasternAsia",   id = 139, default = 130 }, -- eastern asia farm
    { name = "Abstract",      param = "Abstract",      id = 193, default = 150 }, -- abstract farm
    { name = "China",         param = "China",         id = 339, default = 150 }, -- china farm
    { name = "PersiaIran",    param = "PersiaIran",    id = 412, default = 150 }, -- persio-iran farm
}

for _, f in ipairs(farms) do
    local percentage = getParameterNumber(f.param, f.default, 1, 1000) -- wanted % of base capacity
    local multiplier = math.ceil(percentage * 65536 / 100)             -- engine: integer required (ceil: never below requested %)

    root.unitType[f.id].storageMultiplier = multiplier

    print(string.format("[farm] %s (id %d): %d%% -> storageMultiplier %d",
        f.name, f.id, percentage, multiplier))
end

root.f_recreateModifiedUnitTypes()
