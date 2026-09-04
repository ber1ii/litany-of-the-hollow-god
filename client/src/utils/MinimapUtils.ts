import { TILE_TYPES } from '../components/Game/MapData';
import { getTileDef } from '../data/TileRegistry';
import { getEffectiveTileId, type FootprintGrid } from './StructureFootprint';

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

  if (!isStructure(tileId)) return 'none';

  const valNorth = tz > 0 ? map[tz - 1][tx] : 0;
  const valSouth = tz < h - 1 ? map[tz + 1][tx] : 0;
  const valWest = tx > 0 ? map[tz][tx - 1] : 0;
  const valEast = tx < w - 1 ? map[tz][tx + 1] : 0;

  if (isStructure(valNorth) && isStructure(valSouth)) return 'vertical';
  if (isStructure(valWest) && isStructure(valEast)) return 'horizontal';

  if (
    (isStructure(valNorth) || isStructure(valSouth)) &&
    !isStructure(valWest) &&
    !isStructure(valEast)
  ) {
    return 'vertical';
  }

  return 'horizontal';
};

export const hasLineOfSight = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  map: number[][],
  footprint: FootprintGrid
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
      const tileId = getEffectiveTileId(map, footprint, x, y);
      const def = getTileDef(tileId);

      const isTarget = x === endX && y === endY;
      const isStart = x === Math.floor(x0) && y === Math.floor(y0);

      if (!isStart && !isTarget) {
        // Only block line of sight if the tile is explicitly a wall or solid obstacle
        const isSolidWall =
          def.type === 'wall' ||
          (def.placement === 'structure' && def.type !== 'floor' && def.solid !== false);

        if (
          isSolidWall ||
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
