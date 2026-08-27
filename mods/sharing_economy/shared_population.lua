-- ============================================================================
-- 队伍共享人口 mod (修复版)
-- 基于原版 wu9w4OL2oV9，修复废弃 API
-- 参数: keepLimit (布尔, 默认 false) 玩家淘汰后是否保留其贡献的人口上限
-- ============================================================================

SUPPLY_PER_ANCHOR = 10

function onInit(var)
    var.keepLimit = getParameterBool("keepLimit", false)
end

function onStart(var)
    local scene = root.scene[0]
    local factions = scene.faction

    -- 建立队伍分组
    local teams = {}
    for i = 0, factions.size - 1 do
        local fac = factions[i]
        if fac ~= nil then
            local teamId = fac.team
            if teams[teamId] == nil then
                teams[teamId] = {
                    palyerFactions = {},
                    supply = { limitMax = 0, limitByUnits = 0, current = 0 }
                }
            end
            teams[teamId].palyerFactions[i] = {
                player = -1,
                providerAnchors = {},
                consumerAnchors = {},
                ownSupply = { limitMax = 0, limitByUnits = 0, current = 0 }
            }
        end
    end

    -- 找每个 faction 对应的 player
    for i = 0, root.player.size - 1 do
        local player = root.player[i]
        if player ~= nil and not player.eliminated then
            for fid = 0, factions.size - 1 do
                local fac = factions[fid]
                if fac ~= nil then
                    local teamId = fac.team
                    if teams[teamId] ~= nil and teams[teamId].palyerFactions[fid] ~= nil then
                        teams[teamId].palyerFactions[fid].player = i
                    end
                end
            end
        end
    end

    -- 创建锚点单位类型
    local anchors = createSupplyAnchorTypes()

    var.teams = teams
    var.providerAnchor = anchors.providerAnchor
    var.consumerAnchor = anchors.consumerAnchor
    print("[SupplyShare] 初始化完成")
end

function createSupplyAnchorTypes()
    local unitTypes = root.unitType

    local providerAnchorId = unitTypes.f_create()
    unitTypes.f_copy(274, providerAnchorId)
    local providerAnchor = unitTypes[providerAnchorId]
    providerAnchor.viewRange = 0
    providerAnchor.supply.enabled = true
    providerAnchor.tags[15] = false
    providerAnchor.tags[0] = false
    providerAnchor.supply.takes = SUPPLY_PER_ANCHOR

    local consumerAnchorId = unitTypes.f_create()
    unitTypes.f_copy(274, consumerAnchorId)
    local consumerAnchor = unitTypes[consumerAnchorId]
    consumerAnchor.viewRange = 0
    consumerAnchor.supply.enabled = true
    consumerAnchor.tags[15] = false
    consumerAnchor.tags[0] = false
    consumerAnchor.supply.cost = SUPPLY_PER_ANCHOR

    root.f_recreateModifiedUnitTypes()

    return { providerAnchor = providerAnchorId, consumerAnchor = consumerAnchorId }
end

function addToList(target, additional)
    if additional ~= nil then
        for _, v in ipairs(additional) do
            target[#target+1] = v
        end
    end
end

function takeFromList(target, number)
    local removed = {}
    for _ = 1, number do
        if #target > 0 then
            table.insert(removed, table.remove(target, 1))
        end
    end
    return removed
end

function removeUnits(ids)
    local units = root.scene[0].units
    for _, id in ipairs(ids) do
        local unit = units.list[id]
        if unit ~= nil then
            units.f_remove(id, unit.instanceId)
        end
    end
end

function forEachLivePlayerSupplyOfTeam(team, func)
    local players = root.player
    local factions = root.scene[0].faction
    for factionId, entry in pairs(team.palyerFactions) do
        local playerId = entry.player
        if playerId >= 0 and not players[playerId].eliminated then
            local factionSupply = factions[factionId].supply
            func(factionSupply, factionId, entry)
        end
    end
end

function updateTeamFactionSupply(team, providerAnchor, consumerAnchor)
    local teamSupply = team.supply
    local function updateFactionSupply(factionSupply, factionId, factionData)
        factionSupply.limitMax = teamSupply.limitMax

        local diffCurrent = teamSupply.current - factionSupply.sum
        local diffUnitsLimit = teamSupply.limitByUnits - factionSupply.limitByUnits
        local currNum = math.floor(math.abs(diffCurrent) / SUPPLY_PER_ANCHOR)
        local limitNum = math.floor(math.abs(diffUnitsLimit) / SUPPLY_PER_ANCHOR)

        if diffCurrent > 0 then
            local created = root.scene[0].units.f_create(consumerAnchor, currNum, factionId, 0, 0, 0)
            addToList(factionData.consumerAnchors, created)
        elseif diffCurrent < 0 then
            local toRemove = takeFromList(factionData.consumerAnchors, currNum)
            removeUnits(toRemove)
        end

        if diffUnitsLimit > 0 then
            local created = root.scene[0].units.f_create(providerAnchor, limitNum, factionId, 0, 0, 0)
            addToList(factionData.providerAnchors, created)
        elseif diffUnitsLimit < 0 then
            local toRemove = takeFromList(factionData.providerAnchors, limitNum)
            removeUnits(toRemove)
        end
    end
    forEachLivePlayerSupplyOfTeam(team, updateFactionSupply)
end

function onTick(var, currentMoment)
    local teams = var.teams
    for _, team in pairs(teams) do
        local teamSupply = team.supply

        local diffTable = { limitMax = 0, limitByUnits = 0, current = 0 }
        local function updateDiffTable(factionSupply, _, factionData)
            local factionDiffLimitMax = factionSupply.limitMax - teamSupply.limitMax
            local factionDiffLimitByUnits = factionSupply.limitByUnits - teamSupply.limitByUnits
            local factionDiffSum = factionSupply.sum - teamSupply.current

            diffTable.limitMax = diffTable.limitMax + factionDiffLimitMax
            diffTable.limitByUnits = diffTable.limitByUnits + factionDiffLimitByUnits
            diffTable.current = diffTable.current + factionDiffSum

            factionData.ownSupply.limitMax = factionData.ownSupply.limitMax + factionDiffLimitMax
            factionData.ownSupply.limitByUnits = factionData.ownSupply.limitByUnits + factionDiffLimitByUnits
            factionData.ownSupply.current = factionData.ownSupply.current + factionDiffSum
        end
        forEachLivePlayerSupplyOfTeam(team, updateDiffTable)

        teamSupply.limitMax = teamSupply.limitMax + diffTable.limitMax
        teamSupply.limitByUnits = teamSupply.limitByUnits + diffTable.limitByUnits
        teamSupply.current = teamSupply.current + diffTable.current

        updateTeamFactionSupply(team, var.providerAnchor, var.consumerAnchor)
    end
end

function onPlayerEliminate(var)
    if not var.keepLimit then
        local teams = var.teams
        local playerId = getParameterNumber("player")
        for _, team in pairs(teams) do
            for _, entry in pairs(team.palyerFactions) do
                if playerId == entry.player then
                    local teamSupply = team.supply
                    local ownSupply = entry.ownSupply
                    teamSupply.limitMax = teamSupply.limitMax - ownSupply.limitMax
                    teamSupply.limitByUnits = teamSupply.limitByUnits - ownSupply.limitByUnits
                    teamSupply.current = teamSupply.current - ownSupply.current
                end
            end
            updateTeamFactionSupply(team, var.providerAnchor, var.consumerAnchor)
        end
    end
end

addMod({ onInit = onInit, onStart = onStart, onTick = onTick, onPlayerEliminate = onPlayerEliminate })