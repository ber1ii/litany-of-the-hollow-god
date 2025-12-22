import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTexture, Html, PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { motion } from 'framer-motion';
import * as THREE from 'three';

import type { PlayerStats, CombatEnemyInstance } from '../../types/GameTypes';
import { THEMES } from '../../data/LevelThemes';
import { CombatLogic } from '../../managers/CombatLogic';
import { ENEMIES } from '../../data/Enemies';

// Components
import { CombatPlayer } from './CombatPlayer';
import { CombatEnemy } from './CombatEnemy';
import { CombatTorch } from './CombatTorch';

interface CombatSceneProps {
  initialStats: PlayerStats;
  enemyId: string;
  themeId: string;
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
  onEnemyUpdate: (enemy: CombatEnemyInstance) => void;
  requestedAction: string | null;
  setRequestedAction: (action: string | null) => void;
  updatePlayerStats: (stats: PlayerStats) => void;
}

interface DamagePopup {
  id: number;
  text: string;
  position: [number, number, number];
  color: string;
}

export const CombatScene: React.FC<CombatSceneProps> = ({
  initialStats,
  enemyId,
  themeId,
  combatPhase,
  setCombatPhase,
  onEnemyUpdate,
  requestedAction,
  setRequestedAction,
  updatePlayerStats,
}) => {
  // State
  const [playerAction, setPlayerAction] = useState<
    'idle' | 'attack' | 'hurt' | 'pray' | 'die' | 'cast'
  >('idle');
  const [enemyAction, setEnemyAction] = useState<'idle' | 'attack' | 'hurt' | 'death'>('idle');
  const [popups, setPopups] = useState<DamagePopup[]>([]);
  const [playerAttackVariant, setPlayerAttackVariant] = useState<1 | 2>(1);

  // Logic Refs
  const enemyRef = useRef<CombatEnemyInstance | null>(null);
  const playerRef = useRef<PlayerStats>(initialStats);
  const shakeIntensity = useRef(0);
  const originalCamPos = useMemo(() => new THREE.Vector3(-0.5, 3, 6), []);

  // Initialize Enemy
  useEffect(() => {
    const baseId = enemyId.split('-')[0].toUpperCase();
    const def = ENEMIES[baseId] || ENEMIES['SKELETON'];
    enemyRef.current = CombatLogic.createEnemyInstance(def, enemyId);
    onEnemyUpdate(enemyRef.current);
  }, [enemyId]);

  // Theme Textures
  const theme = THEMES[themeId] || THEMES['DUNGEON'];
  const envTextures = useTexture({ wall: theme.combatWall, floor: theme.combatFloor });

  useMemo(() => {
    [envTextures.wall, envTextures.floor].forEach((t) => {
      if (!t) return;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(8, 4);
      t.magFilter = t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
    });
  }, [envTextures]);

  // -- Helpers --
  const spawnText = (text: string, pos: [number, number, number], color: string) => {
    const id = Date.now() + Math.random();
    setPopups((prev) => [...prev, { id, text, position: pos, color }]);
  };
  const removePopup = (id: number) => setPopups((prev) => prev.filter((p) => p.id !== id));

  // -- Turn Logic --
  useEffect(() => {
    if (!requestedAction || combatPhase !== 'player_turn' || !enemyRef.current) return;

    // FIX: Wrap in setTimeout(0) to prevent synchronous setState warning in useEffect
    const timer = setTimeout(() => {
      const [type, payload] = requestedAction.split(':'); // skill:pray or attack_id|limb_id

      // 1. SKILLS
      if (type === 'skill') {
        const skillId = payload;
        setPlayerAction(skillId === 'pray' ? 'pray' : 'cast');
        setCombatPhase('player_acting');

        setTimeout(() => {
          // Fix: passed enemyRef.current! (CombatLogic updated to accept 3 args)
          const result = CombatLogic.executeSkill(skillId, playerRef.current, enemyRef.current!);

          if (result.success) {
            spawnText(result.message, [-1.5, 1.5, 2], '#4ade80');
            if (result.healAmount) {
              spawnText(`+${result.healAmount}`, [-1.5, 2.0, 2], '#4ade80');
              playerRef.current.hp = Math.min(
                playerRef.current.maxHp,
                playerRef.current.hp + result.healAmount
              );
            }
            if (result.cost) {
              playerRef.current.mp = Math.max(0, playerRef.current.mp - result.cost);
            }
            if (result.buffApplied) {
              if (result.buffApplied.type === 'vulnerable') {
                enemyRef.current!.statusEffects.push(result.buffApplied);
              } else {
                playerRef.current.statusEffects.push(result.buffApplied);
              }
            }
            updatePlayerStats({ ...playerRef.current });
            setRequestedAction(null);
          }
        }, 500);
      }
      // 2. ATTACKS
      else {
        const parts = requestedAction.split('|');
        const attackId = parts[0];
        const limbId = parts[1];

        setPlayerAction('attack');
        setPlayerAttackVariant((prev) => (prev === 1 ? 2 : 1));
        setCombatPhase('player_acting');

        setTimeout(() => {
          const result = CombatLogic.calculatePlayerAttack(
            playerRef.current,
            enemyRef.current!,
            limbId,
            attackId
          );

          if (result.hit) {
            shakeIntensity.current = result.isCrit ? 0.3 : 0.1;
            setEnemyAction('hurt');
            spawnText(
              `${result.damageDealt}`,
              [1.5, 1.5, -1.5],
              result.isCrit ? '#ff0000' : '#ffffff'
            );
            if (result.partSevered) {
              spawnText('SEVERED!', [1.5, 2.0, -1.5], '#ef4444');
            }
          } else {
            spawnText('MISS', [1.5, 1.5, -1.5], '#a3a3a3');
          }

          enemyRef.current = result.enemyState;
          onEnemyUpdate(result.enemyState);

          if (result.isFatal) {
            setEnemyAction('death');
          }
          setRequestedAction(null);
        }, 400);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [requestedAction, combatPhase]);

  // -- Animation Callbacks --
  const onPlayerAnimEnd = useCallback(() => {
    if (playerAction === 'die') {
      setCombatPhase('defeat');
      return;
    }
    setPlayerAction('idle');
    if (combatPhase === 'player_acting') {
      if (enemyRef.current?.hp === 0) {
        // Wait for enemy death anim
      } else {
        setCombatPhase('enemy_turn');
      }
    }
  }, [playerAction, combatPhase, setCombatPhase]);

  const onEnemyAnimEnd = useCallback(() => {
    if (enemyAction === 'death') {
      setCombatPhase('victory');
      return;
    }
    setEnemyAction('idle');
    if (combatPhase === 'enemy_acting') {
      setCombatPhase('player_turn');
    }
  }, [enemyAction, combatPhase, setCombatPhase]);

  // -- Enemy Turn AI --
  useEffect(() => {
    if (combatPhase === 'enemy_turn' && enemyRef.current && enemyRef.current.hp > 0) {
      const timer = setTimeout(() => {
        setEnemyAction('attack');
        setCombatPhase('enemy_acting');

        setTimeout(() => {
          const dmg = Math.max(0, 10 - playerRef.current.defense);
          playerRef.current.hp = Math.max(0, playerRef.current.hp - dmg);
          updatePlayerStats({ ...playerRef.current });
          setPlayerAction('hurt');
          shakeIntensity.current = 0.2;
          spawnText(`-${dmg}`, [-1.5, 1.5, 2], '#ef4444');

          if (playerRef.current.hp <= 0) {
            setPlayerAction('die');
          }
        }, 300);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [combatPhase]);

  // Camera Shake
  useFrame((state) => {
    if (shakeIntensity.current > 0) {
      const shakeX = (Math.random() - 0.5) * shakeIntensity.current;
      const shakeY = (Math.random() - 0.5) * shakeIntensity.current;
      state.camera.position.set(
        originalCamPos.x + shakeX,
        originalCamPos.y + shakeY,
        originalCamPos.z
      );
      shakeIntensity.current = THREE.MathUtils.lerp(shakeIntensity.current, 0, 0.1);
      if (shakeIntensity.current < 0.01) {
        shakeIntensity.current = 0;
        state.camera.position.copy(originalCamPos);
      }
    }
  });

  return (
    <group>
      <PerspectiveCamera
        makeDefault
        position={originalCamPos}
        fov={50}
        near={0.01}
        far={100}
        onUpdate={(c) => c.lookAt(0, 0.8, 0)}
      />
      <ambientLight intensity={0.6} color="#ffffff" />
      <directionalLight position={[2, 5, 2]} intensity={1.0} color="#ffffff" />

      <group rotation={[0, -0.05, 0]}>
        <mesh position={[0, 2, -6]}>
          <planeGeometry args={[80, 25]} />
          <meshStandardMaterial map={envTextures.wall} color="#ffffff" roughness={0.9} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]}>
          <planeGeometry args={[80, 40]} />
          <meshStandardMaterial map={envTextures.floor} color="#a0a0a0" roughness={0.8} />
        </mesh>

        <CombatTorch position={[-5, 2, -5.9]} />
        <CombatTorch position={[5, 2, -5.9]} />

        <CombatPlayer
          classId={initialStats.classId}
          action={playerAction}
          attackVariant={playerAttackVariant}
          onAnimEnd={onPlayerAnimEnd}
          position={[-1.5, -0.8, 2]}
        />

        <CombatEnemy
          enemyId={enemyId}
          action={enemyAction}
          onAnimEnd={onEnemyAnimEnd}
          position={[1.5, -0.8, -1.5]}
        />

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
