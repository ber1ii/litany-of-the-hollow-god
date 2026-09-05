import { TILE_SIZE } from '../components/Game/MapData';

export const CHUNK_SIZE = 16;
export const CHUNK_WORLD_SIZE = CHUNK_SIZE * TILE_SIZE;

export interface ChunkKey {
  cx: number;
  cz: number;
  key: string;
}

export const getChunkCoords = (x: number, z: number): { cx: number; cz: number } => ({
  cx: Math.floor(x / CHUNK_SIZE),
  cz: Math.floor(z / CHUNK_SIZE),
});

export const getChunkKey = (cx: number, cz: number): string => `${cx}_${cz}`;

export const getVisibleChunkKeys = (
  playerX: number,
  playerZ: number,
  loadRadius: number = 2,
  unloadRadius: number = 3,
  currentVisible: Set<string> = new Set()
): Set<string> => {
  const tileX = Math.floor(playerX / TILE_SIZE);
  const tileZ = Math.floor(playerZ / TILE_SIZE);
  const { cx, cz } = getChunkCoords(tileX, tileZ);

  const nextVisible = new Set<string>();

  // 1. Keep chunks that are currently loaded and still within the UNLOAD radius
  if (currentVisible.size > 0) {
    for (const key of currentVisible) {
      const [chunkX, chunkZ] = key.split('_').map(Number);
      if (Math.abs(chunkX - cx) <= unloadRadius && Math.abs(chunkZ - cz) <= unloadRadius) {
        nextVisible.add(key);
      }
    }
  }

  // 2. Force load chunks that are within the strict LOAD radius
  for (let dz = -loadRadius; dz <= loadRadius; dz++) {
    for (let dx = -loadRadius; dx <= loadRadius; dx++) {
      nextVisible.add(getChunkKey(cx + dx, cz + dz));
    }
  }

  // Compare sizes and contents to prevent returning a new Set reference if identical
  if (currentVisible.size === nextVisible.size) {
    let matches = true;
    for (const key of nextVisible) {
      if (!currentVisible.has(key)) {
        matches = false;
        break;
      }
    }
    if (matches) return currentVisible;
  }

  return nextVisible;
};
