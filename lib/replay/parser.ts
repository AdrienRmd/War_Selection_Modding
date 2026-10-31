/** Parser de replay War Selection — port TypeScript fidèle de
 *  replayInfoParser.js (IbubussI / wsunitstats-static, dernière version du
 *  28/10/2026). Aucune dépendance UI : pur calcul à partir de la réponse de
 *  l'API officielle GET https://games-api.warselect.io/getByReplay?code=…
 *  et du contexte de jeu (lib/replay/context.ts).
 *
 *  Deux particularités conservées à l'identique de la source :
 *  - extraData['7'] absent → replays anciens : ids numériques d'unités
 *    convertis via legacyIds.json (public/legacy-ids.json) ;
 *  - #findPrevAgeResearchPassedTime compare à 'ageTransition' (sans le
 *    préfixe researchType) — la comparaison ne matche jamais dans la source
 *    (quirk assumé, conservé pour parité des métriques de récolte). */
import getAgeNation, { type ResearchTimeLine } from "./age-nation";
import {
  DatasetContainer,
  DatasetGroup,
  MultiRowDatasetContainer,
  TimeLineDataset,
  TimeLineEvent,
  TimeLineEventDataset,
  TimeLineMultiRowDataset,
  type BaseDataset,
} from "./dataset";
import { calcGatherMetrics, calcMVPScore, calcResourceMetrics, getGatherEntry } from "./score";
import {
  EVENT_TYPES,
  matchTypeFromId,
  symmetryTypeFromId,
  type Match,
  type Player,
  type PlayerResearch,
  type PlayerUnitStat,
  type ReplayParseResult,
  type Team,
} from "./structure";
import type { ReplayGameContext, ReplayUnitContext } from "./context";

// Réponse brute de l'API officielle (formes tolérantes : JSON hétérogène).
export interface ReplayApiResponse {
  error?: number;
  description?: string;
  data?: {
    duration?: number;
    start?: number;
    version?: string;
    initData?: ReplayInitData;
    extraData?: Record<string, string | undefined>;
  };
}

interface ReplayInitData {
  factions?: number;
  players?: number[];
  teams?: number[][];
  seed?: number;
  generatorData?: {
    mapParameters?: { generatorParameters?: { symmetry?: number } };
  };
  loadData?: { mapCode?: string; releaseData?: unknown };
  scriptParameters?: string;
}

interface PlayerScriptEntry {
  name: string;
  anonym?: boolean | number;
  rating?: number;
  group?: number;
  abilities?: string;
}

/** Timeline brute : [unitCreatePoints, unitKillPoints, landPoints,
 *  workerPoints[worker,boat,tractor], resources[9]] par faction. */
type TimeLineEntry = [
  Record<number, number>,
  Record<number, number>,
  Record<number, number>,
  Array<number[]>,
  Array<number[]>,
];

interface GatherWorkers {
  worker: number;
  boat: number;
  tractor: number;
}

interface PlayerMetadata {
  factionId: number;
  teamId?: number;
  squadId?: number;
  ageNation: [number, number];
  workers: GatherWorkers;
  resources: number[];
}

interface UnitKillsLostData {
  killedByFactions: Map<number, Array<{ factionId: number; name: string | null; units: Map<string, PlayerUnitStat[]> }>>;
  killedPlain: Map<number, Map<string, PlayerUnitStat[]>>;
  lostByFactions: Map<number, Array<{ name: string | null; units: Map<string, PlayerUnitStat[]> }>>;
  lostPlain: Map<number, Map<string, PlayerUnitStat[]>>;
}

// Couleurs de factions et d'équipes — reprises de War Selection.
const FACTION_COLORS = [
  "#7f7f7f", "#dadada", "#ff0000", "#bfff3f", "#00bfff", "#ffbf00", "#bf007f",
  "#7f00ff", "#00ffbf", "#ffff00", "#ff007f", "#00007f", "#7fbf7f", "#007fff",
  "#ff7f00", "#bf00bf", "#3fbf00", "#bfbf7f", "#ffbf7f", "#7f0000", "#333366",
  "#3fff00", "#ffff7f", "#ff3f7f", "#7f7fff", "#7fbf3f", "#bf7f00", "#ff00ff",
  "#bfbfff", "#7fff7f", "#ffffbf", "#ff7fbf", "#3f3fbf", "#dfff7f", "#ffbfbf",
  "#ff7fff", "#3f7fbf", "#3f7f3f", "#ff7f7f", "#bf00ff", "#7fbfff", "#007f00",
  "#bf7f7f", "#7f00bf", "#bfffff", "#bfbf00", "#bf3f3f", "#3f003f", "#00bfbf",
  "#bf0000", "#ffbfff", "#00bf7f", "#7f3f3f", "#7fbfbf", "#7f7f00", "#3f0000",
  "#bf7fbf", "#bfffbf", "#7f3f7f", "#00ffff", "#7fffbf", "#007f7f", "#7f007f",
  "#0000b3", "#bfbfbf",
];

const TEAM_COLORS = [
  { dark: "#5a3d3d", light: "#ffa2a2" },
  { dark: "#3b5158", light: "#a2d8ff" },
];

const RES_DATA = {
  names: ["resourceFood", "resourceWood", "resourceIron"],
  colors: ["#d84946", "#89411e", "#a29999"],
  icons: ["food", "wood", "iron"],
  rows: 3,
};

/** Les indices du moteur de jeu sont décalés de 1 quand le conteneur est un
 *  tableau (les tableaux 1-based de l'exporteur deviennent 0-based). */
function gameEngineIndexShift(container: unknown): number {
  return Array.isArray(container) ? 1 : 0;
}

function getSetBitPositions(bitset: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < 32; ++i) {
    if ((bitset & (1 << i)) !== 0) {
      result.push(i);
    }
  }
  return result;
}

/** Valeurs de script : '1'/'0' (récent) ou 'true'/'false' (ancien). */
function isTrueParam(value: unknown): boolean {
  return value === true || value === "1" || value === "true";
}

export class ReplayInfoParser {
  static timeLinePeriod = 30000; // ms

  private context: ReplayGameContext;
  private replayCode: string;
  private legacyUnitIds: Record<string, string> | undefined;
  private unitIds: Record<string, string> | undefined;
  private matchData?: { duration: number; mode: number; region?: string; winners: number };
  private playersLost?: Array<[number, number]>;
  private timeLine?: TimeLineEntry[];
  private stats?: Array<Record<string, Record<string, number>> | Record<number, Record<string, number>>>;
  private researches?: Record<number, ResearchTimeLine> | Array<ResearchTimeLine>;
  private initData!: ReplayInitData;
  private start?: number;
  private version?: string;
  private scriptParameters!: Record<string, string>;
  private playerScriptData!: PlayerScriptEntry[];

  // Structures générées.
  private playerResearchTimeLine: ResearchTimeLine[] = [];
  private factionTeams = new Map<number, number>();
  private playerTeams = new Map<number, number[]>();
  private playerSurvival = new Map<number, number>();
  private playerWinners = new Set<number>();
  private teamWinners = new Set<number>();
  private winnerSurvivalTime = -1;
  private isWonderWin: boolean | false = false;
  private groupMapByGameId = new Map<number, { id: number; creator: { name: string; id: number }; members: number[] }>();
  private groupMapByParsedId = new Map<number, { id: number; creator: { name: string; id: number }; members: number[] }>();
  private playerResearchesData = new Map<
    number,
    {
      researches: PlayerResearch[];
      isWonderBuilt: boolean;
      isWonderWin: boolean;
      firstWonderTime: number;
      lastAgeResearch?: number;
    }
  >();
  private unitsKilledLostData?: UnitKillsLostData;

