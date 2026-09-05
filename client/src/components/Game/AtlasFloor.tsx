import React, { useMemo, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { TILE_SIZE } from './MapData';
import { getTileDef } from '../../data/TileRegistry';
import { getAtlasUVs } from '../../utils/GeometryUtils';
import { getChunkCoords, getChunkKey } from '../../utils/ChunkUtils';

interface AtlasFloorProps {
  map: number[][];
  visibleChunkKeys: Set<string>;
}

export const AtlasFloor: React.FC<AtlasFloorProps> = ({ map, visibleChunkKeys }) => {
  const rawTexture = useTexture('/textures/sheets/mainlevbuild.png');

  const texture = useMemo(() => {
    const t = rawTexture.clone();
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [rawTexture]);

  const floorMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.9,
      color: '#ffffff',
    });
  }, [texture]);

  const chunksData = useMemo(() => {
    const chunks = new Map<string, { x: number; z: number; tileId: number }[]>();
    map.forEach((row, z) => {
      row.forEach((tileId, x) => {
        if (tileId === 0) return;
        const { cx, cz } = getChunkCoords(x, z);
        const key = getChunkKey(cx, cz);
        if (!chunks.has(key)) chunks.set(key, []);
        chunks.get(key)!.push({ x, z, tileId });
      });
    });
    return chunks;
  }, [map]);

  const geometryCache = useRef<Map<string, THREE.BufferGeometry>>(new Map());
  const pendingKeysRef = useRef<string[]>([]);
  const pendingSetRef = useRef<Set<string>>(new Set());

  const CHUNKS_PER_FRAME = 1; // spread heavy BufferGeometry builds across frames instead of building a burst of newly-visible chunks in one commit

  const buildGeometryForChunk = (chunkKey: string) => {
    const tiles = chunksData.get(chunkKey);
    if (!tiles) return;

    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    let indexOffset = 0;

    tiles.forEach(({ x, z, tileId }) => {
      let tileDef = getTileDef(tileId);
      if (!tileDef || tileDef.type !== 'floor') tileDef = getTileDef(2);

      const xCenter = x * TILE_SIZE;
      const zCenter = z * TILE_SIZE;
      const halfW = TILE_SIZE / 2;
      const halfH = TILE_SIZE / 2;

      vertices.push(
        xCenter - halfW,
        0,
        zCenter + halfH,
        xCenter + halfW,
        0,
        zCenter + halfH,
        xCenter + halfW,
        0,
        zCenter - halfH,
        xCenter - halfW,
        0,
        zCenter - halfH
      );

      const { uMin, uMax, vMin, vMax } = getAtlasUVs(
        tileDef.atlasPos.col,
        tileDef.atlasPos.row,
        tileDef.size?.w ?? 1,
        tileDef.size?.h ?? 1
      );

      uvs.push(uMin, vMin, uMax, vMin, uMax, vMax, uMin, vMax);
      indices.push(
        indexOffset,
        indexOffset + 1,
        indexOffset + 2,
        indexOffset,
        indexOffset + 2,
        indexOffset + 3
      );
      indexOffset += 4;
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    geometryCache.current.set(chunkKey, geo);
  };

  // Queue up any newly-visible, not-yet-built chunks. Building itself happens
  // gradually in useFrame below, not all at once here — a chunk-boundary
  // crossing can add several new chunks to the load radius simultaneously,
  // and building all of their geometry in a single commit was the lag spike.
  useEffect(() => {
    const keysToRender =
      visibleChunkKeys.size > 0 ? Array.from(visibleChunkKeys) : Array.from(chunksData.keys());

    keysToRender.forEach((chunkKey) => {
      if (!geometryCache.current.has(chunkKey) && !pendingSetRef.current.has(chunkKey)) {
        pendingSetRef.current.add(chunkKey);
        pendingKeysRef.current.push(chunkKey);
      }
    });
  }, [chunksData, visibleChunkKeys]);

  const [visibleGeometries, setVisibleGeometries] = useState<
    { key: string; geometry: THREE.BufferGeometry }[]
  >([]);

  // Recompute which cached geometries should be shown. This reads
  // geometryCache.current, so it must run in useFrame (outside render), never
  // in useMemo/render — reading a ref during render is what broke last time.
  const lastRecomputeKeyRef = useRef<string>('');

  useFrame(() => {
    let builtSomething = false;
    if (pendingKeysRef.current.length > 0) {
      let built = 0;
      while (pendingKeysRef.current.length > 0 && built < CHUNKS_PER_FRAME) {
        const chunkKey = pendingKeysRef.current.shift()!;
        pendingSetRef.current.delete(chunkKey);
        buildGeometryForChunk(chunkKey);
        built++;
      }
      builtSomething = true;
    }

    const keysToRender =
      visibleChunkKeys.size > 0 ? Array.from(visibleChunkKeys) : Array.from(chunksData.keys());
    const recomputeKey = keysToRender.slice().sort().join(',');

    // Only touch state when the visible key set changed or new geometry just
    // finished building — not every single frame.
    if (builtSomething || recomputeKey !== lastRecomputeKeyRef.current) {
      lastRecomputeKeyRef.current = recomputeKey;
      const list: { key: string; geometry: THREE.BufferGeometry }[] = [];
      keysToRender.forEach((chunkKey) => {
        const geo = geometryCache.current.get(chunkKey);
        if (geo) list.push({ key: chunkKey, geometry: geo });
      });
      setVisibleGeometries(list);
    }
  });

  // Cleanup on level change / unmount
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      geometryCache.current.forEach((geo) => geo.dispose());
    };
  }, []);

  return (
    <group>
      {visibleGeometries.map(({ key, geometry }) => (
        <mesh
          key={`floor-chunk-${key}`}
          geometry={geometry}
          material={floorMaterial}
          receiveShadow
        />
      ))}
    </group>
  );
};
