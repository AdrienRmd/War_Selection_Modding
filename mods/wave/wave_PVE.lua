-- Nuanyang fixed version: after a player is eliminated, existing attacking units and subsequent waves will turn toward the bases that are still alive.
WAVE_SCRIPT_VERSION = "v229.3858-opening-message-20260821"
TC_CLOSE_AREA_SHIFT = 50000
MAKE_UNITS = true
log("***********mod message***************")
----------------------Function wrappers----------------------
function ShowOpeningMessage()
	root.f_playerSpecialCommand(0, "command", "chat", "text",
		"\n----------------------------------------------------------\n\n" ..
		"This mod and map were co-developed by Austin and Nuanyang\n" ..
		"Inspired by the earlier Chenxi wave mod\n\n" ..
		"Welcome to the main QQ group: 1035193402\n" ..
		"or join the WS map group: 768858056\n\n" ..
		"----------------------------------------------------------",
		"destination", "all", "font", "SIMHEI")
end

function WaveDebug(...)
	if DEBUG == true then
		print("[WaveDebug]", ...)
	end
end

function FindUnitIDByTypeID(factionID, unitTypeID, DEBUG)
	--f_findAllByType2(factionID,unittypeID)
	--_self=list of searched units' ID
	return root.scene[0].units.f_findAllByType2(factionID,unitTypeID)
end
function GetUnitpositionByUnitID(unitID, DEBUG)
	if DEBUG == true then 
		print("-----------DEBUG_GetUnitpositionByUnitID----------------")
		print("unitID:", unitID, "position:",root.scene[0].units.list[unitID].position) 
		print("-----------DEBUG_GetUnitpositionByUnitID----------------")
	end
	return root.scene[0].units.list[unitID].position
end
function CreatUnits(unitTypeId, number, factionID, x, y, direction)
	--typeId,number,faction,x,y,direction,addPlacingSize=0,findPositionRule=findClockWise2,findPlaceSize=100000[,lifeTime=0][,additionalBlockLevels]
	--_self = table of created units
	return root.scene[0].units.f_create(unitTypeId,number,factionID,math.floor(x),math.floor(y),direction)
end
----------------------Function wrappers----------------------
----------------------Faction functions----------------------
-- Factions and player IDs start from 0
function FindAttackerFactionID()
	-- You need to add {"attackers":true} to the faction's external data
	for i = 0, root.faction.size - 1 do
		local factionExternalData = fromJson(root.faction[i].externalData)
		if factionExternalData ~= nil and factionExternalData.attackers == true then
			local attackersFactionId = i
			return attackersFactionId
		end
	end
	print("Attacker faction not found.")
	return false
end
function GetControlledFactionOfPlayer(playerId)
	if playerId == nil then
		return nil
	end

	local player = root.player[playerId]
	if player == nil or player.controlledFactions == nil then
		return nil
	end

	for factionId = 0, root.faction.size - 1 do
		if player.controlledFactions[factionId] == true then
			return factionId
		end
	end

	return nil
end
function GetAttackerSpawnPositions(attackerFactionID,unitTypeID,DEBUG)
	local attackersSpawnFlags=FindUnitIDByTypeID(attackerFactionID,unitTypeID) or {}
	local attackersSpawnpositions={}
	for index,unitID in pairs(attackersSpawnFlags) do
		--table.insert(attackersSpawnpositions,GetUnitpositionByUnitID(unitID)) Doing this errors out when accessed in onTick, for unknown reasons.
		attackersSpawnpositions[index] = {}
		attackersSpawnpositions[index].x = GetUnitpositionByUnitID(unitID).x
		attackersSpawnpositions[index].y = GetUnitpositionByUnitID(unitID).y
		attackersSpawnpositions[index].z = GetUnitpositionByUnitID(unitID).z
		if DEBUG == true then
			print("-----------DEBUG_GetAttackerSpawnPositions----------------")
			print("index:", index, "position:", attackersSpawnpositions[index].x,attackersSpawnpositions[index].y,attackersSpawnpositions[index].z)
			print("-----------DEBUG_GetAttackerSpawnPositions----------------")
		end
	end
	return attackersSpawnpositions
end
function GetDefenderpositions(unitTypeID, DEBUG)
	local defenderPositions={}
	for i=0, root.player.size - 1 do
		local factionID = GetControlledFactionOfPlayer(i)
		if factionID ~= nil then
			local defenderUnits = FindUnitIDByTypeID(factionID, unitTypeID)
			if defenderUnits ~= nil and #defenderUnits > 0 then
				local position = GetUnitpositionByUnitID(defenderUnits[1])
				defenderPositions[factionID] = {
					x = position.x,
					y = position.y
				}
				if DEBUG == true then
					print("-----------DEBUG_GetDefenderpositions----------------")
					print("playerID:", i, "factionID:", factionID)
					print("x:", defenderPositions[factionID].x, "y:",defenderPositions[factionID].y)
					print("-----------DEBUG_GetDefenderpositions----------------")
				end
			else
				print("[WaveFix] Player", i, "faction", factionID, "has no defender base flag, skipped")
			end
		end
	end
	return defenderPositions
