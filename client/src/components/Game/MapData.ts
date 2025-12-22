import { getTileDef } from '../../data/TileRegistry';

export const TILE_SIZE = 1;

export const TILE_TYPES = {
  FLOOR_BASE: 0,
  WALL_GENERIC: 1,

  DOOR_CLOSED: 30,
  DOOR_OPEN: 31,
  DOOR_LOCKED_SILVER: 32,
  KEY_SILVER: 6,

  GOLD: 4,
  SKELETON: 5,

  // Custom Wall IDs
  WALL_BASIC: 50,
  WALL_LONG: 51,
  ARCH_DARK: 52,
  ARCH_DOUBLE: 53,
  WALL_BARS: 54,
  HUGE_BUILDING: 100,

  TORCH_WALL: 7,
  CANDLE: 8,
  BONFIRE: 9,

  // NEW ITEMS (Kept here for ID reference, but not placed in map)
  POTION_RED: 20,
  POTION_BLUE: 21,
};

const MAP_WIDTH = 30;
const MAP_HEIGHT = 30;

const EMPTY_MAP = Array(MAP_HEIGHT)
  .fill(0)
  .map(() => Array(MAP_WIDTH).fill(0));

const map = [...EMPTY_MAP];

// --- 1. WALLS ---

// Outer Perimeter
for (let x = 0; x < MAP_WIDTH; x++) {
  map[0][x] = 1;
  map[MAP_HEIGHT - 1][x] = 1;
}
for (let z = 0; z < MAP_HEIGHT; z++) {
  map[z][0] = 1;
  map[z][MAP_WIDTH - 1] = 1;
}

// Horizontal Split
for (let x = 1; x < MAP_WIDTH - 1; x++) {
  map[12][x] = 1;
}

// Vertical Split
for (let z = 12; z < MAP_HEIGHT - 1; z++) {
  map[z][14] = 1;
}

// --- 2. OPENINGS & DOORS ---
map[22][14] = TILE_TYPES.DOOR_CLOSED;
map[12][22] = TILE_TYPES.DOOR_LOCKED_SILVER;

// --- 3. ITEMS & ENEMIES ---

// Room 1 (Bottom Left): Gold
map[25][5] = TILE_TYPES.GOLD;
// Removed Potion Pickups

// Room 2 (Bottom Right): Skeleton & Key
map[22][19] = TILE_TYPES.SKELETON;
map[22][26] = TILE_TYPES.KEY_SILVER;

// Props
map[23][4] = TILE_TYPES.TORCH_WALL;
map[23][6] = TILE_TYPES.CANDLE;

// --- 4. BONFIRE (Top Left Area) ---
map[5][5] = TILE_TYPES.BONFIRE;

export const LEVEL_1_MAP = map;

export const generateCollisionGrid = (mapData: number[][]) => {
  const collision = mapData.map((row) => row.map(() => false));

  for (let z = 0; z < mapData.length; z++) {
    for (let x = 0; x < mapData[z].length; x++) {
      const id = mapData[z][x];
      if (id === 0) continue;

      const def = getTileDef(id);

      if (def.solid === false) continue;

      if (def && def.solid) {
        for (let w = 0; w < def.size.w; w++) {
          if (x + w < mapData[0].length) {
            collision[z][x + w] = true;
          }
        }
      }
    }
  }
  return collision;
};
