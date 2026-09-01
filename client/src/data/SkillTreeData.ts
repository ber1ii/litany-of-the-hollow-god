import type { ClassId } from './Classes';

export interface SkillNodeDef {
  id: string;
  x: number;
  y: number;
  cost: number;
  requires: string[];
  requiredClass?: ClassId;
}

export const SKILL_TREE: Record<string, SkillNodeDef> = {
  // --- KNIGHT BRANCH ---
  pray: {
    id: 'pray',
    x: 0,
    y: 0,
    cost: 0,
    requires: [],
    requiredClass: 'KNIGHT',
  },
  holy_strike: {
    id: 'holy_strike',
    x: 0,
    y: -1,
    cost: 100,
    requires: ['pray'],
    requiredClass: 'KNIGHT',
  },

  // --- TESTING: unlockable versions of SKILL_DATABASE entries ---
  divine_blessing: {
    id: 'divine_blessing',
    x: 1,
    y: 0,
    cost: 0,
    requires: [],
  },
  plunging_strike: {
    id: 'plunging_strike',
    x: 1,
    y: -1,
    cost: 0,
    requires: [],
  },
  blood_surge: {
    id: 'blood_surge',
    x: 1,
    y: 1,
    cost: 0,
    requires: [],
  },
  weakening_dagger_throw: {
    id: 'weakening_dagger_throw',
    x: 2,
    y: 0,
    cost: 0,
    requires: [],
  },
};
