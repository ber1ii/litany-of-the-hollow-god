import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useTexture, Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getSpritePaths } from '../../utils/assetUtils';
import { TILE_SIZE, MONSTER_SCALE } from './MapData';
import { useMonsterBehavior } from '../../hooks/useMonsterBehavior';
import type { MonsterBehavior, Direction } from '../../hooks/useMonsterBehavior';
import type { MonsterType } from '../../types/GameTypes';
import { AudioManager } from '../../managers/AudioManager';

// Maps sprite/monster type to its footstep variation key in AudioManager.
// Falls back to skeleton_walk for any non-sheet type (currently only 'skeleton').
const WALK_SOUND_MAP: Record<string, string> = {
  orc2: 'orc_walk',
  orc3: 'orc_walk',
  vampire1: 'vampire_walk',
  vampire_boss: 'vampire_walk',
};
const WALK_INTERVAL = 0.5;
const CHASE_WALK_INTERVAL = 0.28;

interface MonsterProps {
  id: string;
  type: MonsterType;
  startX: number;
  startZ: number;
  behavior?: MonsterBehavior;
  playerPos: THREE.Vector3;
  collisionGrid: boolean[][];
  onCombatStart: () => void;
  enemyTracker: React.RefObject<Map<string, { x: number; z: number }>>;
  onChaseStateChange?: (id: string, isChasing: boolean) => void;
  scale?: number;
  active?: boolean;
}

const SPRITESHEET_CONFIGS: Record<string, { url: string; cols: number; rows: number }> = {
  orc2: { url: '/sprites/characters/orc2/orc2_walk_full.png', cols: 6, rows: 4 },
  orc3: { url: '/sprites/characters/orc3/orc3_walk_full.png', cols: 6, rows: 4 },
  vampire1: { url: '/sprites/characters/vampire1/Vampires2_Walk_full.png', cols: 6, rows: 4 },
  vampire_boss: {
    url: '/sprites/characters/vampire_boss/Vampires3_Walk_full.png',
    cols: 6,
    rows: 4,
  },
};

const DIRECTION_ROW_MAP: Record<string, number> = {
  S: 0,
  N: 1,
  W: 2,
  E: 3,
};

export const Monster: React.FC<MonsterProps> = ({
  id,
  type,
  startX,
  startZ,
  behavior = { type: 'static', facing: 'S' },
  playerPos,
  collisionGrid,
  onCombatStart,
  enemyTracker,
  onChaseStateChange,
  scale = MONSTER_SCALE,
  active = true,
}) => {
  const [direction, setDirection] = useState<Direction>('S');
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const currentPos = useRef(new THREE.Vector3(startX * TILE_SIZE, 0.15, startZ * TILE_SIZE));
  const hasTriggeredCombat = useRef(false);
  const stepAudioTimer = useRef(0);
  const prevStepPos = useRef(new THREE.Vector3(startX * TILE_SIZE, 0.15, startZ * TILE_SIZE));

  const { updatePosition, isChasing } = useMonsterBehavior(
    startX,
    startZ,
    behavior,
    playerPos,
    collisionGrid,
    (chasing) => onChaseStateChange?.(id, chasing)
  );

  const isSheetMonster = Boolean(SPRITESHEET_CONFIGS[type]);
  const sheetConfig = SPRITESHEET_CONFIGS[type];

  const folderPaths = useMemo(
    () => (isSheetMonster ? [] : getSpritePaths(type as 'skeleton', 'walk', direction)),
    [type, direction, isSheetMonster]
  );

  const rawTextureOrArray = useTexture(isSheetMonster ? sheetConfig.url : folderPaths);

  const activeTexture = useMemo(() => {
    if (isSheetMonster && rawTextureOrArray && !Array.isArray(rawTextureOrArray)) {
      const tex = rawTextureOrArray.clone();
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1 / sheetConfig.cols, 1 / sheetConfig.rows);
      tex.needsUpdate = true;
      return tex;
    }
    return null;
  }, [rawTextureOrArray, isSheetMonster, sheetConfig]);

  const folderTextures = useMemo(() => {
    if (isSheetMonster) return [];
    const arr = Array.isArray(rawTextureOrArray) ? rawTextureOrArray : [rawTextureOrArray];
    arr.forEach((t) => {
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
    });
    return arr;
  }, [rawTextureOrArray, isSheetMonster]);

  useEffect(() => {
    const trackerMap = enemyTracker.current;
    return () => {
      if (trackerMap) {
        trackerMap.delete(id);
      }
    };
  }, [id, enemyTracker]);

  useFrame((state, delta) => {
    if (!groupRef.current || hasTriggeredCombat.current || !active) return;

    const newDirection = updatePosition(currentPos, delta);
    if (newDirection !== direction) {
      setDirection(newDirection);
    }
    groupRef.current.position.copy(currentPos.current);

    // Footstep audio — only fires while actually moving (static/idle frames
    // between path nodes stay silent), pitched faster during a chase, and
    // panned in 3D so distant monsters sound distant.
    const distMoved = currentPos.current.distanceTo(prevStepPos.current);
    if (distMoved > 0.001) {
      stepAudioTimer.current += delta;
      const interval = isChasing ? CHASE_WALK_INTERVAL : WALK_INTERVAL;
      if (stepAudioTimer.current >= interval) {
        stepAudioTimer.current = 0;
        AudioManager.play(WALK_SOUND_MAP[type] ?? 'skeleton_walk', {
          volume: isChasing ? 0.6 : 0.4,
          category: 'sfx',
          position: [currentPos.current.x, currentPos.current.y, currentPos.current.z],
        });
      }
    } else {
      stepAudioTimer.current = 0;
    }
    prevStepPos.current.copy(currentPos.current);

    if (isSheetMonster && materialRef.current?.map) {
      const map = materialRef.current.map as THREE.Texture;
      const frameIndex = Math.floor(state.clock.elapsedTime * 8) % sheetConfig.cols;
      const primaryDir = direction.charAt(0) as 'S' | 'W' | 'E' | 'N';
      const rowIndex = DIRECTION_ROW_MAP[primaryDir] ?? 0;

      const offsetX = frameIndex / sheetConfig.cols;
      const offsetY = 1 - (rowIndex + 1) / sheetConfig.rows;

      map.offset.set(offsetX, offsetY);
    } else if (!isSheetMonster && folderTextures.length > 0 && materialRef.current) {
      const frameIndex = Math.floor(state.clock.elapsedTime * 10) % folderTextures.length;
      materialRef.current.map = folderTextures[frameIndex];
    }

    if (enemyTracker.current) {
      enemyTracker.current.set(id, {
        x: currentPos.current.x,
        z: currentPos.current.z,
      });
    }

    const dx = currentPos.current.x - playerPos.x;
    const dz = currentPos.current.z - playerPos.z;
    if (Math.sqrt(dx * dx + dz * dz) < 0.5) {
      hasTriggeredCombat.current = true;
      onCombatStart();
    }
  });

  return (
    <group ref={groupRef} position={[startX * TILE_SIZE, 0.15, startZ * TILE_SIZE]}>
      <Billboard lockX={false} lockY={false} lockZ={false}>
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[scale, scale]} />
          <meshStandardMaterial
            ref={materialRef}
            map={activeTexture || folderTextures[0]}
            transparent
            alphaTest={0.5}
          />
        </mesh>
      </Billboard>
    </group>
  );
};
