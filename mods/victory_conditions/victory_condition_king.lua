-- ============================================================================
-- Mod: "King" victory condition (critical unit to protect)
-- ============================================================================
-- Principle: each player must protect their "king" unit.
-- If a player no longer has a living king -> they are eliminated.
-- The last team with a living king wins the game.
--
-- Parameter editable IN GAME in the mod panel:
--   VictoryConditionUnitId: the id of the "king" unit (e.g. 253) = victory condition
--                if this unit dies -> the player is eliminated
--                0 = mode disabled (normal behavior)
--
-- IMPORTANT: enable this mod AFTER condition_de_victoire_2.lua
-- (it replaces its checkFactionLose function)
-- ============================================================================

-- =========================== CONFIGURATION ================================
ROI_ID = getParameterNumber("VictoryConditionUnitId", 0, 0, 100000)   -- 0 = disabled
-- ==========================================================================

-- Called by the engine every second for each faction.
-- Returns true = the faction has lost.
function checkFactionLose(factionId, faction)
	if ROI_ID == 0 then return false end   -- mode disabled

	local player = getPlayerOfFaction(factionId)
	local units = root.scene_0.unit
	local roiVivant = false
	local unitesTotales = 0

	local function func(unitId)
		unitesTotales = unitesTotales + 1
		if units[unitId].type == ROI_ID then
			roiVivant = true
		end
	end
	forEachPlayerUnit(player, func)

	-- Safety: a player with no units at all (start of game) is not eliminated
	if unitesTotales == 0 then return false end

	return not roiVivant   -- no living king left = defeat
end

function onStart(var)
	if ROI_ID == 0 then
		print("[Victoire] mode roi desactive (id = 0)")
	else
		print("[Victoire] mode roi actif : unite " .. ROI_ID)
	end
end

addMod({ onStart = onStart })
