import { getTileDef, TILE_IDS } from '../../data/TileRegistry';
import { getWallOrientation } from '../../utils/WallOrientation';
import { buildStructureFootprint } from '../../utils/StructureFootprint';
import { getSpawnPosition } from '../../utils/MapParser';

export const TILE_SIZE = 1;
export const TILE_TYPES = TILE_IDS;

export const LEVEL_1_ASCII = [
  '##############################',
  '#@11........T................#',
  '#.11.........................#',
  '#...................g........#',
  '#.........#d###..............#',
  '#.........#...#..............#',
  '#.........#B..#......s.......#',
  '#.........#$W.#..............#',
  '##A########...#######L########',
  '.............................#',
  '....444...........R..........#',
  '....444......................#',
  '.........................k...#',
  '#####D########################',
];

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
