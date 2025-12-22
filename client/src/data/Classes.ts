import type { PlayerStats } from '../types/GameTypes';

export type ClassId = 'KNIGHT' | 'ASSASSIN' | 'MAGE';

export interface ClassDef {
  id: ClassId;
  name: string;
  description: string;
  tagline: string;
  baseStats: Partial<PlayerStats>;
  startingItems: { id: string; count: number }[];
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
      vitality: 14,
      strength: 14,
      dexterity: 9,
      intelligence: 7,
      mind: 9,
      agility: 8,
      hp: 140,
      maxHp: 140,
      mp: 50,
      maxMp: 50,
      attack: 14,
      defense: 12,
    },
    startingItems: [
      { id: 'flask_crimson', count: 3 },
      { id: 'flask_cerulean', count: 1 },
      { id: 'rusty_sword', count: 1 },
    ],
  },
  ASSASSIN: {
    id: 'ASSASSIN',
    name: 'Assassin',
    tagline:
      'Hollow-eyed and soft-footed, the Assassin survives by ending lives before fate notices them.',
    description:
      'Relies on speed and critical hits. High Dexterity and Agility make them hard to hit but fragile.',
    baseStats: {
      vitality: 10,
      strength: 10,
      dexterity: 15,
      intelligence: 10,
      mind: 10,
      agility: 14,
      hp: 100,
      maxHp: 100,
      mp: 60,
      maxMp: 60,
      attack: 10,
      defense: 8,
    },
    startingItems: [
      { id: 'flask_crimson', count: 2 },
      { id: 'flask_cerulean', count: 2 },
      { id: 'rusty_sword', count: 1 }, // Placeholder for Dagger
    ],
  },
  MAGE: {
    id: 'MAGE',
    name: 'Mage',
    tagline: 'The Mage learned too much, too early—and now the world answers when they speak.',
    description:
      'Masters of the arcane. High Intelligence and Mind grant powerful spells but physically weak.',
    baseStats: {
      vitality: 9,
      strength: 8,
      dexterity: 10,
      intelligence: 16,
      mind: 15,
      agility: 9,
      hp: 90,
      maxHp: 90,
      mp: 100,
      maxMp: 100,
      attack: 8,
      defense: 6,
    },
    startingItems: [
      { id: 'flask_crimson', count: 2 },
      { id: 'flask_cerulean', count: 3 },
      { id: 'rusty_sword', count: 1 },
    ],
  },
};
