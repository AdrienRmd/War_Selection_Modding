-- ============================================================================
-- General Winter v6 - Gameplay
--
-- In-game mod parameters (in normal mode the unit = minutes; with DEBUG=true, seconds):
--   DEBUG             boolean, default false
--   gameplayEffects   boolean, default true; when false, only messages/visuals play, units are not rebuilt
--   firstWinterTime   number, default 30; start time of the first blizzard
--   winterDuration    number, default 10; duration of each round
--   winterInterval    number, default 20; interval between the starts of two rounds
--   winterRounds      number, default 3; number of blizzard rounds
--   warningTime       number, default 5; advance warning time
--
-- Default official times: 25/30/40, 45/50/60, 65/70/80 minutes (warning/start/end).
-- Default DEBUG times: 25/30/40, 45/50/60, 65/70/80 seconds.
-- ============================================================================

-- Gameplay cannot set up an independent timed callback directly, so a dedicated command
-- is echoed back through the Visual mod, moving the unit template rebuild off the onTick
-- call stack. No sacrificial units are created at any point, and no player chat is involved.
local BRIDGE_KEY     = "stalingrad_winter_v6"
local BRIDGE_REQUEST = "stalingrad_winter_bridge_request"
local BRIDGE_ACK     = "stalingrad_winter_bridge_ack"

local INFANTRY_SPEED_PCT = 70
local TANK_SPEED_PCT     = 50
local VIEW_PCT           = 50
local AIR_VIEW_PCT       = 30

local function say(msg)
    root.f_playerSpecialCommand(0, "command", "chat",
        "text", msg, "destination", "all", "font", "SIMHEI")
end

local function debugLog(var, msg)
    if var.config ~= nil and var.config.debug then
        print("[GeneralWinter/DEBUG] " .. msg)
    end
end

local function loadConfig(var)
    local debugMode = getParameterBool("DEBUG", false)
    local unitMs = debugMode and 1000 or 60000

    local first = getParameterNumber("firstWinterTime", 30, 0, 1440)
    local duration = getParameterNumber("winterDuration", 10, 1, 1440)
    local interval = getParameterNumber("winterInterval", 20, 1, 1440)
    local roundCount = math.floor(getParameterNumber("winterRounds", 3, 1, 20))
    local warning = getParameterNumber("warningTime", 5, 0, 1440)

    if interval < duration then interval = duration end

    var.config = {
        debug = debugMode,
        effects = getParameterBool("gameplayEffects", true),
        unitName = debugMode and " seconds" or " minutes",
        nudgePeriod = debugMode and 1000 or 5000,
        warningValue = warning,
        rounds = {},
    }

    for i = 1, roundCount do
        local startAt = (first + (i - 1) * interval) * unitMs
        var.config.rounds[i] = {
            warn = math.max(0, startAt - warning * unitMs),
            start = startAt,
            stop = startAt + duration * unitMs,
        }
    end

    print("[GeneralWinter] Parameters: DEBUG=" .. tostring(debugMode)
        .. ", stat effects=" .. tostring(var.config.effects)
        .. ", first round=" .. first .. var.config.unitName
        .. ", duration=" .. duration .. var.config.unitName
        .. ", interval=" .. interval .. var.config.unitName
        .. ", rounds=" .. roundCount)
end

local function resetState(var)
    loadConfig(var)
    var.round = 1
    var.warned = false
    var.active = false
    var.pendingApply = false
    var.pendingRevert = false
    var.saved = nil
    var.nudgeAt = nil
    var.bridgeToken = 0
    var.bridgeAction = nil
    var.inTick = false
end

local function ensureState(var)
    if var.config == nil then loadConfig(var) end
    if var.round == nil then var.round = 1 end
    if var.warned == nil then var.warned = false end
    if var.active == nil then var.active = false end
    if var.pendingApply == nil then var.pendingApply = false end
    if var.pendingRevert == nil then var.pendingRevert = false end
    if var.bridgeToken == nil then var.bridgeToken = 0 end
    if var.inTick == nil then var.inTick = false end
end

local function sendBridgeTrigger(var)
    if var.bridgeAction == nil then return end
    root.f_playerSpecialCommand(0,
        "command", BRIDGE_REQUEST,
        "winterBridge", BRIDGE_KEY,
        "action", var.bridgeAction,
        "token", var.bridgeToken)
    debugLog(var, "Safe trigger sent to Visual: action="
        .. tostring(var.bridgeAction) .. ", token=" .. tostring(var.bridgeToken))
end

