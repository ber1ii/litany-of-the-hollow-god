// components/Combat/CombatUnit.tsx
import React, { useRef, useMemo } from 'react';
import { useTexture, Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CombatUnitProps {
  textureUrl: string;
  frames: number; // Number of frames to play
  columns: number; // Total columns in sheet
  rows: number; // Total rows in sheet
  startFrame?: number; // Starting index (0 = top left)
  position: [number, number, number];
  height?: number;
  flip?: boolean;
  loop?: boolean;
  onAnimEnd?: () => void;
}

export const CombatUnit: React.FC<CombatUnitProps> = ({
  textureUrl,
  frames,
  columns,
  rows,
  startFrame = 0,
  position,
  height = 3,
  flip = false,
  loop = true,
  onAnimEnd,
}) => {
  const masterTexture = useTexture(textureUrl);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  const spriteAspect = useMemo(() => {
    const img = masterTexture.image as HTMLImageElement;

    // Safety check: if image isn't fully ready or dimensions are missing
    if (!img || !img.width || !img.height) return 1;

    const frameWidth = img.width / columns;
    const frameHeight = img.height / rows;
    return frameWidth / frameHeight;
  }, [masterTexture, columns, rows]);

  const width = height * spriteAspect;

  // Configure the texture instance once
  const texture = useMemo(() => {
    const t = masterTexture.clone();
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;

    // Grid Setup
    t.repeat.set(1 / columns, 1 / rows);

    // Initial Offset
    // We calculate the very first frame's offset here
    const col = startFrame % columns;
    const row = Math.floor(startFrame / columns);

    const xOff = col * (1 / columns);
    const yOff = 1 - (row + 1) * (1 / rows);

    t.offset.set(flip ? xOff + 1 / columns : xOff, yOff);

    if (flip) {
      t.repeat.x = -1 / columns;
    }
    return t;
  }, [masterTexture, columns, rows, flip, startFrame]);

  // Animation State
  const currentLocalFrame = useRef(0);
  const elapsed = useRef(0);
  const FRAME_DURATION = 0.225;

  useFrame((state, delta) => {
    if (!materialRef.current || !materialRef.current.map) return;

    elapsed.current += delta;

    if (elapsed.current > FRAME_DURATION) {
      elapsed.current = 0;

      // Advance Frame
      if (currentLocalFrame.current < frames - 1) {
        currentLocalFrame.current++;
      } else {
        if (loop) {
          currentLocalFrame.current = 0;
        } else {
          if (onAnimEnd) onAnimEnd();
          return;
        }
      }

      // Calculate the absolute frame index in the sheet
      const absFrame = startFrame + currentLocalFrame.current;

      // Calculate UV Coordinates
      const col = absFrame % columns;
      const row = Math.floor(absFrame / columns);

      const xOff = col * (1 / columns);
      const yOff = 1 - (row + 1) * (1 / rows);

      materialRef.current.map.offset.x = flip ? xOff + 1 / columns : xOff;
      materialRef.current.map.offset.y = yOff;
    }
  });

  return (
    <Billboard position={position}>
      {/* FIX 2: Offset Y by height/2 so the 'position' prop refers to the FEET */}
      <mesh position={[0, height / 2, 0]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial ref={materialRef} map={texture} transparent alphaTest={0.5} />
      </mesh>
    </Billboard>
  );
};
