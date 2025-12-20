import React, { useRef, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TILE_SIZE } from './MapData';

interface GoldProps {
  x: number;
  z: number;
}

export const Gold: React.FC<GoldProps> = ({ x, z }) => {
  const textures = useTexture([
    '/sprites/items/gold_drop/1.png',
    '/sprites/items/gold_drop/2.png',
    '/sprites/items/gold_drop/3.png',
    '/sprites/items/gold_drop/4.png',
    '/sprites/items/gold_drop/5.png',
    '/sprites/items/gold_drop/6.png',
    '/sprites/items/gold_drop/7.png',
    '/sprites/items/gold_drop/8.png',
  ]);

  useMemo(() => {
    textures.forEach((t) => {
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
    });
  }, [textures]);

  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state) => {
    if (!meshRef.current || !materialRef.current) return;

    meshRef.current.lookAt(state.camera.position);

    const frameIndex = Math.floor(state.clock.elapsedTime * 10) % textures.length;

    materialRef.current.map = textures[frameIndex];
  });

  return (
    <mesh ref={meshRef} position={[x * TILE_SIZE, 0.15, z * TILE_SIZE]} scale={[0.8, 0.8, 0.8]}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial
        ref={materialRef}
        map={textures[0]} // Start with frame 1
        transparent={true}
        alphaTest={0.5}
        side={THREE.DoubleSide}
        emissive="#ffaa00"
        emissiveIntensity={0.2}
      />
    </mesh>
  );
};
