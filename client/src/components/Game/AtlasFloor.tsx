import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { TILE_SIZE } from './MapData';
import { getTileDef } from '../../data/TileRegistry';
import { getAtlasUVs } from '../../utils/GeometryUtils';

interface AtlasFloorProps {
  map: number[][];
}

export const AtlasFloor: React.FC<AtlasFloorProps> = ({ map }) => {
  const rawTexture = useTexture('/textures/sheets/mainlevbuild.png');

  const texture = useMemo(() => {
    const t = rawTexture.clone();
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  }, [rawTexture]);

  const geometry = useMemo(() => {
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    let indexOffset = 0;

    map.forEach((row, z) => {
      row.forEach((tileId, x) => {
        let tileDef = getTileDef(tileId);

        // Fallback to base floor for walls/props so there's no void
        if (tileDef.type !== 'floor') {
          tileDef = getTileDef(2);
        }

        const xCenter = x * TILE_SIZE;
        const zCenter = z * TILE_SIZE;

        // Standard floor height at 0. Items will be at 0.05.
        const yPos = 0;

        const sizeW = tileDef.size?.w ?? 1;
        const sizeH = tileDef.size?.h ?? 1;
        const width = sizeW * TILE_SIZE;
        const height = sizeH * TILE_SIZE;
        const halfW = width / 2;
        const halfH = height / 2;

        vertices.push(
          xCenter - halfW,
          yPos,
          zCenter + halfH, // BL
          xCenter + halfW,
          yPos,
          zCenter + halfH, // BR
          xCenter + halfW,
          yPos,
          zCenter - halfH, // TR
          xCenter - halfW,
          yPos,
          zCenter - halfH // TL
        );

        const { uMin, uMax, vMin, vMax } = getAtlasUVs(
          tileDef.atlasPos.col,
          tileDef.atlasPos.row,
          sizeW,
          sizeH
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
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [map]);

  return (
    <mesh geometry={geometry} receiveShadow rotation={[-Math.PI / 2, 0, 0]} rotation-x={0}>
      <meshStandardMaterial map={texture} roughness={0.9} color="#888888" />
    </mesh>
  );
};
