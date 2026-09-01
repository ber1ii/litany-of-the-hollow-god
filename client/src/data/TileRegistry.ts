export const SHEET_CONFIG = {
  width: 1024,
  height: 640,
  tileSize: 16,
};

export interface TileDef {
  id: number;
  name: string;
  type: 'floor' | 'wall' | 'prop' | 'item';
  atlasPos: { col: number; row: number };
  size: { w: number; h: number }; // Size in "tiles"
  solid?: boolean;
  itemId?: string;
}

export const TILE_IDS = {
  // --- SPECIAL / DEFAULTS ---
  FLOOR_BASE: 0,
  BASE_FLOOR: 2,

  // --- ITEMS & MOBS ---
  GOLD: 4,
  SKELETON: 5,
  KEY_SILVER: 6,
  POTION_RED: 20,
  POTION_BLUE: 21,
  IRON_BROADSWORD: 22,

  // --- ENEMY SPAWN MARKERS ---
  ORC2: 40,
  ORC3: 41,
  VAMPIRE1: 42,
  VAMPIRE_BOSS: 43,

  // --- PROPS ---
  TORCH_WALL: 7,
  CANDLE: 8,
  BONFIRE: 9,

  // --- FLOORS ---
  STONE_FLOOR_1: 10,
  COBBLESTONE_1: 11,
  COBBLESTONE_2: 12,
  COBBLESTONE_3: 13,
  DIRT_PATCH_1: 14,
  STONE_FLOOR_2: 15,
  COBBLESTONE_4: 16,
  COBBLESTONE_5: 17,

  // --- DOORS ---
  DOOR_CLOSED: 30,
  DOOR_OPEN: 31,
  DOOR_LOCKED_SILVER: 32,

  // --- WALLS ---
  WALL_GENERIC: 1,
  HUGE_BUILDING: 100,
  WALL_LONG: 51,
  ARCH_DOUBLE: 53,
  ARCH_SINGLE: 55,
  WALL_BASIC: 50,
  ARCH_DARK: 52,
  WALL_BARS: 54,
  WALL_PILLAR_1: 60,
} as const;

