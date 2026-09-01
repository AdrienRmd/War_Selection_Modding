-----------------------------------------------------------
-- Mod name: Fast build
-- Description: Construction speed of ALL builders (unitsBuildSpeedRatio),
--              adjustable IN GAME: a "Build: x%" button appears next to
--              the minimap; open it and click a preset (25/50/100/200/400%).
--              The starting value comes from the panel parameter
--              BuildSpeedRatio (default 100 = base game).
-- Author: AdrienRmd
-- Status: Stable
-----------------------------------------------------------
-- ============================================================================
-- ONE file, TWO roles (same pattern as the diplomacy mod, but merged):
--   - VISUAL context: creates the interface (addInterface on the native
--     "/project/Tools/placingButtons" template), positions the buttons
--     next to the minimap, and sends the chosen ratio to the gameplay
--     side with root.session_visual_commands.f_specialCommand.
--   - GAMEPLAY context: receives the "FastBuild" command, writes
--     root.unitsBuildSpeedRatio and confirms back (f_playerSpecialCommand).
-- Every context-specific call is wrapped in pcall: the same script runs
-- in both contexts and must never error in the wrong one.
--
-- Panel parameter (case-sensitive) to create in the mod's settings panel:
--   BuildSpeedRatio -- starting percentage, default 100, min 5, max 1000
--
-- NOTE: if another mod of the map also writes root.unitsBuildSpeedRatio
-- at load time (e.g. better_batiment sets 40), the value at match start
-- depends on the load order — use the in-game buttons to fix it live.
-- ============================================================================

-- Speed presets of the five in-game buttons (percent of base game speed)
local PRESETS = { 25, 50, 100, 200, 400 }

-- ============================================================================
-- 1. LOAD TIME -- apply the panel default (100 = base game)
-- ============================================================================

local DEFAULT_RATIO = math.floor(getParameterNumber("BuildSpeedRatio", 100, 5, 1000))
local currentRatio = DEFAULT_RATIO -- displayed on the menu button (visual side)

pcall(function() root.unitsBuildSpeedRatio = DEFAULT_RATIO end)
print(string.format("[fast_build] unitsBuildSpeedRatio = %d%% at load (panel default; change it in game with the minimap buttons)", DEFAULT_RATIO))
pcall(function() root.f_recreateModifiedUnitTypes() end)

-- ============================================================================
-- 2. INTERFACE (visual context) -- buttons next to the minimap
--    Native node layout of the placingButtons template, reused from the
--    diplomacy mod: node 18 = menu button (text node 9), nodes 12-16 =
--    preset buttons (text nodes 3-7), node 1 = fullscreen anchor.
-- ============================================================================

local menuOpen = false
local hasAlignedTexts = false

local function getNodes()
    local index = root.interface.f_getIndex("fastBuildInterface")
    if index == nil then return nil end
    return root.interface[index].nodes
end

function onInit(var)
    pcall(function()
        local isModeReplay = (root.session_gameplay_streamMode == 2)
        if not isModeReplay then
            local parameters = { "x", 1000, "y", 100, "horizontalAlign", 3, "verticalAlign", 0, "cursor", 0,
                                 "text1", "text", "text2", "text", "text3", "text" }
            for n = 4, 7 do
                table.insert(parameters, "placing" .. n)
                table.insert(parameters, false)
            end
            addInterface("fastBuildInterface", "/project/Tools/placingButtons", nil, nil, parameters)
        end
    end)
end