end
function FindLatestPlayerAge(DEBUG)
	--0 is the Stone Age
	local maxAge = 0
	local function factionFinder(playerId)
		local playerFactionId = GetControlledFactionOfPlayer(playerId)
		if playerFactionId ~= nil then
			local ageData = getAgeFaction(playerFactionId)
			if ageData ~= nil and ageData[1] ~= nil and ageData[1] > maxAge then
				maxAge = ageData[1]
			end
		end
	end
	forEachPlayerLive(factionFinder)
	if DEBUG == true then
		print("-----------DEBUG_FindLatestPlayerAge----------------")
		print("maxAge:", maxAge)
		print("-----------DEBUG_FindLatestPlayerAge----------------")
	end
	--One more than the default
	return maxAge + 1
end
----------------------Faction functions----------------------
----------------------Math functions, self-explanatory----------------------
function GetVector(initialPoint, finalPoint)
	return { x = finalPoint.x - initialPoint.x, y = finalPoint.y - initialPoint.y }
end
function DotProduct(v1, v2)
	return v1.x * v2.x + v1.y * v2.y
end
function Determinant(v1, v2)
	return v1.x * v2.y - v1.y * v2.x
end
function Magnitude(v)
	return math.sqrt(v.x * v.x + v.y * v.y)
end

-- War Selection's built-in Lua has no math.atan2, so use a compatible implementation based only on math.atan.
function Atan2Compatible(y, x)
	if x > 0 then
		return math.atan(y / x)
	elseif x < 0 then
		if y >= 0 then
			return math.atan(y / x) + math.pi
		end
		return math.atan(y / x) - math.pi
	elseif y > 0 then
		return math.pi / 2
	elseif y < 0 then
		return -math.pi / 2
	end
	return 0
end

function GetVectorAngleCounterClockwise(from, to)
	--unit rad
	local dot = DotProduct(from, to)
	local det = Determinant(from, to)
	local angle = Atan2Compatible(det, dot)
	if angle < 0 then
		return angle + 2 * math.pi
	end
	return angle
end
function GetDirectionAngle(Startingposition,EndPosition)
	--unit rad
	local attackVector = GetVector(Startingposition, EndPosition)
	local unitXVector = { x = 1, y = 0 }
	return GetVectorAngleCounterClockwise(unitXVector, attackVector)
end
function RadiansToGameDirection(rad)
	-- 1048575 - max possible value of the game angle
	-- 0 - 0 rad, 1048575-2pi rad, but as a clockwise angle
	return math.floor(1048575 - rad * 1048575 / ( 2 * math.pi ) )
end
function GetMinKey(list, DEBUG)
	local minKey = nil
	local minValue = nil
	for k,v in pairs(list) do
		if minValue == nil or v < minValue then
			minKey = k
			minValue = v
		end
	end
	if DEBUG == true then
		print("-----------DEBUG_GetMinKey----------------")
		print("minKey:", minKey, "minValue:", minValue)
		print("-----------DEBUG_GetMinKey----------------")
	end
	return minKey
end

function GetNearestDefenderFaction(position, defenderPositions)
	local targetFaction = nil
	local minDistanceSquared = nil
	for factionID, defenderPosition in pairs(defenderPositions or {}) do
		local dx = defenderPosition.x - position.x
		local dy = defenderPosition.y - position.y
		local distanceSquared = dx * dx + dy * dy
		if minDistanceSquared == nil or distanceSquared < minDistanceSquared then
			targetFaction = factionID
			minDistanceSquared = distanceSquared
		end
	end
	return targetFaction
end

