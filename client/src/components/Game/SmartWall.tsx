import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SmartWallProps {
  geometry: THREE.BufferGeometry;
  texture: THREE.Texture;
}

export const SmartWall: React.FC<SmartWallProps> = ({ geometry, texture }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const [sideOpacity, setSideOpacity] = useState(1);
  const [topOpacity, setTopOpacity] = useState(1);

  // Optimization: Create persistent objects to avoid GC
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const playerPos = useMemo(() => new THREE.Vector3(), []);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const box = useMemo(() => new THREE.Box3(), []);

  useFrame((state) => {
    if (!meshRef.current) return;

    const cameraPos = state.camera.position;

    // 1. Raycast Check (Line of Sight)
    const pX = cameraPos.x;
    const pZ = cameraPos.z - 2;
    playerPos.set(pX, 0.5, pZ);

    direction.subVectors(playerPos, cameraPos).normalize();
    raycaster.set(cameraPos, direction);

    const intersects = raycaster.intersectObject(meshRef.current, false);

    let shouldFade = false;

    // Condition A: Ray hits wall before player
    if (intersects.length > 0) {
      const distToWall = intersects[0].distance;
      const distToPlayer = cameraPos.distanceTo(playerPos);
      if (distToWall < distToPlayer) {
        shouldFade = true;
      }
    }

    // Condition B: Camera is INSIDE the wall (Fix for bottom walls)
    // We update the box to match the mesh's current world position
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    box.copy(geometry.boundingBox!);
    box.applyMatrix4(meshRef.current.matrixWorld);

    // If camera is inside the wall's box, FORCE fade
    if (box.containsPoint(cameraPos)) {
      shouldFade = true;
    }

    // Apply Fade
    const targetSide = shouldFade ? 0.2 : 1;
    const targetTop = shouldFade ? 0.05 : 1;

    const newSide = THREE.MathUtils.lerp(sideOpacity, targetSide, 0.1);
    const newTop = THREE.MathUtils.lerp(topOpacity, targetTop, 0.1);

    if (Math.abs(newSide - sideOpacity) > 0.01) setSideOpacity(newSide);
    if (Math.abs(newTop - topOpacity) > 0.01) setTopOpacity(newTop);
  });

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        attach="material-0"
        map={texture}
        color="#666"
        transparent={true}
        opacity={sideOpacity}
        depthWrite={true} // Keep true for correct Z-sorting
        shadowSide={THREE.DoubleSide}
      />
      <meshStandardMaterial
        attach="material-1"
        map={texture}
        color="#666"
        transparent={true}
        opacity={topOpacity}
        depthWrite={false}
        shadowSide={THREE.DoubleSide}
      />
    </mesh>
  );
};
