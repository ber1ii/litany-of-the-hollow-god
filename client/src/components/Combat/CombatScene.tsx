import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTexture, Billboard, Html } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';
import { motion } from 'framer-motion';
import { CombatUnit } from './CombatUnit';
import type { PlayerStats } from '../../types/GameTypes';
import { ENEMIES } from '../../data/Enemies';
import * as THREE from 'three';
import { THEMES } from '../../data/LevelThemes';
import { SKILL_DATABASE, type SkillDef } from '../../data/Skills';

// --- Types ---
interface CombatSceneProps {
  initialStats: PlayerStats; // This is actually "Current Stats" passed from App
  enemyId: string;
  themeId: string;

  // Props from App.tsx
  combatPhase:
    | 'player_turn'
    | 'player_acting'
    | 'enemy_turn'
    | 'enemy_acting'
    | 'victory'
    | 'defeat';
  setCombatPhase: (
    phase: 'player_turn' | 'player_acting' | 'enemy_turn' | 'enemy_acting' | 'victory' | 'defeat'
  ) => void;
  enemyHp: number;
  setEnemyHp: (hp: number | ((prev: number) => number)) => void;
  requestedAction: string | null;
  setRequestedAction: (action: string | null) => void;
  updatePlayerHp: (hp: number) => void;
}

interface DamagePopup {
  id: number;
  text: string;
  position: [number, number, number];
  color: string;
}

// --- Constants ---
const TORCH_FRAMES = [
  '/sprites/props/torch/torch_1.png',
  '/sprites/props/torch/torch_2.png',
  '/sprites/props/torch/torch_3.png',
  '/sprites/props/torch/torch_4.png',
];

const HERO_URLS = {
  idle: '/sprites/combat/knight/Idle.png',
  attack1: '/sprites/combat/knight/attack1.png',
  attack2: '/sprites/combat/knight/attack2.png',
  hurt: '/sprites/combat/knight/Hurt.png',
  death: '/sprites/combat/knight/Death.png',
  pray: '/sprites/combat/knight/Pray.png',
};

