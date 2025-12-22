import type { ClassId } from './Classes';

export interface SkillNodeDef {
  id: string;
  x: number;
  y: number;
  cost: number;
  requires: string[];
  requiredClass?: ClassId; // <--- ADD THIS
}

export const SKILL_TREE: Record<string, SkillNodeDef> = {
  // --- KNIGHT BRANCH ---
  pray: { id: 'pray', x: 0, y: 0, cost: 0, requires: [], requiredClass: 'KNIGHT' },
  holy_strike: {
    id: 'holy_strike',
    x: 0,
    y: -1,
    cost: 100,
    requires: ['pray'],
    requiredClass: 'KNIGHT',
  },

  // --- MAGE BRANCH ---
  flame_of_frenzy: {
    id: 'flame_of_frenzy',
    x: 0,
    y: 0,
    cost: 0,
    requires: [],
    requiredClass: 'MAGE',
  },
  ember: {
    id: 'ember',
    x: 1,
    y: 0,
    cost: 100,
    requires: ['flame_of_frenzy'],
    requiredClass: 'MAGE',
  },

  // --- ASSASSIN BRANCH ---
  death_mark: { id: 'death_mark', x: 0, y: 0, cost: 0, requires: [], requiredClass: 'ASSASSIN' },
  toxic_blade: {
    id: 'toxic_blade',
    x: -1,
    y: 0,
    cost: 100,
    requires: ['death_mark'],
    requiredClass: 'ASSASSIN',
  },
};
