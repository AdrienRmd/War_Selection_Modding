-----------------------------------------------------------
-- Mod name: Diplomacy
-- Description: Diplomacy mod part 3/3: backend — faction relations, diplomacy commands, shared allied victory.
-- Author: ShiJueXiangGuan, UIXlangGuan, WaiJiaoMod
-- English translation & republication: JSuisMort
-- Status: Stable
-----------------------------------------------------------

-- Get the faction relation manager
local function rel() return root.scene[0].relation end

-- Get the faction ID controlled by the target player
function getFactionOfPlayer(playerId)
    local player = root.player[playerId]
    if player == nil then return nil end
    for fid = 0, root.faction.size - 1 do
        if player.controlledFactions[fid] then return fid end
    end
    return nil
end

-- Get the player ID controlling the target faction
function getPlayerOfFaction(factionId)
    for pid = 0, root.player.size - 1 do
        local player = root.player[pid]
        if player ~= nil and player.controlledFactions[factionId] then return pid end
    end
    return nil
end

-- Set up bidirectional faction relation
local function setRelation(fa, fb, value)
    rel().f_set(fa, fb, value)
    rel().f_set(fb, fa, value)
end

-- Set ally state
function setAlly(fa, fb)    setRelation(fa, fb, 1) end

-- Set war state
function declareWar(fa, fb) setRelation(fa, fb, 2) end

-- Set peace state
function Peace(fa, fb)      setRelation(fa, fb, 3) end

-- Resource payment interface
function Pay(player, player1) end

-- Handle backend diplomacy command
function ServerDiplomacyHandler(var)
    if getParameter("command") == "Diplomacy" then
        local f1 = tonumber(getParameter("player1"))
        local f2 = tonumber(getParameter("player2"))
        local action = tonumber(getParameter("action"))
        if action == 1 then setAlly(f1, f2)
        elseif action == 2 then Peace(f1, f2)
        elseif action == 3 then declareWar(f1, f2)
        elseif action == 4 then Pay(f1, f2) end
    end
end

-- Check current diplomatic status of two factions
function checkStatus(fa, fb)
    local status = rel().f_get(fa, fb)
    if status == 1 then return "Ally"
    elseif status == 2 then return "War"
    elseif status == 3 then return "Peace" end
end

-- Check the all-allied victory condition
function winControlDiplomacy(var, currentMoment)
    if currentMoment % 1000 == 0 then
        local players = root.player
        local Lives = {}
        for i = 0, players.size - 1 do
            local player = players[i]
            if not player.eliminated then table.insert(Lives, getFactionOfPlayer(i)) end
        end
        if #Lives <= 1 then return end
        for i = 1, #Lives do
            for j = 1, #Lives do
                if checkStatus(Lives[i], Lives[j]) ~= "Ally" and i ~= j then return end
            end
        end
        for i = 1, #Lives do
            root.f_eliminatePlayer(getPlayerOfFaction(Lives[i]), 1)
        end
        root.f_playerSpecialCommand(0, "command", "finish")
    end
end

addMod({ onSpecialCommand = ServerDiplomacyHandler, onTick = winControlDiplomacy })