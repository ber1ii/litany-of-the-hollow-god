import React from 'react';
import { useSpring, animated } from '@react-spring/three';
import { TILE_SIZE } from './MapData';

interface DoorProps {
  x: number;
  z: number;
  isOpen: boolean;
}

export const Door: React.FC<DoorProps> = ({ x, z, isOpen }) => {
  const { rotationY } = useSpring({
    rotationY: isOpen ? -Math.PI / 2 : 0,
    config: { mass: 1, tension: 170, friction: 26 },
  });

  const position = [x * TILE_SIZE, 1, z * TILE_SIZE] as [number, number, number];

  return (
    <animated.group position={position} rotation-y={rotationY}>
      {/* Door Frame */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[TILE_SIZE, 2, 0.2]} />
        <meshStandardMaterial color="#4a3c31" />
      </mesh>

      {/* Door Knob */}
      <mesh position={[0.6, 0, 0.15]}>
        <sphereGeometry args={[0.1]} />
        {/* FIX: 'metallic' -> 'metalness' */}
        <meshStandardMaterial color="#c0a080" metalness={0.8} roughness={0.2} />
      </mesh>
    </animated.group>
  );
};
