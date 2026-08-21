initResourcesA =
{
	getParameterNumber("res0", 100, 0, 1000000) * 1000,
	getParameterNumber("res1", 250, 0, 1000000) * 1000,
	getParameterNumber("res2", 0, 0, 1000000) * 1000,
	getParameterNumber("res3", 0, 0, 1000000) * 1000,
	getParameterNumber("res4", 0, 0, 1000000) * 1000
}


function initOnStartResourcesInit()
	local factions = root.scene[0].faction

	local function func(factionId)
		local treasury = factions[factionId].treasury
		local limits = treasury.limits
		local resources = treasury.resources
		for i = 0, 4 do
			limits[i] = 4000000000
			resources[i] = initResourcesA[i + 1]
		end
	end

	forEachControlledFaction(func)
end



addStartFunction(initOnStartResourcesInit, "initOnStartResourcesInit")
