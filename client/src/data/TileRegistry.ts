export const SHEET_CONFIG = {
  width: 1024,
  height: 640,
  tileSize: 16,
};

export interface TileDef {
  id: number;
  name: string;
  type: 'floor' | 'wall' | 'prop';
  atlasPos: { col: number; row: number };
  size?: { w: number; h: number }; // Size in "tiles" (e.g., 1x1, 2x2)
  solid?: boolean;
}

export const TILE_REGISTRY: Record<number, TileDef> = {
  // Special
  0: {
    id: 0,
    name: 'standard_floor',
    type: 'floor',
    atlasPos: { col: 46, row: 13 }, // Uses top-left of stone floor block
    size: { w: 1, h: 1 },
  },

  // --- FLOORS ---
  2: {
    id: 2,
    name: 'base_floor',
    type: 'floor',
    atlasPos: { col: 46, row: 13 },
    size: { w: 1, h: 1 },
  },
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

  // Walls
  // Basic Wall 1(19,21) 4x3
  50: {
    id: 50,
    name: 'basic_wall_1',
    type: 'wall',
    atlasPos: { col: 19, row: 21 },
    size: { w: 4, h: 3 },
    solid: true,
  },
  // Long Wall 1(3,12) 14x5
  51: {
    id: 51,
    name: 'long_wall_1',
    type: 'wall',
    atlasPos: { col: 3, row: 12 },
    size: { w: 14, h: 5 },
    solid: true,
  },
  // Dark Archway(40,0) 5x6
  52: {
    id: 52,
    name: 'dark_archway',
    type: 'wall',
    atlasPos: { col: 40, row: 0 },
    size: { w: 5, h: 6 },
    solid: true,
  },
};

export const getTileDef = (id: number): TileDef => {
  return TILE_REGISTRY[id] || TILE_REGISTRY[0];
};