  private isMatchDataOn = false;
  private isPlayersLostOn = false;
  private isTimelineOn = false;
  private isStatsOn = false;
  private isResearchesOn = false;
  private isUnitsKilledOn = false;

  constructor(context: ReplayGameContext, replayCode: string, legacyUnitIds?: Record<string, string>) {
    this.context = context;
    this.replayCode = replayCode;
    this.legacyUnitIds = legacyUnitIds;
  }

  parse(replayApiResponse: ReplayApiResponse): ReplayParseResult {
    if (replayApiResponse.error === 2) {
      return { error: 2, message: "Replay does not exist." };
    }
    if (replayApiResponse.error === 6) {
      return {
        error: 6,
        message:
          "War Selection API is unavailable due to the server maintenance. " +
          "It can last up to several hours before endpoint will be available again. Please, try later",
      };
    }
    if (replayApiResponse.error !== 0 || !replayApiResponse.data) {
      return {
        error: replayApiResponse.error ?? 255,
        message:
          `War Selection API responded with error [${replayApiResponse.error}]. ` +
          `Original description: ${replayApiResponse.description ?? "unknown"}`,
      };
    }

    try {
      const data = replayApiResponse.data;
      const extra = data.extraData ?? {};
      this.matchData = extra["0"] ? JSON.parse(extra["0"]) : undefined;
      this.playersLost = extra["1"] ? JSON.parse(extra["1"]) : undefined;
      this.timeLine = extra["2"] ? JSON.parse(extra["2"]) : undefined;
      this.stats = extra["3"] ? JSON.parse(extra["3"]) : undefined;
      this.researches = extra["4"] ? JSON.parse(extra["4"]) : undefined;
      // 5 = données internes, jamais exposées.
      const unitsKilledRaw = extra["6"] ? JSON.parse(extra["6"]) : undefined;
      this.isUnitsKilledOn = unitsKilledRaw != null;
      // Les replays récents portent le mapping index → id de chemin ; les
      // anciens utilisent les ids numériques legacy.
      this.unitIds = extra["7"] ? JSON.parse(extra["7"]) : this.legacyUnitIds;
      this.initData = data.initData ?? {};
      this.scriptParameters = this.parseScriptParams(this.initData.scriptParameters ?? "");
      // Défensif : sans paramètre data (réponses incomplètes), aucune entrée
      // joueur — le contrôle isMatchDataOn ci-dessous produit l'erreur claire.
      const scriptData = this.scriptParameters.data
        ? (JSON.parse(this.scriptParameters.data) as { players?: PlayerScriptEntry[] })
        : { players: [] };
      this.playerScriptData = scriptData.players ?? [];
      this.version = data.version;
      this.start = data.start;

      this.isMatchDataOn = this.matchData != null;
      this.isPlayersLostOn = this.playersLost != null;
      this.isStatsOn = this.stats != null;
      this.isResearchesOn = this.researches != null;
      this.isTimelineOn =
        this.timeLine != null && this.isStatsOn && this.isResearchesOn && this.isPlayersLostOn;

      if (!this.isMatchDataOn) {
        return {
          error: 255,
          message: "Cannot parse replay data. Match data is absent in WS Games API response.",
        };
      }

      // Ordre de la source : le parse des unités tuées intervient après
      // l'initialisation d'initData/playerScriptData (il résout des noms).
      this.unitsKilledLostData = this.isUnitsKilledOn
        ? this.parseUnitsKilledAndLost(unitsKilledRaw)
        : undefined;

      this.playerResearchTimeLine = this.generatePlayerResearchTimeLine();
      const teamEntries = this.generateTeamsData();
      this.factionTeams = teamEntries[0];
      this.playerTeams = teamEntries[1];

      this.playerSurvival = this.isPlayersLostOn ? this.generateSurvivalMap() : new Map();
      this.addWinnersData();
      this.isWonderWin = this.isPlayersLostOn ? this.getIsWonderWin() : false;
      this.playerResearchesData = this.generateResearchesData();

      const groupEntries = this.parsePlayerGroups();
      this.groupMapByGameId = groupEntries[0];
      this.groupMapByParsedId = groupEntries[1];

      const timeLineData = this.generateTimeLineData();
      const players = this.parsePlayers(timeLineData.mvpScoreStructure);
      const teams = this.parseTeams();
      const match = this.parseMatch();

      return {
        error: 0,
        match,
        teams,
        players,
        charts: timeLineData.charts,
        timeLinePeriod: ReplayInfoParser.timeLinePeriod,
      };
    } catch (error) {
      return {
        error: 255,
        message: `Cannot parse replay data. Error: ${(error as Error).message}`,
      };
    }
  }

  private parseMatch(): Match {
    return {
      startTime: this.start,
      duration: this.matchData!.duration * 1000,
      mode: matchTypeFromId(this.matchData!.mode),
      winnerTeams: Array.from(this.teamWinners.keys()),
      playersCount: this.initData.players!.length,
      factionsCount: this.initData.factions ?? 0,
      region: this.matchData!.region,
      gameVersion: this.version,
      matchSeed: this.initData.seed,
      isMatchmaking: isTrueParam(this.scriptParameters.matchmaking),
      creator: isTrueParam(this.scriptParameters.matchmaking)
        ? "0"
        : this.playerScriptData[Number(this.scriptParameters.creator)]?.name,
      isDevMode: isTrueParam(this.scriptParameters.devMode),
      isComplete: this.matchData!.winners > 0,
      isWonderWin: Boolean(this.isWonderWin),
      replayCode: this.replayCode,
      isMapGen: this.initData.generatorData,
      isMapReleased: this.initData.loadData?.releaseData !== "false",
      mapCode: this.initData.loadData?.mapCode?.split("_")[0],
      mapSymmetry: symmetryTypeFromId(
        this.initData.generatorData?.mapParameters?.generatorParameters?.symmetry,
      ),
    };
  }

  private parseTeams(): Team[] {
    const teamData = this.initData.teams ?? [];
    const teamList: Team[] = [];
    teamData.forEach((teamFactions, teamId) => {
      teamList.push({
        id: teamId,
        factions: teamFactions,
        players: teamFactions
          .map((factionId) => this.getFactionPlayer(factionId))
          .filter((e): e is number => e !== null),
        isWinner: this.teamWinners.has(teamId),
        isPlayerTeam: teamFactions.some(
          (factionId) => this.getFactionPlayer(factionId) !== null,
        ),
        color: TEAM_COLORS[teamId % 2],
      });
    });
    return teamList;
  }

