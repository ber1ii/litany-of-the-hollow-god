import React, { useRef, useState, useMemo } from 'react';
import { useTexture, Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const TORCH_FRAMES = [
  '/sprites/props/torch/torch_1.png',
  '/sprites/props/torch/torch_2.png',
  '/sprites/props/torch/torch_3.png',
  '/sprites/props/torch/torch_4.png',
];

export const CombatTorch = ({ position }: { position: [number, number, number] }) => {
  const rawTextures = useTexture(TORCH_FRAMES);

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
    setFrameIndex(Math.floor(t / 0.15) % 4);
    if (light.current) {
      const flicker = Math.sin(t * 10) * 0.3 + Math.cos(t * 23) * 0.1 + (Math.random() - 0.5) * 0.2;
      light.current.intensity = 4 + flicker;
    }
  });

  return (
    <group position={position}>
      <Billboard>
        <mesh>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={textures[frameIndex]}
            transparent
            alphaTest={0.5}
            fog={false}
            toneMapped={false}
          />
        </mesh>
      </Billboard>
      <pointLight ref={light} position={[0, 0, 0.2]} color="#ffaa00" distance={12} decay={2} />
    </group>
  );
};
