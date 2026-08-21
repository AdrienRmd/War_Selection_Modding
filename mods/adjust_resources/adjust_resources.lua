-- ============================================================================
-- Mod: adjust resource quantities at the start of a game
-- ============================================================================
-- All values are editable IN GAME in the mod panel.
-- The 1st number = default value, then min / max.
-- The code automatically converts to the raw engine value (× 1000).
-- ============================================================================

-- Quantity per resource (number as displayed in game)
BERRY_AMOUNT      = getParameterNumber("baies",          1000,  0, 1000000) * 1000
SMALL_FISH_AMOUNT = getParameterNumber("petitsPoissons", 500,   0, 1000000) * 1000
BIG_FISH_AMOUNT   = getParameterNumber("grosPoissons",   1000,  0, 1000000) * 1000
WHEAT_AMOUNT      = getParameterNumber("ble",            10000, 0, 1000000) * 1000
STONE_AMOUNT      = getParameterNumber("pierre",         10000, 0, 1000000) * 1000
IRON_AMOUNT       = getParameterNumber("fer",            10000, 0, 1000000) * 1000

-- Trees: as a PERCENTAGE (100 = unchanged), no × 1000 here
WOOD_PCT          = getParameterNumber("arbresPourcent", 100,   1, 10000)

-- Tags of environmental resources (powers of 2, do not change)
TAG_BERRY      = 1
TAG_WOOD       = 2
TAG_SMALL_FISH = 4
TAG_BIG_FISH   = 8
TAG_IRON       = 16
TAG_STONE      = 64
TAG_WHEAT      = 128

-- Finds all objects with this tag across the whole map
-- and applies the transform(health) function to their quantity.
function ForEachTagged(tag, name, transform)
    local ids  = root.scene[0].envs.f_search(0, 0, 1000000000, tag)
    local envs = root.scene[0].envs.list
    local count = 0
    for _, id in ipairs(ids) do
        envs[id].health = transform(envs[id].health)
        count = count + 1
    end
    print("[Resource] " .. name .. ": " .. count .. " objet(s) modifie(s)")
end

-- Sets the quantity to the given raw value (already converted × 1000)
function SetResource(tag, rawAmount, name)
    ForEachTagged(tag, name, function(health)
        return rawAmount
    end)
    print("[Resource] " .. name .. " fixe a " .. (rawAmount / 1000))
end

-- Multiplies the current quantity by a percentage
function ScaleResource(tag, percent, name)
    ForEachTagged(tag, name, function(health)
        return math.floor(health * percent / 100)
    end)
    print("[Resource] " .. name .. " ajuste a " .. percent .. "%")
end

-- Applied at game start
function onStart(var)
    SetResource(TAG_BERRY,      BERRY_AMOUNT,      "baies")
    ScaleResource(TAG_WOOD,     WOOD_PCT,          "arbres")
    SetResource(TAG_SMALL_FISH, SMALL_FISH_AMOUNT, "petits poissons")
    SetResource(TAG_BIG_FISH,   BIG_FISH_AMOUNT,   "gros poissons")
    SetResource(TAG_IRON,       IRON_AMOUNT,       "fer")
    SetResource(TAG_STONE,      STONE_AMOUNT,      "pierre")
    SetResource(TAG_WHEAT,      WHEAT_AMOUNT,      "blé")
    print("[Resource] terminé")
end

addMod({ onStart = onStart })
