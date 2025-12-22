import React, { useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { CombatUnit } from './CombatUnit';
import type { ClassId } from '../../data/Classes';
import { KNIGHT_SPRITES } from '../../data/sprites/KnightSprites';
import { MAGE_SPRITES } from '../../data/sprites/MageSprites';
import { ASSASSIN_SPRITES } from '../../data/sprites/AssassinSprites';

interface CombatPlayerProps {
  classId: ClassId;
  action: 'idle' | 'attack' | 'hurt' | 'pray' | 'die' | 'cast';
  attackVariant?: 1 | 2;
  onAnimEnd: () => void;
  position: [number, number, number];
}

const REGISTRY = {
  KNIGHT: KNIGHT_SPRITES,
  MAGE: MAGE_SPRITES,
  ASSASSIN: ASSASSIN_SPRITES,
};

export const CombatPlayer: React.FC<CombatPlayerProps> = ({
  classId,
  action,
  attackVariant = 1,
  onAnimEnd,
  position,
}) => {
  const sprites = REGISTRY[classId] || KNIGHT_SPRITES;

  // 1. Define the Texture Map (Load ALL sprites for this class at once)
  const textureMap = useMemo(
    () => ({
      idle: sprites.idle,
      attack1: sprites.attack1,
      attack2: sprites.attack2,
      hurt: sprites.hurt,
      death: sprites.death,
      pray: sprites.pray,
      cast: sprites.cast,
    }),
    [sprites]
  );

  // 2. Load all textures via hook (Stable argument = No re-suspension/flashing)
  const textures = useTexture(textureMap);

  // 3. Configure Pixel Art Settings (Nearest Filter)
  useMemo(() => {
    Object.values(textures).forEach((t) => {
      if (!t) return;
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
    });
  }, [textures]);

  // 4. Select the correct texture based on current action
  const currentTexture = useMemo(() => {
    switch (action) {
      case 'idle':
        return textures.idle;
      case 'hurt':
        return textures.hurt;
      case 'die':
        return textures.death;
      case 'pray':
        return textures.pray;
      case 'cast':
        return textures.cast;
      case 'attack':
        return attackVariant === 2 ? textures.attack2 : textures.attack1;
      default:
        return textures.idle;
    }
  }, [action, attackVariant, textures]);

  // 5. Determine Frame Config
  const config = useMemo(() => {
    if (action === 'attack') {
      return { frames: 10, rows: 1, columns: 10, frameDuration: 0.075, loop: false };
    } else if (action === 'hurt') {
      return { frames: 3, rows: 2, columns: 2, frameDuration: 0.225, loop: false };
    } else if (action === 'pray' || action === 'cast') {
      return { frames: 12, rows: 3, columns: 4, frameDuration: 0.225, loop: false };
    } else if (action === 'die') {
      return { frames: 1, rows: 4, columns: 2, frameDuration: 0.225, loop: false }; // Death usually freezes
    } else {
      // Idle
      return { frames: 8, rows: 4, columns: 2, frameDuration: 0.225, loop: true };
    }
  }, [action]);

  return (
    <CombatUnit
      texture={currentTexture}
      // Note: We do NOT pass textureUrl here, forcing CombatUnit to use the 'texture' prop
      frames={config.frames}
      columns={config.columns}
      rows={config.rows}
      frameDuration={config.frameDuration}
      loop={config.loop}
      onAnimEnd={onAnimEnd}
      position={position}
      height={2.1}
    />
  );
};

// --- PRELOADER ---
export const preloadPlayerAssets = () => {
  const allUrls = new Set<string>();
  Object.values(REGISTRY).forEach((spriteDef) => {
    Object.values(spriteDef).forEach((url) => allUrls.add(url));
  });
  useTexture.preload(Array.from(allUrls));
  console.log('Player Combat Assets Preloaded.');
};
