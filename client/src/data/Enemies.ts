import type { EnemyDef } from '../types/GameTypes';

export const ENEMIES: Record<string, EnemyDef> = {
  SKELETON: {
    id: 'SKELETON',
    name: 'Human Structure (Failed)',
    tier: 'common',
    aiBehavior: 'aggressive',
    baseStats: {
      attack: 10,
      defense: 2,
      speed: 3,
      maxHp: 80,
    },
    scale: 3,
    sprites: {
      idle: {
        textureUrl: '/sprites/combat/skeleton/idle.png',
        frames: 3,
        columns: 3,
        rows: 1,
      },
      attack: {
        textureUrl: '/sprites/combat/skeleton/attack.png',
        frames: 13,
        columns: 13,
        rows: 1,
        frameDuration: 0.075,
      },
      hurt: {
        textureUrl: '/sprites/combat/skeleton/hurt.png',
        frames: 3,
        columns: 3,
        rows: 1,
      },
      death: {
        textureUrl: '/sprites/combat/skeleton/death.png',
        frames: 12,
        columns: 12,
        rows: 1,
      },
    },
    drops: ['bone_shard', 'rusty_sword'],
    parts: [
      {
        id: 'head',
        name: 'Skull',
        hp: 20,
        maxHp: 20,
        isSevered: false,
        isVital: true, // Headshot = Kill
        hitChanceMod: -25, // Hard to hit
        damageMultiplier: 2.0, // Takes double damage
      },
      {
        id: 'torso',
        name: 'Ribcage',
        hp: 50,
        maxHp: 50,
        isSevered: false,
        isVital: false,
        hitChanceMod: 0,
        damageMultiplier: 1.0,
      },
      {
        id: 'r_arm',
        name: 'Sword Arm',
        hp: 25,
        maxHp: 25,
        isSevered: false,
        isVital: false,
        hitChanceMod: -10,
        damageMultiplier: 1.0,
      },
    ],
  },
};
