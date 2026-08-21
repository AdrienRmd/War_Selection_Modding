-----------------------------------------------------------
-- Mod name: Nuclear bomb
-- Description: Configurable nuclear bomb: four aircraft can build and drop one bomb each. Settings panel in-game.
-- Author: AdrienRmd
-- Status: Stable
-----------------------------------------------------------

-- ============================================================================
-- The mod panel expects "displayed numbers" (e.g. 60000 for 60k)
-- The code automatically multiplies × 1000 to convert to the raw engine value
-- ============================================================================

-- Default values used when the panel has nothing set
-- (also displayed numbers, not raw values)
local FOOD     = (getParameterNumber("CostFood") or 60000) * 1000  -- food
local WOOD     = (getParameterNumber("CostWood") or 60000) * 1000  -- wood
local IRON     = (getParameterNumber("CostIron") or 60000) * 1000  -- iron
local RADIUS   = (getParameterNumber("Radius")   or 440)   * 1000  -- explosion radius
local DAMAGE   = (getParameterNumber("Damage")   or 3500)  * 1000  -- damage
local TECH_AC  = 89    -- tech for aircraft bomb drop (industrial wonder, fixed)
local TECH_SPY = 25    -- tech of the spy's nuclear bomb (fixed)

-- The 4 aircraft able to drop the nuclear bomb
local AIRCRAFT = { 316, 330, 355, 361 }

-- The nuclear bomb itself
local bomb = root.unitType[377]
bomb.ability.ability[0].data.damages[0] = DAMAGE
bomb.ability.ability[0].data.damages[5] = DAMAGE
bomb.ability.ability[0].data.radius     = RADIUS
bomb.ability.ability[0].data.id         = 27
bomb.lifeTime = 9000
bomb.tags[16] = true
bomb.tags[15] = true

-- Origin tech of the spy's nuclear bomb
root.unitType[195].ability.ability[16].requirements.researchAny[0].id = TECH_SPY

-- Equips the 4 aircraft with the nuclear drop ability
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
