import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useTexture } from '@react-three/drei';
import { useFrame, extend, type ThreeElement } from '@react-three/fiber';
import { CombatUnit } from './CombatUnit';
import type { EnemyDef, EnemyAttackDef } from '../../types/GameTypes';
import { ENEMIES } from '../../data/Enemies';
import * as THREE from 'three';
import { useCombatStore } from '../../hooks/useCombatStore';
import { CombatSpriteMaterial } from '../../shaders/CombatSpriteMaterial';
import { AnatomicalTargetingOverlay } from './AnatomicalTargetingOverlay';

extend({ CombatSpriteMaterial });

export type SpriteMaterialImpl = THREE.ShaderMaterial & {
  time: number;
  dissolveAmount: number;
  hitEffect: number;
  spriteOffset: THREE.Vector2;
  severedLimbs: THREE.Vector4;
  maskMap?: THREE.Texture;
  hasMask: number;
};

declare module '@react-three/fiber' {
  interface ThreeElements {
    combatSpriteMaterial: ThreeElement<typeof CombatSpriteMaterial>;
  }
}

interface CombatEnemyProps {
  enemyId: string;
  action: 'idle' | 'attack' | 'hurt' | 'death';
  onAnimEnd: () => void;
  position: [number, number, number];
  currentAttackDef?: EnemyAttackDef;
  onTriggerVfx?: (type: string) => void;
  onTriggerCameraShake?: (intensity: number) => void;
}

