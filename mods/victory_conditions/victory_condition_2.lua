-----------------------------------------------------------
-- Mod name: Victory condition 2
-- Description: Victory condition: full win/loss engine (eliminations, leaves/kicks, server reporting).
-- Author: AdrienRmd
-- Status: WIP
-----------------------------------------------------------

checkWinTeam = true



function checkFactionLose(factionId, faction)
	return false
end

function losePlayer(playerId, position)
	root.eliminatePlayer = {playerId, 0}
	if not getResult() then return false end

	assert(playerId < 64)
	
	local scene = root.scene_0
	local units = scene.unit
	local function func(unitId)
		local unitTypeId = units[unitId].type
		if unitTypeId == 253 or unitTypeId == 374 then
			scene.kill = unitId
		else
			scene.unitStop = unitId
		end
	end	
	forEachPlayerUnit(playerId, func)
	
	local json = {
		type = "matchState",
		lostPlayer = playerId,
		matchState = "loser",
		position = position,
		time = root.time
	}
	root.sendDataToServer = toJson(json)

	for i = 1, #onPlayerLose do
		onPlayerLose[i][2](playerId)
	end

	return true
end

function winTeam(winTeamId)
	local scene = root.scene_0
	local factions = scene.faction
	local playersCount = root.player_size
	local winners = {}
	local losers = {}
	local losersCount = 0

	local function func(facId)
		local faction = factions[facId]
		local team = faction.team

		if checkFactionLose(facId, faction) then
			losersCount = losersCount + 1
		end
			
		local pl = getPlayerOfFaction(facId)
		if team == winTeamId then
			root.eliminatePlayer = {pl, 1}
			if getResult() then
				table.insert(winners, pl)
			end
		else
			table.insert(losers, pl)
		end

	end
	forEachControlledFaction(func)

	if #winners == 0 then return false end
	
	local position = playersCount - losersCount
	for i = 1, #losers do
		losePlayer(losers[i], position)
	end

	local json = {
		type = "matchState",
		winPlayers = winners,
		matchState = "winners",
		data = {},
		time = root.time
	}
	
	genServerData(json.data)
	
	root.sendDataToServer = toJson(json)
	
	return true
end

local function checkWinLose()
	local factions = root.scene[0].faction
	local players = root.player
	local playersCount = players.size
	local activeTeams = {}
	local newLosers = {}
	local prevLosersCount = 0
	if playersCount == 1 then return end

	for plId = 0, playersCount - 1 do
		local player = players[plId]
		if player.eliminated then
			prevLosersCount = prevLosersCount + 1
		else
			function func(factionId)
				local faction = factions[factionId]
				local teamId = faction.team
				if checkFactionLose(factionId, faction) then
					table.insert(newLosers, plId)
				else
					activeTeams[teamId] = true
				end
			end

			forEachPlayerFaction(plId, func)
		end
	end
	
	local position = playersCount - prevLosersCount - #newLosers + 1
	for i = 1, #newLosers do
		losePlayer(newLosers[i], position)
	end

	if checkWinTeam then
		local activeTeamsCount = 0
		local winTeamId = 0

		for teamId,_ in pairs(activeTeams) do
			winTeamId = teamId
			activeTeamsCount = activeTeamsCount + 1
		end
		
		if activeTeamsCount == 1 then
			winTeam(winTeamId)
		end
	end
end

function makePlayerLose(player)
	killAllMovableUnits(player)
end

function onTickWinLoss(time)
	if time % 1000 == 0 then checkWinLose() end
end

function onScriptWinLoss()
	if getParameter("command") == "leave" then
		local player = getParameter("player")
		assert(player < 64)
		makePlayerLose(player)
		return
	end
	if getParameter("command") == "serverkick" then
		local player = getParameter("player")
		assert(player < 64)
		makePlayerLose(player)
		return
	end
end



addTickFunction(onTickWinLoss, "onTickWinLoss")
addScriptFunction(onScriptWinLoss, "onScriptWinLoss")
