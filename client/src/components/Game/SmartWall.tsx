// SmartWall.tsx
import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SmartWallProps {
  geometry: THREE.BufferGeometry;
  texture: THREE.Texture;
  playerPos: React.MutableRefObject<THREE.Vector3>;
  wallType: 'rigid' | 'fadable';
}

export const SmartWall: React.FC<SmartWallProps> = ({ geometry, texture, playerPos, wallType }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const [sideOpacity, setSideOpacity] = useState(1);
  const [topOpacity, setTopOpacity] = useState(1);

  const wallCenter = useRef(new THREE.Vector3()).current;
  const box = useRef(new THREE.Box3()).current;

  const shadowDepthMat = useMemo(() => {
    return new THREE.MeshDepthMaterial({
      depthPacking: THREE.BasicDepthPacking,
      side: THREE.DoubleSide,
    });
  }, []);

  useFrame((state) => {
    if (!meshRef.current || !playerPos.current) return;

    if (wallType === 'rigid') {
      if (sideOpacity !== 1) {
        setSideOpacity(1);
        setTopOpacity(1);
      }
      return;
    }

    const pPos = playerPos.current;

    if (!geometry.boundingBox) geometry.computeBoundingBox();
    box.copy(geometry.boundingBox!);
    box.applyMatrix4(meshRef.current.matrixWorld);
    box.getCenter(wallCenter);

    let shouldFade = false;

    const dz = wallCenter.z - pPos.z;
    const dx = Math.abs(wallCenter.x - pPos.x);

    if (dz > 0.5 && dz < 4.0 && dx < 2.5) {
      shouldFade = true;
    }

    if (!shouldFade && box.containsPoint(state.camera.position)) {
      shouldFade = true;
    }

    const targetSide = shouldFade ? 0.2 : 1;
    const targetTop = shouldFade ? 0.1 : 1;

    const newSide = THREE.MathUtils.lerp(sideOpacity, targetSide, 0.2);
    const newTop = THREE.MathUtils.lerp(topOpacity, targetTop, 0.2);

    if (Math.abs(newSide - sideOpacity) > 0.01) setSideOpacity(newSide);
    if (Math.abs(newTop - topOpacity) > 0.01) setTopOpacity(newTop);
  });

  const isTransparent = sideOpacity < 0.95;

  return (
    <group>
      {/* 1. VISUAL MESH: Handles texture and fading */}
      <mesh ref={meshRef} geometry={geometry} castShadow={false} receiveShadow>
        <meshStandardMaterial
          attach="material-0"
          map={texture}
          color="#888"
          transparent={true}
          opacity={sideOpacity}
          depthWrite={!isTransparent}
          shadowSide={THREE.DoubleSide}
        />
        <meshStandardMaterial
          attach="material-1"
          map={texture}
          color="#888"
          transparent={true}
          opacity={topOpacity}
          depthWrite={!isTransparent}
          shadowSide={THREE.DoubleSide}
        />
      </mesh>

      {/* 2. SHADOW BLOCKER: Invisible to camera, SOLID to flashlight. */}
      <mesh geometry={geometry} castShadow={true} receiveShadow={false}>
        <meshBasicMaterial colorWrite={false} depthWrite={false} />

        <primitive object={shadowDepthMat} attach="customDepthMaterial" />
      </mesh>
    </group>
  );
};
