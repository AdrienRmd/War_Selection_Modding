-----------------------------------------------------------
-- Mod name: Fast Period piece (sandbox)
-- Description: Configurable research time and cost for every age research
--              in every temple. One block per RESEARCH: a research offered
--              by several temples (e.g. abstract_age) is defined once and
--              applied to all of them (cost/time are shared).
--              Fast testing variant of the mod: every research takes
--              3 s, needs 1 worker and costs nothing.
-- Author: AdrienRmd
-- Published: mod-ARJwbLUGnHj
-- Status: Stable
-----------------------------------------------------------

print("[fast] script loaded")

-- ============================================================================
-- 1. VALUES -- EDIT HERE (sandbox fast values: 3 s / 1 worker / free)
--    enabled = true: apply the time/costs below; false = apply the stored
--              DEFAULT values (defaults table in section 2 — the mod's
--              reference balance; shared research = defaults in every
--              temple offering it)
--    time = research time in seconds
--              (time = 0 still leaves a 1-second wait: engine minimum)
--    worker_requirements_addition = N: minimum number of workers to start
--              the research. The required unit TYPE comes from the temple:
--              55 / 56 / 89 / 90 (era temples 51 / 52 / 83 / 84), 201 (IR2
--              temples); for the early temples (10 / 11 / 28) the
--              game-chosen type is kept (only the amount is written). Add
--              the line to any block to use it; mirror it in the defaults
--              entry if the enabled = false fallback must keep it.
--              NOTE: setting worker_requirements_addition = 0 writes
--              min = 0: the age can be passed immediately — but everything
--              from the previous age is deleted when the age changes.
--    <resource> = { amount = N }: cost at research start, one line per
--              resource: food, wood, iron, gold, oil — all five are listed.
--              Amounts are x1000 internally (1000 = 1 displayed unit).
-- ============================================================================

-- europe_age -- stone_temple (unit 10): choose Europe
local europe_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- asia_age -- stone_temple (unit 10): choose Asia
local asia_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- iron_age -- SHARED: europe_temple (unit 11) + asia_temple (unit 28) (one block, cost/time shared)
local iron_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- western_europe_age -- europe_temple (unit 11): choose Western Europe
local western_europe_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- eastern_europe_age -- europe_temple (unit 11): choose Eastern Europe
local eastern_europe_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- western_asia_age -- asia_temple (unit 28): choose Western Asia
local western_asia_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- eastern_asia_age -- asia_temple (unit 28): choose Eastern Asia
local eastern_asia_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- late_western_europe_age -- western_europe_temple (unit 51)
local late_western_europe_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- late_eastern_europe_age -- eastern_europe_temple (unit 52)
local late_eastern_europe_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- abstract_age -- SHARED: western_europe_temple (unit 51), eastern_europe_temple (unit 52), western_asia_temple (unit 83), eastern_asia_temple (unit 84) (one block, cost/time shared)
local abstract_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- austro_hungary_age -- SHARED: western_europe_temple (unit 51, work 6) + eastern_europe_temple (unit 52, work 8) (one block, cost/time shared)
local austro_hungary_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- france_age -- western_europe_temple (unit 51)
local france_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- germany_age -- western_europe_temple (unit 51)
local germany_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- great_britain_age -- western_europe_temple (unit 51)
local great_britain_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- italy_age -- western_europe_temple (unit 51)
local italy_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- russian_age -- eastern_europe_temple (unit 52)
local russian_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- poland_age -- eastern_europe_temple (unit 52)
local poland_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- late_western_asia_age -- western_asia_temple (unit 83)
local late_western_asia_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- turkey_age -- western_asia_temple (unit 83)
local turkey_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- india_age -- SHARED: western_asia_temple (unit 83, work 8) + eastern_asia_temple (unit 84, work 6) (one block, cost/time shared)
local india_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- persia_age -- western_asia_temple (unit 83)
local persia_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- late_eastern_asia_age -- eastern_asia_temple (unit 84)
local late_eastern_asia_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- china_age -- eastern_asia_temple (unit 84)
local china_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- japan_age -- eastern_asia_temple (unit 84)
local japan_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- wonder_age -- SHARED: work 5 of all 13 IR2 temples (units 190, 254, 264, 271, 282, 302, 323, 337, 358, 372, 385, 402, 436) (one block, cost/time shared)
local wonder_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- abstract_IR2_age -- abstract_temple (unit 190)
local abstract_IR2_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- great_britain_IR2_age -- great_britain_temple (unit 254)
local great_britain_IR2_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- india_IR2_age -- india_temple (unit 264)
local india_IR2_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- turkey_IR2_age -- turkey_temple (unit 271)
local turkey_IR2_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- germany_IR2_age -- germany_temple (unit 282)
local germany_IR2_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- russian_IR2_age -- russian_temple (unit 302)
local russian_IR2_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- france_IR2_age -- france_temple (unit 323)
local france_IR2_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- china_IR2_age -- china_temple (unit 337)
local china_IR2_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- japan_IR2_age -- japan_temple (unit 358)
local japan_IR2_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- poland_IR2_age -- poland_temple (unit 372)
local poland_IR2_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- austro_hungary_IR2_age -- austro_hungary_temple (unit 385)
local austro_hungary_IR2_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- persia_IR2_age -- persia_temple (unit 402)
local persia_IR2_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- italy_IR2_age -- italy_temple (unit 436), work id 7
local italy_IR2_age = {
    enabled = true,
    time  = 3,
    worker_requirements_addition = 1,
    food  = { amount = 0 },
    wood  = { amount = 0 },
    iron  = { amount = 0 },
    gold  = { amount = 0 },
    oil   = { amount = 0 },
}

