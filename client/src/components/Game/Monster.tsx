import React, { useRef, useState, useMemo } from 'react';
import { useTexture, Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getSpritePaths } from '../../utils/assetUtils';
import { TILE_SIZE } from './MapData';

interface MonsterProps {
  type: 'skeleton';
  startX: number;
  startZ: number;
  playerPos: THREE.Vector3;
  onCombatStart: () => void;
}

export const Monster: React.FC<MonsterProps> = ({
  type,
  startX,
  startZ,
  playerPos,
  onCombatStart,
}) => {
  // AI State
  const [direction, setDirection] = useState('S');
  const action = 'walk';

  // Patrol logic dependencies
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const patrolDir = useRef(1);
  const currentPos = useRef(new THREE.Vector3(startX * TILE_SIZE, 0.5, startZ * TILE_SIZE));

  // Latch to track combat encounter later (prevent 60fps triggers)
  const hasTriggeredCombat = useRef(false);

  // Sprite loading
  const paths = getSpritePaths(type, action, direction);
  const result = useTexture(paths);

  const textures = useMemo(() => {
    const arr = Array.isArray(result) ? result : [result];
    arr.forEach((t) => {
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
    });
    return arr;
  }, [result]);

  // Game loop
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Patrol logic
    // Move along X axis
    const speed = 1.5;
    const moveX = patrolDir.current * speed * delta;
    currentPos.current.x += moveX;

    const rightBound = (startX + 2) * TILE_SIZE;
    const leftBound = (startX - 2) * TILE_SIZE;

    if (currentPos.current.x > rightBound) {
      patrolDir.current = -1;
    } else if (currentPos.current.x < leftBound) {
      patrolDir.current = 1;
    }

    groupRef.current.position.copy(currentPos.current);

    // Direction calculation
    if (patrolDir.current === 1 && direction !== 'E') {
      setDirection('E');
    } else if (patrolDir.current === -1 && direction !== 'W') {
      setDirection('W');
    }

    // Animation frame
    if (textures.length > 0 && materialRef.current) {
      const frameIndex = Math.floor(state.clock.elapsedTime * 10) % textures.length;
      materialRef.current.map = textures[frameIndex];
    }

    // --- COMBAT ---
    if (!hasTriggeredCombat.current && currentPos.current.distanceTo(playerPos) < 0.4) {
      console.log('Combat Triggered!');
      hasTriggeredCombat.current = true;
      onCombatStart();
    }
  });

  return (
    <group ref={groupRef} position={[startX * TILE_SIZE, 0.5, startZ * TILE_SIZE]}>
      <Billboard lockX={false} lockY={false} lockZ={false}>
        <mesh>
          <planeGeometry args={[2, 2]} />
          <meshStandardMaterial ref={materialRef} map={textures[0]} transparent alphaTest={0.5} />
        </mesh>
      </Billboard>
    </group>
  );
};
