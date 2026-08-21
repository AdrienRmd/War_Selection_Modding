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
}

-- Keep the config permissive so existing mods pass
ignore = { "21", "22", "23", "31", "32", "41", "42", "43", "53", "54" }
