export interface WeaponAttack {
  id: string;
  name: string;
  description: string;
  damageMult: number;
  accuracyMod: number;
  critMod: number;
  type: 'physical' | 'magic';
}

export const WEAPON_ATTACKS: Record<string, WeaponAttack> = {
  // Knight (Rusty Sword)
  slash: {
    id: 'slash',
    name: 'Slash',
    description: 'Standard strike.',
    damageMult: 1.0,
    accuracyMod: 0,
    critMod: 0,
    type: 'physical',
  },
  heavy: {
    id: 'heavy',
    name: 'Heavy',
    description: 'Strong but clumsy.',
    damageMult: 1.5,
    accuracyMod: -20,
    critMod: 0,
    type: 'physical',
  },

  // Mage (Wooden Staff)
  comet: {
    id: 'comet',
    name: 'Comet',
    description: 'A small arcane bolt.',
    damageMult: 1.1,
    accuracyMod: 10,
    critMod: 0,
    type: 'magic',
  },
  fireball_basic: {
    id: 'fireball_basic',
    name: 'Fireball',
    description: 'A ball of flame.',
    damageMult: 1.4,
    accuracyMod: -10,
    critMod: 5,
    type: 'magic',
  },

  // Assassin (Dagger)
  quickstrike: {
    id: 'quickstrike',
    name: 'Quickstrike',
    description: 'Fast, weak hit.',
    damageMult: 0.7,
    accuracyMod: 20,
    critMod: 10,
    type: 'physical',
  },
  backstab_basic: {
    id: 'backstab_basic',
    name: 'Backstab',
    description: 'Fatal precision.',
    damageMult: 1.6,
    accuracyMod: -25,
    critMod: 40,
    type: 'physical',
  },
};

export const WEAPON_TYPES: Record<string, string[]> = {
  rusty_sword: ['slash', 'heavy'],
  wooden_staff: ['comet', 'fireball_basic'],
  dagger: ['quickstrike', 'backstab_basic'],
};
