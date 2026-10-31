/** Ratio éliminations/pertes d'un joueur — port de killDeath.ts
 *  (IbubussI / wsunitstats-static). */
import type { Player, PlayerUnitStat } from "./structure";

type UnitStatsMap = Map<string, PlayerUnitStat[]>;

export interface KillDeath {
  /** Unités tuées / unités perdues (brut). */
  raw: number;
  /** Valeur de combat tuée / valeur de combat perdue. */
  value: number;
}

const sumUnits = (unitStatsMap: UnitStatsMap, killValues: Map<string, number>) => {
  let count = 0;
  let value = 0;
  for (const units of unitStatsMap.values()) {
    for (const unit of units) {
      count += unit.number;
      value += unit.number * (killValues.get(unit.id) ?? 0);
    }
  }
  return { count, value };
};

/** Sans pertes, le ratio est le nombre d'éliminations (usage K/D usuel). */
const ratio = (kills: number, losses: number) => (losses > 0 ? kills / losses : kills);

/** K/D du joueur, undefined si le replay n'a pas de données tués/perdus. */
export const calcKillDeath = (
  player: Player,
  killValues: Map<string, number>,
): KillDeath | undefined => {
  if (
    !player.unitsKilledOn ||
    !player.unitsLostOn ||
    !player.unitsKilledPlain ||
    !player.unitsLostPlain
  ) {
    return undefined;
  }
  const killed = sumUnits(player.unitsKilledPlain, killValues);
  const lost = sumUnits(player.unitsLostPlain, killValues);
  return {
    raw: ratio(killed.count, lost.count),
    value: ratio(killed.value, lost.value),
  };
};
