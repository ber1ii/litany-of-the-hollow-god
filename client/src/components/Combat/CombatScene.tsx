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
import { usePlayerStore } from '../../hooks/usePlayerStore';

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
    setSkillCooldown,
    tickCooldowns,
  } = useCombatStore();

  // Local Visual State
  const [playerAction, setPlayerAction] = useState<PlayerCombatAction>('idle');
  const [enemyAction, setEnemyAction] = useState<'idle' | 'attack' | 'hurt' | 'death'>('idle');
  const [popups, setPopups] = useState<DamagePopup[]>([]);
  const [playerAttackVariant, setPlayerAttackVariant] = useState<1 | 2>(1);
  const [playerEmphasis, setPlayerEmphasis] = useState<'none' | 'heavy' | 'plunge'>('none');

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

  // Initialize Combat — runs once per enemy/level, not on every stats update.
  // initialStats is read via a ref and intentionally excluded from the
  // dependency array: it's the `stats` object from usePlayerStore, and the
  // store produces a NEW object reference on every mutation (e.g. modifyHp
  // when the enemy attacks). Depending on it here meant this effect re-ran
  // mid-fight, silently rebuilding enemyInstance from scratch via
  // createEnemyInstance — full HP restored, all severed limbs undone,
  // right after every enemy attack. Capturing initialStats once in a ref
  // and keying the effect only on enemyId fixes it.
  const initialStatsRef = useRef(initialStats);
  useEffect(() => {
    initialStatsRef.current = initialStats;
  }, [initialStats]);

  useEffect(() => {
    const baseId = enemyId.split('-')[0].toUpperCase();
    const def = ENEMIES[baseId] || ENEMIES['SKELETON'];

    setPlayerStats(initialStatsRef.current);
    setEnemyInstance(CombatLogic.createEnemyInstance(def, enemyId));

    return () => resetCombat();
  }, [enemyId, setEnemyInstance, setPlayerStats, resetCombat]);

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

      if (type === 'item') {
        setTurnState('player_acting');
        const itemDef = ITEM_REGISTRY[payload];
        const consumed = usePlayerStore.getState().consumeItem(payload);

        if (consumed) {
          spawnText('USED ITEM', [-1.5, 1.5, 2], '#3b82f6');
          // Play the animation tied to what this item actually does —
          // 'heal' for Vitality restoration (Crimson Flask -> Health.png),
          // falling back to 'cast' for anything else (e.g. Mind restore).
          // Previously nothing here ever called setPlayerAction, so no
          // animation played at all regardless of item type.
          setPlayerAction(itemDef?.effect?.type === 'heal' ? 'heal' : 'cast');
          // Merge in the fresh hp/mp/etc from usePlayerStore, but keep
          // this combat's own statusEffects — usePlayerStore's copy never
          // receives combat-only buffs (e.g. Blood Surge's lifesteal), so
          // overwriting wholesale here would silently erase them.
          setPlayerStats((prev) => ({
            ...usePlayerStore.getState().stats,
            statusEffects: prev.statusEffects,
          }));
        } else {
          spawnText('CANNOT USE', [-1.5, 1.5, 2], '#ef4444');
        }
        setRequestedAction(null);
        setTimeout(() => {
          setPlayerAction('idle');
          // Tick status effects once per completed player turn, same
          // choke point as the skill/attack path below.
          setPlayerStats((prev) => ({
            ...prev,
            statusEffects: tickStatusEffects(prev.statusEffects),
          }));
          setTurnState('enemy_turn');
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
          const result = CombatLogic.executeSkill(skillId, pStats, eStats, pStats.level, limbId);

          if (!result.success) {
            spawnText(result.message, [-1.5, 1.5, 2], '#ef4444');
            setPlayerAction('idle');
            setPlayerEmphasis('none'); // add
            setTurnState('player_turn');
            setRequestedAction(null);
            return;
          }

          // Skill succeeded — start its cooldown (if it has one). Nothing
          // previously called setSkillCooldown anywhere, so cooldowns
          // existed in the store but no skill ever actually triggered one.
          if (skillDef.cooldown) {
            setSkillCooldown(skillId, skillDef.cooldown);
          }

          if (result.attackResult) {
            // Damage-dealing skill (quick_attack, heavy_attack, plunging_strike)
            // — mirror the same visuals as a normal weapon attack.
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
              usePlayerStore.getState().modifyMp(-result.cost); // add: sync global store
              nextPlayer.mp = usePlayerStore.getState().stats.mp; // add: read back clamped value
            }
            if (atk.lifestealHeal) {
              usePlayerStore.getState().modifyHp(atk.lifestealHeal); // add: same gap exists for lifesteal HP
              nextPlayer.hp = usePlayerStore.getState().stats.hp; // add
              spawnText(`+${atk.lifestealHeal}`, [-1.5, 2.0, 2], '#dc2626');
            }
            setPlayerStats(nextPlayer);
          } else {
            // Utility skill (heal and/or buff)
            spawnText(result.message, [-1.5, 1.5, 2], '#4ade80');

            let hpDelta = 0;
            if (result.healAmount) {
              spawnText(`+${result.healAmount}`, [-1.5, 2.0, 2], '#4ade80');
              hpDelta += result.healAmount;
            }
            if (result.hpCost) hpDelta -= result.hpCost;

            if (result.cost) {
              usePlayerStore.getState().modifyMp(-result.cost); // add
              pStats.mp = usePlayerStore.getState().stats.mp; // add
            }
            if (result.buffApplied) {
              pStats.statusEffects = [...(pStats.statusEffects || []), result.buffApplied];
            }

            if (hpDelta !== 0) {
              usePlayerStore.getState().modifyHp(hpDelta); // <-- sync global store
            }

            setPlayerStats({
              ...pStats,
              hp: usePlayerStore.getState().stats.hp, // read back the clamped value
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

          const currentHp = usePlayerStore.getState().stats.hp;
          // Merge fresh hp/mp/etc from usePlayerStore, but keep this
          // combat's own statusEffects intact — see the item-branch
          // comment above for why a wholesale overwrite here would
          // silently erase active buffs like Blood Surge's lifesteal
          // right after casting it, before the player gets a hit in.
          setPlayerStats((prev) => ({
            ...usePlayerStore.getState().stats,
            statusEffects: prev.statusEffects,
          }));
          if (currentHp <= 0) setPlayerAction('die');

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
    setPlayerEmphasis('none');
    if (turnState === 'player_acting' && enemyInstance?.hp !== 0) {
      // Tick status-effect durations once per completed player turn
      // (skill and attack both end up here via CombatPlayer's onAnimEnd).
      if (playerStats) {
        setPlayerStats({
          ...playerStats,
          statusEffects: tickStatusEffects(playerStats.statusEffects),
        });
      }
      setTurnState('enemy_turn');
    }
  }, [playerAction, turnState, enemyInstance, playerStats, setPlayerStats, setTurnState]);

  const onEnemyAnimEnd = useCallback(() => {
    if (enemyAction === 'death') return setTurnState('victory');
    setEnemyAction('idle');
    if (turnState === 'enemy_acting') {
      // Previously cooldowns only ticked down in the rare branch where
      // the enemy has no attacks left to use (see useCombatStore's
      // triggerEnemyTurn) — a normal attack turn never reached this, so
      // skill cooldowns effectively never counted down in most fights.
      tickCooldowns();
      setTurnState('player_turn');
    }
  }, [enemyAction, turnState, setTurnState, tickCooldowns]);

  // --- Camera Reset Manager ---
  // Only reset the camera when returning to the player's turn AND all popups have vanished
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

    cameraLookAt.current.lerp(cameraLookAtTarget.current, 0.15); // replaced
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
