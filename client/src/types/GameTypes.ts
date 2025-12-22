import type { ItemDef } from '../data/ItemRegistry';

export interface PlayerStats {
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
}

export type InventoryItem = ItemDef & { count: number };

export const INITIAL_STATS: PlayerStats = {
  // Vitals
  hp: 100,
  maxHp: 100,
  mp: 50,
  maxMp: 50,
  sanity: 100,
  maxSanity: 100,

  // Resources
  level: 1,
  xp: 0,
  gold: 0,

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
};
