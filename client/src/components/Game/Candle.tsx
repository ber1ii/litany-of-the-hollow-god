import React, { useRef, useState, useMemo } from 'react';
import { useTexture, Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TILE_SIZE } from './MapData';

const CANDLE_FRAMES = [
  '/sprites/props/candle/candleB_01.png',
  '/sprites/props/candle/candleB_02.png',
  '/sprites/props/candle/candleB_03.png',
  '/sprites/props/candle/candleB_04.png',
];

interface CandleProps {
  x: number;
  z: number;
}

const randomOffset = Math.random() * 100;

export const Candle: React.FC<CandleProps> = ({ x, z }) => {
  const rawTextures = useTexture(CANDLE_FRAMES) as THREE.Texture[];

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
    const t = clock.elapsedTime + randomOffset;

    // Animation: Slower than torch (0.2s per frame)
    setFrameIndex(Math.floor(t / 0.2) % CANDLE_FRAMES.length);

    if (light.current) {
      // Gentle, smaller flicker
      const flicker = Math.sin(t * 8) * 0.1 + Math.cos(t * 20) * 0.05;
      light.current.intensity = 0.8 + flicker;
    }
  });

  return (
    <group position={[x * TILE_SIZE, 0.1, z * TILE_SIZE]}>
      <Billboard>
        <mesh>
          <planeGeometry args={[0.15, 0.2]} />
          <meshBasicMaterial map={textures[frameIndex]} transparent alphaTest={0.5} />
        </mesh>
      </Billboard>

      {/* Dimmer, reddish-orange light with short range */}
      <pointLight ref={light} position={[0, 0.1, 0.05]} color="#ff7700" distance={4} decay={2} />
    </group>
  );
};
