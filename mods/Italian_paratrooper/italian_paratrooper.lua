-- ============================================================================
-- Paratrooper replacement mod
-- Parameters:
--   unit444  (number, default 205) unit ID dropped by the 444 plane
--   count444 (number, default 7)   drop count for the 444 plane
--   unit448  (number, default 181) unit ID dropped by the 448 plane
--   count448 (number, default 7)   drop count for the 448 plane
-- ============================================================================

function onInit(var)
    UNIT_444  = getParameterNumber("unit444",  205, 1, 999)
    COUNT_444 = getParameterNumber("count444",   7, 1, 20)
    UNIT_448  = getParameterNumber("unit448",  181, 1, 999)
    COUNT_448 = getParameterNumber("count448",   7, 1, 20)
    print("[ParaMod] 444: unit=" .. UNIT_444 .. " x" .. COUNT_444)
    print("[ParaMod] 448: unit=" .. UNIT_448 .. " x" .. COUNT_448)
end

function onStart(var)
    -- Paratrooper container for the 444 plane (450)
    root.unitType[444].ability.ability[0].data.parameters =
        "ability=paratroopers,pType=450,pCount=" .. COUNT_444
    root.unitType[450].ability.ability[0].data.unit = UNIT_444
    print("[ParaMod] 444 → unit=" .. UNIT_444 .. " x" .. COUNT_444)

    -- Paratrooper container for the 448 plane (451)
    root.unitType[448].ability.ability[0].data.parameters =
        "ability=paratroopers,pType=451,pCount=" .. COUNT_448
    root.unitType[451].ability.ability[0].data.unit = UNIT_448
    print("[ParaMod] 448 → unit=" .. UNIT_448 .. " x" .. COUNT_448)

    root.f_recreateModifiedUnitTypes()
    print("[ParaMod] done")
end

addMod({ onInit = onInit, onStart = onStart })
