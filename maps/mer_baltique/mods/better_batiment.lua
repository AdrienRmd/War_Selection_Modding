-----------------------------------------------------------
-- Mod name: Better batiment
-- Description: Configurable garrison (transport) for every house and
--              temple of the map, one value table per building. Base game:
--              transport.enabled = false on every house and temple.
--              Also sets the global build/work speed ratios (section 1).
--              No settings panel: edit the VALUES section at the top.
-- Author: AdrienRmd
-- Status: Stable
-----------------------------------------------------------

-- ============================================================================
-- 1. GLOBAL SPEED -- EDIT HERE (plain percentage: 100 = base game,
--    40 = 40% i.e. 2.5x slower; verified in game)
--       unitsBuildSpeedRatio = construction speed of builders
--       unitsWorkSpeedRatio  = work/production speed (temples, mines, works)
--    Applies to EVERY unit of the match.
-- ============================================================================

root.unitsBuildSpeedRatio = 40
root.unitsWorkSpeedRatio  = 40

-- ============================================================================
-- 2. GARRISON VALUES -- EDIT HERE (defaults = engine transporter values)
--    enabled   = garrison on/off (false = back to base game, doors shut)
--    tags      = unit classes allowed to enter, as a list: { 10 } is the
--                tag used by the engine's own transporters (keeps tanks
--                out); add numbers to allow more classes
--    unitLimit = max units inside at once (1 = a single unit at a time)
--    volume    = total capacity in int units
--    Plain integers: no x1000 scaling on these fields.
-- ============================================================================

-- ============================ HOUSES =======================================

-- Stone Age house (unit 3)
local stone_house = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 2,
}

-- Europe house (unit 16)
local europe_house = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 2,
}

-- Asia house (unit 29)
local asia_house = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 3,
}

-- Western Europe house (unit 57)
local western_europe_house = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 3,
}

-- Eastern Europe house (unit 58)
local eastern_europe_house = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 3,
}

-- Western Asia house (unit 85)
local western_asia_house = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 3,
}

-- Eastern Asia house (unit 86)
local eastern_asia_house = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 3,
}

-- Abstract (generic) house (unit 192)
local abstract_house = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 4,
}

-- Great Britain house (unit 255)
local great_britain_house = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 4,
}

-- India house (unit 265)
local india_house = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 4,
}

-- Turkey house (unit 272)
local turkey_house = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 4,
}

-- Germany house (unit 283)
local germany_house = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 4,
}

-- Russia house (unit 303)
local russian_house = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 4,
}

-- France house (unit 324)
local france_house = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 4,
}

-- China house (unit 338)
local china_house = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 4,
}

-- Japan house (unit 359)
local japan_house = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 4,
}

-- Poland house (unit 373)
local poland_house = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 4,
}

-- Austro-Hungary house (unit 386)
local austro_hungary_house = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 4,
}



-- Persia/Iran house (unit 403)
local persia_iran_house = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 4,
}

-- Italy house (unit 437)
local italy_house = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 4,
}

-- ============================ TEMPLES ======================================

-- Stone Age altar (unit 0)
local altar = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 4,
}

-- Base temple (unit 10)
local temple_base = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 4,
}

-- Europe temple (unit 11)
local europe_temple = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 6,
}

-- Asia temple (unit 28)
local asia_temple = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 6,
}

-- Western Europe temple (unit 51)
local western_europe_temple = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 8,
}

-- Eastern Europe temple (unit 52)
local eastern_europe_temple = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 8,
}

-- Western Asia temple (unit 83)
local western_asia_temple = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 8,
}

-- Eastern Asia temple (unit 84)
local eastern_asia_temple = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 8,
}

-- Abstract temple (unit 190)
local abstract_temple = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 12,
}

-- Wonder (unit 239)
local wonder = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 12,
}

-- Great Britain temple (unit 254)
local great_britain_temple = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 12,
}

-- India temple (unit 264)
local india_temple = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 12,
}

-- Turkey temple (unit 271)
local turkey_temple = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 12,
}

-- Germany temple (unit 282)
local germany_temple = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 12,
}

-- Russia temple (unit 302)
local russia_temple = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 12,
}

-- France temple (unit 323)
local france_temple = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 12,
}

-- China temple (unit 337)
local china_temple = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 12,
}

-- Japan temple (unit 358)
local japan_temple = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 12,
}

-- Poland temple (unit 372)
local poland_temple = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 12,
}

-- Austro-Hungary temple (unit 385)
local austria_hungary_temple = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 12,
}

-- Persia/Iran temple (unit 402)
local persia_iran_temple = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 12,
}

-- Italy temple (unit 436)
local italy_temple = {
    enabled   = true,
    tags      = { 10 },
    unitLimit = 1,
    volume    = 12,
}

-- ============================================================================
-- 3. BUILDING DATA -- unit ids DO NOT CHANGE
-- ============================================================================

