
function getAgeFactionIndustrial(researchesState, default)
	if isResearchComplete(researchesState, 93) then return {6, 8} end
	if isResearchComplete(researchesState, 59) then return {5, 8} end
	if isResearchComplete(researchesState, 114) then return {6, 9} end
	if isResearchComplete(researchesState, 64) then return {5, 9} end
	if isResearchComplete(researchesState, 115) then return {6, 10} end
	if isResearchComplete(researchesState, 68) then return {5, 10} end
	if isResearchComplete(researchesState, 116) then return {6, 11} end
	if isResearchComplete(researchesState, 67) then return {5, 11} end
	if isResearchComplete(researchesState, 118) then return {6, 12} end
	if isResearchComplete(researchesState, 63) then return {5, 12} end
	if isResearchComplete(researchesState, 121) then return {6, 13} end
	if isResearchComplete(researchesState, 65) then return {5, 13} end
	if isResearchComplete(researchesState, 125) then return {6, 14} end
	if isResearchComplete(researchesState, 62) then return {5, 14} end
	if isResearchComplete(researchesState, 126) then return {6, 15} end
	if isResearchComplete(researchesState, 70) then return {5, 15} end
	if isResearchComplete(researchesState, 131) then return {6, 16} end
	if isResearchComplete(researchesState, 73) then return {5, 16} end
	if isResearchComplete(researchesState, 135) then return {6, 17} end
	if isResearchComplete(researchesState, 72) then return {5, 17} end
	if isResearchComplete(researchesState, 136) then return {6, 18} end
	if isResearchComplete(researchesState, 61) then return {5, 18} end
	if isResearchComplete(researchesState, 145) then return {6, 19} end
	if isResearchComplete(researchesState, 69) then return {5, 19} end
	if isResearchComplete(researchesState, 146) then return {6, 20} end
	if isResearchComplete(researchesState, 71) then return {5, 20} end
	return {4, default}
end

function getAgeFaction(faction)
	local factions = root.faction
	id = faction
	local researchesState = factions[id].researchState

	if isResearchComplete(researchesState, 3) then
		if not isResearchComplete(researchesState, 1) then return {1, 2} end
		if isResearchComplete(researchesState, 5) then
			if not isResearchComplete(researchesState, 15) then return {3, 4} end
			return getAgeFactionIndustrial(researchesState, 4)
		end
		if isResearchComplete(researchesState, 6) then
			if not isResearchComplete(researchesState, 9) then return {3, 5} end
			return getAgeFactionIndustrial(researchesState, 5)
		end
		return {2, 2}
	end
	
	if isResearchComplete(researchesState, 4) then
		if not isResearchComplete(researchesState, 2) then return {1, 3} end
		if isResearchComplete(researchesState, 7) then
			if not isResearchComplete(researchesState, 16) then return {3, 6} end
			return getAgeFactionIndustrial(researchesState, 6)
		end
		if isResearchComplete(researchesState, 8) then
			if not isResearchComplete(researchesState, 17) then return {3, 7} end
			return getAgeFactionIndustrial(researchesState, 7)
		end
		return {2, 3}
	end

	return {0, 1}
end
