import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, useTexture } from '@react-three/drei';
import { TILE_SIZE } from './MapData';
import * as THREE from 'three';
import type { ItemDef } from '../../data/ItemRegistry';

interface LootDropProps {
  x: number;
  z: number;
  item: ItemDef;
}

export const LootDrop: React.FC<LootDropProps> = ({ x, z, item }) => {
  const rawTexture = useTexture(item.icon);

  // Defaults for static items
  const frames = item.spriteConfig?.frames || 1;
  const columns = item.spriteConfig?.columns || 1;
  const rows = item.spriteConfig?.rows || 1;

  const texture = useMemo(() => {
    const t = rawTexture.clone();
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;

    t.repeat.set(1 / columns, 1 / rows);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;

    return t;
  }, [rawTexture, columns, rows]);

  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();

    // Bobbing Motion
    groupRef.current.position.y = 0.15 + Math.sin(t * 3) * 0.03;

    // Sprite Animation
    if (frames > 1) {
      const currentFrame = Math.floor(t * 10) % frames;
      const col = currentFrame % columns;
      const row = Math.floor(currentFrame / columns);

      // eslint-disable-next-line
      texture.offset.x = col / columns;

      texture.offset.y = 1 - (row + 1) / rows;
    }
  });

  return (
    <group ref={groupRef} position={[x * TILE_SIZE, 0.15, z * TILE_SIZE]}>
      <Billboard>
        <mesh>
          {/* Size: 0.25 (approx 1/4 tile) */}
          <planeGeometry args={[0.25, 0.25]} />

          {/* FIX: Use these material settings for crisp pixel art */}
          <meshStandardMaterial
            map={texture}
            transparent
            alphaTest={0.5}
            toneMapped={false} // <--- Critical: Prevents "washed out" look
            color="white" // <--- Critical: Ensures true texture colors
            roughness={1}
          />
        </mesh>
      </Billboard>

      {/* Optional: Add a subtle light for "Rare" items only */}
      {(item.type === 'key' || item.type === 'weapon') && (
        <pointLight color="#fffbd6" intensity={0.5} distance={1.5} />
      )}
    </group>
  );
};
