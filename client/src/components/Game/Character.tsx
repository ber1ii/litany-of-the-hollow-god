import React, { useState, useMemo } from 'react';
import { useTexture, Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getSpritePaths } from '../../utils/assetUtils';

interface CharacterProps {
  action: 'idle' | 'walk';
  direction: string;
  position: [number, number, number];
}

export const Character: React.FC<CharacterProps> = ({ action, direction, position }) => {
  const paths = getSpritePaths('hero', action, direction);

  // Load textures
  const result = useTexture(paths);

  // Ensure array
  const textures = useMemo(() => {
    const arr = Array.isArray(result) ? result : [result];

    // Configure settings ONCE when textures load
    arr.forEach((tex) => {
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
    });

    return arr;
  }, [result]);

  // Animation Loop
  const [frameIndex, setFrameIndex] = useState(0);

  useFrame((state) => {
    // Only animate if we have multiple frames
    if (textures.length > 1) {
      const frame = Math.floor(state.clock.elapsedTime * 10) % textures.length;
      setFrameIndex(frame);
    } else {
      setFrameIndex(0);
    }
  });

  return (
    <Billboard position={position} lockX={false} lockY={false} lockZ={false}>
      <mesh>
        <planeGeometry args={[2, 2]} />
        <meshStandardMaterial map={textures[frameIndex]} transparent alphaTest={0.5} />
      </mesh>
    </Billboard>
  );
};
