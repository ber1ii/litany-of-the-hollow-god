import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CombatUnit } from './CombatUnit';
import type { ClassId } from '../../data/Classes';
import { KNIGHT_SPRITES } from '../../data/sprites/KnightSprites';
import type { PlayerCombatAction } from '../../managers/CombatLogic';

interface CombatPlayerProps {
  classId: ClassId;
  action: PlayerCombatAction;
  attackVariant?: 1 | 2;
  // Cinematic slow-mo emphasis for specific skills — independent from
  // `action`/`attackVariant` since those are shared with plain weapon
  // swings that should NOT get the heavy-hit treatment.
  emphasis?: 'none' | 'heavy' | 'plunge';
  onAnimEnd: () => void;
  position: [number, number, number];
}

const REGISTRY = {
  KNIGHT: KNIGHT_SPRITES,
};

export const CombatPlayer: React.FC<CombatPlayerProps> = ({
  classId,
  action,
  attackVariant = 1,
  emphasis = 'none',
  onAnimEnd,
  position,
}) => {
  const sprites = REGISTRY[classId] || KNIGHT_SPRITES;

  const textureMap = useMemo(
    () => ({
      idle: sprites.idle,
      attack1: sprites.attack1,
      attack2: sprites.attack2,
      hurt: sprites.hurt,
      death: sprites.death,
      pray: sprites.pray,
      cast: sprites.cast,
      plunge: sprites.plunge,
      bloodSurge: sprites.bloodSurge,
      heal: sprites.heal,
    }),
    [sprites]
  );

  const textures = useTexture(textureMap);

  useMemo(() => {
    Object.values(textures).forEach((t) => {
      if (!t) return;
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
    });
  }, [textures]);

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
      case 'plunge':
        return textures.plunge;
      case 'blood_surge':
        return textures.bloodSurge;
      case 'heal':
        return textures.heal;
      case 'attack':
        return attackVariant === 2 ? textures.attack2 : textures.attack1;
      default:
        return textures.idle;
    }
  }, [action, attackVariant, textures]);

  // Frame/grid config, PLUS an optional mid-swing pause point for
  // emphasized hits. `pauseFrame`/`pauseDurationMs` mirror CombatEnemy's
  // heavy_cleave-style freeze; frameDuration is stretched (÷0.6) for a
  // uniform slow-mo feel even outside the pause window.
  const config = useMemo((): {
    frames: number;
    rows: number;
    columns: number;
    frameDuration: number;
    loop: boolean;
    pauseFrame?: number;
    pauseDurationMs?: number;
  } => {
    if (action === 'attack') {
      const isHeavy = emphasis === 'heavy';
      return {
        frames: 10,
        rows: 1,
        columns: 10,
        frameDuration: isHeavy ? 0.075 / 0.6 : 0.075,
        loop: false,
        pauseFrame: isHeavy ? 6 : undefined,
        pauseDurationMs: isHeavy ? 400 : undefined,
      };
    } else if (action === 'hurt') {
      return { frames: 3, rows: 2, columns: 2, frameDuration: 0.225, loop: false };
    } else if (action === 'pray' || action === 'cast') {
      return { frames: 12, rows: 3, columns: 4, frameDuration: 0.225, loop: false };
    } else if (action === 'plunge') {
      const isEmphasized = emphasis === 'plunge';
      return {
        frames: 8,
        rows: 4,
        columns: 2,
        frameDuration: isEmphasized ? 0.08 / 0.6 : 0.08,
        loop: false,
        // Freeze right before impact — this is also what sells the hit
        // despite the sprite never actually traversing to the enemy.
        pauseFrame: isEmphasized ? 4 : undefined,
        pauseDurationMs: isEmphasized ? 500 : undefined,
      };
    } else if (action === 'blood_surge') {
      return { frames: 8, rows: 4, columns: 2, frameDuration: 0.13, loop: false };
    } else if (action === 'heal') {
      return { frames: 8, rows: 4, columns: 2, frameDuration: 0.1, loop: false };
    } else if (action === 'die') {
      return { frames: 1, rows: 4, columns: 2, frameDuration: 0.225, loop: false };
    } else {
      return { frames: 8, rows: 4, columns: 2, frameDuration: 0.225, loop: true };
    }
  }, [action, emphasis]);

  // Mid-swing pause state — same pattern as CombatEnemy's isPaused/
  // pauseTimer/hasPausedOnce, driven here instead of by a currentAttackDef.
  const [isPaused, setIsPaused] = useState(false);
  const pauseTimer = useRef(0);
  const hasPausedOnce = useRef(false);

  useEffect(() => {
    pauseTimer.current = 0;
    hasPausedOnce.current = false;
  }, [action, attackVariant, emphasis]);

  useFrame((_state, delta) => {
    if (isPaused && config.pauseDurationMs) {
      pauseTimer.current += delta * 1000;
      if (pauseTimer.current >= config.pauseDurationMs) {
        setIsPaused(false);
      }
    }
  });

  const handleFrameChange = (frameIndex: number) => {
    if (
      config.pauseFrame !== undefined &&
      frameIndex === config.pauseFrame &&
      !hasPausedOnce.current
    ) {
      hasPausedOnce.current = true;
      setIsPaused(true);
    }
  };

  const effectiveFrameDuration = isPaused ? 999 : config.frameDuration;

  return (
    <CombatUnit
      texture={currentTexture}
      frames={config.frames}
      columns={config.columns}
      rows={config.rows}
      frameDuration={effectiveFrameDuration}
      loop={config.loop}
      onAnimEnd={onAnimEnd}
      onFrameChange={handleFrameChange}
      position={position}
      height={2.1}
    />
  );
};
