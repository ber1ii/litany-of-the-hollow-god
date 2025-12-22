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
  stats: {
    maxHp: number;
    attack: number;
    xpReward: number;
  };
  scale: number;
  sprites: {
    idle: SpriteConfig;
    attack: SpriteConfig;
    hurt: SpriteConfig;
    death: SpriteConfig;
  };
}

export const ENEMIES: Record<string, EnemyDef> = {
  SKELETON: {
    id: 'skeleton',
    name: 'Human Structure (Failed)',
    tier: 'common',
    stats: {
      maxHp: 50,
      attack: 10,
      xpReward: 50,
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
  },
};