-- ============================================================================
-- 2. TEMPLE DATA -- DO NOT CHANGE
--    Building/work id pairs as in the base game. Engine fields:
--    root.unitType[id].ability.work[work_id].makeTime — research duration
--    in milliseconds (300000 = 300 s, divide by 1000 to get seconds).
--    root.unitType[id].ability.work[work_id].costProcess[resource_id] —
--    research cost; resource ids: 0 = food, 1 = wood, 2 = iron, 3 = gold,
--    4 = oil; amounts are x1000 (1000 = 1 displayed unit).
--    worker_type = unit type required by that temple's researches (era
--    worker); absent = the game chooses the type (min only).
--    Integers required (math.floor), like every engine field.
-- ============================================================================

local temples = {
    { name = "stone_temple",         id = 10,  works = {
        { wid = 0,  res = "europe_age",              values = europe_age },
        { wid = 1,  res = "asia_age",                values = asia_age },
    }},
    { name = "europe_temple",        id = 11,  works = {
        { wid = 1,  res = "iron_age",                values = iron_age },
        { wid = 2,  res = "western_europe_age",      values = western_europe_age },
        { wid = 3,  res = "eastern_europe_age",      values = eastern_europe_age },
    }},
    { name = "asia_temple",          id = 28,  works = {
        { wid = 1,  res = "iron_age",                values = iron_age },
        { wid = 2,  res = "western_asia_age",        values = western_asia_age },
        { wid = 3,  res = "eastern_asia_age",        values = eastern_asia_age },
    }},
    { name = "western_europe_temple", id = 51, worker_type = 55, works = {
        { wid = 1,  res = "late_western_europe_age", values = late_western_europe_age },
        { wid = 5,  res = "abstract_age",            values = abstract_age },
        { wid = 6,  res = "austro_hungary_age",      values = austro_hungary_age },
        { wid = 7,  res = "france_age",              values = france_age },
        { wid = 8,  res = "germany_age",             values = germany_age },
        { wid = 9,  res = "great_britain_age",       values = great_britain_age },
        { wid = 14, res = "italy_age",               values = italy_age },
    }},
    { name = "eastern_europe_temple", id = 52, worker_type = 56, works = {
        { wid = 1,  res = "late_eastern_europe_age", values = late_eastern_europe_age },
        { wid = 5,  res = "abstract_age",            values = abstract_age },
        { wid = 6,  res = "russian_age",             values = russian_age },
        { wid = 8,  res = "austro_hungary_age",      values = austro_hungary_age },
        { wid = 9,  res = "poland_age",              values = poland_age },
    }},
    { name = "western_asia_temple",  id = 83, worker_type = 89, works = {
        { wid = 1,  res = "late_western_asia_age",   values = late_western_asia_age },
        { wid = 5,  res = "abstract_age",            values = abstract_age },
        { wid = 7,  res = "turkey_age",              values = turkey_age },
        { wid = 8,  res = "india_age",               values = india_age },
        { wid = 9,  res = "persia_age",              values = persia_age },
    }},
    { name = "eastern_asia_temple",  id = 84, worker_type = 90, works = {
        { wid = 1,  res = "late_eastern_asia_age",   values = late_eastern_asia_age },
        { wid = 5,  res = "abstract_age",            values = abstract_age },
        { wid = 6,  res = "india_age",               values = india_age },
        { wid = 7,  res = "china_age",               values = china_age },
        { wid = 9,  res = "japan_age",               values = japan_age },
    }},
    { name = "abstract_temple",      id = 190, worker_type = 201, works = {
        { wid = 5,  res = "wonder_age",              values = wonder_age },
        { wid = 7,  res = "abstract_IR2_age",        values = abstract_IR2_age },
    }},
    { name = "great_britain_temple", id = 254, worker_type = 201, works = {
        { wid = 5,  res = "wonder_age",              values = wonder_age },
        { wid = 7,  res = "great_britain_IR2_age",   values = great_britain_IR2_age },
    }},
    { name = "india_temple",         id = 264, worker_type = 201, works = {
        { wid = 5,  res = "wonder_age",              values = wonder_age },
        { wid = 7,  res = "india_IR2_age",           values = india_IR2_age },
    }},
    { name = "turkey_temple",        id = 271, worker_type = 201, works = {
        { wid = 5,  res = "wonder_age",              values = wonder_age },
        { wid = 7,  res = "turkey_IR2_age",          values = turkey_IR2_age },
    }},
    { name = "germany_temple",       id = 282, worker_type = 201, works = {
        { wid = 5,  res = "wonder_age",              values = wonder_age },
        { wid = 7,  res = "germany_IR2_age",         values = germany_IR2_age },
    }},
    { name = "russian_temple",       id = 302, worker_type = 201, works = {
        { wid = 5,  res = "wonder_age",              values = wonder_age },
        { wid = 7,  res = "russian_IR2_age",         values = russian_IR2_age },
    }},
    { name = "france_temple",        id = 323, worker_type = 201, works = {
        { wid = 5,  res = "wonder_age",              values = wonder_age },
        { wid = 7,  res = "france_IR2_age",          values = france_IR2_age },
    }},
    { name = "china_temple",         id = 337, worker_type = 201, works = {
        { wid = 5,  res = "wonder_age",              values = wonder_age },
        { wid = 7,  res = "china_IR2_age",           values = china_IR2_age },
    }},
    { name = "japan_temple",         id = 358, worker_type = 201, works = {
        { wid = 5,  res = "wonder_age",              values = wonder_age },
        { wid = 7,  res = "japan_IR2_age",           values = japan_IR2_age },
    }},
    { name = "poland_temple",        id = 372, worker_type = 201, works = {
        { wid = 5,  res = "wonder_age",              values = wonder_age },
        { wid = 7,  res = "poland_IR2_age",          values = poland_IR2_age },
    }},
    { name = "austro_hungary_temple", id = 385, worker_type = 201, works = {
        { wid = 5,  res = "wonder_age",              values = wonder_age },
        { wid = 7,  res = "austro_hungary_IR2_age",  values = austro_hungary_IR2_age },
    }},
    { name = "persia_temple",        id = 402, worker_type = 201, works = {
        { wid = 5,  res = "wonder_age",              values = wonder_age },
        { wid = 7,  res = "persia_IR2_age",          values = persia_IR2_age },
    }},
    { name = "italy_temple",         id = 436, worker_type = 201, works = {
        { wid = 5,  res = "wonder_age",              values = wonder_age },
        { wid = 7,  res = "italy_IR2_age",           values = italy_IR2_age },
    }},
}

