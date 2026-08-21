# Default Gameplay Functions
**Status:** WIP

## Description
Three alternative versions (1, 2, 3) of the engine's default gameplay functions `getAgeFaction` and `getAgeFactionIndustrial`, which compute a faction's age (and civilization index) from its research state. The versions differ only in how many civilizations the industrial-age mapping covers: version 1 maps up to faction 18, version 2 up to faction 19, and version 3 up to faction 20. Only one version should be loaded at a time — they are variants of the same override, and the right one depends on the game version / civilization count.

## Installation
Place exactly one of the `mod_default_gameplay_functions_*.lua` files in the game's mod folder (TODO: confirm exact path in the Wars Selection installation) and enable it in the in-game mod menu. Do not load multiple versions together.

## Parameters
None — the files contain no configurable values.

## Technical details
- `getAgeFaction(faction)` reads `root.faction[faction].researchState` and returns `{age, civilization}`.
- Pre-industrial branch keys on research ids 3/1 (age 1), 5/15 and 6/9 vs 7/16 and 8/17 (age 3 civilizations 4–7), 4/2 (line 2/3).
- Industrial mapping keys on research id pairs, e.g. 93/59 → faction 8, 114/64 → 9, ... up to 136/61 → 18 (v1), 145/69 → 19 (v2), 146/71 → 20 (v3). Uses `isResearchComplete(researchesState, id)`.
