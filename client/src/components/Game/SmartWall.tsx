import React, { useMemo } from 'react';
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
  const isVertical = Math.abs(rotation[1]) > 0.1;

  // 1. MAIN MATERIAL (Group 0 - Wall Sides)
  const customMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      color: '#ffffff',
      roughness: 0.8,
      transparent: true,
      depthWrite: true,
    });

    mat.onBeforeCompile = (shader) => {
      SmartWallShader.onBeforeCompile(shader);

      // Darker washed-out gray in linear space to keep flashlight from blowing it out
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

      mat.userData.shader = shader;
      shader.uniforms.uWallType.value = wallType === 'fadable' ? 1.0 : 0.0;
      shader.uniforms.uIsVertical.value = isVertical ? 1.0 : 0.0;
    };

    return mat;
  }, [texture, wallType, isVertical]);

  // 2. STRUCTURE FILL MATERIAL (Group 1 - Tops & Interiors)
  const fillMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: '#222528', // Dark desaturated washed-out gray matching the GLSL void tone
      roughness: 0.95,
      transparent: true,
      depthWrite: true,
    });

    mat.onBeforeCompile = (shader) => {
      SmartWallShader.onBeforeCompile(shader);
      mat.userData.shader = shader;

      shader.uniforms.uWallType.value = wallType === 'fadable' ? 1.0 : 0.0;
      shader.uniforms.uIsVertical.value = isVertical ? 1.0 : 0.0;
    };

    return mat;
  }, [wallType, isVertical]);

  useFrame(() => {
    if (playerPos.current) {
      if (customMaterial.userData.shader) {
        customMaterial.userData.shader.uniforms.uPlayerPos.value.copy(playerPos.current);
      }
      if (fillMaterial.userData.shader) {
        fillMaterial.userData.shader.uniforms.uPlayerPos.value.copy(playerPos.current);
      }
    }
  });

  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={geometry} material={[customMaterial, fillMaterial]} castShadow receiveShadow>
        <meshDepthMaterial attach="customDepthMaterial" depthPacking={THREE.RGBADepthPacking} />
      </mesh>
    </group>
  );
};
