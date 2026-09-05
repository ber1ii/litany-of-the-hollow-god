import React, { useMemo, useRef } from 'react';
import { useTexture, Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CHARACTER_SIZE } from './MapData';

interface CharacterProps {
  action: 'idle' | 'walk';
  direction: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
  position: [number, number, number];
  isSwordless?: boolean;
}

const DIRECTION_ROW_MAP: Record<string, number> = {
  E: 0,
  SE: 1,
  S: 2,
  SW: 3,
  W: 4,
  NW: 5,
  N: 6,
  NE: 7,
};

const GRID_CONFIG = {
  cols: 15,
  rows: 8,
  fps: 12,
};

export const Character: React.FC<CharacterProps> = ({
  action,
  direction,
  position,
  isSwordless,
}) => {
  const sheetPath = `/sprites/characters/knight/2D HD Character Knight/Spritesheets/With shadows/${
    action === 'walk' ? 'Walk' : 'Idle'
  }${isSwordless ? '_Swordless' : ''}.png`;

  const rawTexture = useTexture(sheetPath);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  const texture = useMemo(() => {
    const tex = rawTexture.clone();
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.repeat.set(1 / GRID_CONFIG.cols, 1 / GRID_CONFIG.rows);
    tex.needsUpdate = true;
    return tex;
  }, [rawTexture]);

  useFrame((state) => {
    const mat = materialRef.current;
    if (!mat || !mat.map) return;

    const totalFrames = GRID_CONFIG.cols;
    const currentFrame = Math.floor(state.clock.elapsedTime * GRID_CONFIG.fps) % totalFrames;
    const rowIndex = DIRECTION_ROW_MAP[direction] ?? 0;

    const offsetX = currentFrame / GRID_CONFIG.cols;
    const offsetY = (GRID_CONFIG.rows - 1 - rowIndex) / GRID_CONFIG.rows;

    mat.map.offset.set(offsetX, offsetY);
  });

  return (
    <Billboard position={position} lockX={false} lockY={false} lockZ={false}>
      <mesh>
        <planeGeometry args={[CHARACTER_SIZE, CHARACTER_SIZE]} />
        <meshStandardMaterial ref={materialRef} map={texture} transparent alphaTest={0.5} />
      </mesh>
    </Billboard>
  );
};
