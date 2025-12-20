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
  map[0][x] = 1; // Top
  map[MAP_HEIGHT - 1][x] = 1; // Bottom
}
for (let z = 0; z < MAP_HEIGHT; z++) {
  map[z][0] = 1; // Left
  map[z][MAP_WIDTH - 1] = 1; // Right
}

// Horizontal Split (Separates Hallway from Bottom Rooms)
for (let x = 1; x < MAP_WIDTH - 1; x++) {
  map[12][x] = 1;
}

// Vertical Split (Separates Bottom Left from Bottom Right)
for (let z = 12; z < MAP_HEIGHT - 1; z++) {
  map[z][14] = 1;
}

// --- 2. OPENINGS & DOORS ---

// Archway between Bottom Rooms (Gap in Vertical Split)
map[22][14] = TILE_TYPES.DOOR_CLOSED;

// Locked Door to Hallway (In Horizontal Split)
map[12][22] = TILE_TYPES.DOOR_LOCKED_SILVER;

// --- 3. ITEMS & ENEMIES ---

// Room 1 (Bottom Left): Gold
map[25][5] = TILE_TYPES.GOLD;

// Room 2 (Bottom Right): Skeleton & Key
map[22][19] = TILE_TYPES.SKELETON;
map[22][26] = TILE_TYPES.KEY_SILVER;

export const LEVEL_1_MAP = map;

export const generateCollisionGrid = (mapData: number[][]) => {
  const collision = mapData.map((row) => row.map(() => false));

  for (let z = 0; z < mapData.length; z++) {
    for (let x = 0; x < mapData[z].length; x++) {
      const id = mapData[z][x];
      if (id === 0) continue;

      // EXPLICIT PASS: Ensure we can always walk on Items and Open Doors
      if (
        id === TILE_TYPES.KEY_SILVER ||
        id === TILE_TYPES.GOLD ||
        id === TILE_TYPES.SKELETON ||
        id === TILE_TYPES.DOOR_OPEN
      ) {
        continue; // Do not mark as solid
      }

      const def = getTileDef(id);
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
