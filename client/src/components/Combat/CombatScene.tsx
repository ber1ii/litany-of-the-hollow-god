import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTexture, Html, PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { motion } from 'framer-motion';
import * as THREE from 'three';

import type { PlayerStats } from '../../types/GameTypes';
import { THEMES } from '../../data/LevelThemes';
import { CombatLogic, getSkillAnimation, tickStatusEffects } from '../../managers/CombatLogic';
import type { PlayerCombatAction } from '../../managers/CombatLogic';
import { SKILL_DATABASE } from '../../data/Skills';
import { ITEM_REGISTRY } from '../../data/ItemRegistry';
import { ENEMIES } from '../../data/Enemies';
import { useCombatStore } from '../../hooks/useCombatStore';

// Components
import { CombatPlayer } from './CombatPlayer';
import { CombatEnemy } from './CombatEnemy';
import { CombatTorch } from './CombatTorch';
import { SeveredLimbManager } from './SeveredLimbManager';
import { CombatProjectile } from './CombatProjectile';
import { CombatLogPanel } from './CombatLogPanel';
import type { CombatActionLog } from './CombatLogPanel';
import { usePlayerStore } from '../../hooks/usePlayerStore';

interface CombatSceneProps {
  initialStats: PlayerStats;
  enemyId: string;
  themeId: string;
  onDefeat?: () => void;
  onFlee?: () => void;
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
  onDefeat,
  onFlee,
}) => {
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
    setSkillCooldown,
    tickCooldowns,
    initQueuedTurns,
    consumeQueuedTurn,
  } = useCombatStore();

  // Local Visual State
  const [playerAction, setPlayerAction] = useState<PlayerCombatAction>('idle');
  const [enemyAction, setEnemyAction] = useState<'idle' | 'attack' | 'hurt' | 'death'>('idle');
  const [popups, setPopups] = useState<DamagePopup[]>([]);
  const [playerAttackVariant, setPlayerAttackVariant] = useState<1 | 2>(1);
  const [playerEmphasis, setPlayerEmphasis] = useState<'none' | 'heavy' | 'plunge'>('none');

  // Rolling Combat Log State
  const [combatLogs, setCombatLogs] = useState<CombatActionLog[]>([]);

  const pushActionLog = useCallback((actor: 'player' | 'enemy', message: string) => {
    setCombatLogs((prev) =>
      [
        ...prev,
        {
          id: `${actor}_${Date.now()}_${Math.random()}`,
          actor,
          message,
        },
      ].slice(-2)
    );
  }, []);

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
  const cameraLookAtTarget = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.8, 0));
  const enemyTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const activeTimers = enemyTimers.current;

    return () => {
      activeTimers.forEach(clearTimeout);
      activeTimers.length = 0;
    };
  }, []);

  const enemyPosition = useMemo<[number, number, number]>(() => [1.5, -0.8, -1.5], []);

  const initialStatsRef = useRef(initialStats);
  useEffect(() => {
    initialStatsRef.current = initialStats;
  }, [initialStats]);

  useEffect(() => {
    const baseId = enemyId.split('-')[0].toUpperCase();
    const def = ENEMIES[baseId] || ENEMIES['SKELETON'];

    const newEnemyInstance = CombatLogic.createEnemyInstance(def, enemyId);
    setPlayerStats(initialStatsRef.current);
    setEnemyInstance(newEnemyInstance);
    initQueuedTurns(initialStatsRef.current.agility, newEnemyInstance.speed);

    return () => resetCombat();
  }, [enemyId, setEnemyInstance, setPlayerStats, resetCombat, initQueuedTurns]);

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

      if (type === 'flee') {
        setTurnState('player_acting');

        // 5% chance to succeed (extremely rare bait)
        const FLEE_CHANCE = 0.05;
        const success = Math.random() < FLEE_CHANCE;

        if (success) {
          spawnText('ESCAPED!', [-1.5, 1.5, 2], '#3b82f6');
          pushActionLog('player', 'Managed to escape combat!');
          setRequestedAction(null);

          setTimeout(() => {
            onFlee?.();
          }, 800);
        } else {
          spawnText('FLEE FAILED!', [-1.5, 1.5, 2], '#ef4444');
          pushActionLog('player', 'Failed to flee! The enemy strikes!');
          setRequestedAction(null);

          // Punish the player by passing turn directly to enemy
          setTimeout(() => {
            if (!consumeQueuedTurn()) {
              setTurnState('enemy_turn');
            } else {
              setTurnState('player_turn');
            }
          }, 800);
        }
        return;
      }

      if (type === 'item') {
        setTurnState('player_acting');
        const itemDef = ITEM_REGISTRY[payload];
        const consumed = usePlayerStore.getState().consumeItem(payload);

        if (consumed) {
          const itemName = itemDef?.name || 'Item';
          spawnText('USED ITEM', [-1.5, 1.5, 2], '#3b82f6');
          pushActionLog('player', `Used ${itemName}`);
          setPlayerAction(itemDef?.effect?.type === 'heal' ? 'heal' : 'cast');
          setPlayerStats((prev) => ({
            ...usePlayerStore.getState().stats,
            statusEffects: prev.statusEffects,
          }));
        } else {
          spawnText('CANNOT USE', [-1.5, 1.5, 2], '#ef4444');
          pushActionLog('player', 'Failed to use item');
        }
        setRequestedAction(null);
        setTimeout(() => {
          setPlayerAction('idle');
          setPlayerStats((prev) => ({
            ...prev,
            statusEffects: tickStatusEffects(prev.statusEffects),
          }));
          if (!consumeQueuedTurn()) {
            setTurnState('enemy_turn');
          } else {
            setTurnState('player_turn');
          }
        }, 900);
        return;
      }

      if (type === 'skill') {
        const [skillId, limbId] = payload.split('|');
        const skillDef = SKILL_DATABASE[skillId];
        if (!skillDef) {
          setRequestedAction(null);
          return;
        }

        const anim = getSkillAnimation(skillDef);
        setPlayerAction(anim.action);
        if (anim.variant) setPlayerAttackVariant(anim.variant);
        setTurnState('player_acting');

        if (skillId === 'heavy_attack' || skillId === 'plunging_strike') {
          setPlayerEmphasis(skillId === 'heavy_attack' ? 'heavy' : 'plunge');
          cameraTargetPos.current.set(-2.0, 1.0, 5.0);
          cameraLookAtTarget.current.set(-1.5, 0.25, 2.0);
        } else {
          setPlayerEmphasis('none');
        }

        setTimeout(() => {
          const pStats = { ...playerStats };
          const eStats = { ...enemyInstance };
          const equippedWeaponId = usePlayerStore.getState().equippedWeaponId;
          const result = CombatLogic.executeSkill(
            skillId,
            pStats,
            eStats,
            pStats.level,
            equippedWeaponId,
            limbId
          );

          if (!result.success) {
            spawnText(result.message, [-1.5, 1.5, 2], '#ef4444');
            pushActionLog('player', result.message);
            setPlayerAction('idle');
            setPlayerEmphasis('none');
            setTurnState('player_turn');
            setRequestedAction(null);
            return;
          }

          if (skillDef.cooldown) {
            setSkillCooldown(skillId, skillDef.cooldown);
          }

          pushActionLog('player', result.message);

          if (result.attackResult) {
            const atk = result.attackResult;
            shakeIntensity.current = atk.isCrit ? 0.3 : 0.1;

            if (atk.hit) {
              setEnemyAction('hurt');
              spawnText(`${atk.damageDealt}`, [1.5, 1.5, -1.5], atk.isCrit ? '#ff0000' : '#ffffff');
              if (atk.partSevered) {
                spawnText('SEVERED!', [1.5, 2.0, -1.5], '#ef4444');
                severLimb(limbId);
              }
            } else {
              spawnText('MISS', [1.5, 1.5, -1.5], '#a3a3a3');
            }

            setEnemyInstance(atk.enemyState);
            if (atk.isFatal) setEnemyAction('death');

            const nextPlayer = { ...pStats };
            if (result.cost) {
              usePlayerStore.getState().modifyMp(-result.cost);
              nextPlayer.mp = usePlayerStore.getState().stats.mp;
            }
            if (atk.lifestealHeal) {
              usePlayerStore.getState().modifyHp(atk.lifestealHeal);
              nextPlayer.hp = usePlayerStore.getState().stats.hp;
              spawnText(`+${atk.lifestealHeal}`, [-1.5, 2.0, 2], '#dc2626');
            }
            setPlayerStats(nextPlayer);
          } else {
            spawnText(result.message, [-1.5, 1.5, 2], '#4ade80');

            let hpDelta = 0;
            if (result.healAmount) {
              spawnText(`+${result.healAmount}`, [-1.5, 2.0, 2], '#4ade80');
              hpDelta += result.healAmount;
            }
            if (result.hpCost) hpDelta -= result.hpCost;

            if (result.cost) {
              usePlayerStore.getState().modifyMp(-result.cost);
              pStats.mp = usePlayerStore.getState().stats.mp;
            }
            if (result.buffApplied) {
              pStats.statusEffects = [...(pStats.statusEffects || []), result.buffApplied];
            }
            if (result.enemyDebuffApplied) {
              setEnemyInstance({
                ...eStats,
                statusEffects: [...(eStats.statusEffects || []), result.enemyDebuffApplied],
              });
              spawnText(result.enemyDebuffApplied.name, [1.5, 2.0, -1.5], '#a855f7');
            }

            if (hpDelta !== 0) {
              usePlayerStore.getState().modifyHp(hpDelta);
            }

            setPlayerStats({
              ...pStats,
              hp: usePlayerStore.getState().stats.hp,
            });
          }

          setRequestedAction(null);
        }, 500);
      } else {
        const [attackId, limbId] = requestedAction.split('|');
        setPlayerAction('attack');
        setPlayerAttackVariant((prev) => (prev === 1 ? 2 : 1));
        setTurnState('player_acting');

        setTimeout(() => {
          const equippedWeaponId = usePlayerStore.getState().equippedWeaponId;
          const result = CombatLogic.calculatePlayerAttack(
            playerStats,
            enemyInstance,
            limbId,
            attackId,
            equippedWeaponId
          );

          pushActionLog('player', result.message);

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
            if (result.lifestealHeal) {
              spawnText(`+${result.lifestealHeal}`, [-1.5, 2.0, 2], '#dc2626');
              setPlayerStats({
                ...playerStats,
                hp: Math.min(playerStats.maxHp, playerStats.hp + result.lifestealHeal),
              });
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
    setSkillCooldown,
    consumeQueuedTurn,
    pushActionLog,
    onFlee,
  ]);

  useEffect(() => {
    if (turnState === 'defeat') {
      const timer = setTimeout(() => {
        onDefeat?.();
      }, 1200); // 1.2s delay allows player death animation to play out
      return () => clearTimeout(timer);
    }
  }, [turnState, onDefeat]);

  // Enemy Turn Execution
  useEffect(() => {
    if (turnState === 'enemy_turn' && popups.length > 0) return;

    if (turnState === 'enemy_turn' && enemyInstance && enemyInstance.hp > 0 && playerStats) {
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
          cameraLookAtTarget.current.set(1.2, 1.0, -1.0);
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

          usePlayerStore.getState().modifyHp(-finalDmg);

          pushActionLog(
            'enemy',
            `${enemyInstance.name} used ${attackDef.name || 'Struggle'} dealing ${finalDmg} damage!`
          );

          const currentHp = usePlayerStore.getState().stats.hp;
          setPlayerStats((prev) => ({
            ...usePlayerStore.getState().stats,
            statusEffects: prev.statusEffects,
          }));

          if (currentHp <= 0) {
            setPlayerAction('die');
          } else {
            setPlayerAction('hurt');
          }

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
    pushActionLog,
  ]);

  // Animation Callbacks
  const onPlayerAnimEnd = useCallback(() => {
    if (playerAction === 'die') return setTurnState('defeat');
    setPlayerAction('idle');
    setPlayerEmphasis('none');
    if (turnState === 'player_acting' && enemyInstance?.hp !== 0) {
      if (playerStats) {
        setPlayerStats({
          ...playerStats,
          statusEffects: tickStatusEffects(playerStats.statusEffects),
        });
      }
      if (!consumeQueuedTurn()) {
        setTurnState('enemy_turn');
      } else {
        setTurnState('player_turn');
      }
    }
  }, [
    playerAction,
    turnState,
    enemyInstance,
    playerStats,
    setPlayerStats,
    setTurnState,
    consumeQueuedTurn,
  ]);

  const onEnemyAnimEnd = useCallback(() => {
    if (enemyAction === 'death') return setTurnState('victory');
    setEnemyAction('idle');

    if (turnState === 'enemy_acting') {
      tickCooldowns();
      if (enemyInstance?.statusEffects?.length) {
        setEnemyInstance({
          ...enemyInstance,
          statusEffects: tickStatusEffects(enemyInstance.statusEffects),
        });
      }

      // Start of a new round. Re-evaluate speed and reset queued turns.
      if (playerStats && enemyInstance) {
        initQueuedTurns(playerStats.agility, enemyInstance.speed);
      }

      setTurnState('player_turn');
    }
  }, [
    enemyAction,
    turnState,
    enemyInstance,
    playerStats,
    setEnemyInstance,
    setTurnState,
    tickCooldowns,
    initQueuedTurns,
  ]);

  // --- Camera Reset Manager ---
  useEffect(() => {
    if (turnState === 'player_turn' && popups.length === 0) {
      cameraTargetPos.current.copy(originalCamPos);
      cameraLookAtTarget.current.set(0, 0.8, 0);
    }
  }, [turnState, popups.length, originalCamPos]);

  // Dynamic Camera Logic
  useFrame((state) => {
    state.camera.position.lerp(cameraTargetPos.current, 0.15);

    if (shakeIntensity.current > 0) {
      state.camera.position.x += (Math.random() - 0.5) * shakeIntensity.current;
      state.camera.position.y += (Math.random() - 0.5) * shakeIntensity.current;
      shakeIntensity.current = THREE.MathUtils.lerp(shakeIntensity.current, 0, 0.15);
      if (shakeIntensity.current < 0.01) shakeIntensity.current = 0;
    }

    cameraLookAt.current.lerp(cameraLookAtTarget.current, 0.15);
    state.camera.lookAt(cameraLookAt.current);
  });

  return (
    <group>
      <PerspectiveCamera makeDefault position={originalCamPos} fov={50} near={0.01} far={100} />
      <ambientLight intensity={0.6} color="#ffffff" />
      <directionalLight position={[2, 5, 2]} intensity={1.0} color="#ffffff" />

      {/* HUD Log & Status Overlay */}
      <Html fullscreen zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
        <div className="absolute top-4 left-4 w-80 md:w-96 pointer-events-auto">
          <CombatLogPanel
            playerEffects={playerStats?.statusEffects || []}
            enemyEffects={enemyInstance?.statusEffects || []}
            recentActions={combatLogs}
          />
        </div>
      </Html>

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
            emphasis={playerEmphasis}
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
              transition={{ duration: 1.2, ease: 'easeOut' }}
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
