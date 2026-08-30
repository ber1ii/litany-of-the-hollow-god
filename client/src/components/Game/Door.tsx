import React, { useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';
import * as THREE from 'three';
import { TILE_SIZE } from './MapData';
import { SHEET_CONFIG } from '../../data/TileRegistry';

interface DoorProps {
  x: number;
  z: number;
  isOpen: boolean;
  isLocked?: boolean;
  rotation?: number;
}

export const Door: React.FC<DoorProps> = ({ x, z, isOpen, isLocked, rotation = 0 }) => {
  // 1. Load textures
  const rawAtlas = useTexture('/textures/sheets/mainlevbuild.png');
  const rawWall = useTexture('/textures/environment/ground_stone.png');

  // 2. Configure Textures
  const { doorTexture, wallTexture } = useMemo(() => {
    const wT = rawWall.clone();
    wT.magFilter = THREE.NearestFilter;
    wT.colorSpace = THREE.SRGBColorSpace;
    wT.wrapS = THREE.RepeatWrapping;
    wT.wrapT = THREE.RepeatWrapping;

    const dT = rawAtlas.clone();
    dT.magFilter = THREE.NearestFilter;
    dT.minFilter = THREE.NearestFilter;
    dT.colorSpace = THREE.SRGBColorSpace;

    const col = 34;
    const row = 18;
    const w = 1;
    const h = 2;

    const totalCols = SHEET_CONFIG.width / SHEET_CONFIG.tileSize;
    const totalRows = SHEET_CONFIG.height / SHEET_CONFIG.tileSize;

    dT.repeat.set(w / totalCols, h / totalRows);
    dT.offset.x = col / totalCols;
    dT.offset.y = (totalRows - row - h) / totalRows;

    return { doorTexture: dT, wallTexture: wT };
  }, [rawAtlas, rawWall]);

  // Dimensions - Tuned relative to player height (~1.0 - 1.2 units)
  const DOOR_WIDTH = 0.9;
  const DOOR_HEIGHT = 1.4;
  const WALL_TOTAL_HEIGHT = 3.0;
  const FILLER_HEIGHT = WALL_TOTAL_HEIGHT - DOOR_HEIGHT;
  const WALL_THICKNESS = 0.25;

  // Animation
  const { slideOffset } = useSpring({
    slideOffset: isOpen ? DOOR_WIDTH * 0.85 : 0,
    config: { mass: 1, tension: 120, friction: 20 },
  });

  const jambXOffset = DOOR_WIDTH / 2;

  return (
    <group position={[x * TILE_SIZE, 0, z * TILE_SIZE]} rotation={[0, rotation, 0]}>
      {/* DOOR FRAME (Jambs) */}
      <group>
        {/* Left Jamb */}
        <mesh position={[-jambXOffset, DOOR_HEIGHT / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.04, DOOR_HEIGHT, WALL_THICKNESS]} />
          <meshStandardMaterial color="#333" />
        </mesh>
        {/* Right Jamb */}
        <mesh position={[jambXOffset, DOOR_HEIGHT / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.04, DOOR_HEIGHT, WALL_THICKNESS]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      </group>

      {/* A. THE MOVING GRATE */}
      <animated.group position-x={slideOffset}>
        <mesh position={[0, DOOR_HEIGHT / 2, 0]} castShadow receiveShadow>
          <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
          <meshStandardMaterial
            map={doorTexture}
            transparent
            side={THREE.DoubleSide}
            alphaTest={0.5}
            color={isLocked ? '#ffaaaa' : '#ffffff'}
          />
        </mesh>
      </animated.group>

      {/* B. THE STATIC STONE WALL ABOVE (FILLER) */}
      <mesh position={[0, DOOR_HEIGHT + FILLER_HEIGHT / 2, 0]} receiveShadow>
        <boxGeometry args={[TILE_SIZE, FILLER_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial map={wallTexture} color="#666" />
      </mesh>
    </group>
  );
};
