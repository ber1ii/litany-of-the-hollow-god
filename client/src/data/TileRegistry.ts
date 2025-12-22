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

export const TILE_REGISTRY: Record<number, TileDef> = {
  // --- SPECIAL / DEFAULTS ---
  0: {
    id: 0,
    name: 'standard_floor',
    type: 'floor',
    atlasPos: { col: 46, row: 13 },
    size: { w: 1, h: 1 },
    solid: false,
  },
  2: {
    id: 2,
    name: 'base_floor',
    type: 'floor',
    atlasPos: { col: 46, row: 13 },
    size: { w: 1, h: 1 },
    solid: false,
  },

  // --- ITEMS & MOBS ---
  4: {
    id: 4,
    name: 'gold',
    type: 'item',
    atlasPos: { col: 0, row: 0 },
    size: { w: 1, h: 1 },
    solid: false,
  },
  5: {
    id: 5,
    name: 'skeleton',
    type: 'item',
    atlasPos: { col: 0, row: 0 },
    size: { w: 1, h: 1 },
    solid: false,
  },
  20: {
    id: 20,
    name: 'potion_red',
    type: 'item',
    atlasPos: { col: 0, row: 0 },
    size: { w: 1, h: 1 },
    solid: false,
    itemId: 'potion_red',
  },
  21: {
    id: 21,
    name: 'potion_blue',
    type: 'item',
    atlasPos: { col: 0, row: 0 },
    size: { w: 1, h: 1 },
    solid: false,
    itemId: 'potion_blue',
  },
  6: {
    id: 6,
    name: 'key_silver',
    type: 'item',
    atlasPos: { col: 0, row: 0 },
    size: { w: 1, h: 1 },
    solid: false,
    itemId: 'silver_key',
  },

  9: {
    id: 9,
    name: 'bonfire',
    type: 'prop',
    atlasPos: { col: 46, row: 13 },
    size: { w: 1, h: 1 },
    solid: false,
  },

  // --- FLOORS ---
  10: {
    id: 10,
    name: 'stone_floor_1',
    type: 'floor',
    atlasPos: { col: 46, row: 13 },
    size: { w: 2, h: 3 },
  },
  11: {
    id: 11,
    name: 'cobblestone_1',
    type: 'floor',
    atlasPos: { col: 46, row: 17 },
    size: { w: 2, h: 2 },
  },
  12: {
    id: 12,
    name: 'cobblestone_2',
    type: 'floor',
    atlasPos: { col: 46, row: 20 },
    size: { w: 2, h: 2 },
  },
  13: {
    id: 13,
    name: 'cobblestone_3',
    type: 'floor',
    atlasPos: { col: 46, row: 23 },
    size: { w: 2, h: 2 },
  },
  14: {
    id: 14,
    name: 'dirt_patch_1',
    type: 'floor',
    atlasPos: { col: 46, row: 26 },
    size: { w: 4, h: 4 },
  },
  15: {
    id: 15,
    name: 'stone_floor_2',
    type: 'floor',
    atlasPos: { col: 49, row: 13 },
    size: { w: 2, h: 3 },
  },
  16: {
    id: 16,
    name: 'cobblestone_4',
    type: 'floor',
    atlasPos: { col: 49, row: 17 },
    size: { w: 2, h: 2 },
  },
  17: {
    id: 17,
    name: 'cobblestone_5',
    type: 'floor',
    atlasPos: { col: 49, row: 20 },
    size: { w: 2, h: 2 },
  },

  // --- DOORS ---
  30: {
    id: 30,
    name: 'door_closed',
    type: 'wall',
    atlasPos: { col: 0, row: 0 },
    size: { w: 1, h: 1 },
    solid: true,
  },
  31: {
    id: 31,
    name: 'door_open',
    type: 'floor',
    // FIX: Match standard floor (46, 13) instead of (0, 0)
    atlasPos: { col: 46, row: 13 },
    size: { w: 1, h: 1 },
    solid: false,
  },
  32: {
    id: 32,
    name: 'door_locked_silver',
    type: 'wall',
    atlasPos: { col: 0, row: 0 },
    size: { w: 1, h: 1 },
    solid: true,
  },

  // --- WALLS ---
  1: {
    id: 1,
    name: 'wall_generic',
    type: 'wall',
    atlasPos: { col: 25, row: 7 },
    size: { w: 1, h: 5 },
    solid: true,
  },
  100: {
    id: 100,
    name: 'huge_building',
    type: 'wall',
    atlasPos: { col: 1, row: 2 },
    size: { w: 18, h: 10 },
    solid: true,
  },
  51: {
    id: 51,
    name: 'long_wall_1',
    type: 'wall',
    atlasPos: { col: 3, row: 12 },
    size: { w: 14, h: 5 },
    solid: true,
  },
  53: {
    id: 53,
    name: 'double_archway',
    type: 'wall',
    atlasPos: { col: 17, row: 1 },
    size: { w: 5, h: 11 },
    solid: true,
  },
  55: {
    id: 55,
    name: 'single_archway',
    type: 'wall',
    atlasPos: { col: 25, row: 1 },
    size: { w: 5, h: 6 },
    solid: true,
  },
  50: {
    id: 50,
    name: 'basic_wall_1',
    type: 'wall',
    atlasPos: { col: 19, row: 21 },
    size: { w: 4, h: 3 },
    solid: true,
  },
  52: {
    id: 52,
    name: 'dark_archway',
    type: 'wall',
    atlasPos: { col: 40, row: 0 },
    size: { w: 5, h: 6 },
    solid: true,
  },
  54: {
    id: 54,
    name: 'wall_bars',
    type: 'wall',
    atlasPos: { col: 16, row: 13 },
    size: { w: 5, h: 3 },
    solid: true,
  },
  60: {
    id: 60,
    name: 'wall_pillar_1',
    type: 'wall',
    atlasPos: { col: 1, row: 21 },
    size: { w: 2, h: 5 },
    solid: true,
  },
  // Torch/Candle
  7: {
    id: 7,
    name: 'torch_wall',
    type: 'wall',
    atlasPos: { col: 25, row: 7 }, // Generic wall background
    size: { w: 1, h: 5 },
    solid: true,
  },
  8: {
    id: 8,
    name: 'candle',
    type: 'prop',
    atlasPos: { col: 0, row: 0 },
    size: { w: 1, h: 1 },
    solid: false,
  },
};

export const getTileDef = (id: number): TileDef => {
  return TILE_REGISTRY[id] || TILE_REGISTRY[1];
};
