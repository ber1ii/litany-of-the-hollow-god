export interface LevelTheme {
  id: string;
  name: string;
  combatWall: string;
  combatFloor: string;
  ambientColor: string;
  lightColor: string;
}

export const THEMES: Record<string, LevelTheme> = {
  DUNGEON: {
    id: 'dungeon',
    name: 'Dark Dungeon',
    combatWall: '/textures/environment/ground_stone.png',
    combatFloor: '/textures/environment/ground_stone.png',
    ambientColor: '#110d0a',
    lightColor: '#ffaa00',
  },
};
