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

interface TorchProps {
  x: number;
  z: number;
}

export const Torch: React.FC<TorchProps> = ({ x, z }) => {
  const rawTextures = useTexture(TORCH_FRAMES) as THREE.Texture[];

  const torchTextures = useMemo(() => {
    const textures = rawTextures.map((t) => t.clone());

    textures.forEach((t: THREE.Texture) => {
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
    });

    return textures;
  }, [rawTextures]);

  const light = useRef<THREE.PointLight>(null);
  const [frameIndex, setFrameIndex] = useState(0);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    setFrameIndex(Math.floor(t / 0.15) % TORCH_FRAMES.length);

    if (light.current) {
      const flicker = Math.sin(t * 10) * 0.3 + Math.cos(t * 23) * 0.1 + (Math.random() - 0.5) * 0.2;
      light.current.intensity = 2.5 + flicker;
    }
  });

  return (
    <group position={[x * TILE_SIZE, 0.25, z * TILE_SIZE]}>
      <Billboard>
        <mesh>
          <planeGeometry args={[0.34, 0.34]} />
          <meshBasicMaterial map={torchTextures[frameIndex]} transparent alphaTest={0.5} />
        </mesh>
      </Billboard>
      {/* Orange/Yellow warm light */}
      <pointLight ref={light} position={[0, 0.1, 0.1]} color="#ffaa00" distance={8} decay={2} />
    </group>
  );
};
