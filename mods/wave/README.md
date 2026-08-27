# Wave PVE & General Winter

**Status:** Stable

## Authors: Austin & Nuanyang

*English texts by AdrienRmd (translated from the original Chinese scripts)*

## Mod IDs

| Script | Mod ID | Mod type |
|--------|--------|----------|
| Wave PVE mod | **`mod-MtNRIa6lil4`** | Gameplay |
| Winter | **`mod-RzcO3BQ8KF9`** | Gameplay |
| Winter visual | **`mod-TbiDQ5Es1k0`** | Visual |

> [!TIP]
> **The quickest way to use these mods — no code to copy.** Open your map in the editor → **Mods** → **Add a modification**, paste the IDs above, save and publish the map. Full instructions: [Add an existing mod to your map](../../docs/modding-guide/installation.md#part-3--add-an-existing-already-published-mod-to-your-map).

## What do these mods do?

These three scripts turn a normal map into a **PVE survival / tower-defense experience**: an AI-controlled attacker faction spawns **escalating waves of units** that march on the players' bases (Wave PVE), while **periodic blizzards** slow everyone down and freeze the battlefield visuals (Winter + Winter visual). The original scripts were written in Chinese by Austin and Nuanyang (the wave system is inspired by the earlier Chenxi wave mod); this repository hosts the English-translated versions.

The scripts are independent: you can use Wave PVE alone, the Winter pair alone, or all three together.

## The three scripts

| File | Type | What it does |
|------|------|--------------|
| `wave_PVE.lua` | Gameplay | Spawns AI attack waves from attacker spawn flags against the players' bases; handles tiers, scaling, redirects and wonder victory. |
| `winter.lua` | Gameplay | Periodic blizzards: reduces unit speeds and vision while a blizzard is active, then restores everything. |
| `winter_visual.lua` | Visual | The look of the blizzards: fades the scene lighting to cold blue tones and back. |

---

# Wave PVE — setup guide

Wave PVE needs **three things on the map** before it will run: an attacker faction, flag units, and a wave unit table. If any of them is missing, the mod disables itself and prints the reason to the log.

## 1. The attacker faction

Create a dedicated faction for the AI attacker (it must not be controlled by any player). In the faction's **external data** (JSON), mark it as the attacker and put the wave unit table in the same JSON (see step 3):

```json
{
  "attackers": true,
  ...wave unit table...
}
```

The mod finds the faction whose external data contains `"attackers": true` (if several factions match, the first one wins).

## 2. Flag units

- **Attacker spawn flags**: place units of type `attackerFlagType` (default unit type `2`) belonging to the attacker faction. Each flag is a spawn point — waves appear next to it, facing the target base.
- **Defender base flags**: place one unit of type `defenderFlagType` (default unit type `0`) for **each player faction**, at the position the waves should attack (usually the main base). A player whose faction has no flag is skipped.

Both flag types can be changed in the settings, so you can use different marker units on your map.

## 3. The wave unit table

The bulk of the faction's external data JSON describes **what spawns, per age and per tier**. Keys are ages (as strings), and each age contains:

- `tierNumber` — how many tiers this age has;
- `research` — per tier, a list of tech IDs the attacker faction researches when waves of that tier start;
- numbered entries (`"1"`, `"2"`, …) — one per unit type, each with:
  - `unitTypeID` — the unit type to spawn;
  - `num` — an array: `num[tier]` = the base number of that unit in one wave of that tier.

Example:

```json
{
  "attackers": true,
  "1": {
    "tierNumber": 2,
    "research": { "1": [], "2": [12] },
    "1": { "unitTypeID": 42, "num": [5, 10] },
    "2": { "unitTypeID": 55, "num": [3, 6] }
  },
  "2": {
    "tierNumber": 1,
    "research": { "1": [21] },
    "1": { "unitTypeID": 61, "num": [4] }
  }
}
```

With this table: in age 1, tier 1 waves are `5× unit 42 + 3× unit 55`; tier 2 waves are `10× unit 42 + 6× unit 55`, and the attacker researches tech `12` when tier 2 begins.

### How the script picks the age

Every wave, the script looks at the **highest age reached by any living player, plus one** — the attacker is always one age ahead. If no table exists for that age key, the wave is skipped (check the log).

### How the wave size scales

For each unit entry:

```
count = num[tier] × playerWeight × (alive players) × penaltyFactor
```

- `playerWeight` (default 1) scales difficulty per player;
- `penaltyFactor` starts at 1 and grows by `penalty` (default +0.2) every wave cycle **after the last tier is reached**, up to `maxPenaltyFactor` (default 3) — this keeps pressure rising in long games;
- the total is capped by `maxUnitsPerWave`, and the number of attackers alive on the field by `maxAttackerUnits`;
- units are split **evenly across all spawn points** (the remainder rotates between waves so no spawn point is permanently favored).

### Targeting

- `attackMode` `0` (**nearest**): each spawn point always attacks the closest living base; existing attackers keep their target until it dies.
- `attackMode` `1` (**random**): each spawn point picks a random living base at every wave.
- When a player is eliminated, all their attackers are **re-targeted in small batches** (250 per tick) toward the remaining bases — this avoids a lag spike.
- Idle attackers (e.g. after destroying everything at their destination) are re-sent to a living base every few seconds.

## Wave PVE settings

Setting names match the parameter names in the mod code. Times are in **seconds** (the script converts to milliseconds).

| Setting | Default | What it does |
|---------|---------|--------------|
| `DEBUG` | `false` | Verbose logging of every wave, redirect and wonder check. |
| `firstWaveTime` | 150 | When the first wave spawns. |
| `waveInternal` | 60 | Time between two waves. |
| `tierInternal` | 3 | Waves per tier before moving to the next tier. |
| `playerWeight` | 1 | Difficulty multiplier per living player. |
| `attackMode` | 0 | `0` = nearest base, `1` = random base each wave. |
| `defenderFlagType` | 0 | Unit type ID of the defender base flag. Legacy name: `DEFENDER_FLAG_TYPE`. |
| `attackerFlagType` | 2 | Unit type ID of the attacker spawn flag. Legacy name: `ATTACKER_FLAG_TYPE`. |
| `autoWallAttack` | `true` | Attackers (and everyone) automatically attack walls in their way. |
| `finalAge` | 6 | Last age players can reach (locks later research). |
| `buildWonder` | `true` | Allow wonder-related research (wonder victory). |
| `penalty` | 0.2 | `penaltyFactor` growth per wave cycle after the last tier. |
| `maxPenaltyFactor` | 3 | Cap for `penaltyFactor`. |
| `maxAttackerUnits` | 3000 | Cap on mobile attackers alive at once. |
| `maxUnitsPerWave` | 800 | Cap on units created per wave. |
| `idleRedirectInterval` | 3 | How often idle attackers are collected. |
| `idleRedirectLimit` | 300 | Max idle attackers re-sent per pass. |
| `redirectBatchSize` | 250 | Units re-targeted per tick after an elimination. |
| `commandBatchSize` | 200 | Units per move command batch (performance). |
| `wonderCheckInterval` | 5 | How often wonders are checked. |
| `wonderWinMinMoment` | 0 | Earliest game time a wonder can win. Legacy name: `minWinMoment`. |
| `wonderWinTimeToWin` | 60 | How long a wonder must stand to win. Legacy name: `timeToWin`. |

### Wonder victory

With `buildWonder` enabled, the oldest standing wonder wins the game for its team after `wonderWinTimeToWin` seconds (and never before `wonderWinMinMoment`). This gives defenders a non-military victory condition.

---

# Winter — setup guide

Winter runs **blizzard rounds** on a schedule. By default: warning at 25 min, blizzard 30→40 min, then 45→50→60 and 65→70→80 (3 rounds).

During a blizzard:

- infantry and general units move at **70%** speed;
- vehicles / tanks / ships move at **50%** speed;
- ground vision is reduced to **50%**;
- aircraft only lose vision (**70%**), so slow planes can still circle and return home.

Everything is restored to the exact original values when the blizzard ends.

## Winter settings

| Setting | Default | What it does |
|---------|---------|--------------|
| `DEBUG` | `false` | Verbose logging; times switch from **minutes to seconds** for quick testing. |
| `gameplayEffects` | `true` | `false` = messages and visuals only, no stat changes. |
| `firstWinterTime` | 30 | When the first blizzard starts. |
| `winterDuration` | 10 | Length of each blizzard. |
| `winterInterval` | 20 | Time between the starts of two rounds (clamped to ≥ duration). |
| `winterRounds` | 3 | Number of blizzard rounds. |
| `warningTime` | 5 | Advance warning before each blizzard. |

## Winter visual settings

| Setting | Default | What it does |
|---------|---------|--------------|
| `DEBUG` | `false` | Same as Winter (seconds instead of minutes). |
| `firstWinterTime` | 30 | Must match **Winter**. |
| `winterDuration` | 10 | Must match **Winter**. |
| `winterInterval` | 20 | Must match **Winter**. |
| `winterRounds` | 3 | Must match **Winter**. |

> [!IMPORTANT]
> `Winter visual` is a **Visual** mod: create/add it as a visual modification, not a gameplay one. The timing parameters of the two mods are **not synchronized automatically** — if you change them on `Winter`, make the same changes on `Winter visual`, or the lighting will not match the stat effects. For stat effects, both mods must be installed; `Winter visual` alone still works as pure atmosphere.

## How the Winter pair works (for modders)

- A gameplay mod cannot rebuild unit templates from inside its own `onTick` call stack, so `Winter` only *requests* the change and sends a special command to `Winter visual`, which echoes it back on a later frame; only then are speeds/vision applied or restored (each request carries a token, so stale echoes are ignored).
- Stat changes iterate **all unit types dynamically** (including units cloned later by other mods), save the original values, apply the percentages, then call `root.f_recreateModifiedUnitTypes()` once.
- The visual mod captures the original light colors on its first tick and lerps them toward cold blue values with a 5-second fade in/out, only writing when the value actually changes.

## How Wave PVE works (for modders)

- `onInit` reads the settings; `onStart` resolves factions, spawn/base flags and initial attack paths, then disables itself with a log message if anything is missing.
- Waves are triggered by `(time - firstWaveTime) % waveInternal == 0` in `onTick`.
- Spawned units face their target (angle math uses a custom `Atan2Compatible` because the game's Lua has no `math.atan2`) and immediately receive a grouped move order in batches of `commandBatchSize`.
- Unit creation uses `f_create` with floor-rounded coordinates; move commands use the **v229+ `f_move` signature** (leading boolean parameter) — on older game versions the call needs the old signature.
- The wonder check scans for wonders every `wonderCheckInterval` seconds and stores the state in `dataStorage` only when it changes.

## Known issues / notes

- In the wonder check, the script reads `scene.units_list` (everywhere else uses `scene.units.list`). If wonder victory never triggers on your game version, that line is the first thing to check.
- `autoWallAttack` uses a **hardcoded list of wall unit-type IDs** (v229); custom walls from other mods are not included.
- All texts (chat messages, logs) are in English; the opening message still credits the original authors and their QQ groups.
- The three scripts are translated from Chinese; `WAVE_SCRIPT_VERSION` tracks the original version (`v229.3858`).