function onTick(var, currentMoment)
    if currentMoment % 10 ~= 0 then return end

    pcall(function()
        local nodes = getNodes()
        if nodes == nil then return end
        local width = root.window.width
        local height = root.window.height

        -- fullscreen anchor
        nodes[1].localLeft = 0; nodes[1].localTop = 0
        nodes[1].sizeX = width; nodes[1].sizeY = height
        nodes[1].horizontalAlign = 3; nodes[1].verticalAlign = 1

        -- center the button texts once
        if not hasAlignedTexts then
            for _, tid in ipairs({ 3, 4, 5, 6, 7, 9 }) do
                pcall(function() nodes[tid].f_setHorizontalAlign(2) end)
                pcall(function() nodes[tid].f_setVerticalAlign(2) end)
            end
            hasAlignedTexts = true
        end

        -- minimap size (for positioning next to it)
        local minimapW, minimapH = 200, 200
        pcall(function()
            minimapW = root.interface.minimap.nodes[1].sizeX
            minimapH = root.interface.minimap.nodes[1].sizeY
        end)

        -- menu button (node 18): always visible, shows the current speed
        nodes[18].visible = true
        nodes[18].sizeX = 130; nodes[18].sizeY = 50
        nodes[18].localLeft = minimapW + 150
        nodes[18].localTop = height - minimapH // 2 - 35
        pcall(function()
            nodes[18].color.r = 100; nodes[18].color.g = 200
            nodes[18].color.b = 255; nodes[18].color.a = 255
        end)
        nodes[9].widget_text = "Build: " .. currentRatio .. "%"
        nodes[9].sizeX = 130; nodes[9].sizeY = 50
        nodes[9].localLeft = 0; nodes[9].localTop = 0

        -- preset buttons (nodes 12-16): visible only when the menu is open
        local buttons = { nil, 12, 13, 14, 15, 16 } -- index = button id from placerButton
        local texts   = { nil, 3, 4, 5, 6, 7 }
        for i = 1, #PRESETS do
            local b, t = buttons[i + 1], texts[i + 1]
            nodes[b].visible = menuOpen
            nodes[b].sizeX = 100; nodes[b].sizeY = 50
            nodes[b].localLeft = minimapW + 150 + i * 110
            nodes[b].localTop = height - minimapH // 2 - 35

            nodes[t].widget_text = PRESETS[i] .. "%"
            nodes[t].sizeX = 100; nodes[t].sizeY = 50
            nodes[t].localLeft = 0; nodes[t].localTop = 0
        end
    end)
end

-- ============================================================================
-- 3. COMMANDS -- button clicks (visual) and speed changes (gameplay)
--    placerButton ids of the template: 1-5 = nodes 12-16, 7 = node 18.
-- ============================================================================

function onSpecialCommand(var)
    local cmd = getParameter("command")

    if cmd == "placerButton" then
        local btn = getParameterNumber("button")
        if btn == 6 then return end            -- hidden native button
        if btn == 7 then                       -- menu toggle
            menuOpen = not menuOpen
            return
        end
        if btn >= 1 and btn <= #PRESETS then   -- a speed preset was clicked
            local ratio = PRESETS[btn]
            currentRatio = ratio               -- optimistic; confirmed below
            pcall(function()
                root.session_visual_commands.f_specialCommand(0, "command", "FastBuild",
                    "ratio", ratio)
            end)
        end
        return
    end

    if cmd == "FastBuild" then
        -- gameplay side: apply the new ratio live
        local ratio = tonumber(getParameter("ratio")) or currentRatio
        pcall(function() root.unitsBuildSpeedRatio = ratio end)
        pcall(function() root.f_recreateModifiedUnitTypes() end)
        print(string.format("[fast_build] unitsBuildSpeedRatio = %d%% (applied in game)", ratio))
        -- tell the visual side so every player's button shows the new value
        pcall(function()
            root.f_playerSpecialCommand(0, "command", "FastBuildApplied", "ratio", ratio)
        end)
        return
    end

    if cmd == "FastBuildApplied" then
        -- visual side: authoritative value from the gameplay side
        local ratio = tonumber(getParameter("ratio"))
        if ratio ~= nil then currentRatio = ratio end
        return
    end
end

addMod({
    onInit = onInit,
    onTick = onTick,
    onSpecialCommand = onSpecialCommand,
})
