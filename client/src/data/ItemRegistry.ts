export type ItemType = 'consumable' | 'weapon' | 'key' | 'material' | 'flask';

export interface ItemDef {
  id: string;
  name: string;
  type: ItemType;
  icon: string;
  description: string;
  stackable: boolean;
  spriteConfig?: {
    frames: number;
    columns: number;
    rows: number;
  };
  effect?: {
    type: 'heal' | 'restore_mind' | 'buff_attack';
    value: number;
  };
  stats?: {
    attack?: number;
    defense?: number;
  };
}

export const ITEM_REGISTRY: Record<string, ItemDef> = {
  // --- FLASKS (Permanent) ---
  flask_crimson: {
    id: 'flask_crimson',
    name: 'Crimson Flask',
    type: 'flask',
    icon: '/sprites/props/red_vial/potion_red_drop.png',
    description: 'Restores Vitality. Refills at Bonfire.',
    stackable: true, // We use count as "Charges"
    effect: { type: 'heal', value: 50 },
  },
  flask_cerulean: {
    id: 'flask_cerulean',
    name: 'Cerulean Flask',
    type: 'flask',
    icon: '/sprites/props/blue_vial/potion_blue_drop.png',
    description: 'Restores Mind. Refills at Bonfire.',
    stackable: true,
    effect: { type: 'restore_mind', value: 30 },
  },

  // --- WEAPONS ---
  rusty_sword: {
    id: 'rusty_sword',
    name: 'Rusty Sword',
    type: 'weapon',
    icon: '/sprites/items/weapons/sword_rusty.png',
    description: 'Barely holds together.',
    stackable: false,
    stats: { attack: 5 },
  },

  // --- KEYS / QUEST ---
  silver_key: {
    id: 'silver_key',
    name: 'Silver Key',
    type: 'key',
    icon: '/sprites/props/silver_key/silver_key.png',
    description: 'Cold to the touch.',
    stackable: false,
  },
};
