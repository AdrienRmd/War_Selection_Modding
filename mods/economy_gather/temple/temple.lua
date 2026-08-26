-----------------------------------------------------------
-- Mod name: Temple (town center) storage capacity
-- Description: Configurable storage capacity for every temple / town center (altar) and wonder, via the settings panel. Values are percentages of the base-game capacity: 100 = unchanged.
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

-- Unit type IDs: temples / town centers (altars) and wonders
-- default = author's tuned capacity in % (100 = base game)
local temples = {
    { name = "Altar",         param = "Altar",         id = 0,   default = 100 }, -- stone age altar
    { name = "Temple",        param = "Temple",        id = 10,  default = 100 }, -- base temple
    { name = "Europe",        param = "Europe",        id = 11,  default = 110 }, -- europe temple
    { name = "Asia",          param = "Asia",          id = 28,  default = 110 }, -- asia temple
    { name = "WesternEurope", param = "WesternEurope", id = 51,  default = 130 }, -- western europe temple
    { name = "EasternEurope", param = "EasternEurope", id = 52,  default = 130 }, -- eastern europe temple
    { name = "WesternAsia",   param = "WesternAsia",   id = 83,  default = 130 }, -- western asia temple
    { name = "EasternAsia",   param = "EasternAsia",   id = 84,  default = 130 }, -- eastern asia temple
    { name = "Abstract",      param = "Abstract",      id = 190, default = 150 }, -- abstract temple
    { name = "Wonder",        param = "Wonder",        id = 239, default = 150 }, -- wonder
    { name = "GreatBritain",  param = "GreatBritain",  id = 254, default = 150 }, -- great britain temple
    { name = "India",         param = "India",         id = 264, default = 150 }, -- india temple
    { name = "Turkey",        param = "Turkey",        id = 271, default = 150 }, -- turkey temple
    { name = "Germany",       param = "Germany",       id = 282, default = 150 }, -- germany temple
    { name = "Russia",        param = "Russia",        id = 302, default = 150 }, -- russian temple
    { name = "France",        param = "France",        id = 323, default = 150 }, -- france temple
    { name = "China",         param = "China",         id = 337, default = 150 }, -- china temple
    { name = "Japan",         param = "Japan",         id = 358, default = 150 }, -- japan temple
    { name = "Poland",        param = "Poland",        id = 372, default = 150 }, -- poland temple
    { name = "AustriaHungary",param = "AustriaHungary",id = 385, default = 150 }, -- austro-hungary temple
    { name = "PersiaIran",    param = "PersiaIran",    id = 402, default = 150 }, -- persio-iran temple
    { name = "Italy",         param = "Italy",         id = 436, default = 150 }, -- italy temple
}

for _, t in ipairs(temples) do
    local percentage = getParameterNumber(t.param, t.default, 1, 1000) -- wanted % of base capacity
    local multiplier = math.ceil(percentage * 65536 / 100)             -- engine: integer required (ceil: never below requested %)

    root.unitType[t.id].storageMultiplier = multiplier

    print(string.format("[temple] %s (id %d): %d%% -> storageMultiplier %d",
        t.name, t.id, percentage, multiplier))
end

root.f_recreateModifiedUnitTypes()
