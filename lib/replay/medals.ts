/** Médailles de fin de partie (page résultat + profil joueur).
 *
 *  CALQUE DOCUMENTÉ (V2/V3, 01/11/2026) — reproduit les médailles du site de
 *  référence wsva (warselection.vercel.app) à partir de NOS données de replay
 *  (lib/replay/analysis.ts + structure.ts) :
 *
 *  | Médaille (wsva)     | Notre source                        | Règle                     |
 *  |---------------------|-------------------------------------|---------------------------|
 *  | Champion of the War | PlayerImpact.share + player.isMvp   | plus grosse part d'impact |
 *  |                     |                                     | du match (MVP si défini)  |
 *  | The First Blade     | events[].elimination (killers)      | 1re élimination « vraie » |
 *  |                     |                                     | (pas un départ volontaire)|
 *  | The First to Fall   | events[].elimination.victim         | 1re élimination           |
 *  | Master of Coin      | PlayerImpact.resTotal               | plus de ressources récoltées |
 *  | In Total Control    | série replayDatasetLandPoints       | part de terre ≥ 50 % à un |
 *  |                     | (max sur la partie)                 | instant donné              |
 *  | Cannon Fodder       | PlayerImpact.lost / killed          | ≥ 15 perdues et K/D < 1   |
 *  | Deserter            | elimination.leftGame + squad        | départ anticipé en peloton|
 *  | The Ghost           | elimination.leftGame sans squad     | départ anticipé seul      |
 *  | The Farmer          | killed vs resTotal                  | < 0,5 unité tuée par 1000 |
 *  |                     |                                     | ressources, récolte ≥ 5k |
 *  | The Last Stand      | timeline d'élimination de l'équipe  | dernier survivant ≥ 5 min |
 *  |                     |                                     | après la chute du dernier |
 *  |                     |                                     | allié, équipe perdante    |
 *
 *  Écart assumé : « Burner of Cities » (wsva) n'est PAS reprise — nos données
 *  ne distinguent pas les villes incendiées (aucun dataset dédié dans les
 *  timelines du replay). Les 10 médailles ci-dessus couvrent tout ce que nos
 *  données prouvent ; aucune valeur n'est inventée.
 *
 *  Module PUR (client + serveur) : consomme le résultat du parser + l'analyse,
 *  produit des attributions sérialisables (clé stable + paramètres de raison)
 *  — le profil joueur (V3) les agrège depuis le digest. */

import type { PlayerImpact, ReplayAnalysis, Side, TeamImpact } from "./analysis";
import { playerSeries } from "./analysis";
import type { Player, ReplayParseSuccess } from "./structure";

export type MedalTier = "gold" | "silver" | "wood";

export type MedalKey =
  | "champion"
  | "first-blade"
  | "first-to-fall"
  | "master-of-coin"
  | "in-total-control"
  | "cannon-fodder"
  | "deserter"
  | "ghost"
  | "farmer"
  | "last-stand";

export interface MedalAward {
  key: MedalKey;
  tier: MedalTier;
  player: string;
  /** Paramètres de la raison (i18n côté rendu, jamais de texte formé ici). */
  params: Record<string, string | number>;
}

export interface MedalMeta {
  key: MedalKey;
  tier: MedalTier;
  icon: string;
}

