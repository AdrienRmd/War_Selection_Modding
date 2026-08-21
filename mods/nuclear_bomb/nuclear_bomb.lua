-- ============================================================================
-- Bombe nucléaire
-- Le panneau du mod attend des "nombres affichés" (ex : 60000 pour 60 milles)
-- Le code multiplie automatiquement × 1000 pour convertir en valeur brute du moteur
-- ============================================================================

-- Valeurs par défaut utilisées si le panneau n'a rien réglé
-- (aussi des nombres affichés, pas des valeurs brutes)
local FOOD     = (getParameterNumber("CostFood") or 60000) * 1000  -- nourriture
local WOOD     = (getParameterNumber("CostWood") or 60000) * 1000  -- bois
local IRON     = (getParameterNumber("CostIron") or 60000) * 1000  -- fer
local RADIUS   = (getParameterNumber("Radius")   or 440)   * 1000  -- rayon d'explosion
local DAMAGE   = (getParameterNumber("Damage")   or 3500)  * 1000  -- dégâts
local TECH_AC  = 89    -- tech du largage de bombe par avion (merveille industrielle, fixe)
local TECH_SPY = 25    -- tech de la bombe nucléaire de l'espion (fixe)

-- Les 4 avions pouvant larguer la bombe nucléaire
local AIRCRAFT = { 316, 330, 355, 361 }

-- La bombe nucléaire elle-même
local bomb = root.unitType[377]
bomb.ability.ability[0].data.damages[0] = DAMAGE
bomb.ability.ability[0].data.damages[5] = DAMAGE
bomb.ability.ability[0].data.radius     = RADIUS
bomb.ability.ability[0].data.id         = 27
bomb.lifeTime = 9000
bomb.tags[16] = true
bomb.tags[15] = true

-- Tech d'origine de la bombe nucléaire de l'espion
root.unitType[195].ability.ability[16].requirements.researchAny[0].id = TECH_SPY

-- Équipe les 4 avions de la capacité de largage nucléaire
for _, aircraftId in ipairs(AIRCRAFT) do
    local b = root.unitType[aircraftId]
    b.ability.enabled = true
    b.ability.ability.f_clear()
    b.ability.work.f_clear()

    local newAbilityId = b.ability.ability.f_create()
    local newAbility = b.ability.ability[newAbilityId]
    newAbility.data.unit     = 377
    newAbility.data.lifeTime = 10000
    newAbility.data.count    = 1

    local newWorkId = b.ability.work.f_create()
    local newWork = b.ability.work[newWorkId]
    newWork.ability        = newAbilityId
    newWork.makeTime       = 1
    newWork.reserveLimit   = 1
    newWork.reserveTime    = 60000
    newWork.costProcess[0] = FOOD
    newWork.costProcess[1] = WOOD
    newWork.costProcess[2] = IRON

    newAbility.requirements.researchAny.f_create()
    newAbility.requirements.researchAny[0].id = TECH_AC
end

root.f_recreateModifiedUnitTypes()
