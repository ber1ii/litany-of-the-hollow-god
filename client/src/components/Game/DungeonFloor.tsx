import React, { useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

export const DungeonFloor: React.FC = () => {
  const rawTexture = useTexture('/textures/environment/ground_stone.png');

  const texture = useMemo(() => {
    const t = rawTexture.clone();
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(80, 80);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }, [rawTexture]);

  return (
    // Receive Shadow is CRITICAL for immersion
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[50, 50]} />
      <meshStandardMaterial map={texture} color="#888" roughness={0.8} metalness={0.1} />
    </mesh>
  );
};
