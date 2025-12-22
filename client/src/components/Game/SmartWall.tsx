import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

interface SmartWallProps {
  geometry: THREE.BufferGeometry;
  texture: THREE.Texture;
  playerPos: React.MutableRefObject<THREE.Vector3>;
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
  const groupRef = useRef<THREE.Group>(null);
  const [opacity, setOpacity] = useState(1);

  const box = useRef(new THREE.Box3()).current;

  const rawStoneTexture = useTexture('/textures/environment/ground_stone.png');
  const stoneTexture = useMemo(() => {
    const t = rawStoneTexture.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [rawStoneTexture]);

  const baseMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      map: stoneTexture,
      color: '#666666',
      roughness: 0.9,
    });
  }, [stoneTexture]);

  const baseGeometry = useMemo(() => geometry.clone(), [geometry]);

  const isVertical = Math.abs(rotation[1]) > 0.1;

  useFrame(() => {
    if (!groupRef.current || !playerPos.current) return;

    if (wallType === 'rigid') {
      if (opacity !== 1) setOpacity(1);
      return;
    }

    // Refresh bounding box in world space
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    box.copy(geometry.boundingBox!);
    box.applyMatrix4(groupRef.current.matrixWorld);

    const pPos = playerPos.current;
    let shouldFade = false;

    // --- SMART LOGIC ---
    // 1. Is the wall physically closer to the camera than the player?
    //    (i.e., is it "South" / +Z of the player?)
    const isSouthOfPlayer = box.min.z > pPos.z - 0.2; // Small buffer

    if (isSouthOfPlayer) {
      // 2. DYNAMIC MARGIN BASED ON WALL TYPE
      // Vertical walls (Side walls) get a tiny margin so they don't fade when we hug them.
      // Horizontal walls (Blocking walls) get a huge margin so they fade out of the way.
      const margin = isVertical ? 0.2 : 1.2;

      const withinXBounds = pPos.x > box.min.x - margin && pPos.x < box.max.x + margin;

      if (withinXBounds) {
        shouldFade = true;
      }
    }

    // Smooth Fade
    const targetOpacity = shouldFade ? 0.15 : 1;
    const newOpacity = THREE.MathUtils.lerp(opacity, targetOpacity, 0.1);

    if (Math.abs(newOpacity - opacity) > 0.01) {
      setOpacity(newOpacity);
    }
  });

  const solidDepthMaterial = useMemo(
    () =>
      new THREE.MeshDepthMaterial({
        depthPacking: THREE.RGBADepthPacking,
      }),
    []
  );

  const isTransparent = opacity < 0.95;

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* BASE MESH */}
      <mesh
        geometry={baseGeometry}
        scale={[1, 1, 0.8]}
        castShadow
        receiveShadow
        renderOrder={-1}
        customDepthMaterial={solidDepthMaterial}
      >
        <primitive
          object={baseMaterial}
          attach="material"
          transparent={true}
          opacity={opacity}
          depthWrite={!isTransparent}
        />
      </mesh>

      {/* TEXTURE MESH */}
      <mesh geometry={geometry} castShadow={false} receiveShadow renderOrder={0}>
        <meshStandardMaterial
          map={texture}
          transparent={true}
          opacity={opacity}
          alphaTest={0.1}
          depthWrite={!isTransparent}
        />
      </mesh>
    </group>
  );
};
