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
};

export const WEAPON_TYPES: Record<string, string[]> = {
  rusty_sword: ['slash', 'heavy'],
};
