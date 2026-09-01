import type { ItemDef } from '../data/ItemRegistry';
import type { ClassId } from '../data/Classes';
import type { MonsterBehavior } from '../hooks/useMonsterBehavior';

export interface PlayerStats {
  classId: ClassId;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  sanity: number;
  maxSanity: number;

  level: number;
  xp: number;
  gold: number;

  vitality: number;
  strength: number;
  dexterity: number;
  intelligence: number;
  mind: number;
  agility: number;

  attack: number;
  defense: number;

  flaskCharges: number;
  maxFlaskCharges: number;

  // Core Inventory Array
  inventory: InventoryItem[];

  statusEffects: StatusEffect[];
  unlockedSkills: string[];
  equippedSkills: string[];
  equippedTalismans: string[];
}

export type MonsterType = 'skeleton' | 'orc2' | 'orc3' | 'vampire1' | 'vampire_boss';

export type InventoryItem = ItemDef & { count: number };

export type StatusEffectType =
  'bleed' | 'poison' | 'stun' | 'weakness' | 'vulnerable' | 'buff_damage' | 'lifesteal';

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
  hitChanceMod: number;
  damageMultiplier: number;
  severChance?: number;
  isSeverable?: boolean;
  hasHp?: boolean;
}

export interface SpriteConfig {
  textureUrl: string;
  frames: number;
  columns: number;
  rows: number;
  frameDuration?: number;
}

export interface EnemyAttackDef {
  id: string;
  name: string;
  damageMod: number;
  accuracyMod?: number;
  requiredPartId?: string;
  requiredAnyParts?: string[];
  requiredAllParts?: string[];
  speedMultiplier?: number;
  pauseFrame?: number;
  pauseDurationMs?: number;
  cameraZoom?: boolean;
  screenShake?: number;
  projectileType?: 'blood_orb' | 'cursed_bolt' | 'shadow_bolt' | 'green_venom';
  projectileFrame?: number;
  isRanged?: boolean;
}

export interface EnemyDef {
  id: string;
  name: string;
  hasMask?: boolean;
  tier: 'common' | 'elite' | 'boss';
  attacks: EnemyAttackDef[];
  parts: BodyPart[];
  baseStats: {
    attack: number;
    defense: number;
    speed: number;
    maxHp: number;
  };
  scale: number;
  sanityDrainOnHit?: number;
  yOffset?: number;
  sprites: {
    idle: SpriteConfig;
    attack: SpriteConfig;
    hurt: SpriteConfig;
    death: SpriteConfig;
  };
  aiBehavior: 'aggressive' | 'defensive' | 'erratic';
  defaultBehavior?: MonsterBehavior;
}

export interface CombatEnemyInstance {
  instanceId: string;
  defId: string;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  parts: BodyPart[];
  statusEffects: StatusEffect[];
  attackDebuff: number;
  damageTakenMultiplier: number;
}

export const INITIAL_STATS: PlayerStats = {
  classId: 'KNIGHT',
  hp: 20,
  maxHp: 100,
  mp: 50,
  maxMp: 50,
  sanity: 100,
  maxSanity: 100,
  level: 1,
  xp: 500,
  gold: 1000,
  vitality: 10,
  strength: 12,
  dexterity: 9,
  intelligence: 8,
  mind: 9,
  agility: 9,
  attack: 12,
  defense: 10,
  flaskCharges: 3,
  maxFlaskCharges: 3,

  inventory: [], // Seed this via a save manager or character creation later

  statusEffects: [],
  unlockedSkills: [],
  equippedSkills: [],
  equippedTalismans: [],
};