local resource_ids = { food = 0, wood = 1, iron = 2, gold = 3, oil = 4 }

-- Stored DEFAULT values, applied when a block has enabled = false.
-- DO NOT CHANGE: this is the mod's reference balance.
local defaults = {
    europe_age               = { time = 90,  worker_requirements_addition = 20, food = { amount = 0 },    wood = { amount = 450 },    iron = { amount = 0 },    gold = { amount = 0 }, oil = { amount = 0 } },
    asia_age                 = { time = 90,  worker_requirements_addition = 20, food = { amount = 0 },    wood = { amount = 450 },    iron = { amount = 0 },    gold = { amount = 0 }, oil = { amount = 0 } },
    iron_age                 = { time = 120, worker_requirements_addition = 30, food = { amount = 0 },    wood = { amount = 0 },      iron = { amount = 500 },  gold = { amount = 0 }, oil = { amount = 0 } },
    western_europe_age       = { time = 150, worker_requirements_addition = 40, food = { amount = 0 },    wood = { amount = 2500 },   iron = { amount = 1000 }, gold = { amount = 0 }, oil = { amount = 0 } },
    eastern_europe_age       = { time = 150, worker_requirements_addition = 40, food = { amount = 0 },    wood = { amount = 2500 },   iron = { amount = 1000 }, gold = { amount = 0 }, oil = { amount = 0 } },
    western_asia_age         = { time = 150, worker_requirements_addition = 40, food = { amount = 0 },    wood = { amount = 2500 },   iron = { amount = 1000 }, gold = { amount = 0 }, oil = { amount = 0 } },
    eastern_asia_age         = { time = 150, worker_requirements_addition = 40, food = { amount = 0 },    wood = { amount = 2500 },   iron = { amount = 1000 }, gold = { amount = 0 }, oil = { amount = 0 } },
    late_western_europe_age  = { time = 180, worker_requirements_addition = 50, food = { amount = 3000 }, wood = { amount = 2500 },   iron = { amount = 2000 }, gold = { amount = 0 }, oil = { amount = 0 } },
    late_eastern_europe_age  = { time = 180, worker_requirements_addition = 50, food = { amount = 3000 }, wood = { amount = 2500 },   iron = { amount = 2000 }, gold = { amount = 0 }, oil = { amount = 0 } },
    late_western_asia_age    = { time = 180, worker_requirements_addition = 50, food = { amount = 3000 }, wood = { amount = 2500 },   iron = { amount = 2000 }, gold = { amount = 0 }, oil = { amount = 0 } },
    late_eastern_asia_age    = { time = 180, worker_requirements_addition = 50, food = { amount = 3000 }, wood = { amount = 2500 },   iron = { amount = 2000 }, gold = { amount = 0 }, oil = { amount = 0 } },
    abstract_age             = { time = 300, worker_requirements_addition = 50, food = { amount = 8000 },  wood = { amount = 6000 }, iron = { amount = 4000 },  gold = { amount = 0 }, oil = { amount = 0 } },
    austro_hungary_age       = { time = 300, worker_requirements_addition = 50, food = { amount = 8000 },  wood = { amount = 6000 }, iron = { amount = 4000 },  gold = { amount = 0 }, oil = { amount = 0 } },
    france_age               = { time = 300, worker_requirements_addition = 50, food = { amount = 8000 },  wood = { amount = 6000 }, iron = { amount = 4000 },  gold = { amount = 0 }, oil = { amount = 0 } },
    germany_age              = { time = 300, worker_requirements_addition = 50, food = { amount = 8000 },  wood = { amount = 6000 }, iron = { amount = 4000 },  gold = { amount = 0 }, oil = { amount = 0 } },
    great_britain_age        = { time = 300, worker_requirements_addition = 50, food = { amount = 8000 },  wood = { amount = 6000 }, iron = { amount = 4000 },  gold = { amount = 0 }, oil = { amount = 0 } },
    italy_age                = { time = 300, worker_requirements_addition = 50, food = { amount = 8000 },  wood = { amount = 6000 }, iron = { amount = 4000 },  gold = { amount = 0 }, oil = { amount = 0 } },
    russian_age              = { time = 300, worker_requirements_addition = 50, food = { amount = 8000 },  wood = { amount = 6000 }, iron = { amount = 4000 },  gold = { amount = 0 }, oil = { amount = 0 } },
    poland_age               = { time = 300, worker_requirements_addition = 50, food = { amount = 8000 },  wood = { amount = 6000 }, iron = { amount = 4000 },  gold = { amount = 0 }, oil = { amount = 0 } },
    turkey_age               = { time = 300, worker_requirements_addition = 50, food = { amount = 8000 },  wood = { amount = 6000 }, iron = { amount = 4000 },  gold = { amount = 0 }, oil = { amount = 0 } },
    india_age                = { time = 300, worker_requirements_addition = 50, food = { amount = 8000 },  wood = { amount = 6000 }, iron = { amount = 4000 },  gold = { amount = 0 }, oil = { amount = 0 } },
    persia_age               = { time = 300, worker_requirements_addition = 50, food = { amount = 8000 },  wood = { amount = 6000 }, iron = { amount = 4000 },  gold = { amount = 0 }, oil = { amount = 0 } },
    china_age                = { time = 300, worker_requirements_addition = 50, food = { amount = 8000 },  wood = { amount = 6000 }, iron = { amount = 4000 },  gold = { amount = 0 }, oil = { amount = 0 } },
    japan_age                = { time = 300, worker_requirements_addition = 50, food = { amount = 8000 },  wood = { amount = 6000 }, iron = { amount = 4000 },  gold = { amount = 0 }, oil = { amount = 0 } },
    wonder_age               = { time = 240, worker_requirements_addition = 50, food = { amount = 10000 }, wood = { amount = 7000 }, iron = { amount = 5000 },  gold = { amount = 0 }, oil = { amount = 0 } },
    abstract_IR2_age         = { time = 240, worker_requirements_addition = 50, food = { amount = 12000 }, wood = { amount = 8000 }, iron = { amount = 5000 },  gold = { amount = 0 }, oil = { amount = 0 } },
    great_britain_IR2_age    = { time = 240, worker_requirements_addition = 50, food = { amount = 12000 }, wood = { amount = 8000 }, iron = { amount = 5000 },  gold = { amount = 0 }, oil = { amount = 0 } },
    india_IR2_age            = { time = 240, worker_requirements_addition = 50, food = { amount = 12000 }, wood = { amount = 8000 }, iron = { amount = 5000 },  gold = { amount = 0 }, oil = { amount = 0 } },
    turkey_IR2_age           = { time = 240, worker_requirements_addition = 50, food = { amount = 12000 }, wood = { amount = 8000 }, iron = { amount = 5000 },  gold = { amount = 0 }, oil = { amount = 0 } },
    germany_IR2_age          = { time = 240, worker_requirements_addition = 50, food = { amount = 12000 }, wood = { amount = 8000 }, iron = { amount = 5000 },  gold = { amount = 0 }, oil = { amount = 0 } },
    russian_IR2_age          = { time = 240, worker_requirements_addition = 50, food = { amount = 12000 }, wood = { amount = 8000 }, iron = { amount = 5000 },  gold = { amount = 0 }, oil = { amount = 0 } },
    france_IR2_age           = { time = 240, worker_requirements_addition = 50, food = { amount = 12000 }, wood = { amount = 8000 }, iron = { amount = 5000 },  gold = { amount = 0 }, oil = { amount = 0 } },
    china_IR2_age            = { time = 240, worker_requirements_addition = 50, food = { amount = 12000 }, wood = { amount = 8000 }, iron = { amount = 5000 },  gold = { amount = 0 }, oil = { amount = 0 } },
    japan_IR2_age            = { time = 240, worker_requirements_addition = 50, food = { amount = 12000 }, wood = { amount = 8000 }, iron = { amount = 5000 },  gold = { amount = 0 }, oil = { amount = 0 } },
    poland_IR2_age           = { time = 240, worker_requirements_addition = 50, food = { amount = 12000 }, wood = { amount = 8000 }, iron = { amount = 5000 },  gold = { amount = 0 }, oil = { amount = 0 } },
    austro_hungary_IR2_age   = { time = 240, worker_requirements_addition = 50, food = { amount = 12000 }, wood = { amount = 8000 }, iron = { amount = 5000 },  gold = { amount = 0 }, oil = { amount = 0 } },
    persia_IR2_age           = { time = 240, worker_requirements_addition = 50, food = { amount = 12000 }, wood = { amount = 8000 }, iron = { amount = 5000 },  gold = { amount = 0 }, oil = { amount = 0 } },
    italy_IR2_age            = { time = 240, worker_requirements_addition = 50, food = { amount = 12000 }, wood = { amount = 8000 }, iron = { amount = 5000 },  gold = { amount = 0 }, oil = { amount = 0 } },
}

