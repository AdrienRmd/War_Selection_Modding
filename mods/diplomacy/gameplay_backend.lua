-- 获取阵营关系管理器
local function rel() return root.scene[0].relation end

-- 获取目标玩家控制的阵营ID
function getFactionOfPlayer(playerId)
    local player = root.player[playerId]
    if player == nil then return nil end
    for fid = 0, root.faction.size - 1 do
        if player.controlledFactions[fid] then return fid end
    end
    return nil
end

-- 获取控制目标阵营的玩家ID
function getPlayerOfFaction(factionId)
    for pid = 0, root.player.size - 1 do
        local player = root.player[pid]
        if player ~= nil and player.controlledFactions[factionId] then return pid end
    end
    return nil
end

-- 建立双向阵营关系
local function setRelation(fa, fb, value)
    rel().f_set(fa, fb, value)
    rel().f_set(fb, fa, value)
end

-- 设置同盟状态
function setAlly(fa, fb)    setRelation(fa, fb, 1) end

-- 设置战争状态
function declareWar(fa, fb) setRelation(fa, fb, 2) end

-- 设置和平状态
function Peace(fa, fb)      setRelation(fa, fb, 3) end

-- 资源支付接口
function Pay(player, player1) end

-- 处理后端外交指令
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

-- 检查两阵营当前外交状态
function checkStatus(fa, fb)
    local status = rel().f_get(fa, fb)
    if status == 1 then return "Ally"
    elseif status == 2 then return "War"
    elseif status == 3 then return "Peace" end
end

-- 判定全员同盟胜利条件
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