-----------------------------------------------------------
-- Mod name: Team shared resources
-- Description: Pools the treasury of allied factions (same team): income and spending are synced across the team every second, for all five resources. An eliminated player's faction leaves the pool.
-- Author: AdrienRmd
-- Status: WIP
-----------------------------------------------------------
-- Resources: 0 = food, 1 = wood, 2 = iron, 3 = gold, 4 = oil
-- Delta sync, once per second (moment % 1000 == 0): each faction's change
-- since the last snapshot is added to the pool, then every faction is set
-- to the pooled value and snapshots are refreshed -- no double counting.

local RESOURCE_MAX = 4 -- share resources 0..4

local function buildTeams()
    local factions = root.scene[0].faction
    local playerFactions = {}

    -- Only factions controlled by a live player
    for i = 0, root.player.size - 1 do
        local player = root.player[i]
        if player ~= nil and not player.eliminated then
            for fid = 0, factions.size - 1 do
                if factions[fid] ~= nil and player.controlledFactions[fid] then
                    playerFactions[fid] = true
                end
            end
        end
    end

    -- Group those factions by team
    local teams = {}
    for fid in pairs(playerFactions) do
        local teamId = factions[fid].team
        if teams[teamId] == nil then
            teams[teamId] = {}
        end
        teams[teamId][#teams[teamId] + 1] = fid
    end
    return teams
end

function onStart(var)
    var.teams = buildTeams()
    var.prevRes = {}

    for _, facIds in pairs(var.teams) do
        for _, fid in ipairs(facIds) do
            local res = root.scene[0].faction[fid].treasury.resources
            var.prevRes[fid] = {}
            for i = 0, RESOURCE_MAX do
                var.prevRes[fid][i] = res[i]
            end
        end
    end

    print("[ResourceShare] initialized")
    for teamId, facIds in pairs(var.teams) do
        print(string.format("[ResourceShare] team %s: %d faction(s)", tostring(teamId), #facIds))
    end
end

function onTick(var, currentMoment)
    if currentMoment % 1000 ~= 0 then return end -- once per second

    local factions = root.scene[0].faction

    for _, facIds in pairs(var.teams) do
        if #facIds >= 2 then
            -- Pool = first faction's current values + every other faction's delta
            local pool = {}
            local baseRes = factions[facIds[1]].treasury.resources
            for i = 0, RESOURCE_MAX do
                pool[i] = baseRes[i]
            end

            for j = 2, #facIds do
                local fid = facIds[j]
                local prev = var.prevRes[fid]
                if prev ~= nil then
                    local res = factions[fid].treasury.resources
                    for i = 0, RESOURCE_MAX do
                        pool[i] = pool[i] + (res[i] - prev[i])
                    end
                end
            end

            for i = 0, RESOURCE_MAX do
                pool[i] = math.max(0, pool[i]) -- never negative
            end

            -- Apply the pool to every faction and refresh snapshots
            for _, fid in ipairs(facIds) do
                local res = factions[fid].treasury.resources
                for i = 0, RESOURCE_MAX do
                    res[i] = pool[i]
                    var.prevRes[fid][i] = pool[i]
                end
            end
        end
    end
end

function onPlayerEliminate(var)
    local eliminatedId = getParameterNumber("player")
    if eliminatedId == nil then return end
    local player = root.player[eliminatedId]
    if player == nil then return end
    print(string.format("[ResourceShare] onPlayerEliminate: player %s", tostring(eliminatedId)))

    for teamId, facIds in pairs(var.teams) do
        local kept = {}
        for _, fid in ipairs(facIds) do
            if player.controlledFactions[fid] then
                print(string.format("[ResourceShare] faction %d left team %s (player %d eliminated)",
                    fid, tostring(teamId), eliminatedId))
            else
                kept[#kept + 1] = fid
            end
        end
        var.teams[teamId] = (#kept >= 2) and kept or nil
    end
end

addMod({ onStart = onStart, onTick = onTick, onPlayerEliminate = onPlayerEliminate })