local function applyWinter(var)
    if not var.config.effects then
        var.active = true
        var.pendingApply = false
        say("The blizzard has arrived! Winter stat effects are disabled this game; only atmosphere effects remain.")
        debugLog(var, "Visual mode: start")
        return
    end

    if var.saved == nil then var.saved = {} end
    local ut = root.unitType

    local affected = 0
    local airCount = 0
    local vehicleCount = 0

    -- Dynamically iterate over all unit types; heroes and vehicles cloned later by other mods are included too.
    for id = 0, ut.size - 1 do
        pcall(function()
            local u = ut[id]
            local mv = u.movement
            local moveSpeed = tonumber(mv.moveSpeed) or 0
            local agroSpeed = tonumber(mv.moveAgroSpeed) or 0

            -- Skip buildings, environmental objects, and truly immobile units.
            if moveSpeed <= 0 and agroSpeed <= 0 then return end

            if var.saved[id] == nil then
                var.saved[id] = {moveSpeed, agroSpeed, u.viewRange}
            end

            local isAir = false
            local isVehicle = false
            pcall(function() isAir = u.tags[14] == true end)
            pcall(function() isVehicle = u.tags[13] == true end)
            pcall(function()
                if mv.airplane.fuel ~= nil and mv.airplane.fuel > 0 then
                    isAir = true
                end
            end)

            if isAir then
                -- Planes only get reduced vision, to prevent slow planes from failing to circle or fly home.
                u.viewRange = math.floor(var.saved[id][3] * AIR_VIEW_PCT / 100)
                airCount = airCount + 1
            else
                local speedPct = isVehicle and TANK_SPEED_PCT or INFANTRY_SPEED_PCT
                mv.moveSpeed = math.floor(var.saved[id][1] * speedPct / 100)
                mv.moveAgroSpeed = math.floor(var.saved[id][2] * speedPct / 100)
                u.viewRange = math.floor(var.saved[id][3] * VIEW_PCT / 100)
                if isVehicle then vehicleCount = vehicleCount + 1 end
            end

            affected = affected + 1
        end)
    end

    debugLog(var, "Dynamically processed unit types=" .. affected
        .. ", of which air=" .. airCount .. ", mechanical/naval=" .. vehicleCount)

    local ok = pcall(function() root.f_recreateModifiedUnitTypes() end)
    if ok then
        var.active = true
        var.pendingApply = false
        say("The blizzard has arrived! Soldiers can barely move, armor is frozen solid, and dark clouds fill the sky!")
        debugLog(var, "Stat effects applied successfully")
    else
        var.pendingApply = true
        print("[GeneralWinter] Failed to apply stat effects, will wait for the next safe trigger")
    end
end

local function revertWinter(var)
    if not var.config.effects then
        var.active = false
        var.pendingRevert = false
        say("The blizzard is over.")
        debugLog(var, "Visual mode: end")
        return
    end

    if var.saved == nil then
        var.active = false
        var.pendingRevert = false
        return
    end

    local ut = root.unitType
    for id, values in pairs(var.saved) do
        pcall(function()
            local u = ut[id]
            u.movement.moveSpeed = values[1]
            u.movement.moveAgroSpeed = values[2]
            u.viewRange = values[3]
        end)
    end

    local ok = pcall(function() root.f_recreateModifiedUnitTypes() end)
    if ok then
        var.active = false
        var.pendingRevert = false
        say("The blizzard is over; the troops regain their mobility.")
        debugLog(var, "Stats restored successfully")
    else
        var.pendingRevert = true
        print("[GeneralWinter] Failed to restore stats, will wait for the next safe trigger")
    end
end

local function processPending(var)
    ensureState(var)
    if var.inTick then
        debugLog(var, "Blocked a unit rebuild inside the onTick stack")
        return
    end

    if var.pendingRevert then
        revertWinter(var)
    elseif var.pendingApply then
        applyWinter(var)
    end
end

local function requestApply(var, time)
    var.pendingRevert = false
    var.pendingApply = true
    var.bridgeToken = var.bridgeToken + 1
    var.bridgeAction = "apply"
    var.nudgeAt = time
    say("A cold wind suddenly rises; a blizzard is closing in on the battlefield...")
    debugLog(var, "Round " .. var.round .. " apply requested, time=" .. time)
    if not var.config.effects then applyWinter(var) end
end

local function requestRevert(var, time)
    var.pendingApply = false
    if not var.active then return end
    var.pendingRevert = true
    var.bridgeToken = var.bridgeToken + 1
    var.bridgeAction = "revert"
    var.nudgeAt = time
    debugLog(var, "Round " .. var.round .. " revert requested, time=" .. time)
    if not var.config.effects then revertWinter(var) end
end

local function onInit(var)
    resetState(var)
end

local function onDumpStart(var)
    ensureState(var)
    debugLog(var, "Restoring state from a save/reconnect")
end

local function onTick(var, time)
    ensureState(var)
    var.inTick = true

    local rounds = var.config.rounds
    local current = rounds[var.round]

    while current ~= nil and time >= current.stop do
        requestRevert(var, time)
        var.round = var.round + 1
        var.warned = false
        current = rounds[var.round]
    end

    if current ~= nil then
        if not var.warned and time >= current.warn and time < current.start then
            var.warned = true
            say("A blizzard will sweep over Stalingrad in "
                .. var.config.warningValue .. var.config.unitName .. "!")
            debugLog(var, "Round " .. var.round .. " warning, time=" .. time)
        end

        if time >= current.start and time < current.stop
            and not var.active and not var.pendingApply then
            requestApply(var, time)
        end
    end

    if (var.pendingApply or var.pendingRevert)
        and var.nudgeAt ~= nil and time >= var.nudgeAt then
        var.nudgeAt = time + var.config.nudgePeriod
        sendBridgeTrigger(var)
    end

    var.inTick = false
end

local function onSpecialCommand(var)
    local ok, command, bridge, action, token = pcall(function()
        return getParameter("command"), getParameter("winterBridge"),
            getParameter("action"), tonumber(getParameter("token"))
    end)
    if not ok or command ~= BRIDGE_ACK or bridge ~= BRIDGE_KEY then return end

    ensureState(var)
    if token ~= var.bridgeToken or action ~= var.bridgeAction then
        debugLog(var, "Ignoring a stale Visual callback")
        return
    end

    processPending(var)
end

addMod({
    onInit = onInit,
    onDumpStart = onDumpStart,
    onTick = onTick,
    onSpecialCommand = onSpecialCommand,
})
