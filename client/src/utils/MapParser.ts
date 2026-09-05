import { TILE_IDS, STRUCTURE_IDS, getTileDef } from '../data/TileRegistry';
import * as THREE from 'three';

export const getMapLegend = (): Record<string, number> => ({
  '@': TILE_IDS.BASE_FLOOR,
  ' ': 0,
  '.': TILE_IDS.BASE_FLOOR,
  d: TILE_IDS.DOOR_CLOSED,
  o: TILE_IDS.DOOR_OPEN,
  L: TILE_IDS.DOOR_LOCKED_SILVER,
  A: TILE_IDS.ARCH_SINGLE,
  M: TILE_IDS.ARCH_DOUBLE,
  D: TILE_IDS.ARCH_DARK,
  m: STRUCTURE_IDS['ARCH_DARK_THIN'] || 0,
  '#': TILE_IDS.WALL_GENERIC,
  '=': TILE_IDS.WALL_LONG,
  '-': STRUCTURE_IDS['WALL_LONG_INDENTED'] || 0,
  _: STRUCTURE_IDS['WALL_LONG_2'] || 0,
  '|': TILE_IDS.WALL_BASIC,
  '[': TILE_IDS.WALL_BARS,
  ']': STRUCTURE_IDS['WALL_PILLARS_BARS'] || 0,
  I: TILE_IDS.WALL_PILLAR_1,
  i: STRUCTURE_IDS['PILLAR_THIN_TALL'] || 0,
  p: STRUCTURE_IDS['PILLAR_1'] || 0,
  P: STRUCTURE_IDS['PILLAR_THICK'] || 0,
  q: STRUCTURE_IDS['PILLAR_STUBBY'] || 0,
  H: TILE_IDS.HUGE_BUILDING,
  E: STRUCTURE_IDS['BASEMENT_ENTRANCE_E'] || 0,
  w: STRUCTURE_IDS['BASEMENT_ENTRANCE_W'] || 0,
  U: STRUCTURE_IDS['WALL_GRAVE_SHAPED'] || 0,
  '1': TILE_IDS.STONE_FLOOR_1,
  '2': TILE_IDS.COBBLESTONE_1,
  '3': TILE_IDS.COBBLESTONE_2,
  '4': TILE_IDS.COBBLESTONE_3,
  '5': TILE_IDS.DIRT_PATCH_1,
  c: TILE_IDS.COBBLESTONE_5,
  '6': STRUCTURE_IDS['STONE_FLOOR2_A'] || 0,
  '7': STRUCTURE_IDS['COBBLESTONE_FLOOR2_A'] || 0,
  '8': STRUCTURE_IDS['STONE_FLOOR3_A'] || 0,
  '9': STRUCTURE_IDS['COBBLESTONE_FLOOR3_A'] || 0,
  g: STRUCTURE_IDS['GRATE_SMALL'] || 0,
  G: STRUCTURE_IDS['GRATE_LARGE'] || 0,
  x: STRUCTURE_IDS['GRATE_SMALL_ACID'] || 0,
  h: STRUCTURE_IDS['STONE_HOLE'] || 0,
  O: STRUCTURE_IDS['STONE_HOLE_CROSS'] || 0,
  $: TILE_IDS.GOLD,
  k: TILE_IDS.KEY_SILVER,
  B: TILE_IDS.BONFIRE,
  W: TILE_IDS.IRON_BROADSWORD,
  C: TILE_IDS.CANDLE,
  T: TILE_IDS.TORCH_WALL,
  s: TILE_IDS.SKELETON,
  R: TILE_IDS.ORC2,
  X: TILE_IDS.ORC3,
  v: TILE_IDS.VAMPIRE1,
  V: TILE_IDS.VAMPIRE_BOSS,
  Y: TILE_IDS.SIGN,
  '!': TILE_IDS.BASE_FLOOR,
  '*': TILE_IDS.BASE_FLOOR,
  F: TILE_IDS.PROP_FIREPLACE,
  '?': TILE_IDS.PROP_STOOL,
  '>': TILE_IDS.PROP_BAG,
  u: TILE_IDS.PROP_BUCKET,
  b: TILE_IDS.PROP_BASIN,
  t: TILE_IDS.PROP_CART,
  z: TILE_IDS.PROP_CUT_WOOD,
  f: TILE_IDS.PROP_DRIED_FISH,
  e: TILE_IDS.PROP_GRINDER,
  K: TILE_IDS.PROP_TARGET,
  Q: TILE_IDS.PROP_MANNEQUIN,
  S: TILE_IDS.PROP_SKIN_HANG,
  r: TILE_IDS.PROP_TROUGH,
  j: TILE_IDS.PROP_BROOM,
  y: TILE_IDS.PROP_PITCHFORK,
  '`': TILE_IDS.PROP_WHEEL,
  N: TILE_IDS.PROP_BOAT_FRAME,
  ':': TILE_IDS.POTION_RED,
  ';': TILE_IDS.POTION_BLUE,
  ',': TILE_IDS.STONE_FLOOR_2,
  '/': TILE_IDS.COBBLESTONE_4,
  '<': STRUCTURE_IDS['GRATE_SMALLER'] || 0,
  '\\': STRUCTURE_IDS['GRATE_SMALLER_ACID'] || 0,
  '~': STRUCTURE_IDS['STONE_STRIP'] || 0,
  J: STRUCTURE_IDS['WALL_PILLAR_2'] || 0,
  Z: STRUCTURE_IDS['PILLAR_2'] || 0,
  l: STRUCTURE_IDS['PILLAR_3'] || 0,
  n: STRUCTURE_IDS['WALL_DIRTY'] || 0,
  '0': STRUCTURE_IDS['WALL_VERY_LONG'] || 0,
  '^': STRUCTURE_IDS['WALL_BASIC_2'] || 0,
  '%': STRUCTURE_IDS['WALL_BASIC_3'] || 0,
  '&': STRUCTURE_IDS['WALL_BASIC_4'] || 0,
  a: STRUCTURE_IDS['PILLAR_THIN_SHORT'] || 0,
  '(': STRUCTURE_IDS['STONE_CIRCLE_LEFT'] || 0,
  ')': STRUCTURE_IDS['STONE_CIRCLE_RIGHT'] || 0,
  '+': STRUCTURE_IDS['OVAL_HALF_DOWN'] || 0,
  '{': STRUCTURE_IDS['COBBLESTONE_6'] || 0,
  '}': STRUCTURE_IDS['DIRT_PATCH_FLOOR2'] || 0,
  '"': STRUCTURE_IDS['DIRT_PATCH_FLOOR3'] || 0,
});

