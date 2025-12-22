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

  // Mage Starter
  flame_of_frenzy: {
    id: 'flame_of_frenzy',
    name: 'Flame of Frenzy',
    type: 'magic',
    description: 'Unleash chaotic fire upon the enemy.',
    damageScale: 3.0,
    cost: 35,
    animation: 'cast',
    color: 'text-orange-500',
  },

  // Assassin Starter
  death_mark: {
    id: 'death_mark',
    name: 'Death Mark',
    type: 'utility',
    description: 'Expose enemy weakness. Next hit deals massive damage.',
    cost: 25,
    buff: {
      type: 'vulnerable',
      name: 'Marked for Death',
      duration: 2,
      value: 100, // 100% extra damage taken
    },
    animation: 'cast',
    color: 'text-purple-500',
  },

  // Test branches
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
  ember: {
    id: 'ember',
    name: 'Ember',
    type: 'magic',
    description: 'A lingering flame that burns the target.',
    damageScale: 1.2,
    cost: 10,
    animation: 'cast',
    color: 'text-orange-400',
  },
  toxic_blade: {
    id: 'toxic_blade',
    name: 'Toxic Blade',
    type: 'physical',
    description: 'Coats weapon in rot. Ignores some defense.',
    damageScale: 1.4,
    cost: 15,
    animation: 'attack1',
    color: 'text-green-600',
  },
};
