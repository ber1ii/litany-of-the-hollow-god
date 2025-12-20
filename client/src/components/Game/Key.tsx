import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, useTexture } from '@react-three/drei';
import { TILE_SIZE } from './MapData';
import * as THREE from 'three';

interface KeyProps {
  x: number;
  z: number;
}

export const Key: React.FC<KeyProps> = ({ x, z }) => {
  const rawTexture = useTexture('/sprites/props/candle/candleB_01.png');

  const texture = useMemo(() => {
    const t = rawTexture.clone();
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [rawTexture]);

  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;

    const t = state.clock.getElapsedTime();
    groupRef.current.position.y = 0.25 + Math.sin(t * 3) * 0.05;
  });

  return (
    <group ref={groupRef} position={[x * TILE_SIZE, 0.25, z * TILE_SIZE]}>
      <Billboard>
        <mesh>
          <planeGeometry args={[0.4, 0.4]} />
          <meshStandardMaterial
            map={texture}
            transparent
            alphaTest={0.5}
            emissive="yellow"
            emissiveIntensity={0.2}
          />
        </mesh>
      </Billboard>
    </group>
  );
};
