-----------------------------------------------------------
-- Mod name: Quay storage capacity
-- Description: Configurable storage capacity for every quay (dock), via the settings panel. Values are percentages of the base-game capacity: 100 = unchanged.
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

-- Unit type IDs: quays (docks)
-- default = author's tuned capacity in % (100 = base game)
local quays = {
    { name = "Europe",        param = "Europe",        id = 21,  default = 110 }, -- europe quay
    { name = "Asia",          param = "Asia",          id = 35,  default = 110 }, -- asia quay
    { name = "EasternEurope", param = "EasternEurope", id = 68,  default = 130 }, -- eastern europe quay
    { name = "WesternEurope", param = "WesternEurope", id = 93,  default = 130 }, -- western europe quay
    { name = "WesternAsia",   param = "WesternAsia",   id = 118, default = 130 }, -- western asia quay
    { name = "EasternAsia",   param = "EasternAsia",   id = 144, default = 130 }, -- eastern asia quay
    { name = "Abstract",      param = "Abstract",      id = 247, default = 150 }, -- abstract quay
}

for _, q in ipairs(quays) do
    local percentage = getParameterNumber(q.param, q.default, 1, 1000) -- wanted % of base capacity
    local multiplier = math.ceil(percentage * 65536 / 100)             -- engine: integer required (ceil: never below requested %)

    root.unitType[q.id].storageMultiplier = multiplier

    print(string.format("[quay] %s (id %d): %d%% -> storageMultiplier %d",
        q.name, q.id, percentage, multiplier))
end

root.f_recreateModifiedUnitTypes()
