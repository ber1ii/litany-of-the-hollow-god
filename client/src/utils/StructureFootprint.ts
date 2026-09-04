import { getTileDef } from '../data/TileRegistry';

export type FootprintGrid = (number | null)[][];

/**
 * Expands every 'structure' placement tile from its authored anchor cell
 * (top-left) into a full grid marking every cell its footprint covers.
 */
export const buildStructureFootprint = (map: number[][]): FootprintGrid => {
  const height = map.length;
  const width = map[0]?.length ?? 0;
  const footprint: FootprintGrid = Array.from({ length: height }, () => Array(width).fill(null));

  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      const id = map[z][x];
      if (id === 0) continue;

      const def = getTileDef(id);
      if (def.placement !== 'structure') continue;

      const fp = def.footprint ?? def.size;

      for (let dz = 0; dz < fp.h; dz++) {
        for (let dx = 0; dx < fp.w; dx++) {
          const fz = z + dz;
          const fx = x + dx;
          if (fz < height && fx < width) {
            footprint[fz][fx] = id;
          }
        }
      }
    }
  }

  return footprint;
};

/**
 * The tile id "as seen by systems that care about occupancy": the raw map
 * id if the cell has one, otherwise whichever structure's footprint has
 * claimed the cell (or 0 if neither).
 */
export const getEffectiveTileId = (
  map: number[][],
  footprint: FootprintGrid,
  x: number,
  z: number
): number => {
  const raw = map[z]?.[x] ?? 0;
  const claimed = footprint[z]?.[x] ?? null;

  if (claimed !== null) {
    const rawDef = raw !== 0 ? getTileDef(raw) : null;
    if (!rawDef || rawDef.type === 'floor') {
      return claimed;
    }
  }

  return raw;
};

export const placeStructure = (map: number[][], id: number, x: number, z: number): void => {
  const def = getTileDef(id);
  if (def.placement !== 'structure') {
    throw new Error(`placeStructure: tile ${id} ("${def.name}") is not a 'structure' tile`);
  }

  const height = map.length;
  const width = map[0]?.length ?? 0;

  const fp = def.footprint ?? def.size;

  for (let dz = 0; dz < fp.h; dz++) {
    for (let dx = 0; dx < fp.w; dx++) {
      const tz = z + dz;
      const tx = x + dx;
      if (tz >= height || tx >= width || tz < 0 || tx < 0) {
        throw new Error(
          `placeStructure: "${def.name}" at (${x},${z}) size ${def.size.w}x${def.size.h} goes out of map bounds at (${tx},${tz})`
        );
      }
      if (map[tz][tx] !== 0) {
        throw new Error(
          `placeStructure: "${def.name}" at (${x},${z}) overlaps existing tile ${map[tz][tx]} at (${tx},${tz})`
        );
      }
    }
  }

  map[z][x] = id;
};
