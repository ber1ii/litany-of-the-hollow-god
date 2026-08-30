import type { StatusEffectType } from '../types/GameTypes';

export type SkillType = 'physical' | 'magic' | 'utility';

export interface SkillDef {
  id: string;
  name: string;
  type: SkillType;
  description: string;
  cost?: number; // MP Cost

  // Logic properties
  heal?: number; // Flat HP restore
  damageScale?: number; // Multiplier

  buff?: {
    type: StatusEffectType;
    name: string;
    duration: number;
    value: number;
  };

  animation: 'attack1' | 'attack2' | 'pray' | 'cast';
  color: string;
}

export const SKILL_DATABASE: Record<string, SkillDef> = {
  // Knight Starter
  pray: {
    id: 'pray',
    name: 'Pray',
    type: 'utility',
    description: 'Restore body and mind. Scales with STR.',
    heal: 20,
    cost: 15,
    buff: {
      type: 'buff_damage',
      name: 'Divine Strength',
      duration: 3,
      value: 10,
    },
    animation: 'pray',
    color: 'text-blue-400',
  },

  // Knight Branch
  holy_strike: {
    id: 'holy_strike',
    name: 'Holy Strike',
    type: 'physical',
    description: 'A heavy blow infused with light. Deals high damage.',
    damageScale: 2.0,
    cost: 20,
    animation: 'attack2',
    color: 'text-yellow-200',
  },
};
