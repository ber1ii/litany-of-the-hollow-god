import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTexture, Html, PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { motion } from 'framer-motion';
import * as THREE from 'three';

import type { PlayerStats } from '../../types/GameTypes';
import { THEMES } from '../../data/LevelThemes';
import { CombatLogic } from '../../managers/CombatLogic';
import { ENEMIES } from '../../data/Enemies';
import { useCombatStore } from '../../hooks/useCombatStore';

// Components
import { CombatPlayer } from './CombatPlayer';
import { CombatEnemy } from './CombatEnemy';
import { CombatTorch } from './CombatTorch';
import { SeveredLimbManager } from './SeveredLimbManager';
import { CombatProjectile } from './CombatProjectile';

interface CombatSceneProps {
  initialStats: PlayerStats;
  enemyId: string;
  themeId: string;
}

interface DamagePopup {
  id: number;
  text: string;
  position: [number, number, number];
  color: string;
}

export const CombatScene: React.FC<CombatSceneProps> = ({ initialStats, enemyId, themeId }) => {
  // Store Subscriptions
  const {
    turnState,
    setTurnState,
    requestedAction,
    setRequestedAction,
    playerStats,
    setPlayerStats,
    enemyInstance,
    setEnemyInstance,
    severLimb,
    resetCombat,
  } = useCombatStore();

  // Local Visual State
  const [playerAction, setPlayerAction] = useState<
    'idle' | 'attack' | 'hurt' | 'pray' | 'die' | 'cast'
  >('idle');
  const [enemyAction, setEnemyAction] = useState<'idle' | 'attack' | 'hurt' | 'death'>('idle');
  const [popups, setPopups] = useState<DamagePopup[]>([]);
  const [playerAttackVariant, setPlayerAttackVariant] = useState<1 | 2>(1);

  // Ranged Projectile State
  const [activeProjectile, setActiveProjectile] = useState<{
    type: string;
    startPos: [number, number, number];
    targetPos: [number, number, number];
  } | null>(null);

  // Dynamic Camera Refs
  const shakeIntensity = useRef(0);
  const originalCamPos = useMemo(() => new THREE.Vector3(-0.5, 3, 6), []);
  const cameraTargetPos = useRef<THREE.Vector3>(originalCamPos.clone());
  const cameraLookAt = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.8, 0));
  const enemyTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Capture the ref's current array into a local variable
    const activeTimers = enemyTimers.current;

    return () => {
      activeTimers.forEach(clearTimeout);
      // Empty the array so it doesn't infinitely grow across a long session
      activeTimers.length = 0;
    };
  }, []);

  // Shared coordinate memoized to prevent unnecessary re-renders in dependency arrays
  const enemyPosition = useMemo<[number, number, number]>(() => [1.5, -0.8, -1.5], []);

  // Initialize Combat
  useEffect(() => {
    const baseId = enemyId.split('-')[0].toUpperCase();
    const def = ENEMIES[baseId] || ENEMIES['SKELETON'];

    setPlayerStats(initialStats);
    setEnemyInstance(CombatLogic.createEnemyInstance(def, enemyId));

    return () => resetCombat();
  }, [enemyId, initialStats, setEnemyInstance, setPlayerStats, resetCombat]);

  // Environment
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

  const spawnText = (text: string, pos: [number, number, number], color: string) => {
    setPopups((prev) => [...prev, { id: Date.now() + Math.random(), text, position: pos, color }]);
  };
  const removePopup = (id: number) => setPopups((prev) => prev.filter((p) => p.id !== id));

  // --- Core Combat Logic ---
  // Player Turn Execution
  useEffect(() => {
    if (!requestedAction || turnState !== 'player_turn' || !enemyInstance || !playerStats) return;

    const timer = setTimeout(() => {
      const [type, payload] = requestedAction.split(':');

      if (type === 'skill') {
        setPlayerAction(payload === 'pray' ? 'pray' : 'cast');
        setTurnState('player_acting');

        setTimeout(() => {
          const pStats = { ...playerStats };
          const eStats = { ...enemyInstance };
          const result = CombatLogic.executeSkill(payload, pStats, eStats);

          if (result.success) {
            spawnText(result.message, [-1.5, 1.5, 2], '#4ade80');
            if (result.healAmount) {
              spawnText(`+${result.healAmount}`, [-1.5, 2.0, 2], '#4ade80');
              pStats.hp = Math.min(pStats.maxHp, pStats.hp + result.healAmount);
            }
            if (result.cost) pStats.mp = Math.max(0, pStats.mp - result.cost);

            setPlayerStats(pStats);
            setEnemyInstance(eStats);
            setRequestedAction(null);
          }
        }, 500);
      } else {
        const [attackId, limbId] = requestedAction.split('|');
        setPlayerAction('attack');
        setPlayerAttackVariant((prev) => (prev === 1 ? 2 : 1));
        setTurnState('player_acting');

        setTimeout(() => {
          const result = CombatLogic.calculatePlayerAttack(
            playerStats,
            enemyInstance,
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
              severLimb(limbId);
            }
          } else {
            spawnText('MISS', [1.5, 1.5, -1.5], '#a3a3a3');
          }

          setEnemyInstance(result.enemyState);
          if (result.isFatal) setEnemyAction('death');
          setRequestedAction(null);
        }, 400);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [
    requestedAction,
    turnState,
    enemyInstance,
    playerStats,
    setTurnState,
    setPlayerStats,
    setEnemyInstance,
    setRequestedAction,
    severLimb,
  ]);

  // Enemy Turn Execution
  useEffect(() => {
    if (turnState === 'enemy_turn' && popups.length > 0) return;

    if (turnState === 'enemy_turn' && enemyInstance && enemyInstance.hp > 0 && playerStats) {
      // 1. LOCK THE STATE IMMEDIATELY.
      // This stops React from cleaning up and re-triggering this effect during the delay.
      setTurnState('enemy_acting');

      const mainTimer = setTimeout(() => {
        const enemyDef = ENEMIES[enemyInstance.instanceId.split('-')[0].toUpperCase()];
        let availableAttacks = enemyDef?.attacks || [];

        availableAttacks = availableAttacks.filter((atk) => {
          if (atk.requiredAllParts) {
            return atk.requiredAllParts.every((partId) => {
              const p = enemyInstance.parts.find((part) => part.id === partId);
              return p && !p.isSevered;
            });
          }
          if (atk.requiredAnyParts) {
            return atk.requiredAnyParts.some((partId) => {
              const p = enemyInstance.parts.find((part) => part.id === partId);
              return p && !p.isSevered;
            });
          }
          return true;
        });

        const attackDef =
          availableAttacks.length > 0
            ? availableAttacks[Math.floor(Math.random() * availableAttacks.length)]
            : { id: 'basic_struggle', name: 'Struggle', damageMod: 0.5 };

        setEnemyAction('attack');

        const isRangedAttack = attackDef?.projectileType || attackDef?.isRanged;
        const attackTypeLabel = isRangedAttack ? 'Ranged' : 'Melee';
        spawnText(
          `${attackDef.name || 'Struggle'} [${attackTypeLabel}]`,
          [enemyPosition[0], enemyPosition[1] + 2.5, enemyPosition[2]],
          '#fbbf24'
        );

        if (attackDef?.cameraZoom) {
          cameraTargetPos.current.set(-0.1, 2.2, 3.5);
        }

        const baseFrameTime = 80 / (attackDef?.speedMultiplier || 1.0);
        const activeProjType =
          attackDef?.projectileType || (attackDef?.isRanged ? 'blood_orb' : null);

        if (activeProjType) {
          const projTimer = setTimeout(
            () => {
              setActiveProjectile({
                type: activeProjType,
                startPos: [enemyPosition[0] - 0.5, enemyPosition[1] + 1.2, enemyPosition[2]],
                targetPos: [-1.5, 0.5, 2],
              });
            },
            (attackDef.projectileFrame || 3) * baseFrameTime
          );
          enemyTimers.current.push(projTimer);
        }

        const impactDelay = (attackDef?.pauseFrame || 4) * baseFrameTime;
        const impactTimer = setTimeout(() => {
          shakeIntensity.current = (attackDef?.screenShake || 0.2) * 1.05;

          const effectiveAttack = Math.max(1, enemyInstance.attack - enemyInstance.attackDebuff);
          const rawDmg = Math.round(effectiveAttack * (attackDef?.damageMod || 1.0));
          const finalDmg = Math.max(1, rawDmg - playerStats.defense);

          setPlayerStats((prev) => {
            const newHp = Math.max(0, prev.hp - finalDmg);
            if (newHp <= 0) setPlayerAction('die');
            return { ...prev, hp: newHp };
          });

          setPlayerAction('hurt');
          spawnText(`-${finalDmg}`, [-1.5, 1.5, 2], '#ef4444');
        }, impactDelay);
        enemyTimers.current.push(impactTimer);
      }, 350);

      enemyTimers.current.push(mainTimer);
    }
  }, [
    turnState,
    enemyInstance,
    playerStats,
    setTurnState,
    setPlayerStats,
    enemyPosition,
    popups.length,
  ]);

  // Animation Callbacks
  const onPlayerAnimEnd = useCallback(() => {
    if (playerAction === 'die') return setTurnState('defeat');
    setPlayerAction('idle');
    if (turnState === 'player_acting' && enemyInstance?.hp !== 0) setTurnState('enemy_turn');
  }, [playerAction, turnState, enemyInstance, setTurnState]);

  const onEnemyAnimEnd = useCallback(() => {
    if (enemyAction === 'death') return setTurnState('victory');
    setEnemyAction('idle');
    if (turnState === 'enemy_acting') setTurnState('player_turn');
  }, [enemyAction, turnState, setTurnState]);

  // --- Camera Reset Manager ---
  // Only reset the camera when returning to the player's turn AND all popups have vanished
  useEffect(() => {
    if (turnState === 'player_turn' && popups.length === 0) {
      cameraTargetPos.current.copy(originalCamPos);
    }
  }, [turnState, popups.length, originalCamPos]);

  // Dynamic Camera Logic
  useFrame((state) => {
    state.camera.position.lerp(cameraTargetPos.current, 0.15);

    if (shakeIntensity.current > 0) {
      state.camera.position.x += (Math.random() - 0.5) * shakeIntensity.current;
      state.camera.position.y += (Math.random() - 0.5) * shakeIntensity.current;
      shakeIntensity.current = THREE.MathUtils.lerp(shakeIntensity.current, 0, 0.15);

      if (shakeIntensity.current < 0.01) {
        shakeIntensity.current = 0;
      }
    }

    const targetLook = cameraTargetPos.current.equals(originalCamPos)
      ? new THREE.Vector3(0, 0.8, 0)
      : new THREE.Vector3(1.2, 1.0, -1.0);

    cameraLookAt.current.lerp(targetLook, 0.15);
    state.camera.lookAt(cameraLookAt.current);
  });

  return (
    <group>
      <PerspectiveCamera makeDefault position={originalCamPos} fov={50} near={0.01} far={100} />
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

        {playerStats && (
          <CombatPlayer
            classId={playerStats.classId}
            action={playerAction}
            attackVariant={playerAttackVariant}
            onAnimEnd={onPlayerAnimEnd}
            position={[-1.5, -0.8, 2]}
          />
        )}

        {enemyInstance && (
          <>
            <CombatEnemy
              enemyId={enemyId}
              action={enemyAction}
              onAnimEnd={onEnemyAnimEnd}
              position={enemyPosition}
            />
            <SeveredLimbManager enemyPosition={enemyPosition} />
          </>
        )}

        {activeProjectile && (
          <CombatProjectile
            type={activeProjectile.type}
            startPos={activeProjectile.startPos}
            targetPos={activeProjectile.targetPos}
            onHit={() => setActiveProjectile(null)}
          />
        )}

        {popups.map((p) => (
          <Html key={p.id} position={p.position} center zIndexRange={[100, 0]}>
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.5 }}
              animate={{ opacity: [0, 1, 1, 0], y: [10, -50, -80], scale: [0.5, 1.5, 1] }}
              transition={{ duration: 1.2, ease: 'easeOut' }} // <-- CHANGED from 2.5
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
