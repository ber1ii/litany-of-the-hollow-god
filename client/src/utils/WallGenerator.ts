import * as THREE from 'three';
import { TILE_SIZE } from '../components/Game/MapData';

// Returns one group per wall tile
export const getWallGroups = (map: number[][]) => {
  const groups: { x: number; z: number }[][] = [];
  for (let row = 0; row < map.length; row++) {
    for (let col = 0; col < map[row].length; col++) {
      if (map[row][col] === 1) {
        groups.push([{ x: col, z: row }]);
      }
    }
  }
  return groups;
};

export const createWallGeometry = (
  group: { x: number; z: number }[],
  map: number[][],
  forceFaces: string[] = []
) => {
  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  let indexOffset = 0;

  const addFace = (
    v1: number[],
    v2: number[],
    v3: number[],
    v4: number[],
    normal: number[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _uvType: 'side' | 'top'
  ) => {
    vertices.push(...v1, ...v2, ...v3, ...v4);
    normals.push(...normal, ...normal, ...normal, ...normal);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(
      indexOffset,
      indexOffset + 1,
      indexOffset + 2,
      indexOffset,
      indexOffset + 2,
      indexOffset + 3
    );
    indexOffset += 4;
  };

  const isWall = (gx: number, gz: number) => {
    if (gz < 0 || gz >= map.length || gx < 0 || gx >= map[0].length) return false;
    return map[gz][gx] === 1;
  };

  const getCoords = (x: number, z: number) => {
    const worldX = x * TILE_SIZE;
    const worldZ = z * TILE_SIZE;
    return {
      x,
      z,
      yBot: 0,
      yTop: 2,
      xL: worldX - TILE_SIZE / 2,
      xR: worldX + TILE_SIZE / 2,
      zF: worldZ - TILE_SIZE / 2,
      zB: worldZ + TILE_SIZE / 2,
    };
  };

  // PASS 1: Generate SIDES
  group.forEach(({ x, z }) => {
    const c = getCoords(x, z);

    // North Face (Checks Z-1) OR Forced 'N'
    if (!isWall(x, z - 1) || forceFaces.includes('N'))
      addFace(
        [c.xR, c.yBot, c.zF],
        [c.xL, c.yBot, c.zF],
        [c.xL, c.yTop, c.zF],
        [c.xR, c.yTop, c.zF],
        [0, 0, -1],
        'side'
      );

    // South Face (Checks Z+1) OR Forced 'S'
    if (!isWall(x, z + 1) || forceFaces.includes('S'))
      addFace(
        [c.xL, c.yBot, c.zB],
        [c.xR, c.yBot, c.zB],
        [c.xR, c.yTop, c.zB],
        [c.xL, c.yTop, c.zB],
        [0, 0, 1],
        'side'
      );

    // West Face (Checks X-1) OR Forced 'W'
    if (!isWall(x - 1, z) || forceFaces.includes('W'))
      addFace(
        [c.xL, c.yBot, c.zF],
        [c.xL, c.yBot, c.zB],
        [c.xL, c.yTop, c.zB],
        [c.xL, c.yTop, c.zF],
        [-1, 0, 0],
        'side'
      );

    // East Face (Checks X+1) OR Forced 'E'
    if (!isWall(x + 1, z) || forceFaces.includes('E'))
      addFace(
        [c.xR, c.yBot, c.zB],
        [c.xR, c.yBot, c.zF],
        [c.xR, c.yTop, c.zF],
        [c.xR, c.yTop, c.zB],
        [1, 0, 0],
        'side'
      );
  });

  const sideIndicesCount = indices.length;

  // PASS 2: Generate TOPS
  group.forEach(({ x, z }) => {
    const c = getCoords(x, z);
    addFace(
      [c.xL, c.yTop, c.zB],
      [c.xR, c.yTop, c.zB],
      [c.xR, c.yTop, c.zF],
      [c.xL, c.yTop, c.zF],
      [0, 1, 0],
      'top'
    );
  });

  const topIndicesCount = indices.length - sideIndicesCount;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  geometry.addGroup(0, sideIndicesCount, 0);
  geometry.addGroup(sideIndicesCount, topIndicesCount, 1);

  geometry.computeBoundingBox();

  return geometry;
};
