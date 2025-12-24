import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SmartWallShader } from '../Materials/SmartFadeMaterial';

interface SmartWallProps {
  geometry: THREE.BufferGeometry;
  texture: THREE.Texture;
  playerPos: React.RefObject<THREE.Vector3>;
  wallType: 'rigid' | 'fadable';
  position: [number, number, number];
  rotation: [number, number, number];
}

export const SmartWall: React.FC<SmartWallProps> = ({
  geometry,
  texture,
  playerPos,
  wallType,
  position,
  rotation,
}) => {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  // Determine if this wall is "Vertical" (Side wall) based on rotation
  const isVertical = Math.abs(rotation[1]) > 0.1;

  // Create a custom material instance for this wall
  const customMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      color: '#666666',
      roughness: 0.9,
      transparent: true,
      // CRITICAL FIX: Force depthWrite to prevent flickering/z-fighting
      depthWrite: true,
    });

    mat.onBeforeCompile = (shader) => {
      // 1. Apply the patch
      SmartWallShader.onBeforeCompile(shader);

      // 2. Save reference
      mat.userData.shader = shader;

      // 3. Set static uniforms locally for THIS specific wall
      shader.uniforms.uWallType.value = wallType === 'fadable' ? 1.0 : 0.0;
      shader.uniforms.uIsVertical.value = isVertical ? 1.0 : 0.0;
    };

    return mat;
  }, [texture, wallType, isVertical]);

  useFrame(() => {
    // OPTIMIZATION: Update player pos on GPU
    if (materialRef.current?.userData.shader && playerPos.current) {
      materialRef.current.userData.shader.uniforms.uPlayerPos.value.copy(playerPos.current);
    }
  });

  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <primitive object={customMaterial} ref={materialRef} attach="material" />
        {/* Helper to fix shadow artifacts on transparent meshes */}
        <meshDepthMaterial attach="customDepthMaterial" depthPacking={THREE.RGBADepthPacking} />
      </mesh>
    </group>
  );
};
