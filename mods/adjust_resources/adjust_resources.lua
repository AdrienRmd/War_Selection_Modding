-- ============================================================================
-- Mod : ajustement des quantités de ressources au démarrage d'une partie
-- ============================================================================
-- Toutes les valeurs sont modifiables EN JEU dans le panneau du mod.
-- Le 1er nombre = valeur par défaut, puis min / max.
-- Le code convertit tout seul en valeur brute du moteur (× 1000).
-- ============================================================================

-- Quantités par ressource (nombre tel qu'affiché en jeu)
BERRY_AMOUNT      = getParameterNumber("baies",          1000,  0, 1000000) * 1000
SMALL_FISH_AMOUNT = getParameterNumber("petitsPoissons", 500,   0, 1000000) * 1000
BIG_FISH_AMOUNT   = getParameterNumber("grosPoissons",   1000,  0, 1000000) * 1000
WHEAT_AMOUNT      = getParameterNumber("ble",            10000, 0, 1000000) * 1000
STONE_AMOUNT      = getParameterNumber("pierre",         10000, 0, 1000000) * 1000
IRON_AMOUNT       = getParameterNumber("fer",            10000, 0, 1000000) * 1000

-- Arbres : en POURCENTAGE (100 = inchangé), pas de × 1000 ici
WOOD_PCT          = getParameterNumber("arbresPourcent", 100,   1, 10000)

-- Tags des ressources environnementales (puissances de 2, ne pas modifier)
TAG_BERRY      = 1
TAG_WOOD       = 2
TAG_SMALL_FISH = 4
TAG_BIG_FISH   = 8
TAG_IRON       = 16
TAG_STONE      = 64
TAG_WHEAT      = 128

-- Cherche tous les objets portant ce tag sur toute la carte
-- et applique la fonction transform(health) à leur quantité.
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

-- Fixe la quantité à la valeur brute donnée (déjà convertie × 1000)
function SetResource(tag, rawAmount, name)
    ForEachTagged(tag, name, function(health)
        return rawAmount
    end)
    print("[Resource] " .. name .. " fixe a " .. (rawAmount / 1000))
end

-- Multiplie la quantité actuelle par un pourcentage
function ScaleResource(tag, percent, name)
    ForEachTagged(tag, name, function(health)
        return math.floor(health * percent / 100)
    end)
    print("[Resource] " .. name .. " ajuste a " .. percent .. "%")
end

-- Application au démarrage de la partie
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
