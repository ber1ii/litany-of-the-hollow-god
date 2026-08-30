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
};