  private parsePlayers(mvpScoreData: Array<Record<string, unknown>>): Player[] {
    const playerList: Player[] = [];
    const mvp = { index: -1, score: 0 };
    this.playerScriptData.forEach((playerScriptEntry, playerId) => {
      const player: Player = {
        id: playerId,
        factionId: 0,
        nickname: playerScriptEntry.name,
        isNicknameAutogenerated: Boolean(playerScriptEntry.anonym),
        rating: playerScriptEntry.rating,
        team: undefined,
        group: this.groupMapByGameId.get(playerScriptEntry.group!)?.id,
        survivalTime: undefined,
        isWinner: this.playerWinners.has(playerId),
        isDead: undefined,
        color: "",
        researches: undefined,
        unitsCreatedOn: 0,
        unitsLostOn: false,
        researchOn: false,
        survivalOn: false,
        unitsKilledOn: false,
      };
      playerList[playerId] = player;

      const factionId = this.getPlayerFaction(playerId);
      player.factionId = factionId;
      player.team = this.factionTeams.get(factionId);
      player.color = FACTION_COLORS[factionId % FACTION_COLORS.length];

      if (this.isPlayersLostOn) {
        player.survivalOn = true;
        player.survivalTime = this.playerSurvival.get(playerId);
        player.isDead = this.winnerSurvivalTime > (player.survivalTime ?? -Infinity);
      }

      if (this.isResearchesOn) {
        player.researchOn = true;
        const playerResearchEntry = this.playerResearchesData.get(playerId)!;
        player.researches = playerResearchEntry.researches;
        player.isWonderBuilt = playerResearchEntry.isWonderBuilt;
        player.lastAgeResearch = playerResearchEntry.lastAgeResearch;
        player.isWonderWin = playerResearchEntry.isWonderWin;
        player.firstWonderTime = playerResearchEntry.firstWonderTime;
      }

      if (this.isStatsOn) {
        player.unitsCreated = this.parsePlayerUnitsCreated(factionId);
        player.unitsCreatedOn = player.unitsCreated.size;
      }

      if (this.isUnitsKilledOn) {
        const data = this.unitsKilledLostData!;
        player.unitsKilledByFaction = data.killedByFactions.get(factionId);
        player.unitsKilledPlain = data.killedPlain.get(factionId);
        player.unitsLostByFaction = data.lostByFactions.get(factionId);
        player.unitsLostPlain = data.lostPlain.get(factionId);
        player.unitsKilledOn = (player.unitsKilledPlain?.size ?? 0) > 0;
        player.unitsLostOn = (player.unitsLostPlain?.size ?? 0) > 0;
      }

      if (this.isTimelineOn && this.isUnitsKilledOn) {
        player.mvpScore = calcMVPScore({
          isWonder: player.isWonderBuilt,
          isWinTeam: this.teamWinners.has(player.team!),
          isFirstWonder: (player.firstWonderTime ?? 0) > 0,
          isWinWonder: player.isWonderWin,
          firstWonderTime: player.firstWonderTime ?? 0,
          researchPoints: 0,
          unitKillPointsArray:
            player.unitsKilledPlain && Array.from(player.unitsKilledPlain.values()).flatMap((v) => v),
          survivalTime: player.survivalTime ?? 0,
          matchTime: this.matchData!.duration,
          ...mvpScoreData[playerId],
        } as never);
        mvp.score = mvp.score > player.mvpScore ? mvp.score : player.mvpScore;
        mvp.index = mvp.score > player.mvpScore ? mvp.index : playerId;
      }
    });

    if (playerList[mvp.index]) {
      playerList[mvp.index].isMvp = true;
    }

    return playerList;
  }

  private parsePlayerGroups(): [
    Map<number, { id: number; creator: { name: string; id: number }; members: number[] }>,
    Map<number, { id: number; creator: { name: string; id: number }; members: number[] }>,
  ] {
    const playerGroupsByGameId = new Map<
      number,
      { id: number; creator: { name: string; id: number }; members: number[] }
    >();
    const playerGroupsByParsedId = new Map<
      number,
      { id: number; creator: { name: string; id: number }; members: number[] }
    >();

    this.playerScriptData.forEach((playerScriptEntry, playerId) => {
      if (playerScriptEntry.group !== undefined) {
        const group = playerGroupsByGameId.get(playerScriptEntry.group);
        if (group === undefined) {
          const groupId = playerGroupsByGameId.size;
          const entry = {
            id: groupId,
            creator: { name: playerScriptEntry.name, id: playerId },
            members: [playerId],
          };
          playerGroupsByGameId.set(playerScriptEntry.group, entry);
          playerGroupsByParsedId.set(groupId, entry);
        } else {
          group.members.push(playerId);
        }
      }
    });
    return [playerGroupsByGameId, playerGroupsByParsedId];
  }