export const CombatEnemy: React.FC<CombatEnemyProps> = ({
  enemyId,
  action,
  onAnimEnd,
  position,
  currentAttackDef,
  onTriggerVfx,
  onTriggerCameraShake,
}) => {
  const materialRef = useRef<SpriteMaterialImpl>(null);
  const enemyInstance = useCombatStore((state) => state.enemyInstance);

  const baseId = enemyId.split('-')[0].toUpperCase();
  const def: EnemyDef = ENEMIES[baseId] || ENEMIES['SKELETON'];

  const [isPaused, setIsPaused] = useState(false);
  const pauseTimer = useRef(0);
  const hasPausedOnce = useRef(false);
  const hasFiredVfx = useRef(false);
  const hasFiredShake = useRef(false);

  const [prevAction, setPrevAction] = useState(action);
  const [prevAttackDef, setPrevAttackDef] = useState(currentAttackDef);

  if (action !== prevAction || currentAttackDef !== prevAttackDef) {
    setPrevAction(action);
    setPrevAttackDef(currentAttackDef);

    if (action === 'attack') {
      setIsPaused(false);
    }
  }

  useEffect(() => {
    if (action === 'attack') {
      pauseTimer.current = 0;
      hasPausedOnce.current = false;
      hasFiredVfx.current = false;
      hasFiredShake.current = false;
    }
  }, [action, currentAttackDef]);

  const textureMap = useMemo(() => {
    const idleUrl = def.sprites?.idle?.textureUrl || '';
    const attackUrl = def.sprites?.attack?.textureUrl || idleUrl;
    const hurtUrl = def.sprites?.hurt?.textureUrl || idleUrl;
    const deathUrl = def.sprites?.death?.textureUrl || idleUrl;

    const map: Record<string, string> = {
      idle: idleUrl,
      attack: attackUrl,
      hurt: hurtUrl,
      death: deathUrl,
    };

    if (def.hasMask) {
      map.idleMask = idleUrl.replace('.png', '_mask.png');
      map.attackMask = attackUrl.replace('.png', '_mask.png');
      map.hurtMask = hurtUrl.replace('.png', '_mask.png');
      map.deathMask = deathUrl.replace('.png', '_mask.png');
    }

    return map;
  }, [def]);

  const textures = useTexture(textureMap);

  useMemo(() => {
    Object.values(textures).forEach((t) => {
      if (!t) return;
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
    });
  }, [textures]);

  const currentConfig = useMemo(() => {
    const hasMask = Boolean(def.hasMask);
    switch (action) {
      case 'attack':
        return {
          tex: textures.attack,
          mask: hasMask ? textures.attackMask : undefined,
          cfg: def.sprites.attack,
        };
      case 'hurt':
        return {
          tex: textures.hurt,
          mask: hasMask ? textures.hurtMask : undefined,
          cfg: def.sprites.hurt,
        };
      case 'death':
        return {
          tex: textures.death,
          mask: hasMask ? textures.deathMask : undefined,
          cfg: def.sprites.death,
        };
      default:
        return {
          tex: textures.idle,
          mask: hasMask ? textures.idleMask : undefined,
          cfg: def.sprites.idle,
        };
    }
  }, [action, def, textures]);

  const effectiveFrameDuration = useMemo(() => {
    if (action !== 'attack' || !currentAttackDef) {
      return currentConfig.cfg.frameDuration || 0.08;
    }

    if (isPaused) {
      return 999;
    }

    const speed = currentAttackDef.speedMultiplier || 1.0;
    return (currentConfig.cfg.frameDuration || 0.08) / speed;
  }, [action, currentConfig, currentAttackDef, isPaused]);

  const severedVector = useMemo(() => {
    if (!enemyInstance?.parts) return new THREE.Vector4(0, 0, 0, 0);

    const isSevered = (id: string) =>
      enemyInstance.parts.find((p) => p.id === id)?.isSevered ? 1.0 : 0.0;

    return new THREE.Vector4(
      isSevered('l_arm') || isSevered('l_wing'),
      isSevered('r_arm') || isSevered('r_wing'),
      isSevered('l_leg'),
      isSevered('r_leg')
    );
  }, [enemyInstance]);

  useFrame((_state, delta) => {
    if (materialRef.current) {
      materialRef.current.time += delta;

      if (materialRef.current.uniforms?.severedLimbs) {
        materialRef.current.uniforms.severedLimbs.value.copy(severedVector);
      } else {
        materialRef.current.severedLimbs = severedVector;
      }

      if (action === 'death') {
        materialRef.current.dissolveAmount = THREE.MathUtils.lerp(
          materialRef.current.dissolveAmount,
          1.0,
          delta * 1.5
        );
      } else {
        materialRef.current.dissolveAmount = 0.0;
      }

      if (action === 'hurt') {
        materialRef.current.hitEffect = THREE.MathUtils.lerp(
          materialRef.current.hitEffect,
          0.8,
          delta * 10.0
        );
      } else {
        materialRef.current.hitEffect = THREE.MathUtils.lerp(
          materialRef.current.hitEffect,
          0.0,
          delta * 5.0
        );
      }
    }

    if (action === 'attack' && isPaused && currentAttackDef) {
      pauseTimer.current += delta * 1000;
      if (pauseTimer.current >= (currentAttackDef.pauseDurationMs || 1000)) {
        setIsPaused(false);
      }
    }
  });

  const handleFrameChange = (frameIndex: number) => {
    if (action !== 'attack' || !currentAttackDef) return;

    if (
      currentAttackDef.pauseFrame !== undefined &&
      frameIndex === currentAttackDef.pauseFrame &&
      !hasPausedOnce.current
    ) {
      hasPausedOnce.current = true;
      setIsPaused(true);
    }

    if (
      currentAttackDef.projectileType &&
      currentAttackDef.projectileFrame !== undefined &&
      frameIndex === currentAttackDef.projectileFrame &&
      !hasFiredVfx.current
    ) {
      hasFiredVfx.current = true;
      onTriggerVfx?.(currentAttackDef.projectileType);
    }

    if (
      currentAttackDef.screenShake &&
      !hasFiredShake.current &&
      frameIndex >= Math.floor(currentConfig.cfg.frames * 0.7)
    ) {
      hasFiredShake.current = true;
      onTriggerCameraShake?.(currentAttackDef.screenShake);
    }
  };

  return (
    <group position={position}>
      <CombatUnit
        texture={currentConfig.tex}
        frames={currentConfig.cfg.frames}
        columns={currentConfig.cfg.columns}
        rows={currentConfig.cfg.rows}
        frameDuration={effectiveFrameDuration}
        startFrame={0}
        loop={action === 'idle'}
        onAnimEnd={onAnimEnd}
        onFrameChange={handleFrameChange}
        position={[0, 0, 0]} // Position handled by parent group
        height={def.scale}
        flip={true}
        customMaterialRef={materialRef}
        customMaterial={
          <combatSpriteMaterial
            attach="material"
            maskMap={currentConfig.mask || undefined}
            hasMask={def.hasMask ? 1.0 : 0.0}
            severedLimbs={severedVector}
            transparent={true}
          />
        }
      />

      {/* Anatomical 3D Target Overlay */}
      <AnatomicalTargetingOverlay enemyPosition={[0, 0, 0]} />
    </group>
  );
};
