import * as THREE from 'three';
import { TILE_SIZE } from '../components/Game/MapData';

export const getWallGroups = (map: number[][]) => {
  const visited = new Set<string>();
  const groups: { x: number; z: number }[][] = [];

  const directions = [
    { x: 1, z: 0 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: -1 },
  ];

  for (let row = 0; row < map.length; row++) {
    for (let col = 0; col < map[row].length; col++) {
      // Key must strictly match nKey format
      const key = `${col},${row}`;

      if (map[row][col] === 1 && !visited.has(key)) {
        const group: { x: number; z: number }[] = [];
        const queue = [{ c: col, r: row }];
        visited.add(key);

        while (queue.length > 0) {
          const { c, r } = queue.pop()!;
          group.push({ x: c, z: r });

          directions.forEach((dir) => {
            const nc = c + dir.x;
            const nr = r + dir.z;
            const nKey = `${nc},${nr}`;

            if (
              nr >= 0 &&
              nr < map.length &&
              nc >= 0 &&
              nc < map[0].length &&
              map[nr][nc] === 1 &&
              !visited.has(nKey)
            ) {
              visited.add(nKey);
              queue.push({ c: nc, r: nr });
            }
          });
        }
        groups.push(group);
      }
    }
  }
  return groups;
};

export const createWallGeometry = (group: { x: number; z: number }[], map: number[][]) => {
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

  // PASS 1: GENERATE SIDES (Material Index 0)
  group.forEach(({ x, z }) => {
    const c = getCoords(x, z);

    // North
    if (!isWall(x, z - 1))
      addFace(
        [c.xR, c.yBot, c.zF],
        [c.xL, c.yBot, c.zF],
        [c.xL, c.yTop, c.zF],
        [c.xR, c.yTop, c.zF],
        [0, 0, -1],
        'side'
      );
    // South
    if (!isWall(x, z + 1))
      addFace(
        [c.xL, c.yBot, c.zB],
        [c.xR, c.yBot, c.zB],
        [c.xR, c.yTop, c.zB],
        [c.xL, c.yTop, c.zB],
        [0, 0, 1],
        'side'
      );
    // West
    if (!isWall(x - 1, z))
      addFace(
        [c.xL, c.yBot, c.zF],
        [c.xL, c.yBot, c.zB],
        [c.xL, c.yTop, c.zB],
        [c.xL, c.yTop, c.zF],
        [-1, 0, 0],
        'side'
      );
    // East
    if (!isWall(x + 1, z))
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

  // PASS 2: GENERATE TOPS (Material Index 1)
  group.forEach(({ x, z }) => {
    const c = getCoords(x, z);
    // Top Face (Facing Up)
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

  // Define Groups: Group 0 = Sides, Group 1 = Top
  geometry.addGroup(0, sideIndicesCount, 0);
  geometry.addGroup(sideIndicesCount, topIndicesCount, 1);

  geometry.computeBoundingBox();

  return geometry;
};
