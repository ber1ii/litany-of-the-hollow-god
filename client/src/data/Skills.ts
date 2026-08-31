import type { StatusEffectType } from '../types/GameTypes';

export type SkillType = 'physical' | 'magic' | 'utility';

export interface SkillDef {
  id: string;
  name: string;
  type: SkillType;
  description: string;
  cost?: number;
  cooldown?: number; // Tracked in the combat store
  animationSpeed?: 'normal' | 'slow'; // Used by your sprite renderer

  // Logic properties
  healBase?: number;
  healLevelScale?: number;
  damageScale?: number;
  scalesWithWeapon?: 'quick' | 'heavy';
  accuracyMod?: number;
  // % of the caster's CURRENT hp sacrificed when this skill is used
  // (e.g. blood_surge). Kept generic so any future hp-cost skill just
  // sets this instead of needing a hardcoded id check in CombatLogic.
  hpCostPercent?: number;

  buff?: {
    type: StatusEffectType;
    name: string;
    duration: number;
    value: number;
  };

  // Applied to the ENEMY's statusEffects instead of the player's
  // (e.g. a skill that lowers enemy defense). Kept separate from `buff`
  // so CombatLogic/CombatScene know which side to patch.
  enemyDebuff?: {
    type: StatusEffectType;
    name: string;
    duration: number;
    value: number;
  };

  animation: 'attack1' | 'attack2' | 'pray' | 'cast' | 'blood_surge' | 'plunge';
  color: string;
}

export const SKILL_DATABASE: Record<string, SkillDef> = {
  // --- STARTING LOADOUT ---
  quick_attack: {
    id: 'quick_attack',
    name: 'Quick Attack',
    type: 'physical',
    description: 'A swift, reliable strike. Can be used every turn.',
    cooldown: 0,
    damageScale: 1.0,
    animationSpeed: 'normal',
    animation: 'attack1',
    color: 'text-gray-200',
    scalesWithWeapon: 'quick',
  },
  heavy_attack: {
    id: 'heavy_attack',
    name: 'Heavy Attack',
    type: 'physical',
    description: 'A deliberate, forceful blow. Requires a turn to recover.',
    cooldown: 2,
    damageScale: 1.5,
    animationSpeed: 'slow',
    animation: 'attack2',
    color: 'text-gray-400',
    scalesWithWeapon: 'heavy',
  },

  // --- UNLOCKABLE TREE ---
  divine_blessing: {
    id: 'divine_blessing',
    name: 'Divine Blessing',
    type: 'utility',
    description: 'Channel immense focus to knit flesh and bone, then fight with holy conviction.',
    cost: 30, // Matches exactly one Cerulean Flask
    cooldown: 2,
    healBase: 35, // High base heal so Crimson Flasks remain highly relevant
    healLevelScale: 5, // Adds +5 HP per level
    buff: {
      type: 'buff_damage',
      name: 'Divine Blessing',
      duration: 3,
      value: 20, // +20% damage, scaled further by intPotency at cast time
    },
    animationSpeed: 'normal',
    animation: 'pray',
    color: 'text-blue-400',
  },
  plunging_strike: {
    id: 'plunging_strike',
    name: 'Plunging Strike',
    type: 'physical',
    description: 'Leap and bring the blade down with crushing force. Devastating to brittle foes.',
    cost: 15,
    cooldown: 3,
    damageScale: 3.5, // High enough to one-shot skeleton limbs or cripple an Orc
    scalesWithWeapon: 'heavy', // stacks on top of the equipped weapon's heavy move
    animationSpeed: 'slow',
    animation: 'plunge', // Reusing plunge, but the slow speed will emphasize the weight
    color: 'text-orange-500',
  },
  blood_surge: {
    id: 'blood_surge',
    name: 'Blood Surge',
    type: 'utility',
    description:
      'Sacrifice 20% of your CURRENT Vitality to imbue your weapon with vampiric hunger.',
    cooldown: 4,
    hpCostPercent: 20,
    buff: {
      type: 'lifesteal', // Ensure 'lifesteal' is added to StatusEffectType
      name: 'Sanguine Thirst',
      duration: 3,
      value: 30,
    },
    animationSpeed: 'normal',
    animation: 'blood_surge', // Maps to Blood_surge.png
    color: 'text-red-600',
  },
  weakening_strike: {
    id: 'weakening_strike',
    name: 'Weakening Strike',
    type: 'physical',
    description: 'Strike a vital point, leaving the enemy vulnerable to further damage.',
    cost: 15,
    cooldown: 3,
    enemyDebuff: {
      type: 'vulnerable',
      name: 'Weakened',
      duration: 3,
      value: 25, // +25% damage taken
    },
    animationSpeed: 'normal',
    animation: 'attack1', // placeholder — swap once your sprite's ready
    color: 'text-purple-500',
  },
};
