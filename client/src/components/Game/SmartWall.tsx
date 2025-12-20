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
  const clampedPoint = useRef(new THREE.Vector3()).current;

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

  useFrame((state) => {
    if (!groupRef.current || !playerPos.current) return;

    if (wallType === 'rigid') {
      if (opacity !== 1) setOpacity(1);
      return;
    }

    if (!geometry.boundingBox) geometry.computeBoundingBox();
    box.copy(geometry.boundingBox!);
    box.applyMatrix4(groupRef.current.matrixWorld);

    const pPos = playerPos.current;
    const camPos = state.camera.position;

    let shouldFade = false;

    // 1. Proximity
    box.clampPoint(camPos, clampedPoint);
    const distToCamera = clampedPoint.distanceTo(camPos);

    if (distToCamera < 2.0) {
      shouldFade = true;
    } else {
      // 2. Occlusion
      const isSouthOfPlayer = box.min.z > pPos.z - 0.5;
      if (isSouthOfPlayer) {
        const margin = 1.5;
        const withinXBounds = pPos.x > box.min.x - margin && pPos.x < box.max.x + margin;
        if (withinXBounds) {
          shouldFade = true;
        }
      }
    }

    const targetOpacity = shouldFade ? 0.2 : 1;
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
      {/* BASE MESH 
          - visible={true}: Keeps it from floating.
          - customDepthMaterial: Forces it to cast a SOLID shadow even when fading.
      */}
      <mesh
        geometry={baseGeometry}
        scale={[1, 1, 0.8]}
        castShadow
        receiveShadow
        renderOrder={-1}
        customDepthMaterial={solidDepthMaterial} // <--- KEEPS FLASHLIGHT BLOCKED
      >
        <primitive
          object={baseMaterial}
          attach="material"
          transparent={true} // Always allow transparency handling
          opacity={opacity}
          depthWrite={!isTransparent} // Stop writing depth when fading to fix sorting
        />
      </mesh>

      {/* TEXTURE MESH */}
      <mesh geometry={geometry} castShadow={false} receiveShadow renderOrder={0}>
        <meshStandardMaterial
          map={texture}
          transparent={true}
          opacity={opacity}
          alphaTest={0.1}
          depthWrite={!isTransparent} // Stop writing depth when fading to fix sorting
        />
      </mesh>
    </group>
  );
};
