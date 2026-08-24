-----------------------------------------------------------
-- Mod name: Colossal cannon
-- Description: Fully configurable colossal cannon (unit type 284): range, reload, damage, blast radius, turret rotation, health and armor. Settings panel in-game.
-- Author: JSuisMort
-- Status: Stable
-----------------------------------------------------------

-- ============================================================================
-- The mod panel expects "displayed numbers" (meters, seconds, damage points)
-- The code automatically multiplies x 1000 to convert to raw engine values.
-- Only DamagesCount is a raw engine value (no x 1000).
-- ============================================================================

-- Panel parameters (displayed values)
-- math.floor: engine fields require integers (e.g. 0.5 * 1000 = 500.0 is a
-- Lua float and would fail with "Argument 0: Not integer")
local DISTANCE_MAX   = math.floor(getParameterNumber("DistanceMax",  2000, 0, 100000) * 1000) -- max range, meters (base 2000)
local DISTANCE_MIN   = math.floor(getParameterNumber("DistanceMin",  1000, 0, 100000) * 1000) -- min range, meters (base 1000)
local DISTANCE_STOP  = math.floor(getParameterNumber("DistanceStop", 2050, 0, 100000) * 1000) -- stop distance, meters (base 2050)
local RECHARGE       = math.floor(getParameterNumber("Recharge",        5, 1, 600)    * 1000) -- reload time, seconds (base 5)
local RADIUS         = math.floor(getParameterNumber("Radius",          5, 0, 1000)   * 1000) -- blast radius, meters (base 5)
local DAMAGE         = math.floor(getParameterNumber("Damage",        400, 0, 1000000) * 1000) -- damage to units (base 400)
local ROTATION_SPEED = math.floor(getParameterNumber("RotationSpeed", 0.5, 0.1, 10)  * 1000) -- turret rotation, seconds: 1000 = 1 s (base 500 = 0.5 s)
local DAMAGES_COUNT  = getParameterNumber("DamagesCount",    1, 1, 100)           -- hits per attack (base 1)
local ENV_DAMAGE     = math.floor(getParameterNumber("EnvDamage",     250, 0, 1000000) * 1000) -- damage to environment (base 250)
local HEALTH         = math.floor(getParameterNumber("Health",       1500, 1, 1000000) * 1000) -- cannon HP (base 1500)
local FIRST_ARMOR    = math.floor(getParameterNumber("FirstArmor",      8, 0, 1000)    * 1000) -- armor slot 0 thickness (base 8)
local SECOND_ARMOR   = math.floor(getParameterNumber("SecondArmor",    12, 0, 1000)    * 1000) -- armor slot 1 thickness (base 12)

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

cannon.rotationSpeed = ROTATION_SPEED       -- base 500 = 0.5 s (1000 = 1 s)

local deathability = root.unitType[284].deathability

deathability.health                         = HEALTH      -- base 1500000 = 1500 HP
deathability.armor.data[0].object.thickness = FIRST_ARMOR  -- base 8000 = 8 armor
deathability.armor.data[1].object.thickness = SECOND_ARMOR -- base 12000 = 12 armor

-- Debug: prints the values actually applied (check the developer Console)
-- If a value shows the base default, the panel parameter is missing or misnamed
print("test")
print(string.format(
    "[colossal_cannon] range max/min/stop: %d/%d/%d m | reload: %.1f s | blast radius: %d m | damage: %d x%d | env damage: %d | rotation: %.2f s | HP: %d | armor: %d/%d",
    DISTANCE_MAX / 1000, DISTANCE_MIN / 1000, DISTANCE_STOP / 1000,
    RECHARGE / 1000,
    RADIUS / 1000,
    DAMAGE / 1000, DAMAGES_COUNT,
    ENV_DAMAGE / 1000,
    ROTATION_SPEED / 1000,
    HEALTH / 1000,
    FIRST_ARMOR / 1000, SECOND_ARMOR / 1000))

root.f_recreateModifiedUnitTypes()
