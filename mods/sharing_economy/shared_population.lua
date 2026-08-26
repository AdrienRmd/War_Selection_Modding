-----------------------------------------------------------
-- Mod name: Team shared population
-- Description: Shares the population (supply) limit across allied factions (same team): every faction sees the team's total supply. Panel setting keepLimit (default off) keeps an eliminated player's contribution to the team limit.
-- Author: AdrienRmd (fixed version of the original mod wu9w4OL2oV9)
-- Status: WIP
-----------------------------------------------------------
-- The engine has no API to transfer supply between factions, so the mod spawns
-- invisible anchor units (copies of unit type 274, viewRange 0, selection tags
-- off) at map corner (0,0): a consumer anchor takes SUPPLY_PER_ANCHOR supply
-- from its faction, a provider anchor gives it back. Each tick the mod compares
-- every live faction's supply to the team total and creates/removes anchors in
-- steps of SUPPLY_PER_ANCHOR, keeping the remainder for the next tick.

local SUPPLY_PER_ANCHOR = 10

function onInit(var)
    var.keepLimit = getParameterBool("keepLimit", false)
end

function onStart(var)
    local factions = root.scene[0].faction

    -- Group every faction by team
    local teams = {}
    for i = 0, factions.size - 1 do
        local fac = factions[i]
        if fac ~= nil then
            local teamId = fac.team
            if teams[teamId] == nil then
                teams[teamId] = {
                    playerFactions = {},
                    supply = { limitMax = 0, limitByUnits = 0, current = 0 }
                }
            end
            teams[teamId].playerFactions[i] = {
                player = -1,
                providerAnchors = {},
                consumerAnchors = {},
                ownSupply = { limitMax = 0, limitByUnits = 0, current = 0 }
            }
        end
    end

    -- Match each faction to its controlling player
    -- (fixed: must check controlledFactions, otherwise the last alive player
    --  gets assigned to every faction and elimination handling breaks)
    for i = 0, root.player.size - 1 do
        local player = root.player[i]
        if player ~= nil and not player.eliminated then
            for fid = 0, factions.size - 1 do
                if factions[fid] ~= nil and player.controlledFactions[fid] then
                    local teamId = factions[fid].team
                    if teams[teamId] ~= nil and teams[teamId].playerFactions[fid] ~= nil then
                        teams[teamId].playerFactions[fid].player = i
                    end
                end
            end
        end
    end

    local anchors = createSupplyAnchorTypes()

    var.teams = teams
    var.providerAnchor = anchors.providerAnchor
    var.consumerAnchor = anchors.consumerAnchor
    print("[SupplyShare] initialized")
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
    for factionId, entry in pairs(team.playerFactions) do
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
    local playerId = getParameterNumber("player")
    if playerId == nil then return end
    print(string.format("[SupplyShare] onPlayerEliminate: player %s", tostring(playerId)))

    for _, team in pairs(var.teams) do
        for _, entry in pairs(team.playerFactions) do
            if playerId == entry.player then
                -- Release the dead faction's anchors (its supply reverts to raw,
                -- harmless once dead; frees the corner units either way)
                removeUnits(entry.consumerAnchors)
                removeUnits(entry.providerAnchors)
                entry.consumerAnchors = {}
                entry.providerAnchors = {}

                if not var.keepLimit then
                    local teamSupply = team.supply
                    local ownSupply = entry.ownSupply
                    teamSupply.limitMax = teamSupply.limitMax - ownSupply.limitMax
                    teamSupply.limitByUnits = teamSupply.limitByUnits - ownSupply.limitByUnits
                    teamSupply.current = teamSupply.current - ownSupply.current
                end
            end
        end
        updateTeamFactionSupply(team, var.providerAnchor, var.consumerAnchor)
    end
end

addMod({ onInit = onInit, onStart = onStart, onTick = onTick, onPlayerEliminate = onPlayerEliminate })
