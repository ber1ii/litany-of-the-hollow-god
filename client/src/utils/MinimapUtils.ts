import { TILE_TYPES } from '../components/Game/MapData';
import { getTileDef } from '../data/TileRegistry';

// --- HELPERS ---

const isStructure = (v: number) => {
  if (
    v === TILE_TYPES.KEY_SILVER ||
    v === TILE_TYPES.GOLD ||
    v === TILE_TYPES.SKELETON ||
    v === TILE_TYPES.POTION_RED ||
    v === TILE_TYPES.POTION_BLUE
  ) {
    return false;
  }
  const def = getTileDef(v);
  if (def.type === 'item') return false;
  return (
    def &&
    (def.type === 'wall' ||
      v === TILE_TYPES.DOOR_CLOSED ||
      v === TILE_TYPES.DOOR_OPEN ||
      v === TILE_TYPES.DOOR_LOCKED_SILVER)
  );
};

export const getWallOrientation = (
  tx: number,
  tz: number,
  map: number[][]
): 'horizontal' | 'vertical' | 'none' => {
  const h = map.length;
  const w = map[0].length;

  if (tx < 0 || tx >= w || tz < 0 || tz >= h) return 'none';
  const tileId = map[tz][tx];

  // If it's not a structure, it has no orientation
  if (!isStructure(tileId)) return 'none';

  const valNorth = tz > 0 ? map[tz - 1][tx] : 0;
  const valSouth = tz < h - 1 ? map[tz + 1][tx] : 0;
  const valWest = tx > 0 ? map[tz][tx - 1] : 0;
  const valEast = tx < w - 1 ? map[tz][tx + 1] : 0;

  // 1. Surrounded Vertical
  if (isStructure(valNorth) && isStructure(valSouth)) return 'vertical';

  // 2. Surrounded Horizontal
  if (isStructure(valWest) && isStructure(valEast)) return 'horizontal';

  // 3. Dangling / End pieces
  // If we have a neighbor North/South but NOT West/East -> Vertical
  if (
    (isStructure(valNorth) || isStructure(valSouth)) &&
    !isStructure(valWest) &&
    !isStructure(valEast)
  ) {
    return 'vertical';
  }

  // Default to Horizontal for everything else (including corners, which will overlap nicely)
  return 'horizontal';
};

// --- RAYCASTING ---

export const hasLineOfSight = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  map: number[][]
): boolean => {
  let x = Math.floor(x0);
  let y = Math.floor(y0);
  const endX = Math.floor(x1);
  const endY = Math.floor(y1);

  const dx = Math.abs(endX - x);
  const dy = Math.abs(endY - y);
  const sx = x < endX ? 1 : -1;
  const sy = y < endY ? 1 : -1;
  let err = dx - dy;

  while (true) {
    if (y >= 0 && y < map.length && x >= 0 && x < map[0].length) {
      const tileId = map[y][x];
      const def = getTileDef(tileId);

      const isTarget = x === endX && y === endY;
      const isStart = x === Math.floor(x0) && y === Math.floor(y0);

      if (!isStart && !isTarget) {
        if (
          def.type === 'wall' ||
          tileId === TILE_TYPES.DOOR_CLOSED ||
          tileId === TILE_TYPES.DOOR_LOCKED_SILVER
        ) {
          return false;
        }
      }
    }

    if (x === endX && y === endY) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }

  return true;
};
