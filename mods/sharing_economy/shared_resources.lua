-- ============================================================================
-- 队伍共享资源 mod
-- 资源：0=肉, 1=木, 2=铁（变化量同步）
-- 只处理有存活玩家的 faction
-- ============================================================================

function onStart(var)
    local scene = root.scene[0]
    local factions = scene.faction

    -- 找有存活玩家的 faction
    local playerFactions = {}
    for i = 0, root.player.size - 1 do
        local player = root.player[i]
        if player ~= nil and not player.eliminated then
            -- 通过 controlledFactions 找对应 faction
            for fid = 0, factions.size - 1 do
                local fac = factions[fid]
                if fac ~= nil then
                    -- 用 team 和 player index 匹配
                    -- controlledFactions 是 Tags，active tag 对应 faction id
                    if player.controlledFactions[fid] then
                        playerFactions[fid] = i
                    end
                end
            end
        end
    end

    -- 按 team 分组，只用有玩家的 faction
    local teams = {}
    for fid, pid in pairs(playerFactions) do
        local teamId = factions[fid].team
        if teams[teamId] == nil then
            teams[teamId] = {}
        end
        teams[teamId][#teams[teamId]+1] = fid
    end

    -- 记录初始资源
    local prevRes = {}
    for _, facIds in pairs(teams) do
        for _, fid in ipairs(facIds) do
            local res = factions[fid].treasury.resources
            prevRes[fid] = {}
            prevRes[fid][0] = res[0]
            prevRes[fid][1] = res[1]
            prevRes[fid][2] = res[2]
        end
    end

    var.teams = teams
    var.prevRes = prevRes
    print("[ResourceShare] 初始化完成")
    for teamId, facIds in pairs(teams) do
        print("[ResourceShare] team " .. teamId .. " factions: " .. #facIds)
    end
end

function onTick(var, currentMoment)
    if currentMoment % 1000 ~= 0 then return end

    local scene = root.scene[0]
    local factions = scene.faction
    local teams = var.teams
    local prevRes = var.prevRes

    for teamId, facIds in pairs(teams) do
        if #facIds >= 2 then
            local baseFid = facIds[1]
            local baseRes = factions[baseFid].treasury.resources
            local pool = {}
            pool[0] = baseRes[0]
            pool[1] = baseRes[1]
            pool[2] = baseRes[2]

            for j = 2, #facIds do
                local fid = facIds[j]
                local res = factions[fid].treasury.resources
                local prev = prevRes[fid]
                if prev ~= nil then
                    for i = 0, 2 do
                        local diff = res[i] - prev[i]
                        if diff ~= 0 then
                            pool[i] = pool[i] + diff
                        end
                    end
                end
            end

            for i = 0, 2 do
                pool[i] = math.max(0, pool[i])
            end

            for _, fid in ipairs(facIds) do
                local res = factions[fid].treasury.resources
                res[0] = pool[0]
                res[1] = pool[1]
                res[2] = pool[2]
                prevRes[fid][0] = pool[0]
                prevRes[fid][1] = pool[1]
                prevRes[fid][2] = pool[2]
            end
        end
    end
end

addMod({ onStart = onStart, onTick = onTick })