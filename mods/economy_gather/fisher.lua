-----------------------------------------------------------
-- Mod name: Fisher production & capacity
-- Description: Configurable fishing boats for every civilization: gather speed (food per second) and carry capacity (food carried), via the settings panel. Displayed values = food/sec and food carried.
-- Author: JSuisMort
-- Status: Stable
-----------------------------------------------------------

-- ============================================================================
-- The mod panel expects "displayed numbers":
--   production: 9  = 9 food per second -> perTick = food/sec x 50
--   capacity:   70 = 70 food carried   -> bagSize = capacity x 1000 (70000 = 70)
-- (perTick scale: 55 = 1.1/sec, see docs/modding-guide/workers-and-construction.md)
-- ============================================================================

-- Unit type IDs: fishing boats
local europe_fisher          = 26  -- base 270 perTick = 5.4/sec
local asia_fisher            = 43  -- base 220 perTick = 4.4/sec
local medieval_europe_fisher = 81  -- base 350 perTick = 7/sec
local eastern_asia_fisher    = 169 -- base 350 perTick = 7/sec
local western_asia_fisher    = 452 -- base 300 perTick = 6/sec
local china_fisher           = 353 -- base 400 perTick = 8/sec
local abstract_fisher        = 244 -- base 500 perTick = 10/sec

local fishers = {
    -- base = production (food/sec), bag_base = carry capacity (food carried)
    { name = "Europe",         param = "Europe",         stockage_param = "EuropeStockage",         id = europe_fisher,          base = 5.4, bag_base = 70  },
    { name = "Asia",           param = "Asia",           stockage_param = "AsiaStockage",           id = asia_fisher,            base = 4.4, bag_base = 50  },
    { name = "MedievalEurope", param = "MedievalEurope", stockage_param = "MedievalEuropeStockage", id = medieval_europe_fisher, base = 7,   bag_base = 150 },
    { name = "EasternAsia",    param = "EasternAsia",    stockage_param = "EasternAsiaStockage",    id = eastern_asia_fisher,    base = 7,   bag_base = 150 },
    { name = "WesternAsia",    param = "WesternAsia",    stockage_param = "WesternAsiaStockage",    id = western_asia_fisher,    base = 6,   bag_base = 60  },
    { name = "China",          param = "China",          stockage_param = "ChinaStockage",          id = china_fisher,           base = 8,   bag_base = 150 },
    { name = "Abstract",       param = "Abstract",       stockage_param = "AbstractStockage",       id = abstract_fisher,        base = 10,  bag_base = 250 },
}

for _, f in ipairs(fishers) do
    -- Production (food per second)
    local production = getParameterNumber(f.param, f.base, 0, 100) -- wanted food/sec
    local perTick = math.floor(production * 50)                    -- engine: integer required

    root.unitType[f.id].movement.gather[0].perTick = perTick -- resource 0 = food

    print(string.format("[fisher] %s fisher (id %d): %.2f/sec (perTick %d)",
        f.name, f.id, perTick / 50, perTick))

    -- Carry capacity (food carried) -- skipped until bag_base is filled in
    if f.bag_base then
        local capacity = getParameterNumber(f.stockage_param, f.bag_base, 0, 1000) -- wanted food carried
        local bagSize = math.floor(capacity * 1000)                                -- engine: integer required

        root.unitType[f.id].movement.gather[0].bagSize = bagSize -- resource 0 = food

        print(string.format("[fisher] %s fisher (id %d): capacity %d (bagSize %d)",
            f.name, f.id, bagSize / 1000, bagSize))
    else
        print(string.format("[fisher] %s fisher (id %d): bagSize unchanged (stockage variable not filled)",
            f.name, f.id))
    end
end

root.f_recreateModifiedUnitTypes()