-- ============================================================================
-- 3. LOAD-TIME APPLY
--    Every research of every temple gets its time and cost written to the
--    engine fields; shared researches are applied to each temple offering
--    them. Each entry runs inside pcall: a broken temple/research prints an
--    ERROR line instead of stopping the whole mod, and the final summary
--    says exactly how many entries were applied.
--    Worker requirements: element created with f_create() if missing, then
--    root.unitType[id].ability.ability[wid].requirements.unit[0] gets
--    type = worker_type (201 = worker unit) and max = 65535; temples
--    without worker_type keep the game-chosen type (min only).
--    enabled = false applies the stored defaults instead of block values.
-- ============================================================================

local applied, skipped, failed = 0, 0, 0

for _, t in ipairs(temples) do
    for _, w in ipairs(t.works) do
        local ok, err = pcall(function()
            local v = w.values.enabled and w.values or defaults[w.res]
            local work = root.unitType[t.id].ability.work[w.wid]
            if work == nil then
                print(string.format("[fast] WARN: unit %d has no work slot %d (%s) — skipped",
                    t.id, w.wid, w.res))
                skipped = skipped + 1
                return
            end
            work.makeTime = math.floor(v.time * 1000)
            for res, r in pairs(v) do
                local rid = resource_ids[res]
                if rid and r and r.amount then
                    work.costProcess[rid] = math.floor(r.amount * 1000)
                end
            end
            if v.worker_requirements_addition then
                local ability = root.unitType[t.id].ability.ability[w.wid]
                local req = ability ~= nil and ability.requirements ~= nil
                    and ability.requirements.unit or nil
                if req == nil then
                    print(string.format(
                        "[fast] WARN: unit %d work %d has no requirements.unit — worker requirement skipped",
                        t.id, w.wid))
                else
                    if req.size == 0 then
                        req.f_create()
                    end
                    if t.worker_type then
                        req[0].type = t.worker_type
                        req[0].max = 65535
                    end
                    req[0].min = math.floor(v.worker_requirements_addition)
                end
            end
            applied = applied + 1
            print(string.format("[fast] %s (unit %d, work %d = %s): %d s%s%s",
                t.name, t.id, w.wid, w.res, v.time,
                v.worker_requirements_addition
                    and string.format(", %d workers min", v.worker_requirements_addition)
                    or "",
                w.values.enabled and "" or " (defaults)"))
        end)
        if not ok then
            failed = failed + 1
            print(string.format("[fast] ERROR: unit %d work %d (%s): %s",
                t.id, w.wid, w.res, tostring(err)))
        end
    end
end

root.f_recreateModifiedUnitTypes()

print(string.format("[fast] done: %d applied, %d skipped, %d failed",
    applied, skipped, failed))

addMod({
    onStart = function(var)
        print("[fast] onStart: research changes were applied at script load")
    end,
})
