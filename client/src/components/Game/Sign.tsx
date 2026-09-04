import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TILE_SIZE } from './MapData';

interface SignProps {
  x: number;
  z: number;
  playerPos: React.RefObject<THREE.Vector3>;
}

const POST_HEIGHT = TILE_SIZE * 0.6;
const BOARD_WIDTH = TILE_SIZE * 0.6;
const BOARD_HEIGHT = TILE_SIZE * 0.4;

export const Sign: React.FC<SignProps> = ({ x, z, playerPos }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current && playerPos.current) {
      // Keep the sign upright by inheriting its current Y position
      const target = new THREE.Vector3(
        playerPos.current.x,
        groupRef.current.position.y,
        playerPos.current.z
      );
      groupRef.current.lookAt(target);
    }
  });

  return (
    <group ref={groupRef} position={[x * TILE_SIZE, 0, z * TILE_SIZE]}>
      <mesh position={[0, POST_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={[TILE_SIZE * 0.08, POST_HEIGHT, TILE_SIZE * 0.08]} />
        <meshStandardMaterial color="#3b2a1a" roughness={1} />
      </mesh>
      <mesh position={[0, POST_HEIGHT * 0.85, 0]} castShadow>
        <boxGeometry args={[BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE * 0.05]} />
        <meshStandardMaterial color="#5a3d21" roughness={0.9} />
      </mesh>
    </group>
  );
};