const RANDOM_FLOOR_POOL = [
  TILE_IDS.STONE_FLOOR_1,
  TILE_IDS.COBBLESTONE_1,
  TILE_IDS.COBBLESTONE_2,
  TILE_IDS.COBBLESTONE_3,
  TILE_IDS.DIRT_PATCH_1,
  TILE_IDS.STONE_FLOOR_2,
  TILE_IDS.COBBLESTONE_4,
];

const RANDOM_PROP_POOL = [
  TILE_IDS.PROP_STOOL,
  TILE_IDS.PROP_BAG,
  TILE_IDS.PROP_BUCKET,
  TILE_IDS.PROP_BASIN,
  TILE_IDS.PROP_CUT_WOOD,
  TILE_IDS.PROP_DRIED_FISH,
  TILE_IDS.PROP_BROOM,
  TILE_IDS.PROP_PITCHFORK,
];

export interface NoPropZone {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const floodFillRandomize = (
  mapGrid: number[][],
  startX: number,
  startZ: number,
  propChance: number = 0.012, // lowered from 0.03 — less prop clutter overall
  noPropZone?: NoPropZone
): void => {
  const height = mapGrid.length;
  const width = mapGrid[0].length;

  const targetTiles = [TILE_IDS.BASE_FLOOR, 0];
  const visited = new Set<string>();
  const queue = [{ x: startX, z: startZ }];

  while (queue.length > 0) {
    const { x, z } = queue.shift()!;
    const key = `${x},${z}`;

    if (x < 0 || x >= width || z < 0 || z >= height) continue;
    if (visited.has(key)) continue;
    visited.add(key);

    const currentTile = mapGrid[z][x];
    const isFillable = targetTiles.includes(currentTile);

    if (!isFillable) {
      // Any hand-placed, non-solid tile (grates, cobblestone variants, stone
      // holes, torches on the floor row, etc) is walkable but must NOT be
      // overwritten. Still spread the BFS through it so fill reaches floor
      // on the far side — otherwise a single hardcoded decorative tile
      // dead-ends the whole flood (this was the chase-corridor void bug).
      const def = currentTile !== 0 ? getTileDef(currentTile) : null;
      if (def && !def.solid) {
        queue.push({ x: x + 1, z });
        queue.push({ x: x - 1, z });
        queue.push({ x, z: z + 1 });
        queue.push({ x, z: z - 1 });
      }
      continue;
    }

    // Safeguard: Ensure we never drop a solid random prop exactly on the player spawn
    const isSpawnPoint = x === startX && z === startZ;

    // Chase corridor (or any caller-specified zone): floor only, no props,
    // so nothing blocks or visually clutters the boss chase.
    const inNoPropZone =
      !!noPropZone &&
      x >= noPropZone.minX &&
      x <= noPropZone.maxX &&
      z >= noPropZone.minZ &&
      z <= noPropZone.maxZ;

    if (!isSpawnPoint && !inNoPropZone && Math.random() < propChance) {
      mapGrid[z][x] = RANDOM_PROP_POOL[Math.floor(Math.random() * RANDOM_PROP_POOL.length)];
    } else {
      mapGrid[z][x] = RANDOM_FLOOR_POOL[Math.floor(Math.random() * RANDOM_FLOOR_POOL.length)];
    }

    queue.push({ x: x + 1, z });
    queue.push({ x: x - 1, z });
    queue.push({ x, z: z + 1 });
    queue.push({ x, z: z - 1 });
  }
};

export const getSpawnPosition = (asciiMap: string[], tileSize: number = 0.5): THREE.Vector3 => {
  for (let z = 0; z < asciiMap.length; z++) {
    for (let x = 0; x < asciiMap[z].length; x++) {
      if (asciiMap[z][x] === '@') {
        // Removed the +0.5 offset. Returning x * tileSize places the player squarely in the center.
        return new THREE.Vector3(x * tileSize, 0, z * tileSize);
      }
    }
  }
  return new THREE.Vector3(0, 0, 0);
};

export const getSpawnGridPosition = (asciiMap: string[]): { x: number; z: number } | null => {
  for (let z = 0; z < asciiMap.length; z++) {
    for (let x = 0; x < asciiMap[z].length; x++) {
      if (asciiMap[z][x] === '@') {
        return { x, z };
      }
    }
  }
  return null;
};

export const parseAsciiMap = (asciiMap: string[], noPropZone?: NoPropZone): number[][] => {
  const legend = getMapLegend();

  // Calculate the true width based on the longest row in the ASCII array
  const maxWidth = Math.max(...asciiMap.map((row) => row.length));

  const mapGrid = asciiMap.map((row) => {
    const parsedRow = row.split('').map((char) => {
      const tileId = legend[char];
      if (tileId === undefined) {
        console.warn(`Unrecognized map character: "${char}". Defaulting to 0.`);
        return 0;
      }
      return tileId;
    });

    // Pad shorter rows with empty space (0) so every row matches maxWidth
    while (parsedRow.length < maxWidth) {
      parsedRow.push(0);
    }

    return parsedRow;
  });

  // Automatically wire the floodfill so Level Registry dynamically generates the floor layout
  const spawnGrid = getSpawnGridPosition(asciiMap);
  if (spawnGrid) {
    floodFillRandomize(mapGrid, spawnGrid.x, spawnGrid.z, undefined, noPropZone);
  }

  return mapGrid;
};

// Builds a grid-space bounding box spanning two markers (e.g. the chase
// trigger markers '!' and '*' in LEVEL_2_ASCII), padded by `padding` tiles,
// for use as floodFillRandomize's noPropZone.
export const getNoPropZoneBetweenMarkers = (
  asciiMap: string[],
  markerA: string,
  markerB: string,
  padding: number = 2
): NoPropZone | null => {
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  let found = false;

  for (let z = 0; z < asciiMap.length; z++) {
    for (let x = 0; x < asciiMap[z].length; x++) {
      const ch = asciiMap[z][x];
      if (ch === markerA || ch === markerB) {
        found = true;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
      }
    }
  }

  if (!found) return null;
  return {
    minX: minX - padding,
    maxX: maxX + padding,
    minZ: minZ - padding,
    maxZ: maxZ + padding,
  };
};

export const getMarkerCenter = (
  asciiMap: string[],
  marker: string,
  tileSize: number = 0.5
): THREE.Vector3 | null => {
  let sumX = 0,
    sumZ = 0,
    count = 0;
  for (let z = 0; z < asciiMap.length; z++) {
    for (let x = 0; x < asciiMap[z].length; x++) {
      if (asciiMap[z][x] === marker) {
        sumX += x;
        sumZ += z;
        count++;
      }
    }
  }
  if (count === 0) return null;
  return new THREE.Vector3((sumX / count) * tileSize, 0, (sumZ / count) * tileSize);
};
