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
  // Cost set to 0 for now so these can be unlocked freely while wiring
  // is verified. No requiredClass so they're visible/unlockable regardless
  // of the active class. Bump costs and add real prereqs/positions once
  // playtesting is done (see roadmap item 8, Combat Balancing Pass).
  divine_recovery: {
    id: 'divine_recovery',
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
};
