import React, { useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import { CombatUnit } from './CombatUnit';
import type { EnemyDef } from '../../types/GameTypes';
import { ENEMIES } from '../../data/Enemies';
import * as THREE from 'three';

interface CombatEnemyProps {
  enemyId: string;
  action: 'idle' | 'attack' | 'hurt' | 'death';
  onAnimEnd: () => void;
  position: [number, number, number];
}

export const CombatEnemy: React.FC<CombatEnemyProps> = ({
  enemyId,
  action,
  onAnimEnd,
  position,
}) => {
  // 1. Resolve Definition
  const baseId = enemyId.split('-')[0].toUpperCase();
  const def: EnemyDef = ENEMIES[baseId] || ENEMIES['SKELETON'];

  // 2. Load Textures
  const textureMap = useMemo(
    () => ({
      idle: def.sprites.idle.textureUrl,
      attack: def.sprites.attack.textureUrl,
      hurt: def.sprites.hurt.textureUrl,
      death: def.sprites.death.textureUrl,
    }),
    [def]
  );

  const textures = useTexture(textureMap);

  // 3. Configure Texture Settings
  useMemo(() => {
    Object.values(textures).forEach((t) => {
      if (!t) return;
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
    });
  }, [textures]);

  // 4. Determine Current Config
  const currentConfig = useMemo(() => {
    switch (action) {
      case 'attack':
        return { tex: textures.attack, cfg: def.sprites.attack };
      case 'hurt':
        return { tex: textures.hurt, cfg: def.sprites.hurt };
      case 'death':
        return { tex: textures.death, cfg: def.sprites.death };
      default:
        return { tex: textures.idle, cfg: def.sprites.idle };
    }
  }, [action, def, textures]);

  return (
    <CombatUnit
      texture={currentConfig.tex}
      frames={currentConfig.cfg.frames}
      columns={currentConfig.cfg.columns}
      rows={currentConfig.cfg.rows}
      frameDuration={currentConfig.cfg.frameDuration || 0.225}
      startFrame={0}
      loop={action === 'idle'}
      onAnimEnd={onAnimEnd}
      position={position}
      height={def.scale}
      flip={true}
    />
  );
};

// --- PRELOADER ---
export const preloadEnemyAssets = () => {
  const textures = new Set<string>();
  Object.values(ENEMIES).forEach((def) => {
    textures.add(def.sprites.idle.textureUrl);
    textures.add(def.sprites.attack.textureUrl);
    textures.add(def.sprites.hurt.textureUrl);
    textures.add(def.sprites.death.textureUrl);
  });
  useTexture.preload(Array.from(textures));
  console.log('Enemy Combat Assets Preloaded.');
};