local houses = {
    { name = "stone_house",          id = 3,   values = stone_house },
    { name = "europe_house",         id = 16,  values = europe_house },
    { name = "asia_house",           id = 29,  values = asia_house },
    { name = "western_europe_house", id = 57,  values = western_europe_house },
    { name = "eastern_europe_house", id = 58,  values = eastern_europe_house },
    { name = "western_asia_house",   id = 85,  values = western_asia_house },
    { name = "eastern_asia_house",   id = 86,  values = eastern_asia_house },
    { name = "abstract_house",       id = 192, values = abstract_house },
    { name = "great_britain_house",  id = 255, values = great_britain_house },
    { name = "india_house",          id = 265, values = india_house },
    { name = "turkey_house",         id = 272, values = turkey_house },
    { name = "germany_house",        id = 283, values = germany_house },
    { name = "russian_house",        id = 303, values = russian_house },
    { name = "france_house",         id = 324, values = france_house },
    { name = "china_house",          id = 338, values = china_house },
    { name = "japan_house",          id = 359, values = japan_house },
    { name = "poland_house",         id = 373, values = poland_house },
    { name = "austro_hungary_house", id = 386, values = austro_hungary_house },
    { name = "persia_iran_house",    id = 403, values = persia_iran_house },
    { name = "italy_house",          id = 437, values = italy_house },
}

local temples = {
    { name = "altar",                id = 0,   values = altar },
    { name = "temple_base",          id = 10,  values = temple_base },
    { name = "europe_temple",        id = 11,  values = europe_temple },
    { name = "asia_temple",          id = 28,  values = asia_temple },
    { name = "western_europe_temple", id = 51, values = western_europe_temple },
    { name = "eastern_europe_temple", id = 52, values = eastern_europe_temple },
    { name = "western_asia_temple",  id = 83,  values = western_asia_temple },
    { name = "eastern_asia_temple",  id = 84,  values = eastern_asia_temple },
    { name = "abstract_temple",      id = 190, values = abstract_temple },
    { name = "wonder",               id = 239, values = wonder },
    { name = "great_britain_temple", id = 254, values = great_britain_temple },
    { name = "india_temple",         id = 264, values = india_temple },
    { name = "turkey_temple",        id = 271, values = turkey_temple },
    { name = "germany_temple",       id = 282, values = germany_temple },
    { name = "russia_temple",        id = 302, values = russia_temple },
    { name = "france_temple",        id = 323, values = france_temple },
    { name = "china_temple",         id = 337, values = china_temple },
    { name = "japan_temple",         id = 358, values = japan_temple },
    { name = "poland_temple",        id = 372, values = poland_temple },
    { name = "austria_hungary_temple", id = 385, values = austria_hungary_temple },
    { name = "persia_iran_temple",   id = 402, values = persia_iran_temple },
    { name = "italy_temple",         id = 436, values = italy_temple },
}

-- ============================================================================
-- 4. APPLY -- load-time write to every building transport node, then ONE
--    rebuild pass (root.f_recreateModifiedUnitTypes is mandatory: without
--    it the changes silently do not apply). Applied at script load, before
--    the match starts; no onTick needed.
-- ============================================================================

local applied, skipped, failed = 0, 0, 0

-- Every building runs inside pcall: one bad unit type must never abort the
-- loop (a crash before f_recreateModifiedUnitTypes would skip everything).
local function applyBuilding(b)
    local v = b.values
    local ok, err = pcall(function()
        local t = root.unitType[b.id].transport

        if t == nil then
            print(string.format("[batiment] %s (id %d): ERROR: no transport node on this unit type",
                b.name, b.id))
            return
        end

        if not v.enabled then
            skipped = skipped + 1
            print(string.format("[batiment] %s (id %d): disabled", b.name, b.id))
            return
        end

        t.enabled = true
        t.unitLimit = v.unitLimit
        t.volume = v.volume

        if t.tags ~= nil then
            -- f_clear exists on some tag nodes and CRASHES on others
            -- ("Lua format error", seen on temples) — never call it bare.
            local okClear = pcall(function()
                if t.tags.f_clear ~= nil then t.tags.f_clear() end
            end)
            if not okClear then
                print(string.format("[batiment] %s (id %d): tags.f_clear failed, keeping existing tags",
                    b.name, b.id))
            end
            for _, tag in ipairs(v.tags) do
                t.tags[tag] = true
            end
        end

        applied = applied + 1
        print(string.format("[batiment] %s (id %d): transport on (tags {%s}, unitLimit %d, volume %d)",
            b.name, b.id, table.concat(v.tags, ", "), v.unitLimit, v.volume))
    end)

    if not ok then
        failed = failed + 1
        print(string.format("[batiment] %s (id %d): ERROR: %s", b.name, b.id, tostring(err)))
    end
end

for _, b in ipairs(houses) do applyBuilding(b) end
for _, b in ipairs(temples) do applyBuilding(b) end

print(string.format("[batiment] done: %d garrison(s), %d skipped, %d failed",
    applied, skipped, failed))

root.f_recreateModifiedUnitTypes()

addMod({
    onStart = function(var)
        print("[batiment] onStart: transport changes were applied at script load")
        print(string.format(
            "[batiment] onStart summary: %d garrison(s), %d skipped, %d failed",
            applied, skipped, failed))
    end,
})
