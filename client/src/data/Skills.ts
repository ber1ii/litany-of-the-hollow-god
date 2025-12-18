export type SkillType = 'physical' | 'magic' | 'utility';

export interface SkillDef {
  id: string;
  name: string;
  type: SkillType;
  description: string;
  damage?: number;
  heal?: number;
  cost?: number;
  critChance?: number;
  animation: 'attack1' | 'attack2' | 'pray' | 'cast';
  color: string;
}

export const SKILL_DATABASE: Record<string, SkillDef> = {
  slash: {
    id: 'slash',
    name: 'Slash',
    type: 'physical',
    description: 'Light attack. 15 DMG.',
    damage: 15,
    animation: 'attack1',
    color: 'text-red-400',
  },
  heavy: {
    id: 'heavy',
    name: 'Heavy',
    type: 'physical',
    description: 'Heavy attack. 25 DMG.',
    damage: 25,
    animation: 'attack2',
    color: 'text-purple-400',
  },
  pray: {
    id: 'pray',
    name: 'Pray',
    type: 'utility',
    description: 'Restore body and mind.',
    heal: 20,
    animation: 'pray',
    color: 'text-blue-400',
  },
};
