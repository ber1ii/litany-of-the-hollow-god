import { getTileDef, TILE_IDS } from '../../data/TileRegistry';

export const TILE_SIZE = 1;
export const TILE_TYPES = TILE_IDS;

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

// Room 1 (Bottom Left): Gold, Bonfire & Iron Broadsword for testing
map[25][5] = TILE_TYPES.GOLD;
map[24][5] = TILE_TYPES.BONFIRE;
map[25][6] = TILE_TYPES.IRON_BROADSWORD; // Placed next to gold
map[27][5] = TILE_TYPES.ORC2;

// Room 1: Line-of-Sight Test Wall (Hide behind this)
map[25][8] = 1;
map[26][8] = 1;
map[27][8] = 1;

// Room 1: Cursed Ground Patch (COBBLESTONE_5)
map[26][4] = TILE_TYPES.COBBLESTONE_5;
map[26][5] = TILE_TYPES.COBBLESTONE_5;
map[26][6] = TILE_TYPES.COBBLESTONE_5;

// Room 2 (Bottom Right): Vampire 1 & Key
map[22][19] = TILE_TYPES.VAMPIRE_BOSS;
map[22][26] = TILE_TYPES.KEY_SILVER;

// Props
map[23][4] = TILE_TYPES.TORCH_WALL;
map[23][6] = TILE_TYPES.CANDLE;

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
