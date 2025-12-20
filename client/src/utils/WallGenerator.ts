import * as THREE from 'three';
import { TILE_SIZE } from '../components/Game/MapData';
import type { TileDef } from '../data/TileRegistry';
import { getAtlasUVs } from './GeometryUtils';

// Thickness Constant (0.25 = 1/4th of a tile)
const WALL_THICKNESS = 0.25;

export const getWallGroups = (map: number[][]) => {
  const groups: { x: number; z: number; id: number }[][] = [];
  const visited = new Set<string>();

  for (let row = 0; row < map.length; row++) {
    for (let col = 0; col < map[row].length; col++) {
      const tileId = map[row][col];
      // ID 1 = Generic, ID >= 50 = Custom Anchor
      const isWall = tileId === 1 || tileId >= 50;

      if (isWall && !visited.has(`${col},${row}`)) {
        groups.push([{ x: col, z: row, id: tileId }]);
        visited.add(`${col},${row}`);
      }
    }
  }
  return groups;
};

interface CullOptions {
  left?: boolean; // Cull West Face
  right?: boolean; // Cull East Face
}

// Generates geometry in LOCAL space (centered at 0,0,0)
export const createWallGeometry = (tileDef: TileDef, cullFaces: CullOptions = {}) => {
  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  let indexOffset = 0;

  // 1. Calculate Main Face UVs
  const mainUV = getAtlasUVs(
    tileDef.atlasPos.col,
    tileDef.atlasPos.row,
    tileDef.size.w,
    tileDef.size.h
  );

  // 2. Side UVs (Dark pixel)
  const sideUV = getAtlasUVs(0, 0, 1, 1);

  const addFace = (
    v1: number[],
    v2: number[],
    v3: number[],
    v4: number[],
    normal: number[],
    faceType: 'main' | 'side' | 'top'
  ) => {
    vertices.push(...v1, ...v2, ...v3, ...v4);
    normals.push(...normal, ...normal, ...normal, ...normal);

    if (faceType === 'main') {
      uvs.push(
        mainUV.uMin,
        mainUV.vMin,
        mainUV.uMax,
        mainUV.vMin,
        mainUV.uMax,
        mainUV.vMax,
        mainUV.uMin,
        mainUV.vMax
      );
    } else if (faceType === 'side') {
      uvs.push(
        sideUV.uMin,
        sideUV.vMin,
        sideUV.uMax,
        sideUV.vMin,
        sideUV.uMax,
        sideUV.vMax,
        sideUV.uMin,
        sideUV.vMax
      );
    } else {
      const topUV = getAtlasUVs(46, 13, 1, 1);
      uvs.push(
        topUV.uMin,
        topUV.vMin,
        topUV.uMax,
        topUV.vMin,
        topUV.uMax,
        topUV.vMax,
        topUV.uMin,
        topUV.vMax
      );
    }

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

  // Dimensions
  const width = tileDef.size.w * TILE_SIZE;
  const height = tileDef.size.h * TILE_SIZE;

  // LOCAL COORDINATES: Centered on X/Z, Bottom at Y=0
  const xL = -width / 2;
  const xR = width / 2;
  const zF = -WALL_THICKNESS / 2;
  const zB = WALL_THICKNESS / 2;
  const yBot = 0;
  const yTop = height;

  // South Face (Back)
  addFace([xL, yBot, zB], [xR, yBot, zB], [xR, yTop, zB], [xL, yTop, zB], [0, 0, 1], 'main');

  // North Face (Front)
  addFace([xR, yBot, zF], [xL, yBot, zF], [xL, yTop, zF], [xR, yTop, zF], [0, 0, -1], 'main');

  // West Face (Left) - Only add if NOT culled
  if (!cullFaces.left) {
    addFace([xL, yBot, zF], [xL, yBot, zB], [xL, yTop, zB], [xL, yTop, zF], [-1, 0, 0], 'side');
  }

  // East Face (Right) - Only add if NOT culled
  if (!cullFaces.right) {
    addFace([xR, yBot, zB], [xR, yBot, zF], [xR, yTop, zF], [xR, yTop, zB], [1, 0, 0], 'side');
  }

  const sideIndicesCount = indices.length;

  // Top Face
  addFace([xL, yTop, zB], [xR, yTop, zB], [xR, yTop, zF], [xL, yTop, zF], [0, 1, 0], 'top');

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

// Floor generator (unchanged)
export const createFloorGeometry = (x: number, z: number, tileDef: TileDef) => {
  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const { uMin, uMax, vMin, vMax } = getAtlasUVs(
    tileDef.atlasPos.col,
    tileDef.atlasPos.row,
    tileDef.size.w,
    tileDef.size.h
  );

  const anchorX = x * TILE_SIZE;
  const anchorZ = z * TILE_SIZE;
  const half = TILE_SIZE / 2;

  const xL = anchorX - half;
  const xR = anchorX - half + tileDef.size.w * TILE_SIZE;
  const zF = anchorZ - half;
  const zB = anchorZ - half + tileDef.size.h * TILE_SIZE;
  const y = 0;

  vertices.push(xL, y, zB, xR, y, zB, xR, y, zF, xL, y, zF);
  normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
  uvs.push(uMin, vMin, uMax, vMin, uMax, vMax, uMin, vMax);
  indices.push(0, 1, 2, 0, 2, 3);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
};
