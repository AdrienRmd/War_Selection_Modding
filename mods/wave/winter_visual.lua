-- ============================================================================
-- General Winter v6 - Visual
--
-- Add the same parameters to the Visual mod as to the Gameplay mod:
--   DEBUG / firstWinterTime / winterDuration / winterInterval / winterRounds
-- In normal mode the time unit is minutes; with DEBUG=true, seconds.
-- ============================================================================

local FADE_MS = 5000
local BRIDGE_KEY     = "stalingrad_winter_v6"
local BRIDGE_REQUEST = "stalingrad_winter_bridge_request"
local BRIDGE_ACK     = "stalingrad_winter_bridge_ack"

local COLD = {
    lr = 2.8, lg = 3.8, lb = 6.0,
    dr = 0.16, dg = 0.22, db = 0.40,
}

local function loadConfig(var)
    local debugMode = getParameterBool("DEBUG", false)
    local unitMs = debugMode and 1000 or 60000
    local first = getParameterNumber("firstWinterTime", 30, 0, 1440)
    local duration = getParameterNumber("winterDuration", 10, 1, 1440)
    local interval = getParameterNumber("winterInterval", 20, 1, 1440)
    local roundCount = math.floor(getParameterNumber("winterRounds", 3, 1, 20))

    if interval < duration then interval = duration end

    var.config = {debug = debugMode, rounds = {}}
    for i = 1, roundCount do
        local startAt = (first + (i - 1) * interval) * unitMs
        var.config.rounds[i] = {
            start = startAt,
            stop = startAt + duration * unitMs,
        }
    end

    print("[GeneralWinter/Visual] Parameters: DEBUG=" .. tostring(debugMode)
        .. ", first round=" .. first .. (debugMode and " seconds" or " minutes")
        .. ", duration=" .. duration .. (debugMode and " seconds" or " minutes")
        .. ", interval=" .. interval .. (debugMode and " seconds" or " minutes")
        .. ", rounds=" .. roundCount)
end

local function ensureState(var)
    if var.config == nil then loadConfig(var) end
    if var.lastPct == nil then var.lastPct = -1 end
    if var.lastRound == nil then var.lastRound = 0 end
end

local function captureOriginal(var)
    if var.orig ~= nil then return true end
    local ok = pcall(function()
        local light = root.session_visual_scene[0].light
        var.orig = {
            lr = light.lightColor.r, lg = light.lightColor.g, lb = light.lightColor.b,
            dr = light.darkColor.r, dg = light.darkColor.g, db = light.darkColor.b,
        }
    end)
    return ok
end

local function setLight(original, pct)
    pcall(function()
        local light = root.session_visual_scene[0].light
        light.lightColor.r = original.lr + (COLD.lr - original.lr) * pct
        light.lightColor.g = original.lg + (COLD.lg - original.lg) * pct
        light.lightColor.b = original.lb + (COLD.lb - original.lb) * pct
        light.darkColor.r = original.dr + (COLD.dr - original.dr) * pct
        light.darkColor.g = original.dg + (COLD.dg - original.dg) * pct
        light.darkColor.b = original.db + (COLD.db - original.db) * pct
    end)
end

local function winterPct(rounds, time)
    local pct = 0
    local activeRound = 0

    for i, round in ipairs(rounds) do
        local value = 0
        if time >= round.start and time < round.start + FADE_MS then
            value = (time - round.start) / FADE_MS
        elseif time >= round.start + FADE_MS and time < round.stop then
            value = 1
        elseif time >= round.stop and time < round.stop + FADE_MS then
            value = 1 - (time - round.stop) / FADE_MS
        end

        if value > pct then
            pct = value
            activeRound = i
        end
    end

    if pct < 0 then pct = 0 end
    if pct > 1 then pct = 1 end
    return pct, activeRound
end

local function onInit(var)
    loadConfig(var)
    var.orig = nil
    var.lastPct = -1
    var.lastRound = 0
    var.pendingBridgeAck = nil
end

local function onDumpStart(var)
    ensureState(var)
end

local function onTick(var, time)
    ensureState(var)
    if not captureOriginal(var) then return end

    local pct, activeRound = winterPct(var.config.rounds, time)

    -- While holding a phase, stop rewriting the six light fields every tick.
    if math.abs(pct - var.lastPct) > 0.001 then
        setLight(var.orig, pct)
        var.lastPct = pct
    end

    if var.config.debug and activeRound ~= var.lastRound then
        if activeRound > 0 then
            print("[GeneralWinter/Visual/DEBUG] Round " .. activeRound .. " visuals started")
        elseif var.lastRound > 0 then
            print("[GeneralWinter/Visual/DEBUG] Round " .. var.lastRound .. " visuals ended")
        end
        var.lastRound = activeRound
    end
end

-- Gameplay only sends a request in onTick; after Visual echoes it back on the next frame,
-- Gameplay rebuilds the templates.
-- This needs no sacrificial unit coordinates or player chat, and cannot be confused
-- with normal chat commands.
local function onSpecialCommand(var)
    local ok, command, bridge, action, token = pcall(function()
        return getParameter("command"), getParameter("winterBridge"),
            getParameter("action"), getParameter("token")
    end)
    if not ok or command ~= BRIDGE_REQUEST or bridge ~= BRIDGE_KEY then return end

    -- Only record the request; do not echo back within the same call chain that received the Gameplay command.
    var.pendingBridgeAck = {action = action, token = token}
end

local function onWork(var)
    local ack = var.pendingBridgeAck
    if ack == nil then return end
    var.pendingBridgeAck = nil

    root.session.visual.commands.f_specialCommand(0,
        "command", BRIDGE_ACK,
        "winterBridge", BRIDGE_KEY,
        "action", ack.action,
        "token", ack.token)

    if var.config ~= nil and var.config.debug then
        print("[GeneralWinter/Visual/DEBUG] Safe trigger echoed back to Gameplay: "
            .. tostring(ack.action) .. ", token=" .. tostring(ack.token))
    end
end

addMod({
    onInit = onInit,
    onDumpStart = onDumpStart,
    onTick = onTick,
    onSpecialCommand = onSpecialCommand,
    onWork = onWork,
})
