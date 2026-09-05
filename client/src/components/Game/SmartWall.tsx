import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SmartWallShader } from '../Materials/SmartFadeMaterial';

const globalPlayerPosUniform = { value: new THREE.Vector3() };

const createSharedMaterial = (isVertical: boolean, isFadable: boolean, texture: THREE.Texture) => {
  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    color: '#ffffff',
    roughness: 0.8,
    transparent: true,
    depthWrite: true,
  });

  mat.onBeforeCompile = (shader) => {
    SmartWallShader.onBeforeCompile(shader);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
      #include <map_fragment>
      #ifdef USE_MAP
        diffuseColor.rgb = mix(vec3(0.025, 0.027, 0.030), diffuseColor.rgb, diffuseColor.a);
        diffuseColor.a = 1.0; 
      #endif
      `
    );
    shader.uniforms.uPlayerPos = globalPlayerPosUniform;
    shader.uniforms.uWallType.value = isFadable ? 1.0 : 0.0;
    shader.uniforms.uIsVertical.value = isVertical ? 1.0 : 0.0;
  };
  return mat;
};

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

const getSharedWallMaterial = (isVertical: boolean, isFadable: boolean, texture: THREE.Texture) => {
  const key = `${isVertical ? 'v' : 'h'}_${isFadable ? 'f' : 'r'}`;
  if (!materialCache.has(key)) {
    materialCache.set(key, createSharedMaterial(isVertical, isFadable, texture));
  }
  return materialCache.get(key)!;
};

export const WallUniformDriver: React.FC<{ playerPos: React.RefObject<THREE.Vector3> }> = ({
  playerPos,
}) => {
  useFrame(() => {
    if (playerPos.current) globalPlayerPosUniform.value.copy(playerPos.current);
  });
  return null;
};

// --- NEW: INSTANCED MESH DATA STRUCTURES ---
export interface InstancedGroupData {
  geometry: THREE.BufferGeometry;
  isVertical: boolean;
  isFadable: boolean;
  matrices: THREE.Matrix4[];
}

export const InstancedSmartWall: React.FC<{ data: InstancedGroupData; texture: THREE.Texture }> =
  React.memo(({ data, texture }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const material = getSharedWallMaterial(data.isVertical, data.isFadable, texture);

    useEffect(() => {
      if (meshRef.current) {
        data.matrices.forEach((mat, i) => {
          meshRef.current!.setMatrixAt(i, mat);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
      }
    }, [data.matrices]);

    return (
      <instancedMesh
        ref={meshRef}
        args={[data.geometry, [material, material], data.matrices.length]}
        castShadow
        receiveShadow
      />
    );
  });

// Original preserved to prevent breaking other components
interface SmartWallProps {
  geometry: THREE.BufferGeometry;
  texture: THREE.Texture;
  wallType: 'rigid' | 'fadable';
  position: [number, number, number];
  rotation: [number, number, number];
}

export const SmartWall: React.FC<SmartWallProps> = React.memo(
  ({ geometry, texture, wallType, position, rotation }) => {
    const isVertical = Math.abs(rotation[1]) > 0.1;
    const isFadable = wallType === 'fadable';
    const material = getSharedWallMaterial(isVertical, isFadable, texture);

    return (
      <mesh
        position={position}
        rotation={rotation}
        geometry={geometry}
        material={[material, material]}
        castShadow
        receiveShadow
      />
    );
  }
);
