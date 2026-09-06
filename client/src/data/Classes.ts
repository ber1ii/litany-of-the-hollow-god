import type { PlayerStats } from '../types/GameTypes';

export type ClassId = 'KNIGHT';

export interface ClassDef {
  id: ClassId;
  name: string;
  description: string;
  tagline: string;
  baseStats: Partial<PlayerStats>;
  startingItems: { id: string; count: number }[];
  startingSkills: string[];
}

export const CLASSES: Record<ClassId, ClassDef> = {
  KNIGHT: {
    id: 'KNIGHT',
    name: 'Knight',
    tagline:
      'Clad in rusted vows and rotting honor, the Knight endures horrors that unmake lesser men.',
    description:
      'High Vitality and Strength allow them to endure heavy blows and strike back harder.',
    baseStats: {
      vitality: 10,
      strength: 14,
      dexterity: 9,
      intelligence: 7,
      mind: 9,
      agility: 8,
      hp: 100,
      maxHp: 100,
      mp: 50,
      maxMp: 50,
      attack: 14,
      defense: 7,
      xp: 0,
      gold: 0,
    },
    startingItems: [
      { id: 'flask_crimson', count: 3 },
      { id: 'flask_cerulean', count: 1 },
      { id: 'rusty_sword', count: 1 },
    ],
    startingSkills: ['pray'],
  },
};
