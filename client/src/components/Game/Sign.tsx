import React from 'react';
import { TILE_SIZE } from './MapData';

interface SignProps {
  x: number;
  z: number;
}

const POST_HEIGHT = TILE_SIZE * 0.6;
const BOARD_WIDTH = TILE_SIZE * 0.6;
const BOARD_HEIGHT = TILE_SIZE * 0.4;

// Simple placeholder geometry — SIGN has no dedicated atlas sprite yet
// (TileRegistry's SIGN entry uses the shared {col:0,row:0} placeholder),
// so this renders as a plain post + board rather than a textured quad.
// Swap this out for a textured mesh once sign art exists.
export const Sign: React.FC<SignProps> = ({ x, z }) => (
  <group position={[x * TILE_SIZE, 0, z * TILE_SIZE]}>
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
