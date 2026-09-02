import { getTileDef, TILE_IDS } from '../../data/TileRegistry';
import { getWallOrientation } from '../../utils/WallOrientation';
import { buildStructureFootprint } from '../../utils/StructureFootprint';
import { getSpawnPosition } from '../../utils/MapParser';

export const TILE_SIZE = 0.5;
export const TILE_TYPES = TILE_IDS;

// --- Derived world-scale constants (ratios preserved from original tuning) ---
export const WALL_THICKNESS = TILE_SIZE / 3; // was hardcoded 0.25
export const PLAYER_RADIUS = TILE_SIZE * 0.267; // was hardcoded 0.2
export const MOVEMENT_SPEED = TILE_SIZE * 4; // was hardcoded 3
export const DOOR_WIDTH = TILE_SIZE * 1.2; // was hardcoded 0.9
export const DOOR_HEIGHT = TILE_SIZE * 1.867; // was hardcoded 1.4
export const WALL_TOTAL_HEIGHT = TILE_SIZE * 4; // was hardcoded 3.0
export const CAM_OFFSET_Y = TILE_SIZE * 4; // was hardcoded 3
export const CAM_OFFSET_Z = TILE_SIZE * 3.333; // was hardcoded 2.5
export const STRUCTURE_HEIGHT_DEFAULT = TILE_SIZE * 5; // was hardcoded "5" (tile-units) — now scaled + shortened
export const MONSTER_SCALE = TILE_SIZE * 1.867; // was hardcoded 1.4
export const TORCH_SIZE = TILE_SIZE * 0.453; // was hardcoded 0.34
export const BONFIRE_SIZE = TILE_SIZE * 0.8; // was hardcoded 0.6
export const LOOT_DROP_SIZE = TILE_SIZE * 0.333; // was hardcoded 0.25
export const KEY_ITEM_SIZE = TILE_SIZE * 0.533; // was hardcoded 0.4
export const GOLD_SIZE = TILE_SIZE * 3; // was hardcoded 1 * 0.8 scale
export const CANDLE_WIDTH = TILE_SIZE * 0.2; // was hardcoded 0.15
export const CANDLE_HEIGHT = TILE_SIZE * 0.267; // was hardcoded 0.2

// Character plane — THE ACTUAL BUG. Was fixed at 2x2 regardless of TILE_SIZE.
// Ratio below (2 / former TILE_SIZE=1) restores original intended proportion.
export const CHARACTER_SIZE = TILE_SIZE * 3;

export const LEVEL_1_ASCII = [
  '#######################D....##',
  '#.........#.....#.....#.....##',
  '#.........#.....#.....#.....##',
  '#.........#.....#.....#.....##',
  '#@11.Y....#     #######.....##',
  '#.11......#     #............#',
  '#.........#     #......s.....#',
  '#.........#     #.........4..#',
  '#.....Y...#     #............#',
  '#.....B...#     #......Y..4..#',
  '#.........#......#...........#',
  '#.........#......#...........#',
  '#.........].......#..........#',
  '#.................#T......T..#',
  '#.................#..........#',
  '#..T........... ..#..........#',
  '####....##........######L#####',
  '#....................Y.......#',
  '#...444.....33....$..........#',
  '#...444.........Y............#',
  '#.........T.........g....T...#',
  '#...88Y.....h................#',
  '#......T.........5555........#',
  '#........................k...#',
  '##############################',
];

export const LEVEL_2_ASCII = [
  '##############################',
  '#.............@...............',
  '#.............................',
  '##############################',
].map((r) => r.padEnd(30, '.').slice(0, 30));
export const LEVEL_2_SPAWN = getSpawnPosition(LEVEL_2_ASCII);

// Dynamic spawn location parsed directly from the '@' symbol in LEVEL_1_ASCII
export const PLAYER_SPAWN = getSpawnPosition(LEVEL_1_ASCII);

export const generateCollisionGrid = (mapData: number[][]) => {
  const height = mapData.length;
  const width = mapData[0]?.length ?? 0;
  const collision = mapData.map((row) => row.map(() => false));

  const footprint = buildStructureFootprint(mapData);
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      const id = footprint[z][x];
      if (id === null) continue;
      if (getTileDef(id).solid) collision[z][x] = true;
    }
  }

  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      const id = mapData[z][x];
      if (id === 0) continue;

      const def = getTileDef(id);
      if (def.placement !== 'modular') continue;
      if (def.solid === false) continue;

      const isVertical = getWallOrientation(mapData, x, z) === 'vertical';
      for (let i = 0; i < def.size.w; i++) {
        if (isVertical) {
          if (z + i < height) collision[z + i][x] = true;
        } else if (x + i < width) {
          collision[z][x + i] = true;
        }
      }
    }
  }

  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      const id = mapData[z][x];
      if (id === 0) continue;
      const def = getTileDef(id);
      if (def && def.type === 'door' && id !== TILE_TYPES.DOOR_OPEN) {
        collision[z][x] = true;
      }
    }
  }

  return collision;
};
