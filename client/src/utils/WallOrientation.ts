import { getTileDef, TILE_IDS } from '../data/TileRegistry';

// Tiles that behave as "wall-like" for orientation/adjacency purposes:
// anything registered as type 'wall', plus doors (which sit inline with
// walls but aren't type 'wall' in the registry).
export const isWallLike = (tileId: number): boolean => {
  if (
    tileId === TILE_IDS.DOOR_CLOSED ||
    tileId === TILE_IDS.DOOR_OPEN ||
    tileId === TILE_IDS.DOOR_LOCKED_SILVER
  ) {
    return true;
  }
  return getTileDef(tileId).type === 'wall';
};

export type WallOrientation = 'horizontal' | 'vertical' | 'none';

// Single source of truth for "is the wall run through this cell horizontal
// or vertical". Used by LevelBuilder (rendering/rotation/stretch/cull) and
// MapData (collision) so the two never disagree about which axis a modular
// wall segment runs along.
export const getWallOrientation = (map: number[][], tx: number, tz: number): WallOrientation => {
  const mapHeight = map.length;
  const mapWidth = map[0]?.length ?? 0;
  if (tx < 0 || tx >= mapWidth || tz < 0 || tz >= mapHeight) return 'none';
  if (!isWallLike(map[tz][tx])) return 'none';

  const north = tz > 0 ? map[tz - 1][tx] : 0;
  const south = tz < mapHeight - 1 ? map[tz + 1][tx] : 0;
  const west = tx > 0 ? map[tz][tx - 1] : 0;
  const east = tx < mapWidth - 1 ? map[tz][tx + 1] : 0;

  if (isWallLike(north) && isWallLike(south)) return 'vertical';
  if (isWallLike(west) && isWallLike(east)) return 'horizontal';
  if ((isWallLike(north) || isWallLike(south)) && !isWallLike(west) && !isWallLike(east)) {
    return 'vertical';
  }
  return 'horizontal';
};
