-- ============================================================================
-- Mod : condition de victoire "Roi" (unité critique à protéger)
-- ============================================================================
-- Principe : chaque joueur doit protéger son unité "roi".
-- Si un joueur n'a plus de roi vivant -> il est éliminé.
-- La dernière équipe avec un roi vivant remporte la partie.
--
-- Paramètre modifiable EN JEU dans le panneau du mod :
--   VictoryConditionUnitId : l'id de l'unité "roi" (ex : 253) = condition de victoire
--                si cette unité meurt -> le joueur est éliminé
--                0 = mode désactivé (comportement normal)
--
-- IMPORTANT : activer ce mod APRÈS condition_de_victoire_2.lua
-- (il remplace sa fonction checkFactionLose)
-- ============================================================================

-- =========================== CONFIGURATION ================================
ROI_ID = getParameterNumber("VictoryConditionUnitId", 0, 0, 100000)   -- 0 = désactivé
-- ==========================================================================

-- Appelé par le moteur chaque seconde pour chaque faction.
-- Retourne true = la faction a perdu.
function checkFactionLose(factionId, faction)
	if ROI_ID == 0 then return false end   -- mode désactivé

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

	-- Sécurité : un joueur sans aucune unité (début de partie) n'est pas éliminé
	if unitesTotales == 0 then return false end

	return not roiVivant   -- plus de roi vivant = défaite
end

function onStart(var)
	if ROI_ID == 0 then
		print("[Victoire] mode roi desactive (id = 0)")
	else
		print("[Victoire] mode roi actif : unite " .. ROI_ID)
	end
end

addMod({ onStart = onStart })
