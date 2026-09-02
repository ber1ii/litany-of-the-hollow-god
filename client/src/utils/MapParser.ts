import { TILE_IDS, STRUCTURE_IDS } from '../data/TileRegistry';

// Wrap the legend in a function
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
});

export const getSpawnPosition = (asciiMap: string[]): { x: number; z: number } => {
  for (let z = 0; z < asciiMap.length; z++) {
    for (let x = 0; x < asciiMap[z].length; x++) {
      if (asciiMap[z][x] === '@') {
        return { x, z };
      }
    }
  }
  return { x: 1, z: 1 };
};

export const parseAsciiMap = (asciiMap: string[]): number[][] => {
  const legend = getMapLegend(); // Evaluate the legend here at runtime
  return asciiMap.map((row) =>
    row.split('').map((char) => {
      const tileId = legend[char];
      if (tileId === undefined) {
        console.warn(`Unrecognized map character: "${char}". Defaulting to 0.`);
        return 0;
      }
      return tileId;
    })
  );
};
