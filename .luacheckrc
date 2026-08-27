-- Luacheck configuration for Wars Selection mods
-- Game-engine globals are injected by the runtime, so declare them here.

std = "max"

globals = {
    -- Engine root object
    "root",
    "gameplay",
    -- Parameter getters
    "getParameter",
    "getParameterNumber",
    "getParameterBoolean",
    -- Mod registration
    "addMod",
    -- Serialization
    "toJson",
    "fromJson",
    -- Engine callbacks defined by mods
    "onInit",
    "onPlayerEliminate",
    "onStart",
    "onTick",
    -- mods/adjust_resources
    "BERRY_AMOUNT",
    "BIG_FISH_AMOUNT",
    "IRON_AMOUNT",
    "SMALL_FISH_AMOUNT",
    "STONE_AMOUNT",
    "WHEAT_AMOUNT",
    "WOOD_PCT",
    "TAG_BERRY",
    "TAG_BIG_FISH",
    "TAG_IRON",
    "TAG_SMALL_FISH",
    "TAG_STONE",
    "TAG_WHEAT",
    "TAG_WOOD",
    "ForEachTagged",
    "ScaleResource",
    "SetResource",
    -- mods/default_gameplay_functions
    "getAgeFaction",
    "getAgeFactionIndustrial",
    "id",
    -- mods/diplomacy (interface + backend)
    "Diplomacy",
    "DiplomacyInterface",
    "GlobalNotif",
    "RequestNotif",
    "SystemNotif",
    "SendGlobalMsg",
    "SendRequestMsg",
    "SendSystemMsg",
    "ServerDiplomacyHandler",
    "SetMusicOnStart",
    "allySound",
    "checkStatus",
    "checkStatusFrontend",
    "currentAction",
    "currentP1",
    "currentP2",
    "currentRQ",
    "currentWork",
    "declareWar",
    "finsihSound",
    "getAllyCount",
    "getFactionOfPlayer",
    "getNodes",
    "getPlayerName",
    "getPlayerOfFaction",
    "hideShow",
    "openingSound",
    "Pay",
    "Peace",
    "peaceSound",
    "requestSound",
    "setAlly",
    "showPosition",
    "updateGamePlay",
    "warSound",
    "winControlDiplomacy",
    -- mods/diplomacy/ui_framework
    "Image",
    "Interface",
    "Label",
    "Panel",
    "Root",
    "Widget",
    -- mods/starting_resources
    "initOnStartResourcesInit",
    "initResourcesA",
    -- mods/victory_conditions
    "ROI_ID",
    "checkFactionLose",
    "checkWinTeam",
    "func",
    "func_",
    "losePlayer",
    "makePlayerLose",
    "onScriptWinLoss",
    "onTickWinLoss",
    "winTeam",
}

-- Engine-provided helpers that mods only call, never assign
read_globals = {
    "addInterface",
    "addScriptFunction",
    "addStartFunction",
    "addTickFunction",
    "forEachControlledFaction",
    "forEachPlayerFaction",
    "forEachPlayerLive",
    "forEachPlayerUnit",
    "forEachPlayerUnit2",
    "genServerData",
    "getParameterBool",
    "getResult",
    "isResearchComplete",
    "key",
    "killAllMovableUnits",
    "onPlayerLose",
}

-- Keep the config permissive so existing mods pass;
-- 6xx codes are pure formatting noise (whitespace / line length) in mod files.
ignore = { "21", "22", "23", "31", "32", "41", "42", "43", "53", "54", "611", "612", "631" }
