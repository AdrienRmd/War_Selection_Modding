-----------------------------------------------------------
-- Mod name: Colossal cannon
-- Description: Fully configurable colossal cannon (unit type 284): range, reload, damage, blast radius, turret rotation. Settings panel in-game.
-- Author: AdrienRmd
-- Status: WIP
-----------------------------------------------------------

-- ============================================================================
-- The mod panel expects "displayed numbers" (meters, seconds, damage points)
-- The code automatically multiplies x 1000 to convert to raw engine values.
-- Only RotationSpeed and DamagesCount are raw engine values (no x 1000).
-- ============================================================================

-- Panel parameters (displayed values)
local DISTANCE_MAX   = getParameterNumber("DistanceMax",  2000, 0, 100000) * 1000 -- max range, meters (base 2000)
local DISTANCE_MIN   = getParameterNumber("DistanceMin",  1000, 0, 100000) * 1000 -- min range, meters (base 1000)
local DISTANCE_STOP  = getParameterNumber("DistanceStop", 2050, 0, 100000) * 1000 -- stop distance, meters (base 2050)
local RECHARGE       = getParameterNumber("Recharge",        5, 1, 600)    * 1000 -- reload time, seconds (base 5)
local RADIUS         = getParameterNumber("Radius",          5, 0, 1000)   * 1000 -- blast radius, meters (base 5)
local DAMAGE         = getParameterNumber("Damage",        400, 0, 1000000) * 1000 -- damage to units (base 400)
local ROTATION_SPEED = getParameterNumber("RotationSpeed", 500, 0, 10000)         -- turret rotation speed, raw value (base 500)
local DAMAGES_COUNT  = getParameterNumber("DamagesCount",    1, 1, 100)           -- hits per attack (base 1)
local ENV_DAMAGE     = getParameterNumber("EnvDamage",     250, 0, 1000000) * 1000 -- damage to environment (base 250)

-- ============================================================================
-- Safety checks: wrong ranges would silently break the weapon
-- ============================================================================

-- distanceMin must stay below distanceMax, otherwise the cannon can never fire
if DISTANCE_MIN >= DISTANCE_MAX then
    DISTANCE_MIN = math.floor(DISTANCE_MAX / 2)
end

-- distanceStop MUST be greater than distanceMax, otherwise the cannon stops
-- attacking as soon as the target moves (see docs/modding-guide/attack.md)
if DISTANCE_STOP <= DISTANCE_MAX then
    DISTANCE_STOP = DISTANCE_MAX + 50000 -- +50 m safety margin
end

-- damagesCount is a hit count: keep it a whole number >= 1
DAMAGES_COUNT = math.max(1, math.floor(DAMAGES_COUNT))

-- ============================================================================
-- Apply everything to the colossal cannon (unit type 284, turret 0, weapon 0)
-- ============================================================================

local cannon = root.unitType[284].attack.turret[0]
local weapon = cannon.weapon[0]

weapon.distanceMax         = DISTANCE_MAX   -- base 2000000 = 2000 m
weapon.distanceMin         = DISTANCE_MIN   -- base 1000000 = 1000 m
weapon.distanceStop        = DISTANCE_STOP  -- base 2050000 = 2050 m (must stay > distanceMax)
weapon.rechargePeriod      = RECHARGE       -- base 5000 = 5 s
weapon.damage.radius       = RADIUS         -- base 5000 = 5 m
weapon.damage.damages[0]   = DAMAGE         -- base 400000 = 400 damage
weapon.damage.damagesCount = DAMAGES_COUNT  -- base 1
weapon.damage.envDamage    = ENV_DAMAGE     -- base 250000 = 250 damage

cannon.rotationSpeed = ROTATION_SPEED       -- base 500

root.f_recreateModifiedUnitTypes()