function GetRandomDefenderFaction(defenderPositions)
	local defenderFactions = {}
	-- Build the list in faction ID order so that all clients use the same random candidate order.
	for factionID = 0, root.faction.size - 1 do
		if defenderPositions ~= nil and defenderPositions[factionID] ~= nil then
			table.insert(defenderFactions, factionID)
		end
	end
	if #defenderFactions == 0 then
		return nil
	end
	return defenderFactions[1 + root.f_random(#defenderFactions)]
end

-- Distribute the total number of one unit type in a wave precisely across the spawn points.
-- First hand out the integer quotient equally, then add the remainder one by one;
-- the starting point for the remainder rotates with each wave to avoid long-term bias toward fixed points.
function GetSpawnUnitAllocation(totalNumber, spawnIndex, spawnCount, waveNumber)
	if totalNumber <= 0 or spawnCount == nil or spawnCount <= 0 then
		return 0
	end
	local numberPerSpawn = math.floor(totalNumber / spawnCount)
	local remainder = totalNumber - numberPerSpawn * spawnCount
	if remainder <= 0 then
		return numberPerSpawn
	end

	local rotation = ((waveNumber or 1) - 1) % spawnCount
	local rotatedIndex = ((spawnIndex - 1 - rotation + spawnCount) % spawnCount) + 1
	if rotatedIndex <= remainder then
		return numberPerSpawn + 1
	end
	return numberPerSpawn
end
----------------------Math functions, self-explanatory----------------------
----------------------Unit control functions----------------------
function FindIdleAttackerUnits(factionId, limit)
	local idleAttackerUnits={}
	local idleUnitsList = root.scene[0].units.f_findIdlers2(factionId, 32768) or {}
	--print(idleUnitsList)
	for _,idleUnitID in pairs(idleUnitsList) do
		local unit = root.scene[0].units.list[idleUnitID]
		local unitType = nil
		if unit ~= nil then
			unitType = root.unitType[unit.type]
		end
		if unitType ~= nil and unitType.movement ~= nil and unitType.movement.enabled == true then
			--print(idleUnitID,root.scene[0].units.list[idleUnitID].type)
			table.insert(idleAttackerUnits,idleUnitID)
			if limit ~= nil and limit > 0 and #idleAttackerUnits >= limit then
				break
			end
		end
	end
	return idleAttackerUnits
end
function FindAllMobileAttackerUnits(factionId)
	local mobileUnits = {}
	local allUnits = root.scene[0].units.f_findAll2(factionId, 24, true)
	if allUnits == nil then
		return mobileUnits
	end
	for _, unitID in pairs(allUnits) do
		local unit = root.scene[0].units.list[unitID]
		local unitType = nil
		if unit ~= nil then
			unitType = root.unitType[unit.type]
		end
		if unitType ~= nil and unitType.movement ~= nil and unitType.movement.enabled == true then
			table.insert(mobileUnits, unitID)
		end
	end
	return mobileUnits
end
function CreateAttackOrderDirected(unitsIDList, pointToAttack, DEBUG)
	if unitsIDList == nil or #unitsIDList == 0 or pointToAttack == nil then
		return
	end
	if DEBUG == true then
		print("-----------DEBUG_CreateAttackOrderDirected----------------")
		print("CreateAttackOrderDirected list:",unitsIDList)
		print("Point under attack:",pointToAttack.x,pointToAttack.y)
		print("-----------DEBUG_CreateAttackOrderDirected----------------")
	end
	local command = root.scene[0].units.command
	local batchSize = COMMAND_BATCH_SIZE or #unitsIDList
	if batchSize <= 0 then
		batchSize = #unitsIDList
	end
	for firstIndex = 1, #unitsIDList, batchSize do
		local commandBatch = {}
		local lastIndex = math.min(firstIndex + batchSize - 1, #unitsIDList)
		for unitIndex = firstIndex, lastIndex do
			table.insert(commandBatch, unitsIDList[unitIndex])
		end
		-- In v229, f_move takes a new boolean parameter before the unit list.
		-- Regular move/attack calls in the current version use true; the other parameters follow the old version.
		command.f_move(true, numbersToString(commandBatch), pointToAttack.x, pointToAttack.y, 0, false)
	end
end
function RedirectUnitsToLivingDefenders(unitsIDList, defenderPositions, DEBUG)
	if unitsIDList == nil or #unitsIDList == 0
		or defenderPositions == nil or next(defenderPositions) == nil then
		return 0
	end

	local unitsByTarget = {}
	local units = root.scene[0].units.list
	local redirected = 0

	for _, unitID in pairs(unitsIDList) do
		local unit = units[unitID]
		if unit ~= nil and unit.position ~= nil then
			local targetFaction = GetNearestDefenderFaction(unit.position, defenderPositions)
			if targetFaction ~= nil and defenderPositions[targetFaction] ~= nil then
				if unitsByTarget[targetFaction] == nil then
					unitsByTarget[targetFaction] = {}
				end
				table.insert(unitsByTarget[targetFaction], unitID)
				redirected = redirected + 1
			end
		end
	end

	for targetFaction, unitIDs in pairs(unitsByTarget) do
		CreateAttackOrderDirected(unitIDs, defenderPositions[targetFaction], DEBUG)
	end

	return redirected
end

function RedirectUnitsByAttackMode(unitsIDList, defenderPositions, attackMode, DEBUG)
	if attackMode == 1 then
		if unitsIDList == nil or #unitsIDList == 0
			or defenderPositions == nil or next(defenderPositions) == nil then
			return 0
		end
		local targetFaction = GetRandomDefenderFaction(defenderPositions)
		if targetFaction == nil then
			return 0
		end
		local validUnits = {}
		for _,unitID in pairs(unitsIDList) do
			if root.scene[0].units.list[unitID] ~= nil then
				table.insert(validUnits, unitID)
			end
		end
		CreateAttackOrderDirected(validUnits, defenderPositions[targetFaction], DEBUG)
		return #validUnits
	end
	return RedirectUnitsToLivingDefenders(unitsIDList, defenderPositions, DEBUG)
end

function CreateAttackPaths(attackerSpawnpositions, defenderPositions, type, DEBUG)
	--type is used later to add different route generation methods
	local attackPaths = {}
	if attackerSpawnpositions == nil or defenderPositions == nil or next(defenderPositions) == nil then
		return attackPaths
	end
	if type == 0 then
		--Attack the nearest base
		for i = 1, #attackerSpawnpositions do
			local targetIndex = GetNearestDefenderFaction(attackerSpawnpositions[i], defenderPositions)
			if targetIndex ~= nil and defenderPositions[targetIndex] ~= nil then
				table.insert(attackPaths, {
					index = targetIndex,
					direction = RadiansToGameDirection(GetVectorAngleCounterClockwise({x = 1, y = 0}, GetVector(attackerSpawnpositions[i], defenderPositions[targetIndex])))
				})
				if DEBUG == true then
					print("-----------DEBUG_CreateAttackPaths----------------")
					print("Attacker position:",i,attackerSpawnpositions[i].x,attackerSpawnpositions[i].y)
					print("Player under attack:",targetIndex, "direction:",attackPaths[#attackPaths].direction)
					print("-----------DEBUG_CreateAttackPaths----------------")
				end
			end
		end
	elseif type == 1 then
		-- Each spawn point randomly picks a base that is still alive.
		for i = 1, #attackerSpawnpositions do
			local targetIndex = GetRandomDefenderFaction(defenderPositions)
			if targetIndex ~= nil and defenderPositions[targetIndex] ~= nil then
				table.insert(attackPaths, {
					index = targetIndex,
					direction = RadiansToGameDirection(GetVectorAngleCounterClockwise({x = 1, y = 0}, GetVector(attackerSpawnpositions[i], defenderPositions[targetIndex])))
				})
				WaveDebug("Random route: spawn point=",i,"target faction=",targetIndex)
			end
		end
	end
	return attackPaths
end
----------------------Unit operation functions----------------------
----------------------Misc functions----------------------
function SetFinalAge(finalAge, buildWonder)
	local function massOffResearchesUnavailable(research, setOff)
		local function func(facId)
			root.faction[facId].researchesUnavailable[research] = setOff
		end
		forEachControlledFaction(func)
	end
	if buildWonder == false then
		massOffResearchesUnavailable(25, true)
		massOffResearchesUnavailable(57, true)
		massOffResearchesUnavailable(58, true)
		massOffResearchesUnavailable(85, true)
		massOffResearchesUnavailable(86, true)
		massOffResearchesUnavailable(87, true)
		massOffResearchesUnavailable(88, true)
		massOffResearchesUnavailable(89, true)
	else
		massOffResearchesUnavailable(25, false)
		massOffResearchesUnavailable(57, false)
		massOffResearchesUnavailable(58, false)
		massOffResearchesUnavailable(85, false)
		massOffResearchesUnavailable(86, false)
		massOffResearchesUnavailable(87, false)
		massOffResearchesUnavailable(88, false)
		massOffResearchesUnavailable(89, false)
	end
	
	root.dataStorage.f_set("finalAge", finalAge)

	if finalAge == 0 then
		massOffResearchesUnavailable(3, true)
		massOffResearchesUnavailable(4, true)
		massOffResearchesUnavailable(90, true)
		massOffResearchesUnavailable(91, true)
	elseif finalAge == 1 then	
		massOffResearchesUnavailable(1, true)
		massOffResearchesUnavailable(2, true)

	elseif finalAge == 2 then
		massOffResearchesUnavailable(5, true)
		massOffResearchesUnavailable(6, true)
		massOffResearchesUnavailable(7, true)
		massOffResearchesUnavailable(8, true)
	elseif finalAge == 3 then
		massOffResearchesUnavailable(15, true)
		massOffResearchesUnavailable(9, true)
		massOffResearchesUnavailable(16, true)
		massOffResearchesUnavailable(17, true)
	elseif finalAge == 4 then			
		massOffResearchesUnavailable(59, true)
		massOffResearchesUnavailable(61, true)
		massOffResearchesUnavailable(62, true)
		massOffResearchesUnavailable(63, true)
		massOffResearchesUnavailable(64, true)
		massOffResearchesUnavailable(65, true)
		massOffResearchesUnavailable(66, true)
		massOffResearchesUnavailable(67, true)
		massOffResearchesUnavailable(68, true)
		massOffResearchesUnavailable(69, true)
		massOffResearchesUnavailable(70, true)
		massOffResearchesUnavailable(71, true)
		massOffResearchesUnavailable(72, true)
		massOffResearchesUnavailable(73, true)
	elseif finalAge == 5 then						
		massOffResearchesUnavailable(93, true)
		massOffResearchesUnavailable(114, true)
		massOffResearchesUnavailable(115, true)
		massOffResearchesUnavailable(116, true)
		massOffResearchesUnavailable(118, true)
		massOffResearchesUnavailable(121, true)
		massOffResearchesUnavailable(125, true)
		massOffResearchesUnavailable(126, true)
		massOffResearchesUnavailable(131, true)
		massOffResearchesUnavailable(135, true)
		massOffResearchesUnavailable(136, true)
		massOffResearchesUnavailable(145, true)
		massOffResearchesUnavailable(146, true)
	end
end
function JsonDecode(unitsJson)
	local unitsTable = {}
	local numAge = -1
	for key,age in pairs(unitsJson) do
		if key ~= "attackers" then
			unitsTable[tonumber(key)] = {}
			for k,v in pairs(age) do
				if k ~= "tierNumber" and k ~= "research" then
					unitsTable[tonumber(key)][tonumber(k)] = v
				elseif k == "tierNumber" then
					unitsTable[tonumber(key)].tierNumber = v
				elseif k == "research" then
					unitsTable[tonumber(key)].research = v
				end
			end
		end
	end
	return unitsTable
end
----------------------Misc functions----------------------
function onInit(var)
	--time in ms
	DEBUG = getParameterBool("DEBUG",false)
	-- Compatible with the camelCase parameter names from the tutorial, as well as the all-caps parameter names used by the old fixed version.
	DEFENDER_FLAG_TYPE = getParameterNumber("defenderFlagType", getParameterNumber("DEFENDER_FLAG_TYPE", 0))
	ATTACKER_FLAG_TYPE = getParameterNumber("attackerFlagType", getParameterNumber("ATTACKER_FLAG_TYPE", 2))
	AUTO_WALL_ATTACK = getParameterBool("autoWallAttack", true)
	WONDER_WIN_MIN_MOMENT = getParameterNumber("wonderWinMinMoment", getParameterNumber("minWinMoment", 0, 0, 86400), 0, 86400) * 1000
	WONDER_WIN_TIME_TO_WIN = getParameterNumber("wonderWinTimeToWin", getParameterNumber("timeToWin", 60, 0, 86400), 0, 86400) * 1000
	FIRST_WAVE_TIME = getParameterNumber("firstWaveTime",150,0,86400) * 1000
	WAVE_INTERNAL = getParameterNumber("waveInternal",60,1,86400) * 1000
	TIER_INTERNAL = getParameterNumber("tierInternal",3,1,1000)
	PLAYER_WEIGHT = getParameterNumber("playerWeight",1,0,1000) --player weight
	ATTACK_MODE = math.floor(getParameterNumber("attackMode",0,0,1) + 0.5)
	ATTACKER_FACTION_ID = FindAttackerFactionID()
	FINAL_AGE = getParameterNumber("finalAge", 6, 0, 6)
	BUILD_WONDER = getParameterBool("buildWonder",true)
	PENALTY = getParameterNumber("penalty",0.2,0,10)
	MAX_PENALTY_FACTOR = getParameterNumber("maxPenaltyFactor",3,0,1000)
	if MAX_PENALTY_FACTOR > 0 and MAX_PENALTY_FACTOR < 1 then
		MAX_PENALTY_FACTOR = 1
	end
	MAX_ATTACKER_UNITS = getParameterNumber("maxAttackerUnits",3000,0,1000000)
	MAX_UNITS_PER_WAVE = getParameterNumber("maxUnitsPerWave",800,0,1000000)
	IDLE_REDIRECT_INTERVAL = getParameterNumber("idleRedirectInterval",3,1,60) * 1000
	IDLE_REDIRECT_LIMIT = getParameterNumber("idleRedirectLimit",300,0,100000)
	REDIRECT_BATCH_SIZE = getParameterNumber("redirectBatchSize",250,1,100000)
	COMMAND_BATCH_SIZE = getParameterNumber("commandBatchSize",200,1,100000)
	WONDER_CHECK_INTERVAL = getParameterNumber("wonderCheckInterval",5,1,60) * 1000
	FACTION_SIZE = root.faction.size
	var.playerSize = root.player.size
	-- UNIT_BATCHES = fromJson(root.faction[ATTACKER_FACTION_ID].externalData)
	if DEBUG == true then
		WaveDebug("DEBUG mode enabled")
		WaveDebug("Script version=",WAVE_SCRIPT_VERSION)
		WaveDebug("Attacker faction=",ATTACKER_FACTION_ID,"Players=",var.playerSize,"Factions=",FACTION_SIZE)
		WaveDebug("First wave (ms)=",FIRST_WAVE_TIME,"Wave interval (ms)=",WAVE_INTERNAL,"Tier interval=",TIER_INTERNAL)
		WaveDebug("Attack mode=",ATTACK_MODE," (0=nearest target, 1=random target each wave)")
		WaveDebug("Final age=",FINAL_AGE,"Wonder allowed=",BUILD_WONDER,"Penalty increment=",PENALTY,"Penalty cap=",MAX_PENALTY_FACTOR)
		WaveDebug("Max attackers on field=",MAX_ATTACKER_UNITS,"Max per wave=",MAX_UNITS_PER_WAVE)
		WaveDebug("Idle check (ms)=",IDLE_REDIRECT_INTERVAL,"Idle units per pass=",IDLE_REDIRECT_LIMIT,
			"Elimination redirect batch=",REDIRECT_BATCH_SIZE,"Command batch=",COMMAND_BATCH_SIZE)
		WaveDebug("Wonder check (ms)=",WONDER_CHECK_INTERVAL,"Earliest wonder victory (ms)=",WONDER_WIN_MIN_MOMENT,
			"Wonder hold time (ms)=",WONDER_WIN_TIME_TO_WIN)
	end
	if AUTO_WALL_ATTACK == true then
		WaveDebug("Auto wall attack: enabled")
		local Wall = {211,212,213,216,217,218,221,222,223,226,227,228,182,183,185,186,187,189,184,188,214,219,224,229,198,199,215,220,225,230}
		for i=1, #Wall do
			root.unitType[Wall[i]].searchTags[10] = true
			root.unitType[Wall[i]].deathability.attackThreat = 49
		end
		-- Refresh only once after all wall modifications are done, to avoid repeated cache rebuilds during initialization.
		root.f_recreateModifiedUnitTypes()
	else
		WaveDebug("Auto wall attack: disabled")
	end
end

function onStart(var)
	ShowOpeningMessage()
	if ATTACKER_FACTION_ID == nil or ATTACKER_FACTION_ID == false then
		var.disabled = true
		print("[WaveFix] No attacker faction with attackers=true found, wave system disabled")
		return
	end
	var.disabled = false
	SetFinalAge(FINAL_AGE, BUILD_WONDER)
	ATTACKER_POSITIONS = GetAttackerSpawnPositions(ATTACKER_FACTION_ID, ATTACKER_FLAG_TYPE,DEBUG) --This can only be obtained during the onStart phase
	if ATTACKER_POSITIONS == nil or #ATTACKER_POSITIONS == 0 then
		var.disabled = true
		print("[WaveFix] No attacker spawn points found, wave system disabled")
		return
	end
	local attackerExternalData = fromJson(root.faction[ATTACKER_FACTION_ID].externalData)
	if attackerExternalData == nil then
		var.disabled = true
		print("[WaveFix] The attacker faction's external data is not valid JSON, wave system disabled")
		return
	end
	UNIT_BATCHES = JsonDecode(attackerExternalData)
	var.playerSize = root.player.size
	var.playerFactions = {}
	for playerId = 0, root.player.size - 1 do
		var.playerFactions[playerId] = GetControlledFactionOfPlayer(playerId)
	end
	var.defenderPositions = GetDefenderpositions(DEFENDER_FLAG_TYPE,DEBUG)
	var.playerAlive = 0
	for _ in pairs(var.defenderPositions) do
		var.playerAlive = var.playerAlive + 1
	end
	var.attackPaths = CreateAttackPaths(ATTACKER_POSITIONS, var.defenderPositions, ATTACK_MODE,DEBUG)
	print("[WaveFix] Initialization complete: defender bases=", var.playerAlive, ", attack routes=", #var.attackPaths)
	var.latestAge = FindLatestPlayerAge()
	var.currentTier = 1
	var.currentTierNumber = 0
	var.currentTierWave = 1 --Wave number within the current tier
	var.currentWave = 0 --Total number of waves sent
	var.lastAge = var.latestAge
	var.penaltyFactor = 1
	var.pendingRedirectUnits = nil
	var.pendingRedirectIndex = 1
	var.pendingRedirectedCount = 0
	if DEBUG == true then
		for k,v in pairs(UNIT_BATCHES) do
			WaveDebug("Unit table age=",k,"Tier count=",v.tierNumber,"Unit types=",#v)
		end
	end

	if DEBUG == true then
		print("----------onStart info----------")
		for i,v in pairs(var.defenderPositions) do
			print("defenderpositions",i,":",v.x,v.y)
		end
		for i,v in ipairs(ATTACKER_POSITIONS) do
			print("attacker positions",i,":",v.x,v.y)
		end
		for i,v in pairs(var.attackPaths) do
			print("attack paths",i,":",v.index,"direction:",v.direction)
		end
		print("----------onStart info----------")
	end
end

function ProcessPendingRedirect(var)
	if var.pendingRedirectUnits == nil then
		return
	end
	if var.playerAlive <= 0 or var.defenderPositions == nil or next(var.defenderPositions) == nil then
		var.pendingRedirectUnits = nil
		return
	end

	local firstIndex = var.pendingRedirectIndex or 1
	local lastIndex = math.min(firstIndex + REDIRECT_BATCH_SIZE - 1, #var.pendingRedirectUnits)
	local redirectBatch = {}
	for unitIndex = firstIndex, lastIndex do
		table.insert(redirectBatch, var.pendingRedirectUnits[unitIndex])
	end

	var.pendingRedirectedCount = (var.pendingRedirectedCount or 0)
		+ RedirectUnitsByAttackMode(redirectBatch, var.defenderPositions, ATTACK_MODE, false)
	var.pendingRedirectIndex = lastIndex + 1
	WaveDebug("Elimination redirect batch:", firstIndex, "-", lastIndex,
		"Total succeeded=", var.pendingRedirectedCount, "Total queued=", #var.pendingRedirectUnits)
	if var.pendingRedirectIndex > #var.pendingRedirectUnits then
		print("[WaveFix] Post-elimination batch redirect complete:", var.pendingRedirectedCount, "units")
		var.pendingRedirectUnits = nil
		var.pendingRedirectIndex = 1
		var.pendingRedirectedCount = 0
	end
end

function onTick(var, currentMoment)
	if var.disabled == true then
		return
	end

	-- When a player is eliminated, don't process every unit in the same frame; process a fixed batch each tick instead.
	ProcessPendingRedirect(var)

	local isWaveMoment = currentMoment >= FIRST_WAVE_TIME
		and (currentMoment - FIRST_WAVE_TIME) % WAVE_INTERNAL == 0
	if isWaveMoment then
		var.latestAge = FindLatestPlayerAge()
		if var.latestAge > var.lastAge then
			var.lastAge = var.latestAge
			var.currentTier = 1
			var.currentTierWave = 1
			var.penaltyFactor = 1
		end
		if ATTACK_MODE == 1 then
			-- Random mode refreshes routes every wave; nearest mode keeps the existing routes until the target is eliminated.
			var.attackPaths = CreateAttackPaths(ATTACKER_POSITIONS, var.defenderPositions, ATTACK_MODE, DEBUG)
		end

		local ageBatch = UNIT_BATCHES[var.lastAge]
		if ageBatch == nil then
			print("[WaveFix] Age", var.lastAge, "has no wave configuration, skipping this wave")
		else
			var.currentTierNumber = ageBatch.tierNumber or 1
			if var.currentTier > var.currentTierNumber then
				var.currentTier = var.currentTierNumber
			end
			var.currentWave = var.currentWave + 1

			if DEBUG == true then
				print("----------onTick info----------")
				print("current time(s):",currentMoment / 1000)
				print("latest age:",var.latestAge)
				print("current wave:",var.currentWave)
				print("current tier number:",var.currentTierNumber)
				print("current tier:",var.currentTier)
				print("current tier wave:",var.currentTierWave)
				print("penalty factor:", var.penaltyFactor)
			end

			if var.playerAlive > 0 then
				local plannedThisWave = 0
				for _,unitToBeCreated in ipairs(ageBatch) do
					local tierNumbers = unitToBeCreated.num
					local baseNumber = tierNumbers ~= nil and tierNumbers[var.currentTier] or 0
					if baseNumber > 0 then
						plannedThisWave = plannedThisWave
							+ math.floor(baseNumber * PLAYER_WEIGHT * var.playerAlive * var.penaltyFactor + 0.5)
					end
				end

				local remainingUnits = math.huge
				local attackerUnitsBeforeWave = nil
				if MAX_ATTACKER_UNITS > 0 then
					local attackerUnitsNow = FindAllMobileAttackerUnits(ATTACKER_FACTION_ID)
					attackerUnitsBeforeWave = #attackerUnitsNow
					remainingUnits = math.max(0, MAX_ATTACKER_UNITS - #attackerUnitsNow)
				end
				if MAX_UNITS_PER_WAVE > 0 then
					remainingUnits = math.min(remainingUnits, MAX_UNITS_PER_WAVE)
				end

				local createdThisWave = 0
				if MAKE_UNITS == true and remainingUnits > 0 then
					for spawnIndex,path in ipairs(var.attackPaths) do
						if remainingUnits <= 0 then break end
						-- When a safety cap is hit, leave the remaining allowance spread as evenly as possible across the spawn points not yet processed.
						local remainingSpawnPoints = #var.attackPaths - spawnIndex + 1
						local remainingAtThisSpawn = math.ceil(remainingUnits / remainingSpawnPoints)
						local unitsBeCreatedList = {}
						for _,unitToBeCreated in ipairs(ageBatch) do
							if remainingUnits <= 0 or remainingAtThisSpawn <= 0 then break end
							local tierNumbers = unitToBeCreated.num
							local baseNumber = tierNumbers ~= nil and tierNumbers[var.currentTier] or 0
							if baseNumber > 0 then
								local totalRequestedNumber = math.floor(baseNumber * PLAYER_WEIGHT * var.playerAlive * var.penaltyFactor + 0.5)
								local requestedNumber = GetSpawnUnitAllocation(totalRequestedNumber,
									spawnIndex, #var.attackPaths, var.currentWave)
								local createNumber = math.min(requestedNumber, remainingUnits, remainingAtThisSpawn)
								if createNumber > 0 then
									local createdUnits = CreatUnits(unitToBeCreated.unitTypeID, createNumber,
										ATTACKER_FACTION_ID, ATTACKER_POSITIONS[spawnIndex].x,
										ATTACKER_POSITIONS[spawnIndex].y, path.direction) or {}
									for _,unitID in pairs(createdUnits) do
										table.insert(unitsBeCreatedList, unitID)
									end
									createdThisWave = createdThisWave + #createdUnits
									remainingUnits = remainingUnits - #createdUnits
									remainingAtThisSpawn = remainingAtThisSpawn - #createdUnits
								end
							end
						end
						if var.defenderPositions[path.index] ~= nil and #unitsBeCreatedList > 0 then
							CreateAttackOrderDirected(unitsBeCreatedList, var.defenderPositions[path.index])
						end
					end
				end

				WaveDebug("Wave=",var.currentWave,"Age=",var.lastAge,"Tier=",var.currentTier,
					"Planned total=",plannedThisWave,"Actually created=",createdThisWave,
					"Attackers on field before wave=",attackerUnitsBeforeWave or "not counted","Remaining safety allowance=",remainingUnits)
				if createdThisWave < plannedThisWave then
					WaveDebug("This wave was reduced by safety caps or unit creation failures: shortfall=", plannedThisWave - createdThisWave)
				end

				if ageBatch.research ~= nil and ageBatch.research[var.currentTier] ~= nil then
					for _,techID in pairs(ageBatch.research[var.currentTier]) do
						if DEBUG == true then print("Researching tech:",techID) end
						root.faction[ATTACKER_FACTION_ID].f_researchAdd(techID)
					end
				end

				if var.currentTierWave == TIER_INTERNAL and var.currentTier < var.currentTierNumber then
					var.currentTier = var.currentTier + 1
					var.currentTierWave = 1
				elseif var.currentTierWave < TIER_INTERNAL then
					var.currentTierWave = var.currentTierWave + 1
				elseif var.currentTierWave == TIER_INTERNAL and var.currentTier == var.currentTierNumber then
					local nextPenaltyFactor = var.penaltyFactor + PENALTY
					if MAX_PENALTY_FACTOR > 0 then
						nextPenaltyFactor = math.min(nextPenaltyFactor, MAX_PENALTY_FACTOR)
					end
					var.penaltyFactor = nextPenaltyFactor
				end
			else
				print("All players are dead!")
			end
		end
	end

	-- Idle unit recovery changed from full processing every second to configurable rate-limited polling.
	if currentMoment % IDLE_REDIRECT_INTERVAL == 0
		and var.playerAlive > 0
		and var.defenderPositions ~= nil
		and next(var.defenderPositions) ~= nil then
		local idleUnits = FindIdleAttackerUnits(ATTACKER_FACTION_ID, IDLE_REDIRECT_LIMIT)
		if #idleUnits > 0 then
			local redirected = RedirectUnitsByAttackMode(idleUnits, var.defenderPositions, ATTACK_MODE, false)
			WaveDebug("Idle unit redirect: found=",#idleUnits,"redirected=",redirected)
		end
	end

	-- The wonder is a low-frequency state; reduce full-map search frequency and only write to dataStorage when the content changes.
	if currentMoment % WONDER_CHECK_INTERVAL == 0 then
		local scene = root.scene[0]
		local units = scene.units_list
		local HQs = scene.units.f_search2(0, 0, 100000000, 0xffffffffffffffff, 32)
		local bestWonder = nil
		for _, hq in ipairs(HQs) do
			local unit = units[hq]
			local modifiedType = unit ~= nil and root.unitTypeModified[unit.typeModified] or nil
			if modifiedType ~= nil and modifiedType.tags ~= nil and modifiedType.tags[9] then
				if bestWonder == nil or unit.setTypeTime < bestWonder.built then
					bestWonder = {unit = hq, faction = unit.faction, built = unit.setTypeTime}
				end
			end
		end
		if bestWonder ~= nil then
			bestWonder.finish = bestWonder.built + WONDER_WIN_TIME_TO_WIN
			if bestWonder.finish < WONDER_WIN_MIN_MOMENT then bestWonder.finish = WONDER_WIN_MIN_MOMENT end
			if currentMoment > bestWonder.finish then
				winTeam(scene.faction[bestWonder.faction].team)
			end
		end

		local wonderJson = toJson(bestWonder)
		if wonderJson ~= var.lastWonderJson then
			root.dataStorage.f_set("wonderWin", wonderJson)
			var.lastWonderJson = wonderJson
			WaveDebug("Wonder state updated:", wonderJson)
		end
	end
end
function onPlayerEliminate(var)
	if var.disabled == true then
		return
	end
	local playerId = getParameterNumber("player")
	if playerId == nil then
		print("[WaveFix] Player elimination event is missing the player parameter")
		return
	end

	local factionID = nil
	if var.playerFactions ~= nil then
		factionID = var.playerFactions[playerId]
	end
	if factionID == nil then
		factionID = GetControlledFactionOfPlayer(playerId)
	end

	if factionID ~= nil and var.defenderPositions ~= nil then
		var.defenderPositions[factionID] = nil
	end

	var.playerAlive = 0
	for _ in pairs(var.defenderPositions or {}) do
		var.playerAlive = var.playerAlive + 1
	end

	var.attackPaths = CreateAttackPaths(ATTACKER_POSITIONS, var.defenderPositions, ATTACK_MODE)

	if var.playerAlive <= 0 or var.defenderPositions == nil or next(var.defenderPositions) == nil then
		var.pendingRedirectUnits = nil
		print("[WaveFix] All defending players have been eliminated")
		return
	end

	-- Key fix: override the old commands, but execute in batches to avoid a spike from processing every unit at the moment of elimination.
	var.pendingRedirectUnits = FindAllMobileAttackerUnits(ATTACKER_FACTION_ID)
	var.pendingRedirectIndex = 1
	var.pendingRedirectedCount = 0
	local queuedUnits = #var.pendingRedirectUnits
	ProcessPendingRedirect(var)
	print("[WaveFix] Player", playerId, "faction", factionID,
		"eliminated;", var.playerAlive, "bases remaining;", queuedUnits, "units entered the redirect queue")
end

function onResearchDone(var)

end
----------------------Mod registration----------------------
addMod({
	onInit = onInit,
	onStart = onStart,
	onTick = onTick,
	onPlayerEliminate = onPlayerEliminate,
	onResearchDone = onResearchDone
})
