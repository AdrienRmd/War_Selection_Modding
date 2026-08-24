-----------------------------------------------------------
-- Mod name: Fisher production
-- Description: Configurable fishing boat production (food per second) for every civilization's fisher boat, via the settings panel. Displayed value = production per second.
-- Author: JSuisMort
-- Status: Stable
-----------------------------------------------------------

-- ============================================================================
-- The mod panel expects "displayed numbers": 9 = 9 food per second.
-- The code converts to the engine value: perTick = production/sec x 50
-- (55 perTick = 1.1/sec, see docs/modding-guide/workers-and-construction.md)
-- ============================================================================

-- Unit type IDs: fishing boats
local europe_fisher         = 26  -- base 270 perTick = 5.4/sec
local asia_fisher           = 43  -- base 220 perTick = 4.4/sec
local medieval_europe_fisher = 81 -- base 350 perTick = 7/sec
local eastern_asia_fisher   = 169 -- base 350 perTick = 7/sec
local western_asia_fisher   = 452 -- base 300 perTick = 6/sec
local china_fisher          = 353 -- base 400 perTick = 8/sec
local abstract_fisher       = 244 -- base 500 perTick = 10/sec

local fishers = {
    { name = "Europe",         param = "Europe",         id = europe_fisher,          base = 5.4 },
    { name = "Asia",           param = "Asia",           id = asia_fisher,            base = 4.4 },
    { name = "MedievalEurope", param = "MedievalEurope", id = medieval_europe_fisher, base = 7   },
    { name = "EasternAsia",    param = "EasternAsia",    id = eastern_asia_fisher,    base = 7   },
    { name = "WesternAsia",    param = "WesternAsia",    id = western_asia_fisher,    base = 6   },
    { name = "China",          param = "China",          id = china_fisher,           base = 8   },
    { name = "Abstract",       param = "Abstract",       id = abstract_fisher,        base = 10  },
}

for _, f in ipairs(fishers) do
    local production = getParameterNumber(f.param, f.base, 0, 100) -- wanted food/sec
    local perTick = math.floor(production * 50)                    -- engine: integer required

    root.unitType[f.id].movement.gather[0].perTick = perTick -- resource 0 = food

    print(string.format("[fisher] %s fisher (id %d): %.2f/sec (perTick %d)",
        f.name, f.id, perTick / 50, perTick))
end

root.f_recreateModifiedUnitTypes()
