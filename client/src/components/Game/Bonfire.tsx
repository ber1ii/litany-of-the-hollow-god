import React, { useRef, useState, useMemo } from 'react';
import { useTexture, Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TILE_SIZE } from './MapData';

const TORCH_FRAMES = [
  '/sprites/props/torch/torch_1.png',
  '/sprites/props/torch/torch_2.png',
  '/sprites/props/torch/torch_3.png',
  '/sprites/props/torch/torch_4.png',
];

interface BonfireProps {
  x: number;
  z: number;
}

export const Bonfire: React.FC<BonfireProps> = ({ x, z }) => {
  const rawTextures = useTexture(TORCH_FRAMES) as THREE.Texture[];
  const textures = useMemo(() => {
    const cloned = rawTextures.map((t) => t.clone());
    cloned.forEach((t) => {
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
    });
    return cloned;
  }, [rawTextures]);

  const light = useRef<THREE.PointLight>(null);
  const [frameIndex, setFrameIndex] = useState(0);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    setFrameIndex(Math.floor(t / 0.15) % TORCH_FRAMES.length);

    if (light.current) {
      const flicker = Math.sin(t * 3) * 0.5 + Math.cos(t * 10) * 0.2;
      light.current.intensity = 4 + flicker; // Reduced slightly
      light.current.distance = 10 + Math.sin(t * 2); // Reduced slightly
    }
  });

  return (
    <group position={[x * TILE_SIZE, 0, z * TILE_SIZE]}>
      <Billboard>
        <mesh position={[0, 0.2, 0]}>
          {/* Resized: Was [1,1], now [0.6, 0.6] */}
          <planeGeometry args={[0.6, 0.6]} />
          <meshBasicMaterial
            map={textures[frameIndex]}
            transparent
            alphaTest={0.5}
            color="#ffddaa"
          />
        </mesh>
      </Billboard>
      {/* Warm, intense light */}
      <pointLight
        ref={light}
        position={[0, 0.4, 0]}
        color="#ff6600"
        distance={10}
        decay={2}
        castShadow
      />

      {/* Subtle floor glow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.6, 16]} />
        <meshBasicMaterial color="#ff4400" transparent opacity={0.2} />
      </mesh>
    </group>
  );
};