const AnimatedTorch = ({ position }: { position: [number, number, number] }) => {
  const rawTextures = useTexture(TORCH_FRAMES);

  const textures = useMemo(() => {
    const cloned = rawTextures.map((t) => t.clone());

    cloned.forEach((t) => {
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
    });

    return cloned;
  }, [rawTextures]);

  const light = useRef<THREE.PointLight>(null);
  const [frameIndex, setFrameIndex] = useState(0);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    setFrameIndex(Math.floor(t / 0.15) % 4);
    if (light.current) {
      const flicker = Math.sin(t * 10) * 0.3 + Math.cos(t * 23) * 0.1 + (Math.random() - 0.5) * 0.2;
      light.current.intensity = 4 + flicker;
    }
  });

  return (
    <group position={position}>
      <Billboard>
        <mesh>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={textures[frameIndex]}
            transparent
            alphaTest={0.5}
            fog={false}
            toneMapped={false}
          />
        </mesh>
      </Billboard>
      <pointLight ref={light} position={[0, 0, 0.2]} color="#ffaa00" distance={12} decay={2} />
    </group>
  );
};
// --- Main Component ---
export const CombatScene: React.FC<CombatSceneProps> = ({
  initialStats,
  enemyId,
  themeId,
  combatPhase,
  setCombatPhase,
  enemyHp,
  setEnemyHp,
  requestedAction,
  setRequestedAction,
  updatePlayerHp,
}) => {
  const { camera } = useThree();

  // Visual Only State
  const [playerAction, setPlayerAction] = useState<'idle' | 'attack' | 'hurt' | 'pray' | 'die'>(
    'idle'
  );
  const [enemyAction, setEnemyAction] = useState<'idle' | 'attack' | 'hurt' | 'death'>('idle');
  const [popups, setPopups] = useState<DamagePopup[]>([]);
  const [playerAttackVariant, setPlayerAttackVariant] = useState<1 | 2>(1);
  const [activeSkill, setActiveSkill] = useState<SkillDef>(); // Kept as any or import SkillDef if strict

  const shakeIntensity = useRef(0);
  const originalCamPos = useRef(new THREE.Vector3(-0.5, 3, 6));

  // Data Loading
  const enemyData = ENEMIES[enemyId] || ENEMIES['SKELETON'];
  const theme = THEMES[themeId] || THEMES['DUNGEON'];
  const heroTextures = useTexture(HERO_URLS);

  const enemyTextureMap = useMemo(
    () => ({
      idle: enemyData.sprites.idle.textureUrl,
      attack: enemyData.sprites.attack.textureUrl,
      hurt: enemyData.sprites.hurt.textureUrl,
      death: enemyData.sprites.death.textureUrl,
    }),
    [enemyData]
  );
  const enemyTextures = useTexture(enemyTextureMap);

  const envTextures = useTexture({
    wall: theme.combatWall,
    floor: theme.combatFloor,
  });

  useEffect(() => {
    // 1. Reset Position
    camera.position.copy(originalCamPos.current);
    camera.lookAt(0, 0.8, 0);

    // 2. NEW FIX: Reset FOV back to normal (50)
    if (camera instanceof THREE.PerspectiveCamera) {
      // eslint-disable-next-line
      camera.fov = 50;
      camera.updateProjectionMatrix();
    }
  }, [camera]);

  useMemo(() => {
    [envTextures.wall, envTextures.floor].forEach((t) => {
      if (!t) return;
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(8, 4);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
    });
  }, [envTextures]);

  // --- 1. HANDLE ACTION REQUEST ---
  useEffect(() => {
    if (requestedAction && combatPhase === 'player_turn') {
      const skill = SKILL_DATABASE[requestedAction];
      if (skill) {
        // Wrap in timeout to push to next tick, satisfying strict mode/linter
        setTimeout(() => {
          setActiveSkill(skill);
          setCombatPhase('player_acting');
          setPlayerAction(skill.animation === 'pray' ? 'pray' : 'attack');
          if (skill.animation === 'attack2') setPlayerAttackVariant(2);
          else setPlayerAttackVariant(1);

          setRequestedAction(null);
        }, 0);
      }
    }
  }, [requestedAction, combatPhase, setCombatPhase, setRequestedAction]);

  // --- Camera Shake ---
  useFrame(() => {
    if (shakeIntensity.current > 0) {
      const shakeX = (Math.random() - 0.5) * shakeIntensity.current;
      const shakeY = (Math.random() - 0.5) * shakeIntensity.current;
      camera.position.set(
        originalCamPos.current.x + shakeX,
        originalCamPos.current.y + shakeY,
        originalCamPos.current.z
      );
      shakeIntensity.current = THREE.MathUtils.lerp(shakeIntensity.current, 0, 0.1);
      if (shakeIntensity.current < 0.01) {
        shakeIntensity.current = 0;
        camera.position.copy(originalCamPos.current);
      }
    }
  });

  useEffect(() => {
    camera.position.copy(originalCamPos.current);
    camera.lookAt(0, 0.8, 0);
  }, [camera]);

  const spawnText = (text: string, pos: [number, number, number], color: string) => {
    const id = Date.now() + Math.random();
    setPopups((prev) => [...prev, { id, text, position: pos, color }]);
  };

  const removePopup = (id: number) => {
    setPopups((prev) => prev.filter((p) => p.id !== id));
  };

  // --- 2. ANIMATION EVENT HANDLERS ---
  const onPlayerAnimEnd = useCallback(() => {
    if (playerAction === 'attack' && activeSkill) {
      setPlayerAction('idle');
      // Calculate Damage
      const baseDmg = activeSkill.damage || 10;
      const finalDmg = Math.floor(baseDmg + (Math.random() * 4 - 2));

      setEnemyHp((prev: number) => Math.max(0, prev - finalDmg));
      setEnemyAction('hurt');

      shakeIntensity.current = 0.2;
      spawnText(finalDmg.toString(), [1.5, 2, -1.5], '#ffffff');
    }

    if (playerAction === 'pray' && activeSkill) {
      setPlayerAction('idle');
      const heal = activeSkill.heal || 20;
      updatePlayerHp(Math.min(initialStats.maxHp, initialStats.hp + heal));
      spawnText(`+${heal}`, [-1.5, 2, 2], '#00ff00');
      setCombatPhase('enemy_turn');
    }

    if (playerAction !== 'idle' && playerAction !== 'hurt') {
      setTimeout(() => setCombatPhase('enemy_turn'), 500);
    }
  }, [playerAction, activeSkill, initialStats, setEnemyHp, setCombatPhase, updatePlayerHp]);

  const onEnemyAnimEnd = useCallback(() => {
    if (enemyAction === 'hurt') {
      setEnemyAction('idle');
      if (enemyHp <= 0) setCombatPhase('victory');
      else setCombatPhase('enemy_turn');
    }
    if (enemyAction === 'attack') {
      setEnemyAction('idle');
      const dmg = enemyData.stats.attack;
      updatePlayerHp(Math.max(0, initialStats.hp - dmg));
      setPlayerAction('hurt');
      spawnText(dmg.toString(), [-1.5, 2, 2], '#ff0000');
    }
  }, [enemyAction, enemyHp, initialStats, enemyData, setCombatPhase, updatePlayerHp]);

  // --- 3. RECOVERY & AI LOGIC ---
  useEffect(() => {
    if (playerAction === 'hurt') {
      const t = setTimeout(() => {
        setPlayerAction('idle');
        if (initialStats.hp <= 0) setCombatPhase('defeat');
        else setCombatPhase('player_turn');
      }, 500);
      return () => clearTimeout(t);
    }
  }, [playerAction, initialStats.hp, setCombatPhase]);

  useEffect(() => {
    if (combatPhase === 'enemy_turn') {
      const timer = setTimeout(() => {
        setCombatPhase('enemy_acting');
        setEnemyAction('attack');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [combatPhase, setCombatPhase]);

  // --- Helpers ---
  const getPlayerTexture = () => {
    switch (playerAction) {
      case 'attack':
        return playerAttackVariant === 2 ? heroTextures.attack2 : heroTextures.attack1;
      case 'hurt':
        return heroTextures.hurt;
      case 'die':
        return heroTextures.death;
      case 'pray':
        return heroTextures.pray;
      default:
        return heroTextures.idle;
    }
  };

  const getEnemyConfig = () => {
    switch (enemyAction) {
      case 'attack':
        return { tex: enemyTextures.attack, cfg: enemyData.sprites.attack };
      case 'hurt':
        return { tex: enemyTextures.hurt, cfg: enemyData.sprites.hurt };
      case 'death':
        return { tex: enemyTextures.death, cfg: enemyData.sprites.death };
      default:
        return { tex: enemyTextures.idle, cfg: enemyData.sprites.idle };
    }
  };

  const currentEnemy = getEnemyConfig();
  const FLOOR_LEVEL = -0.8;

  return (
    <group>
      <ambientLight intensity={0.6} color="#ffffff" />
      <directionalLight position={[2, 5, 2]} intensity={1.0} color="#ffffff" />

      <group rotation={[0, -0.05, 0]}>
        {/* Environment */}
        <mesh position={[0, 2, -6]}>
          <planeGeometry args={[80, 25]} />
          <meshStandardMaterial map={envTextures.wall} color="#ffffff" roughness={0.9} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_LEVEL, 0]}>
          <planeGeometry args={[80, 40]} />
          <meshStandardMaterial map={envTextures.floor} color="#a0a0a0" roughness={0.8} />
        </mesh>
        <AnimatedTorch position={[-5, 2, -5.9]} />
        <AnimatedTorch position={[5, 2, -5.9]} />

        {/* Characters */}
        <CombatUnit
          texture={getPlayerTexture()}
          frameDuration={playerAction === 'attack' ? 0.075 : 0.225}
          columns={
            playerAction === 'attack'
              ? 10
              : playerAction === 'hurt'
                ? 2
                : playerAction === 'pray'
                  ? 4
                  : 2
          }
          rows={
            playerAction === 'attack'
              ? 1
              : playerAction === 'hurt'
                ? 2
                : playerAction === 'pray'
                  ? 3
                  : 4
          }
          frames={
            playerAction === 'attack'
              ? 10
              : playerAction === 'hurt'
                ? 3
                : playerAction === 'pray'
                  ? 12
                  : 8
          }
          startFrame={0}
          loop={playerAction === 'idle'}
          onAnimEnd={onPlayerAnimEnd}
          position={[-1.5, FLOOR_LEVEL, 2]}
          height={2.1}
        />
        <CombatUnit
          texture={currentEnemy.tex}
          frames={currentEnemy.cfg.frames}
          columns={currentEnemy.cfg.columns}
          rows={currentEnemy.cfg.rows}
          frameDuration={currentEnemy.cfg.frameDuration || 0.225}
          startFrame={0}
          loop={enemyAction === 'idle'}
          onAnimEnd={onEnemyAnimEnd}
          position={[1.5, FLOOR_LEVEL, -1.5]}
          height={enemyData.scale}
          flip={true}
        />

        {/* 3D Popups (Damage Numbers) - Kept because they need 3D Position */}
        {popups.map((p) => (
          <Html key={p.id} position={p.position} center zIndexRange={[100, 0]}>
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.5 }}
              animate={{ opacity: [0, 1, 1, 0], y: [10, -50, -80], scale: [0.5, 1.5, 1] }}
              transition={{ duration: 1, ease: 'easeOut' }}
              onAnimationComplete={() => removePopup(p.id)}
              className="text-4xl font-pixel pointer-events-none"
              style={{ color: p.color, textShadow: '4px 4px 0 #000' }}
            >
              {p.text}
            </motion.div>
          </Html>
        ))}
      </group>
    </group>
  );
};