  private generateTimeLineData(): {
    charts: DatasetContainer[];
    mvpScoreStructure: Array<Record<string, unknown>>;
  } {
    if (!this.isTimelineOn) {
      return { charts: [], mvpScoreStructure: [] };
    }
    // Les jeux de données sont créés selon le type de conteneur : ce cast
    // local reflète la garantie de setupGroups (numérique, multi-lignes ou
    // événements), comme les accès directs du JS source.
    const num = (d: BaseDataset): TimeLineDataset => d as TimeLineDataset;
    const metadata: PlayerMetadata[] = [];
    const teamsCount = this.initData.teams!.length;
    const squadsCount = this.groupMapByParsedId.size;
    const playersCount = this.initData.players!.length;

    const setupGroups = (
      container: DatasetContainer,
      kFunc?: (value: number, time: number) => number,
    ) => {
      const teamDatasetGroup = new DatasetGroup("replayDatasetGroupTeams", "teams");
      const squadDatasetGroup = new DatasetGroup("replayDatasetGroupSquads", "squads");
      const playerDatasetGroup = new DatasetGroup("replayDatasetGroupPlayers", "players");
      container.addDatasetGroup(teamDatasetGroup);
      container.addDatasetGroup(squadDatasetGroup);
      container.addDatasetGroup(playerDatasetGroup);

      const getTeamResult = (teamId: number) => {
        const playerTeam = this.playerTeams.get(teamId) ?? [];
        const allPlayersDead = !playerTeam.some(
          (playerId) => this.winnerSurvivalTime === this.playerSurvival.get(playerId),
        );
        const isWinner = this.teamWinners.has(teamId);
        const isWonderWin = playerTeam.some(
          (playerId) => this.playerResearchesData.get(playerId)?.isWonderWin,
        );
        return allPlayersDead ? "death" : isWinner ? (isWonderWin ? "wonder" : "win") : "timeout";
      };
      const getSquadResult = (squadId: number) => {
        const squad = this.groupMapByParsedId.get(squadId)!;
        const allPlayersDead = !squad.members.some(
          (playerId) => this.winnerSurvivalTime === this.playerSurvival.get(playerId),
        );
        const anyMemberWon = squad.members.some((playerId) => this.playerWinners.has(playerId));
        const anyMemberWonByWonder = squad.members.some(
          (playerId) => this.playerResearchesData.get(playerId)?.isWonderWin,
        );
        return allPlayersDead
          ? "death"
          : anyMemberWon
            ? anyMemberWonByWonder
              ? "wonder"
              : "win"
            : "timeout";
      };
      const getPlayerResult = (playerId: number) => {
        const isDead = this.winnerSurvivalTime > (this.playerSurvival.get(playerId) ?? -1);
        const isWinner = this.playerWinners.has(playerId);
        const isWonderWin = this.playerResearchesData.get(playerId)?.isWonderWin ?? false;
        return isDead ? "death" : isWinner ? (isWonderWin ? "wonder" : "win") : "timeout";
      };

      const type = container.containerType;
      const rowNum = container instanceof MultiRowDatasetContainer ? container.rowNum : 0;
      const tlSize = this.timeLine!.length;

      let playerTeamCounter = 0;
      for (let i = 0; i < teamsCount; i++) {
        const playerTeam = this.playerTeams.get(i) ?? [];
        const playerTeamsNumber = Array.from(this.playerTeams.values()).filter(
          (arr) => arr.length > 0,
        ).length;
        playerTeamCounter = playerTeam.length > 0 ? playerTeamCounter + 1 : playerTeamCounter;
        const leadingFaction = this.getPlayerFaction(playerTeam[0] ?? 0);
        const color =
          playerTeamsNumber === 2
            ? TEAM_COLORS[i % 2].light
            : FACTION_COLORS[leadingFaction % FACTION_COLORS.length];
        let dataset: BaseDataset;
        if (type === "multiRow") {
          dataset = new TimeLineMultiRowDataset("replayTeam", true, playerTeamCounter, getTeamResult(i), rowNum, tlSize);
        } else if (type === "events") {
          dataset = new TimeLineEventDataset("replayTeam", true, playerTeamCounter, getTeamResult(i), color);
        } else {
          dataset = new TimeLineDataset("replayTeam", true, playerTeamCounter, getTeamResult(i), color, tlSize, kFunc);
        }
        teamDatasetGroup.addDataset(dataset);
      }

      for (let i = 0; i < squadsCount; i++) {
        let dataset: BaseDataset;
        if (type === "multiRow") {
          dataset = new TimeLineMultiRowDataset("replaySquad", true, i + 1, getSquadResult(i), rowNum, tlSize);
        } else if (type === "events") {
          dataset = new TimeLineEventDataset("replaySquad", true, i + 1, getSquadResult(i), FACTION_COLORS[(i + 2) % FACTION_COLORS.length]);
        } else {
          dataset = new TimeLineDataset("replaySquad", true, i + 1, getSquadResult(i), FACTION_COLORS[(i + 2) % FACTION_COLORS.length], tlSize, kFunc);
        }
        squadDatasetGroup.addDataset(dataset);
      }

      for (let i = 0; i < playersCount; i++) {
        const playerFaction = this.getPlayerFaction(i);
        const playerNickname = this.playerScriptData[i].name;
        let dataset: BaseDataset;
        if (type === "multiRow") {
          dataset = new TimeLineMultiRowDataset(playerNickname, false, null, getPlayerResult(i), rowNum, tlSize);
        } else if (type === "events") {
          dataset = new TimeLineEventDataset(playerNickname, false, null, getPlayerResult(i), FACTION_COLORS[playerFaction % FACTION_COLORS.length]);
        } else {
          dataset = new TimeLineDataset(playerNickname, false, null, getPlayerResult(i), FACTION_COLORS[playerFaction % FACTION_COLORS.length], tlSize, kFunc);
        }
        playerDatasetGroup.addDataset(dataset);
      }

      return {
        teams: teamDatasetGroup.datasets,
        squads: squadDatasetGroup.datasets,
        players: playerDatasetGroup.datasets,
      };
    };

    const unitCreatePointsDatasetContainer = new DatasetContainer("replayDatasetUnitCreatePoints");
    const unitCreatePointsData = setupGroups(unitCreatePointsDatasetContainer);
    const unitKillPointsDatasetContainer = new DatasetContainer("replayDatasetUnitKillPoints");
    const unitKillPointsData = setupGroups(unitKillPointsDatasetContainer);
    const landPointsDatasetContainer = new DatasetContainer("replayDatasetLandPoints");
    const landPointsData = setupGroups(landPointsDatasetContainer);
    const workerPointsDatasetContainer = new DatasetContainer("replayDatasetWorkerPoints");
    const workerPointsData = setupGroups(workerPointsDatasetContainer);

    const gatherEfficiencyDatasetContainer = new DatasetContainer(
      "replayDatasetGatherEfficiency",
      "percent",
    );
    const gatherEfficiencyData = setupGroups(gatherEfficiencyDatasetContainer);
    const gatherValueScoreDatasetContainer = new DatasetContainer("replayDatasetGatherValueScore");
    const gatherValueScoreData = setupGroups(gatherValueScoreDatasetContainer);

    const foodCollectedDatasetContainer = new DatasetContainer("replayDatasetFoodCollected");
    const foodCollectedData = setupGroups(foodCollectedDatasetContainer);
    const woodCollectedDatasetContainer = new DatasetContainer("replayDatasetWoodCollected");
    const woodCollectedData = setupGroups(woodCollectedDatasetContainer);
    const ironCollectedDatasetContainer = new DatasetContainer("replayDatasetIronCollected");
    const ironCollectedData = setupGroups(ironCollectedDatasetContainer);
    const foodNowDatasetContainer = new DatasetContainer("replayDatasetFoodNow");
    const foodNowData = setupGroups(foodNowDatasetContainer);
    const woodNowDatasetContainer = new DatasetContainer("replayDatasetWoodNow");
    const woodNowData = setupGroups(woodNowDatasetContainer);
    const ironNowDatasetContainer = new DatasetContainer("replayDatasetIronNow");
    const ironNowData = setupGroups(ironNowDatasetContainer);

    const resourcesCollectedDatasetContainer = new MultiRowDatasetContainer(
      "replayDatasetResourcesCollected",
      RES_DATA.rows,
      RES_DATA.names,
      RES_DATA.colors,
      RES_DATA.icons,
    );
    const resourcesCollectedData = setupGroups(resourcesCollectedDatasetContainer);
    const resourcesNowDatasetContainer = new MultiRowDatasetContainer(
      "replayDatasetResourcesNow",
      RES_DATA.rows,
      RES_DATA.names,
      RES_DATA.colors,
      RES_DATA.icons,
    );
    const resourcesNowData = setupGroups(resourcesNowDatasetContainer);
    const resourcesSpentDatasetContainer = new MultiRowDatasetContainer(
      "replayDatasetResourcesSpent",
      RES_DATA.rows,
      RES_DATA.names,
      RES_DATA.colors,
      RES_DATA.icons,
    );
    const resourcesSpentData = setupGroups(resourcesSpentDatasetContainer);
    const researchesDatasetContainer = new DatasetContainer(
      "replayDatasetResearches",
      "num",
      "events",
      EVENT_TYPES,
    );
    const researchesData = setupGroups(researchesDatasetContainer);

    const playerKillsDataMap = new Map<
      number,
      Array<{
        victimMvpScore: number;
        playerInstantMvpScore: number;
        playerArmyScore: number[];
        teamInstantMvpScore: Map<number, number>;
        teamArmyScore: Map<number, number[]>;
        deathTime: number;
      }>
    >();
    const playerTeams = Array.from(this.playerTeams.entries())
      .filter((entry) => entry[1].length > 0)
      .map((entry) => entry[0]);
    // Les éliminations de joueurs ne sont capturées que pour les matchs par
    // équipes (FFA/1v1 : sans objet avec une seule personne par équipe).
    const capturePlayerKillsData = playerTeams.length === 2 && playersCount > 2;
    for (let i = 0; i < playersCount; i++) {
      const factionId = this.getPlayerFaction(i);
      const playerScriptEntry = this.playerScriptData[i];
      metadata.push({
        factionId,
        teamId: this.factionTeams.get(factionId),
        squadId: this.groupMapByGameId.get(playerScriptEntry.group!)?.id,
        ageNation: [0, 0],
        workers: { worker: 10, boat: 0, tractor: 0 },
        resources: [0, 0, 0],
      });
    }

    for (let i = 0; i < this.timeLine!.length; i++) {
      const time = (i + 1) * ReplayInfoParser.timeLinePeriod;
      const startTime = i * ReplayInfoParser.timeLinePeriod;
      const tlEntry = this.timeLine![i];
      const unitCreateInfo = tlEntry[0];
      const unitKillInfo = tlEntry[1];
      const landInfo = tlEntry[2];
      const workerInfo = tlEntry[3];
      const resourceInfo = tlEntry[4];

      for (let playerId = 0; playerId < playersCount; playerId++) {
        const playerMetadata = metadata[playerId];
        const factionId = playerMetadata.factionId;
        const unitCreatePoints = unitCreateInfo[factionId] ?? 0;
        const unitKillPoints = unitKillInfo[factionId] ?? 0;
        const landPoints = landInfo[factionId] ?? 0;
        const workerPoints = workerInfo[factionId]?.[0] ?? 0;

        const workerNum = workerInfo[factionId]?.[1] ?? 0;
        const boatNum = workerInfo[factionId]?.[2] ?? 0;
        const tractorNum = workerInfo[factionId]?.[3] ?? 0;

        const resInfo = resourceInfo[factionId] ?? [0, 0, 0, 0, 0, 0, 0, 0, 0];
        const resDelta = [resInfo[0], resInfo[1], resInfo[2]];
        const resCollected = [resInfo[3], resInfo[4], resInfo[5]];
        const resNow = [resInfo[6], resInfo[7], resInfo[8]];
        const resWas = playerMetadata.resources;
        playerMetadata.resources = resNow;

        const teamId = playerMetadata.teamId;
        const squadId = playerMetadata.squadId;

        const resMetrics = calcResourceMetrics(resNow, resWas, resDelta, resCollected);

        if (teamId !== undefined && this.isTeamAlive(teamId, startTime)) {
          num(unitKillPointsData.teams[teamId]).computeSum(i, unitKillPoints);
          (resourcesCollectedData.teams[teamId] as TimeLineMultiRowDataset).computeSum(i, resMetrics.resCollected);
          (resourcesNowData.teams[teamId] as TimeLineMultiRowDataset).computeSum(i, resMetrics.resNow);
          (resourcesSpentData.teams[teamId] as TimeLineMultiRowDataset).computeSum(i, resMetrics.resSpent);
          num(foodCollectedData.teams[teamId]).computeSum(i, resMetrics.resCollected[0]);
          num(woodCollectedData.teams[teamId]).computeSum(i, resMetrics.resCollected[1]);
          num(ironCollectedData.teams[teamId]).computeSum(i, resMetrics.resCollected[2]);
          num(foodNowData.teams[teamId]).computeSum(i, resMetrics.resNow[0]);
          num(woodNowData.teams[teamId]).computeSum(i, resMetrics.resNow[1]);
          num(ironNowData.teams[teamId]).computeSum(i, resMetrics.resNow[2]);
        }

        if (squadId != null && this.isSquadAlive(squadId, startTime)) {
          num(unitKillPointsData.squads[squadId]).computeSum(i, unitKillPoints);
          (resourcesCollectedData.squads[squadId] as TimeLineMultiRowDataset).computeSum(i, resMetrics.resCollected);
          (resourcesNowData.squads[squadId] as TimeLineMultiRowDataset).computeSum(i, resMetrics.resNow);
          (resourcesSpentData.squads[squadId] as TimeLineMultiRowDataset).computeSum(i, resMetrics.resSpent);
          num(foodCollectedData.squads[squadId]).computeSum(i, resMetrics.resCollected[0]);
          num(woodCollectedData.squads[squadId]).computeSum(i, resMetrics.resCollected[1]);
          num(ironCollectedData.squads[squadId]).computeSum(i, resMetrics.resCollected[2]);
          num(foodNowData.squads[squadId]).computeSum(i, resMetrics.resNow[0]);
          num(woodNowData.squads[squadId]).computeSum(i, resMetrics.resNow[1]);
          num(ironNowData.squads[squadId]).computeSum(i, resMetrics.resNow[2]);
        }

        if (this.isPlayerAlive(playerId, startTime)) {
          const currAgeNation = getAgeNation(time, this.playerResearchTimeLine[playerId] ?? []);

          const prevAgeNation = playerMetadata.ageNation;
          const prevWorkers = playerMetadata.workers;
          const currWorkers = { worker: workerNum, boat: boatNum, tractor: tractorNum };
          playerMetadata.ageNation = currAgeNation;
          playerMetadata.workers = currWorkers;

          const timeSinceLastAgeUp = this.findPrevAgeResearchPassedTime(time, playerId);
          const gatherEntry = getGatherEntry(
            prevAgeNation,
            currAgeNation,
            timeSinceLastAgeUp,
            ReplayInfoParser.timeLinePeriod,
            time,
          );
          const gatherMetrics = calcGatherMetrics(
            gatherEntry,
            prevWorkers,
            currWorkers,
            resDelta,
            ReplayInfoParser.timeLinePeriod,
          );

          num(unitCreatePointsData.players[playerId]).push(unitCreatePoints, time);
          num(unitKillPointsData.players[playerId]).push(unitKillPoints, time);
          num(landPointsData.players[playerId]).push(landPoints);
          num(workerPointsData.players[playerId]).push(workerPoints);
          num(gatherEfficiencyData.players[playerId]).push(gatherMetrics.gatherEfficiency);
          num(gatherValueScoreData.players[playerId]).push(gatherMetrics.gatherValueScore);
          (resourcesCollectedData.players[playerId] as TimeLineMultiRowDataset).push(resMetrics.resCollected);
          (resourcesNowData.players[playerId] as TimeLineMultiRowDataset).push(resMetrics.resNow);
          (resourcesSpentData.players[playerId] as TimeLineMultiRowDataset).push(resMetrics.resSpent);
          num(foodCollectedData.players[playerId]).push(resMetrics.resCollected[0]);
          num(woodCollectedData.players[playerId]).push(resMetrics.resCollected[1]);
          num(ironCollectedData.players[playerId]).push(resMetrics.resCollected[2]);
          num(foodNowData.players[playerId]).push(resMetrics.resNow[0]);
          num(woodNowData.players[playerId]).push(resMetrics.resNow[1]);
          num(ironNowData.players[playerId]).push(resMetrics.resNow[2]);

          const researches = this.collectResearchEvents(playerId, startTime, time);
          (researchesData.players[playerId] as TimeLineEventDataset).push(researches);

          if (teamId !== undefined) {
            num(unitCreatePointsData.teams[teamId]).computeSum(i, unitCreatePoints);
            num(landPointsData.teams[teamId]).computeSum(i, landPoints);
            num(workerPointsData.teams[teamId]).computeSum(i, workerPoints);
            num(gatherEfficiencyData.teams[teamId]).computeAvg(i, gatherMetrics.gatherEfficiency);
            num(gatherValueScoreData.teams[teamId]).computeSum(i, gatherMetrics.gatherValueScore);
          }

          if (squadId != null) {
            num(unitCreatePointsData.squads[squadId]).computeSum(i, unitCreatePoints);
            num(landPointsData.squads[squadId]).computeSum(i, landPoints);
            num(workerPointsData.squads[squadId]).computeSum(i, workerPoints);
            num(gatherEfficiencyData.squads[squadId]).computeAvg(i, gatherMetrics.gatherEfficiency);
          }

          // Élimination d'un joueur : points d'impact pour ses bourreaux.
          if (!this.isPlayerAlive(playerId, time) && capturePlayerKillsData) {
            const deadPlayerTeam = this.factionTeams.get(factionId);
            const killerTeam = playerTeams.filter((team) => deadPlayerTeam !== team)[0];
            const killerTeamInstantMvpScore = new Map<number, number>();
            const killerTeamArmyScore = new Map<number, number[]>();
            const victimMvpScore = calcMVPScore({
              playerKillsData: undefined,
              unitCombatPointsArray: (unitKillPointsData.players[playerId] as TimeLineDataset).values,
              territorySum: (landPointsData.players[playerId] as TimeLineDataset).pointsSum,
              resourcesSpentAvg: (resourcesSpentData.players[playerId] as TimeLineMultiRowDataset).pointsAvgLocal,
              armySizeAvg: (unitCreatePointsData.players[playerId] as TimeLineDataset).pointsAvgLocal,
              survivalTime: time,
              isWonder: false,
              isFirstWonder: false,
              isWinWonder: false,
              isWinTeam: false,
              firstWonderTime: 0,
              researchPoints: 0,
            });

            for (let j = 0; j < playersCount; j++) {
              const team = metadata[j].teamId;
              if (j !== playerId && this.isPlayerAlive(j, startTime) && team === killerTeam) {
                const instantMVPScore = calcMVPScore({
                  playerKillsData: undefined,
                  unitCombatPointsArray: (unitKillPointsData.players[j] as TimeLineDataset).values,
                  territorySum: (landPointsData.players[j] as TimeLineDataset).pointsSum,
                  resourcesSpentAvg: (resourcesSpentData.players[j] as TimeLineMultiRowDataset).pointsAvgLocal,
                  armySizeAvg: (unitCreatePointsData.players[j] as TimeLineDataset).pointsAvgLocalK,
                  survivalTime: time,
                  isWonder: false,
                  isFirstWonder: false,
                  isWinWonder: false,
                  isWinTeam: false,
                  firstWonderTime: 0,
                  researchPoints: 0,
                });

                const playerKillEntry = {
                  victimMvpScore,
                  playerInstantMvpScore: instantMVPScore,
                  playerArmyScore: [...(unitCreatePointsData.players[j] as TimeLineDataset).values],
                  teamInstantMvpScore: killerTeamInstantMvpScore,
                  teamArmyScore: killerTeamArmyScore,
                  deathTime: this.playerSurvival.get(playerId) ?? 0,
                };

                const entries = playerKillsDataMap.get(j) || [];
                entries.push(playerKillEntry);
                playerKillsDataMap.set(j, entries);
                killerTeamInstantMvpScore.set(j, instantMVPScore);
                killerTeamArmyScore.set(j, [...(unitCreatePointsData.players[j] as TimeLineDataset).values]);
              }
            }
          }
        }
      }
    }

    const timeLineMvpScoreStructure: Array<Record<string, unknown>> = [];
    for (let playerId = 0; playerId < playersCount; playerId++) {
      timeLineMvpScoreStructure.push({
        // Points d'élimination calculés par l'aire sous la courbe.
        playerKillsData: playerKillsDataMap.get(playerId),
        unitCombatPointsArray: (unitKillPointsData.players[playerId] as TimeLineDataset).values,
        territorySum: (landPointsData.players[playerId] as TimeLineDataset).pointsSum,
        resourcesSpentAvg: (resourcesSpentData.players[playerId] as TimeLineMultiRowDataset).pointsAvgLocal,
        armySizeAvg: (unitCreatePointsData.players[playerId] as TimeLineDataset).pointsAvgLocal,
      });
    }

    const resultFull = [
      unitCreatePointsDatasetContainer,
      unitKillPointsDatasetContainer,
      landPointsDatasetContainer,
      workerPointsDatasetContainer,
      gatherEfficiencyDatasetContainer,
      gatherValueScoreDatasetContainer,
      resourcesCollectedDatasetContainer,
      resourcesNowDatasetContainer,
      foodCollectedDatasetContainer,
      woodCollectedDatasetContainer,
      ironCollectedDatasetContainer,
      foodNowDatasetContainer,
      woodNowDatasetContainer,
      ironNowDatasetContainer,
      researchesDatasetContainer,
    ];
    const resultFiltered: DatasetContainer[] = [];
    resultFull.forEach((container) => {
      // Filtre les jeux de données vides.
      container.datasetGroups.forEach((datasetGroup) => {
        datasetGroup.datasets = datasetGroup.datasets.filter(
          (dataset) =>
            (dataset.values as unknown[]).length > 1 &&
            (!Array.isArray(dataset.values[0]) || (dataset.values[0] as unknown[]).length > 1),
        );
      });
      const nonEmptyGroups = container.datasetGroups.filter(
        (datasetGroup) => datasetGroup.datasets.length > 0,
      );
      if (nonEmptyGroups.length > 0) {
        container.datasetGroups = nonEmptyGroups;
        resultFiltered.push(container);
      }
    });
    return { charts: resultFiltered, mvpScoreStructure: timeLineMvpScoreStructure };
  }

