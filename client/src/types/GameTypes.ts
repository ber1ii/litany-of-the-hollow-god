export interface PlayerStats {
  hp: number;
  maxHp: number;
  xp: number;
  level: number;
  nextLevelXp: number;
  attack: number;
  potions: number;
  gold: number;
}

export const INITIAL_STATS: PlayerStats = {
  hp: 100,
  maxHp: 100,
  xp: 0,
  level: 1,
  nextLevelXp: 100,
  attack: 15,
  potions: 2,
  gold: 0,
};
