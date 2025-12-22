import type { ItemDef } from '../data/ItemRegistry';
import type { ClassId } from '../data/Classes';

export interface PlayerStats {
  // ID
  classId: ClassId;
  // Core Vitals
  hp: number;
  maxHp: number;
  mp: number; // Mana Points
  maxMp: number;
  sanity: number; // 100 = Sane, 0 = Insane
  maxSanity: number;

  // Progression Resources
  level: number;
  xp: number; // Used for Skills/Spells
  gold: number; // Used for Stats (Souls-like leveling)

  // Attributes
  vitality: number; // HP
  strength: number; // Physical Dmg
  dexterity: number; // Crit / Speed
  intelligence: number; // Magic Dmg
  mind: number; // MP / Sanity Resist
  agility: number; // Turn Order / Dodge

  // Computed Combat Stats
  attack: number;
  defense: number;

  // Flasks (Estus System)
  flaskCharges: number;
  maxFlaskCharges: number;

  // Active Effects (Buffs/Debuffs)
  statusEffects: StatusEffect[];

  // Skills
  unlockedSkills: string[];
}

export type InventoryItem = ItemDef & { count: number };

export type StatusEffectType =
  | 'bleed'
  | 'poison'
  | 'stun'
  | 'weakness'
  | 'vulnerable'
  | 'buff_damage';

export interface StatusEffect {
  id: string;
  type: StatusEffectType;
  name: string;
  duration: number;
  value: number;
  icon?: string;
}

export interface BodyPart {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  isSevered: boolean;
  isVital: boolean;

  // Stats
  hitChanceMod: number; // e.g. -20 for head (harder to hit)
  damageMultiplier: number;
}

export interface SpriteConfig {
  textureUrl: string;
  frames: number;
  columns: number;
  rows: number;
  frameDuration?: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  tier: 'common' | 'elite' | 'boss';
  parts: BodyPart[]; // The template for this enemy's body
  baseStats: {
    attack: number;
    defense: number;
    speed: number;
    maxHp: number; // Main HP Pool
  };
  scale: number;
  sprites: {
    idle: SpriteConfig;
    attack: SpriteConfig;
    hurt: SpriteConfig;
    death: SpriteConfig;
  };
  drops: string[];
  aiBehavior: 'aggressive' | 'defensive' | 'erratic';
}

// The active instance in combat
export interface CombatEnemyInstance {
  instanceId: string;
  defId: string;
  name: string;
  hp: number;
  maxHp: number;
  parts: BodyPart[];
  statusEffects: StatusEffect[];

  attackDebuff: number;
  damageTakenMultiplier: number;
}

export const INITIAL_STATS: PlayerStats = {
  classId: 'KNIGHT',
  // Vitals
  hp: 100,
  maxHp: 100,
  mp: 50,
  maxMp: 50,
  sanity: 100,
  maxSanity: 100,

  // Resources
  level: 1,
  xp: 500,
  gold: 1000,

  // Knight Class Defaults (Fallback)
  vitality: 10,
  strength: 12,
  dexterity: 9,
  intelligence: 8,
  mind: 9,
  agility: 9,

  // Derived (Will be recalculated on load)
  attack: 12,
  defense: 10,

  // Estus
  flaskCharges: 3,
  maxFlaskCharges: 3,

  // Effects
  statusEffects: [],

  // Skills
  unlockedSkills: [],
};