  private addWinnersData(): void {
    this.playerWinners = new Set();
    this.teamWinners = new Set();
    const winnersBitset = this.matchData!.winners;
    const playersCount = this.initData.players!.length;
    this.winnerSurvivalTime = -1;
    for (let i = 0; i < playersCount; i++) {
      if ((winnersBitset & (1 << i)) !== 0) {
        const faction = this.getPlayerFaction(i);
        const team = this.factionTeams.get(faction);
        if (team !== undefined) this.teamWinners.add(team);
        this.playerWinners.add(i);
        if (this.isPlayersLostOn) {
          const survTime = this.playerSurvival.get(i) || -1;
          this.winnerSurvivalTime = Math.max(this.winnerSurvivalTime, survTime);
        }
      }
    }
  }

  private generatePlayerResearchTimeLine(): ResearchTimeLine[] {
    const playerResearchesList: ResearchTimeLine[] = [];
    if (this.researches) {
      const playersCount = this.initData.players!.length;
      for (let i = 0; i < playersCount; i++) {
        const factionId = this.getPlayerFaction(i);
        const playerResearches = Array.isArray(this.researches)
          ? this.researches[factionId]
          : this.researches[factionId];
        playerResearchesList.push(playerResearches || []);
      }
    }
    return playerResearchesList;
  }