export const TILE_REGISTRY: Record<number, TileDef> = {
  // --- SPECIAL / DEFAULTS ---
  [TILE_IDS.FLOOR_BASE]: {
    id: TILE_IDS.FLOOR_BASE,
    name: 'standard_floor',
    type: 'floor',
    atlasPos: { col: 46, row: 13 },
    size: { w: 1, h: 1 },
    solid: false,
  },
  [TILE_IDS.BASE_FLOOR]: {
    id: TILE_IDS.BASE_FLOOR,
    name: 'base_floor',
    type: 'floor',
    atlasPos: { col: 46, row: 13 },
    size: { w: 1, h: 1 },
    solid: false,
  },

  // --- ITEMS & MOBS ---
  [TILE_IDS.GOLD]: {
    id: TILE_IDS.GOLD,
    name: 'gold',
    type: 'item',
    atlasPos: { col: 0, row: 0 },
    size: { w: 1, h: 1 },
    solid: false,
  },
  [TILE_IDS.SKELETON]: {
    id: TILE_IDS.SKELETON,
    name: 'skeleton',
    type: 'item',
    atlasPos: { col: 0, row: 0 },
    size: { w: 1, h: 1 },
    solid: false,
  },
  [TILE_IDS.POTION_RED]: {
    id: TILE_IDS.POTION_RED,
    name: 'potion_red',
    type: 'item',
    atlasPos: { col: 0, row: 0 },
    size: { w: 1, h: 1 },
    solid: false,
    itemId: 'potion_red',
  },
  [TILE_IDS.POTION_BLUE]: {
    id: TILE_IDS.POTION_BLUE,
    name: 'potion_blue',
    type: 'item',
    atlasPos: { col: 0, row: 0 },
    size: { w: 1, h: 1 },
    solid: false,
    itemId: 'potion_blue',
  },
  [TILE_IDS.KEY_SILVER]: {
    id: TILE_IDS.KEY_SILVER,
    name: 'key_silver',
    type: 'item',
    atlasPos: { col: 0, row: 0 },
    size: { w: 1, h: 1 },
    solid: false,
    itemId: 'silver_key',
  },
  [TILE_IDS.IRON_BROADSWORD]: {
    id: TILE_IDS.IRON_BROADSWORD,
    name: 'iron_broadsword',
    type: 'item',
    atlasPos: { col: 0, row: 0 },
    size: { w: 1, h: 1 },
    solid: false,
    itemId: 'iron_broadsword',
  },

  // --- ENEMY SPAWN MARKERS ---
  [TILE_IDS.ORC2]: {
    id: TILE_IDS.ORC2,
    name: 'orc2_spawn',
    type: 'item',
    atlasPos: { col: 0, row: 0 },
    size: { w: 1, h: 1 },
    solid: false,
  },
  [TILE_IDS.ORC3]: {
    id: TILE_IDS.ORC3,
    name: 'orc3_spawn',
    type: 'item',
    atlasPos: { col: 0, row: 0 },
    size: { w: 1, h: 1 },
    solid: false,
  },
  [TILE_IDS.VAMPIRE1]: {
    id: TILE_IDS.VAMPIRE1,
    name: 'vampire1_spawn',
    type: 'item',
    atlasPos: { col: 0, row: 0 },
    size: { w: 1, h: 1 },
    solid: false,
  },
  [TILE_IDS.VAMPIRE_BOSS]: {
    id: TILE_IDS.VAMPIRE_BOSS,
    name: 'vampire_boss_spawn',
    type: 'item',
    atlasPos: { col: 0, row: 0 },
    size: { w: 1, h: 1 },
    solid: false,
  },

  [TILE_IDS.BONFIRE]: {
    id: TILE_IDS.BONFIRE,
    name: 'bonfire',
    type: 'prop',
    atlasPos: { col: 46, row: 13 },
    size: { w: 1, h: 1 },
    solid: true,
  },

  // --- FLOORS ---
  [TILE_IDS.STONE_FLOOR_1]: {
    id: TILE_IDS.STONE_FLOOR_1,
    name: 'stone_floor_1',
    type: 'floor',
    atlasPos: { col: 46, row: 13 },
    size: { w: 2, h: 3 },
  },
  [TILE_IDS.COBBLESTONE_1]: {
    id: TILE_IDS.COBBLESTONE_1,
    name: 'cobblestone_1',
    type: 'floor',
    atlasPos: { col: 46, row: 17 },
    size: { w: 2, h: 2 },
  },
  [TILE_IDS.COBBLESTONE_2]: {
    id: TILE_IDS.COBBLESTONE_2,
    name: 'cobblestone_2',
    type: 'floor',
    atlasPos: { col: 46, row: 20 },
    size: { w: 2, h: 2 },
  },
  [TILE_IDS.COBBLESTONE_3]: {
    id: TILE_IDS.COBBLESTONE_3,
    name: 'cobblestone_3',
    type: 'floor',
    atlasPos: { col: 46, row: 23 },
    size: { w: 2, h: 2 },
  },
  [TILE_IDS.DIRT_PATCH_1]: {
    id: TILE_IDS.DIRT_PATCH_1,
    name: 'dirt_patch_1',
    type: 'floor',
    atlasPos: { col: 46, row: 26 },
    size: { w: 4, h: 4 },
  },
  [TILE_IDS.STONE_FLOOR_2]: {
    id: TILE_IDS.STONE_FLOOR_2,
    name: 'stone_floor_2',
    type: 'floor',
    atlasPos: { col: 49, row: 13 },
    size: { w: 2, h: 3 },
  },
  [TILE_IDS.COBBLESTONE_4]: {
    id: TILE_IDS.COBBLESTONE_4,
    name: 'cobblestone_4',
    type: 'floor',
    atlasPos: { col: 49, row: 17 },
    size: { w: 2, h: 2 },
  },
  [TILE_IDS.COBBLESTONE_5]: {
    id: TILE_IDS.COBBLESTONE_5,
    name: 'cobblestone_5',
    type: 'floor',
    atlasPos: { col: 49, row: 20 },
    size: { w: 2, h: 2 },
  },

  // --- DOORS ---
  [TILE_IDS.DOOR_CLOSED]: {
    id: TILE_IDS.DOOR_CLOSED,
    name: 'door_closed',
    type: 'wall',
    atlasPos: { col: 0, row: 0 },
    size: { w: 1, h: 1 },
    solid: true,
  },
  [TILE_IDS.DOOR_OPEN]: {
    id: TILE_IDS.DOOR_OPEN,
    name: 'door_open',
    type: 'floor',
    atlasPos: { col: 46, row: 13 },
    size: { w: 1, h: 1 },
    solid: false,
  },
  [TILE_IDS.DOOR_LOCKED_SILVER]: {
    id: TILE_IDS.DOOR_LOCKED_SILVER,
    name: 'door_locked_silver',
    type: 'wall',
    atlasPos: { col: 0, row: 0 },
    size: { w: 1, h: 1 },
    solid: true,
  },

  // --- WALLS ---
  [TILE_IDS.WALL_GENERIC]: {
    id: TILE_IDS.WALL_GENERIC,
    name: 'wall_generic',
    type: 'wall',
    atlasPos: { col: 25, row: 7 },
    size: { w: 1, h: 5 },
    solid: true,
  },
  [TILE_IDS.HUGE_BUILDING]: {
    id: TILE_IDS.HUGE_BUILDING,
    name: 'huge_building',
    type: 'wall',
    atlasPos: { col: 1, row: 2 },
    size: { w: 18, h: 10 },
    solid: true,
  },
  [TILE_IDS.WALL_LONG]: {
    id: TILE_IDS.WALL_LONG,
    name: 'long_wall_1',
    type: 'wall',
    atlasPos: { col: 3, row: 12 },
    size: { w: 14, h: 5 },
    solid: true,
  },
  [TILE_IDS.ARCH_DOUBLE]: {
    id: TILE_IDS.ARCH_DOUBLE,
    name: 'double_archway',
    type: 'wall',
    atlasPos: { col: 17, row: 1 },
    size: { w: 5, h: 11 },
    solid: true,
  },
  [TILE_IDS.ARCH_SINGLE]: {
    id: TILE_IDS.ARCH_SINGLE,
    name: 'single_archway',
    type: 'wall',
    atlasPos: { col: 25, row: 1 },
    size: { w: 5, h: 6 },
    solid: true,
  },
  [TILE_IDS.WALL_BASIC]: {
    id: TILE_IDS.WALL_BASIC,
    name: 'basic_wall_1',
    type: 'wall',
    atlasPos: { col: 19, row: 21 },
    size: { w: 4, h: 3 },
    solid: true,
  },
  [TILE_IDS.ARCH_DARK]: {
    id: TILE_IDS.ARCH_DARK,
    name: 'dark_archway',
    type: 'wall',
    atlasPos: { col: 40, row: 0 },
    size: { w: 5, h: 6 },
    solid: true,
  },
  [TILE_IDS.WALL_BARS]: {
    id: TILE_IDS.WALL_BARS,
    name: 'wall_bars',
    type: 'wall',
    atlasPos: { col: 16, row: 13 },
    size: { w: 5, h: 3 },
    solid: true,
  },
  [TILE_IDS.WALL_PILLAR_1]: {
    id: TILE_IDS.WALL_PILLAR_1,
    name: 'wall_pillar_1',
    type: 'wall',
    atlasPos: { col: 1, row: 21 },
    size: { w: 2, h: 5 },
    solid: true,
  },
  // Torch/Candle
  [TILE_IDS.TORCH_WALL]: {
    id: TILE_IDS.TORCH_WALL,
    name: 'torch_wall',
    type: 'wall',
    atlasPos: { col: 25, row: 7 },
    size: { w: 1, h: 5 },
    solid: false,
  },
  [TILE_IDS.CANDLE]: {
    id: TILE_IDS.CANDLE,
    name: 'candle',
    type: 'prop',
    atlasPos: { col: 0, row: 0 },
    size: { w: 1, h: 1 },
    solid: false,
  },
};

export const getTileDef = (id: number): TileDef => {
  return TILE_REGISTRY[id] || TILE_REGISTRY[TILE_IDS.WALL_GENERIC];
};
