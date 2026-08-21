
function onTick(var, currentMoment)
	if currentMoment % 1000 == 0 then
		if root.player_size == 1 then return end
		local factions = root.scene[0].faction
		local winTeamId = nil
		local oneAliveTeam = true

		local function func(playerId)
			if not root.player[playerId].eliminated then
				function func_(factionId)
					local teamId = factions[factionId].team
					if winTeamId == nil or winTeamId == teamId then
						winTeamId = teamId
					else
						oneAliveTeam = false
					end
				end
				forEachPlayerFaction(playerId, func_)
			end
		end
		forEachPlayerLive(func)
		
		if oneAliveTeam and winTeamId ~= nil then
			winTeam(winTeamId)
		end
	end
end


addMod({ onTick = onTick })