  private generateSurvivalMap(): Map<number, number> {
    const result = new Map<number, number>();
    for (const playerSurvEntry of this.playersLost ?? []) {
      result.set(playerSurvEntry[0], playerSurvEntry[1]);
    }
    return result;
  }

  private generateTeamsData(): [Map<number, number>, Map<number, number[]>] {
    const factionTeams = new Map<number, number>();
    const playerTeams = new Map<number, number[]>();
    const teams = this.initData.teams ?? [];
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      const teamPlayers: number[] = [];
      for (let j = 0; j < team.length; j++) {
        const factionId = team[j];
        factionTeams.set(factionId, i);
        const playerId = this.getFactionPlayer(factionId);
        if (playerId != null) {
          teamPlayers.push(playerId);
        }
      }
      playerTeams.set(i, teamPlayers);
    }
    return [factionTeams, playerTeams];
  }

  private generateResearchesData() {
    const playerData = this.playerResearchesData;
    if (this.isResearchesOn) {
      const wonderLeaderCandidates: Array<{ playerId: number; researchTime: number }> = [];
      const firstWonderCandidates: Array<{ playerId: number; researchTime: number }> = [];
      this.playerScriptData.forEach((_, playerId) => {
        const researchResult = this.parsePlayerResearches(playerId);
        const isWonder = researchResult.wonderTime ? true : false;
        const isWinner = this.playerWinners.has(playerId);
        if (isWonder) {
          const entry = { playerId, researchTime: researchResult.wonderTime ?? 0 };
          firstWonderCandidates.push(entry);
          // La merveille d'un joueur mort avant la fin ne fait pas gagner.
          if (
            isWinner &&
            this.isWonderWin &&
            (this.playerSurvival.get(playerId) ?? -1) >= this.winnerSurvivalTime
          ) {
            wonderLeaderCandidates.push(entry);
          }
        }
        playerData.set(playerId, {
          researches: researchResult.researches,
          isWonderBuilt: isWonder,
          isWonderWin: false,
          firstWonderTime: 0,
          lastAgeResearch: researchResult.lastAgeResearch,
        });
      });

      const firstWonder = firstWonderCandidates.reduce(
        (acc, current) => (acc.researchTime < current.researchTime ? acc : current),
        { playerId: -1, researchTime: Number.MAX_VALUE },
      );
      if (firstWonder.playerId >= 0) {
        playerData.get(firstWonder.playerId)!.firstWonderTime = firstWonder.researchTime;
      }

      this.getWonderLeaders(wonderLeaderCandidates).forEach(
        (playerId) => (playerData.get(playerId)!.isWonderWin = true),
      );
    }
    return playerData;
  }

  private getIsWonderWin(): boolean | false {
    if (this.winnerSurvivalTime === -1) {
      return false;
    }
    return Array.from(this.playerSurvival.entries()).some(
      ([playerId, survTime]) =>
        !this.playerWinners.has(playerId) && this.winnerSurvivalTime <= survTime,
    );
  }

  private getFactionPlayer(factionId: number): number | null {
    const playerBitsets = this.initData.players ?? [];
    for (let i = 0; i < playerBitsets.length; i++) {
      if ((playerBitsets[i] & (1 << factionId)) !== 0) {
        return i;
      }
    }
    return null;
  }

  private getFactionName(factionId: number): string | null {
    const playerId = this.getFactionPlayer(factionId);
    if (playerId != null) {
      return this.playerScriptData[playerId]?.name ?? null;
    }
    return null;
  }

  private getPlayerFaction(playerId: number): number {
    const playerBitset = this.initData.players![playerId] ?? 0;
    return getSetBitPositions(playerBitset)[0] ?? 0;
  }

  private parseScriptParams(scriptParamsString: string): Record<string, string> {
    // Récent : '@GE<n>:' + tableau JSON de paires [clé, valeur].
    const ge2Match = /^@GE(\d+):/.exec(scriptParamsString);
    if (ge2Match) {
      return Object.fromEntries(
        JSON.parse(scriptParamsString.slice(ge2Match[0].length)) as [string, string][],
      );
    }
    return this.parseLegacyScriptParams(scriptParamsString);
  }

  /** Ancien format : 'clé=valeur,clé=valeur', valeurs pouvant contenir des
   *  virgules (noms échappés en hexadécimal pour ne pas les couper). */
  private parseLegacyScriptParams(scriptParamsString: string): Record<string, string> {
    const stringToHex = (str: string) =>
      str
        .split("")
        .map((c) => c.charCodeAt(0).toString(16).padStart(4, "0"))
        .join("");

    const hexToString = (hex: string) =>
      hex
        .split(/(\w\w\w\w)/g)
        .filter((p) => !!p)
        .map((c) => String.fromCharCode(parseInt(c, 16)))
        .join("");

    // Échappe les noms du JSON en hexa pour éviter de couper sur leurs virgules.
    const escapedParams = scriptParamsString.replaceAll(
      /"name":"((?:(?!(?<!\\)").)+)"/g,
      (_, g1: string) => `"name":"${stringToHex(g1)}"`,
    );

    // Toute virgule suivie d'un nom de clé sépare deux entrées (les virgules
    // valides d'un JSON sont suivies d'une clé entre guillemets).
    const regexp = /([a-zA-Z0-9]+)=((?:(?!,[a-zA-Z0-9]).)+)/g;
    const matches = escapedParams.matchAll(regexp);
    const result: Record<string, string> = {};
    for (const match of matches) {
      const key = match[1];
      let unescapedValue = match[2].replaceAll(
        /"name":"([^"]+)"/g,
        (_, g1: string) => `"name":"${hexToString(g1)}"`,
      );
      if (
        (unescapedValue.startsWith('"') && unescapedValue.endsWith('"')) ||
        (unescapedValue.startsWith("'") && unescapedValue.endsWith("'"))
      ) {
        unescapedValue = unescapedValue.slice(1, -1);
      }
      if (key === "data") {
        unescapedValue = unescapedValue.replaceAll("\\,", ",").replaceAll("\\\\", "\\");
      }
      result[key] = unescapedValue;
    }
    return result;
  }

  private parsePlayerResearches(playerId: number): {
    researches: PlayerResearch[];
    lastAgeResearch?: number;
    wonderTime?: number;
  } {
    const researchTimeline = this.playerResearchTimeLine[playerId] ?? [];
    const researches: PlayerResearch[] = [];
    let lastAgeResearch: number | undefined;
    let wonderTime: number | undefined;
    researchTimeline.forEach((researchEntry) => {
      const time = researchEntry[0];
      const id = researchEntry[1];
      const research = this.context.researches.get(id);

      researches.push({ id, takenTime: time });

      // Liste triée par temps par l'API WS.
      if (research?.type === "researchTypeAgeTransition") {
        lastAgeResearch = id;
      }
      if (research?.type === "researchTypeWonderTransition") {
        wonderTime = time;
      }
    });
    return { researches, lastAgeResearch, wonderTime };
  }

  private parsePlayerUnitsCreated(factionId: number): Map<string, PlayerUnitStat[]> {
    // Source : this.#stats[factionId]?.unitsCreated (index direct, tableau ou
    // objet — le shift ne porte que sur les ids d'unités internes).
    const factionStats = (this.stats as Record<number, { unitsCreated?: Record<string, number> }> | undefined)?.[factionId];
    const unitEntry = factionStats?.unitsCreated;
    const units = new Map<string, PlayerUnitStat[]>();
    if (unitEntry) {
      for (const [unitTypeId, number] of Object.entries(unitEntry)) {
        const shift = gameEngineIndexShift(unitEntry);
        const unitTypeIdN = shift + parseInt(unitTypeId, 10);
        const unitContext = this.getUnitContext(unitTypeIdN);
        if (!unitContext) {
          continue;
        }
        const unitCreated: PlayerUnitStat = {
          id: unitContext.gameId,
          number,
        };
        const unitCategory = unitContext.category ?? "unknown";
        const unitCategoryEntry = units.get(unitCategory);
        if (unitCategoryEntry != null) {
          unitCategoryEntry.push(unitCreated);
        } else {
          units.set(unitCategory, [unitCreated]);
        }
      }
    }
    return units;
  }

  private parseUnitsKilledAndLost(unitsKilledRaw: unknown): UnitKillsLostData {
    const killedByFactions = new Map<
      number,
      Array<{ factionId: number; name: string | null; units: Map<string, PlayerUnitStat[]> }>
    >();
    const killedPlain = new Map<number, Map<string, PlayerUnitStat[]>>();
    const lostByFactions = new Map<
      number,
      Array<{ name: string | null; units: Map<string, PlayerUnitStat[]> }>
    >();
    const lostPlain = new Map<number, Map<string, PlayerUnitStat[]>>();
    // Conteneur brut : faction victime → (faction bourreau → unités perdues),
    // aplati en tableau avant retour (format d'affichage de la source).
    const lostByFactionsRaw = new Map<
      number,
      Map<number, { name: string | null; units: Map<string, PlayerUnitStat[]> }>
    >();

    // Index des entrées d'unités, pour sommer les unités identiques tuées par
    // des factions différentes dans killedPlain/lostPlain.
    const killedPlainIndex = new Map<number, Map<number, number>>();
    const lostPlainIndex = new Map<number, Map<number, number>>();

    const killerEntries: Array<[string, unknown]> = Array.isArray(unitsKilledRaw)
      ? unitsKilledRaw.map((v, i) => [String(i), v] as [string, unknown])
      : Object.entries(unitsKilledRaw as Record<string, unknown>);

    for (const [killerFaction, victimEntryRaw] of killerEntries) {
      const killerFactionN = gameEngineIndexShift(unitsKilledRaw) + parseInt(killerFaction, 10);
      const killedByFactionsEntry: Array<{
        factionId: number;
        name: string | null;
        units: Map<string, PlayerUnitStat[]>;
      }> = [];
      const killedPlainEntry = new Map<string, PlayerUnitStat[]>();
      killedByFactions.set(killerFactionN, killedByFactionsEntry);
      killedPlain.set(killerFactionN, killedPlainEntry);
      killedPlainIndex.set(killerFactionN, new Map());

      const victimEntries: Array<[string, unknown]> = Array.isArray(victimEntryRaw)
        ? victimEntryRaw.map((v, i) => [String(i), v] as [string, unknown])
        : Object.entries(victimEntryRaw as Record<string, unknown>);

      for (const [victimFaction, unitEntryRaw] of victimEntries) {
        const victimFactionN = gameEngineIndexShift(victimEntryRaw) + parseInt(victimFaction, 10);
        const lostByFactionsEntry =
          lostByFactionsRaw.get(victimFactionN) || new Map<number, { name: string | null; units: Map<string, PlayerUnitStat[]> }>();
        const lostPlainEntry = lostPlain.get(victimFactionN) || new Map<string, PlayerUnitStat[]>();
        lostByFactionsRaw.set(victimFactionN, lostByFactionsEntry);
        lostPlain.set(victimFactionN, lostPlainEntry);

        const killedFactionUnits = new Map<string, PlayerUnitStat[]>();
        const lostFactionUnits = new Map<string, PlayerUnitStat[]>();
        const unitEntry = unitEntryRaw as Record<string, number>;
        for (const [unitTypeId, number] of Object.entries(unitEntry)) {
          const unitTypeIdN = gameEngineIndexShift(unitEntry) + parseInt(unitTypeId, 10);
          const unitContext = this.getUnitContext(unitTypeIdN);
          if (!unitContext) {
            continue;
          }
          const unitKilled: PlayerUnitStat = {
            id: unitContext.gameId,
            number,
            points: unitContext.killValue,
          };
          const unitCategory = unitContext.category ?? "unknown";

          // Tués (toutes factions confondues).
          const killedUnitCategoryEntry = killedPlainEntry.get(unitCategory);
          const killedPlainIndexEntry = killedPlainIndex.get(killerFactionN)!;
          if (killedUnitCategoryEntry != null) {
            const prevIndex = killedPlainIndexEntry.get(unitTypeIdN);
            if (prevIndex != null) {
              killedUnitCategoryEntry[prevIndex].number += unitKilled.number;
            } else {
              killedUnitCategoryEntry.push({ ...unitKilled });
              killedPlainIndexEntry.set(unitTypeIdN, killedUnitCategoryEntry.length - 1);
            }
          } else {
            killedPlainIndexEntry.set(unitTypeIdN, 0);
            killedPlainEntry.set(unitCategory, [{ ...unitKilled }]);
          }

          // Tués (par faction victime).
          const killedFactionCategoryEntry = killedFactionUnits.get(unitCategory);
          if (killedFactionCategoryEntry != null) {
            killedFactionCategoryEntry.push({ ...unitKilled });
          } else {
            killedFactionUnits.set(unitCategory, [{ ...unitKilled }]);
          }

          // Perdus (toutes factions confondues).
          const lostUnitCategoryEntry = lostPlainEntry.get(unitCategory);
          const lostPlainIndexEntry = lostPlainIndex.get(victimFactionN) || new Map();
          lostPlainIndex.set(victimFactionN, lostPlainIndexEntry);
          if (lostUnitCategoryEntry != null) {
            const prevIndex = lostPlainIndexEntry.get(unitTypeIdN);
            if (prevIndex != null) {
              lostUnitCategoryEntry[prevIndex].number += unitKilled.number;
            } else {
              lostUnitCategoryEntry.push({ ...unitKilled });
              lostPlainIndexEntry.set(unitTypeIdN, lostUnitCategoryEntry.length - 1);
            }
          } else {
            lostPlainIndexEntry.set(unitTypeIdN, 0);
            lostPlainEntry.set(unitCategory, [{ ...unitKilled }]);
          }

          // Perdus (par faction bourreau).
          const lostFactionCategoryEntry = lostFactionUnits.get(unitCategory);
          if (lostFactionCategoryEntry != null) {
            lostFactionCategoryEntry.push({ ...unitKilled });
          } else {
            lostFactionUnits.set(unitCategory, [{ ...unitKilled }]);
          }

          const prevLostByFactionsEntry = lostByFactionsEntry.get(killerFactionN);
          if (prevLostByFactionsEntry != null) {
            lostFactionUnits.forEach((v, k) => {
              prevLostByFactionsEntry.units.set(k, v);
            });
          } else {
            lostByFactionsEntry.set(killerFactionN, {
              name: this.getFactionName(killerFactionN),
              units: lostFactionUnits,
            });
          }
        }
        killedByFactionsEntry.push({
          factionId: victimFactionN,
          name: this.getFactionName(victimFactionN),
          units: killedFactionUnits,
        });
      }
    }

    // Aplatit les maps de maps en tableaux (format d'affichage).
    for (const [k, v] of lostByFactionsRaw) {
      lostByFactions.set(k, Array.from(v.values()));
    }

    return { killedByFactions, killedPlain, lostByFactions, lostPlain };
  }

  /** Unité du dataset (contexte de jeu) par son index dans le replay. */
  private getUnitContext(unitIndex: number): ReplayUnitContext | undefined {
    const unitId = this.unitIds?.[String(unitIndex)];
    const unit = unitId ? this.context.units.get(unitId) : undefined;
    if (!unit) {
      return undefined;
    }
    return unit;
  }

  private getWonderLeaders(
    wonderLeaderCandidates: Array<{ playerId: number; researchTime: number }>,
  ): number[] {
    if (wonderLeaderCandidates.length > 0) {
      // En cas d'égalité parfaite de temps (rarissime), leaders multiples.
      const wonderLeaders = { time: Number.MAX_VALUE, players: [] as number[] };
      wonderLeaderCandidates.forEach((entry) => {
        const time = entry.researchTime;
        if (wonderLeaders.time > time) {
          wonderLeaders.time = time;
          wonderLeaders.players = [entry.playerId];
        } else if (wonderLeaders.time === time) {
          wonderLeaders.players.push(entry.playerId);
        }
      });
      return wonderLeaders.players;
    }
    return [];
  }

  private isPlayerAlive(playerId: number, time: number): boolean {
    if (!this.isPlayersLostOn) {
      return true;
    }
    return time < (this.playerSurvival.get(playerId) ?? -1);
  }

  private isSquadAlive(squadId: number, time: number): boolean {
    if (!this.isPlayersLostOn) {
      return true;
    }
    const squadMembers = this.groupMapByParsedId.get(squadId)!.members;
    return squadMembers.some((playerId) => time < (this.playerSurvival.get(playerId) ?? -1));
  }

  private isTeamAlive(teamId: number, time: number): boolean {
    if (!this.isPlayersLostOn) {
      return true;
    }
    const teamMembers = this.playerTeams.get(teamId) ?? [];
    return teamMembers.some((playerId) => time < (this.playerSurvival.get(playerId) ?? -1));
  }

  private findPrevAgeResearchPassedTime(time: number, playerId: number): number {
    const researchTimeline = this.playerResearchTimeLine[playerId] ?? [];
    for (let i = researchTimeline.length - 1; i >= 0; i--) {
      const researchEntry = researchTimeline[i];
      const rTime = researchEntry[0];
      const research = this.context.researches.get(researchEntry[1]);
      const timeDiff = time - rTime;
      // Quirk de la source : comparaison à 'ageTransition' (sans préfixe
      // researchType) — ne matche jamais, la fonction renvoie donc toujours
      // `time`. Conservé à l'identique pour la parité des métriques.
      if (research?.type === "ageTransition" && timeDiff >= 0) {
        return timeDiff;
      }
    }
    return time;
  }

  private collectResearchEvents(playerId: number, startTime: number, endTime: number): TimeLineEvent[] {
    return (this.playerResearchTimeLine[playerId] ?? [])
      .filter((research) => research[0] > startTime && research[0] <= endTime)
      .map((research) => {
        const researchContext = this.context.researches.get(research[1]);
        return new TimeLineEvent(
          researchContext?.name ?? `#${research[1]}`,
          researchContext?.type ?? "researchTypeOther",
          researchContext?.image ?? "",
          20,
          20,
          research[0] / ReplayInfoParser.timeLinePeriod,
          research[0],
        );
      });
  }
}
