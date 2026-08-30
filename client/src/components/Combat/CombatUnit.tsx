import React, { useRef, useMemo, useEffect } from 'react';
import { useTexture, Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CombatUnitProps {
  textureUrl?: string;
  texture?: THREE.Texture;
  frames: number;
  columns: number;
  rows: number;
  startFrame?: number;
  position: [number, number, number];
  height?: number;
  flip?: boolean;
  loop?: boolean;
  onAnimEnd?: () => void;
  onFrameChange?: (frameIndex: number) => void;
  frameDuration?: number;
  customMaterial?: React.ReactElement<Record<string, unknown>>;
  customMaterialRef?: React.RefObject<THREE.ShaderMaterial | null>;
}

export const CombatUnit: React.FC<CombatUnitProps> = ({
  textureUrl,
  frames,
  texture: providedTexture,
  columns,
  rows,
  startFrame = 0,
  position,
  height = 3,
  flip = false,
  loop = true,
  onAnimEnd,
  onFrameChange,
  frameDuration = 0.075,
  customMaterial,
  customMaterialRef,
}) => {
  const loadedTexture = useTexture(providedTexture ? [] : [textureUrl!]);
  const sourceTexture = providedTexture || (loadedTexture[0] as THREE.Texture);

  const standardMaterialRef = useRef<THREE.MeshStandardMaterial>(null);

  const activeTexture = useMemo(() => {
    if (!sourceTexture) return null;

    const t = sourceTexture.clone();
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;

    const repeatX = flip ? -1 / columns : 1 / columns;
    const repeatY = 1 / rows;
    t.repeat.set(repeatX, repeatY);

    const col = startFrame % columns;
    const row = Math.floor(startFrame / columns);

    const xOff = col * (1 / columns);
    const yOff = 1 - (row + 1) * (1 / rows);

    t.offset.set(flip ? xOff + 1 / columns : xOff, yOff);
    t.needsUpdate = true;

    return t;
  }, [sourceTexture, columns, rows, flip, startFrame]);

  const spriteAspect = useMemo(() => {
    const img = sourceTexture?.image as HTMLImageElement | undefined;
    if (!img || !img.width || !img.height) return 1;
    const frameWidth = img.width / columns;
    const frameHeight = img.height / rows;
    return frameWidth / frameHeight;
  }, [sourceTexture, columns, rows]);

  const width = height * spriteAspect;
  const currentLocalFrame = useRef(0);
  const elapsed = useRef(0);

  useFrame((_state, delta) => {
    if (!activeTexture) return;

    elapsed.current += delta;

    if (elapsed.current >= frameDuration) {
      elapsed.current = 0;

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

      onFrameChange?.(currentLocalFrame.current);

      const absFrame = startFrame + currentLocalFrame.current;
      const col = absFrame % columns;
      const row = Math.floor(absFrame / columns);

      const xOff = col * (1 / columns);
      const yOff = 1 - (row + 1) * (1 / rows);
      const finalXOff = flip ? xOff + 1 / columns : xOff;

      if (customMaterialRef?.current) {
        const uniforms = (customMaterialRef.current as THREE.ShaderMaterial).uniforms;
        if (uniforms?.spriteOffset) {
          uniforms.spriteOffset.value.set(finalXOff, yOff);
        }
      } else {
        activeTexture.offset.set(finalXOff, yOff);
      }
    }
  });

  useEffect(() => {
    currentLocalFrame.current = 0;
    elapsed.current = 0;
  }, [sourceTexture?.uuid, startFrame, frames]);

  if (!activeTexture) return null;

  return (
    <Billboard position={position}>
      <mesh position={[0, height / 2, 0]}>
        <planeGeometry args={[width, height]} />
        {customMaterial ? (
          React.cloneElement(customMaterial, {
            ref: customMaterialRef,
            map: activeTexture,
            spriteRepeat: new THREE.Vector2(flip ? -1 / columns : 1 / columns, 1 / rows),
          })
        ) : (
          <meshStandardMaterial
            ref={standardMaterialRef}
            map={activeTexture}
            transparent
            alphaTest={0.5}
          />
        )}
      </mesh>
    </Billboard>
  );
};
