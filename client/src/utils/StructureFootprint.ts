import { getTileDef } from '../data/TileRegistry';

export type FootprintGrid = (number | null)[][];

/**
 * Expands every 'structure' placement tile from its authored anchor cell
 * (top-left) into a full grid marking every cell its footprint covers.
 * Structures never rotate, so this is a plain w x h rectangle fill — no
 * orientation logic needed (that's only relevant to 'modular' tiles, which
 * are 1 cell thick and don't need a footprint at all).
 *
 * Uses `def.footprint` (ground-plane occupancy) when present, falling back
 * to `def.size` (atlas sprite size) otherwise — the two only diverge for
 * tiles like tall archways, where the sprite is many tiles high in the
 * atlas but only occupies a shallow strip on the ground.
 *
 * Anchor cells are included in the footprint too, so any code that just
 * wants "what structure (if any) claims this cell" doesn't need to special
 * case the anchor vs. the rest of the rectangle.
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
 * claimed the cell (or 0 if neither). Use this instead of indexing `map`
 * directly whenever you're checking a neighbor cell for wall/structure
 * adjacency — a cell can be empty in the sparse `map` but still be "inside"
 * a huge building.
 */
export const getEffectiveTileId = (
  map: number[][],
  footprint: FootprintGrid,
  x: number,
  z: number
): number => {
  const raw = map[z]?.[x] ?? 0;
  const claimed = footprint[z]?.[x] ?? null;

  // A structure's footprint should win over a plain floor tile drawn
  // underneath it — levels are authored as flat ASCII, so cells inside a
  // structure's footprint can still carry their own floor character for
  // visual continuity (e.g. the archway's own row). Only literal non-floor
  // entities on the raw map (doors, items, other structures) should take
  // priority over the footprint claim.
  if (claimed !== null) {
    const rawDef = raw !== 0 ? getTileDef(raw) : null;
    if (!rawDef || rawDef.type === 'floor') {
      return claimed;
    }
  }

  return raw;
};

/**
 * Authoring helper: writes a structure's anchor id into `map` at (x, z),
 * after verifying its full footprint is empty and in-bounds. Throws on any
 * overlap or out-of-bounds placement instead of silently corrupting the
 * map — catches off-by-one coordinate mistakes (e.g. from
 * mainlevbuildtiles.txt) at build time instead of at runtime.
 *
 * Only ever writes the single anchor cell — `map` stays sparse. Collision,
 * adjacency, and floor-fallback all derive the rest of the footprint from
 * buildStructureFootprint(), so nothing else needs to change to support
 * multi-cell structures.
 */
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