/** Métadonnées d'affichage (icône du pack wsva, public/icons). */
export const MEDAL_META: Record<MedalKey, MedalMeta> = {
  champion: { key: "champion", tier: "gold", icon: "/icons/medal-champion-of-the-war.png" },
  "first-blade": { key: "first-blade", tier: "silver", icon: "/icons/medal-first-blade.png" },
  "first-to-fall": { key: "first-to-fall", tier: "wood", icon: "/icons/medal-first-to-fall.png" },
  "master-of-coin": { key: "master-of-coin", tier: "silver", icon: "/icons/medal-master-of-coin.png" },
  "in-total-control": {
    key: "in-total-control",
    tier: "gold",
    icon: "/icons/medal-in-total-control.png",
  },
  "cannon-fodder": { key: "cannon-fodder", tier: "wood", icon: "/icons/medal-cannon-fodder.png" },
  deserter: { key: "deserter", tier: "wood", icon: "/icons/medal-deserter.png" },
  ghost: { key: "ghost", tier: "wood", icon: "/icons/medal-ghost.png" },
  farmer: { key: "farmer", tier: "wood", icon: "/icons/medal-farmer.png" },
  "last-stand": { key: "last-stand", tier: "silver", icon: "/icons/medal-last-stand.png" },
};

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Médailles d'une partie — ordre d'affichage : gold, silver, wood. */
export function computeMedals(result: ReplayParseSuccess, analysis: ReplayAnalysis): MedalAward[] {
  const awards: MedalAward[] = [];
  const allPlayers: PlayerImpact[] = analysis.teams.flatMap((t) => t.players);

  /* Champion of the War — plus grosse part d'impact du match. */
  const mvp = allPlayers.find((p) => p.player.isMvp === true);
  const champ =
    mvp ??
    allPlayers.reduce<PlayerImpact | null>(
      (best, p) => (!best || p.share > best.share ? p : best),
      null,
    );
  if (champ && champ.share > 0) {
    const team = analysis.teams.find((t) => t.players.includes(champ));
    awards.push({
      key: "champion",
      tier: "gold",
      player: champ.player.nickname,
      params: {
        player: champ.player.nickname,
        share: Math.round(champ.share * 100),
        team: team ? (team.side === 0 ? "blue" : "red") : "",
      },
    });
  }

  /* Éliminations — première vraie élimination (First Blade + First to Fall)
     et départs anticipés (Deserter / Ghost). */
  const eliminations = analysis.events
    .filter((e) => e.kind === "elimination" && e.elimination)
    .sort((a, b) => a.timeMs - b.timeMs);
  const firstReal = eliminations.find((e) => !e.elimination!.leftGame);
  if (firstReal?.elimination) {
    const killer = firstReal.elimination.killers[0];
    if (killer) {
      awards.push({
        key: "first-blade",
        tier: "silver",
        player: killer,
        params: { player: killer, victim: firstReal.elimination.victim, time: clock(firstReal.timeMs) },
      });
    }
  }
  const firstFall = eliminations[0]?.elimination;
  if (firstFall) {
    awards.push({
      key: "first-to-fall",
      tier: "wood",
      player: firstFall.victim,
      params: { player: firstFall.victim, time: clock(eliminations[0].timeMs) },
    });
  }
  for (const event of eliminations) {
    const el = event.elimination!;
    if (!el.leftGame) continue;
    const impact = allPlayers.find((p) => p.player.nickname === el.victim);
    awards.push({
      key: impact?.squad !== undefined ? "deserter" : "ghost",
      tier: "wood",
      player: el.victim,
      params: { player: el.victim, time: clock(event.timeMs), squad: impact?.squad ?? 0 },
    });
  }

  /* Master of Coin — plus de ressources récoltées. */
  const coin = allPlayers.reduce<PlayerImpact | null>(
    (best, p) => (!best || p.resTotal > best.resTotal ? p : best),
    null,
  );
  if (coin && coin.resTotal > 0) {
    awards.push({
      key: "master-of-coin",
      tier: "silver",
      player: coin.player.nickname,
      params: { player: coin.player.nickname, res: Math.round(coin.resTotal) },
    });
  }

  /* In Total Control — part de terre maximale ≥ 50 % à un instant. */
  for (const team of analysis.teams) {
    const landSeries = team.players.map((p) => landShareSeries(result, p.player));
    if (landSeries.length === 0) continue;
    const count = Math.max(...landSeries.map((s) => s.length));
    for (let t = 0; t < count; t++) {
      const total = sum(landSeries.map((s) => s[t] ?? 0));
      if (total <= 0) continue;
      for (let i = 0; i < team.players.length; i++) {
        const share = (landSeries[i][t] ?? 0) / total;
        if (share >= 0.5) {
          const p = team.players[i];
          awards.push({
            key: "in-total-control",
            tier: "gold",
            player: p.player.nickname,
            params: {
              player: p.player.nickname,
              share: Math.round(share * 100),
              time: clock(t * result.timeLinePeriod),
            },
          });
          t = count; // première occurrence suffisante (une par partie)
          break;
        }
      }
    }
  }

  /* Cannon Fodder / The Farmer — profils de pertes et de récolte. */
  for (const p of allPlayers) {
    if (p.lost >= 15 && (p.kd === undefined || p.kd < 1)) {
      const ratio = p.lost > 0 && p.killed > 0 ? Math.round((p.killed / p.lost) * 10) / 10 : 0;
      awards.push({
        key: "cannon-fodder",
        tier: "wood",
        player: p.player.nickname,
        params: { player: p.player.nickname, lost: p.lost, ratio },
      });
    } else if (p.resTotal >= 5000 && p.killed / Math.max(1, p.resTotal) * 1000 < 0.5) {
      awards.push({
        key: "farmer",
        tier: "wood",
        player: p.player.nickname,
        params: {
          player: p.player.nickname,
          ratio: Math.round((p.killed / Math.max(1, p.resTotal)) * 1000 * 10) / 10,
        },
      });
    }
  }

  /* The Last Stand — dernier survivant d'une équipe éliminée, ≥ 5 min seul. */
  for (const team of analysis.teams) {
    if (team.isWinner) continue;
    const deaths = team.players
      .map((p) => deathTimeMs(analysis, p.player.nickname))
      .filter((t): t is number => t !== null)
      .sort((a, b) => a - b);
    if (deaths.length < 2) continue;
    const last = deaths[deaths.length - 1];
    const before = deaths[deaths.length - 2];
    if (last - before >= 5 * 60 * 1000) {
      const survivor = team.players.find(
        (p) => deathTimeMs(analysis, p.player.nickname) === last,
      );
      if (survivor) {
        awards.push({
          key: "last-stand",
          tier: "silver",
          player: survivor.player.nickname,
          params: {
            player: survivor.player.nickname,
            minutes: Math.round((last - before) / 60000),
          },
        });
      }
    }
  }

  /* Ordre stable : gold → silver → wood, puis par joueur. */
  const order: Record<MedalTier, number> = { gold: 0, silver: 1, wood: 2 };
  return awards.sort((a, b) => order[a.tier] - order[b.tier] || a.player.localeCompare(b.player));
}

function landShareSeries(result: ReplayParseSuccess, player: Player): number[] {
  // Même résolution que lib/replay/analysis.ts (playerSeries, exporté) :
  // conteneur replayDatasetLandPoints, groupe « players ».
  return playerSeries(result, "replayDatasetLandPoints", player) ?? [];
}

function deathTimeMs(analysis: ReplayAnalysis, nickname: string): number | null {
  for (const event of analysis.events) {
    if (event.kind === "elimination" && event.elimination?.victim === nickname) {
      return event.timeMs;
    }
  }
  return null;
}

/** Médailles d'UN joueur (affichage ligne d'équipe / profil). */
export function medalsOfPlayer(awards: MedalAward[], nickname: string): MedalAward[] {
  return awards.filter((a) => a.player === nickname);
}

export function teamMedalCount(team: TeamImpact, awards: MedalAward[]): number {
  const names = new Set(team.players.map((p) => p.player.nickname));
  return awards.filter((a) => names.has(a.player)).length;
}

/** Côté texte d'une équipe pour l'i18n des raisons. */
export function sideLabelKey(side: Side): string {
  return side === 0 ? "blue" : "red";
}
