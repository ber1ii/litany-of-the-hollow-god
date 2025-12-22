import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTexture, Billboard, Html, PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { motion } from 'framer-motion';
import { CombatUnit } from './CombatUnit';
import type { PlayerStats, CombatEnemyInstance, StatusEffect } from '../../types/GameTypes';
import { ENEMIES } from '../../data/Enemies';
import * as THREE from 'three';
import { THEMES } from '../../data/LevelThemes';
import { CombatLogic } from '../../managers/CombatLogic';

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

interface AttackResult {
  hit: boolean;
  damageDealt: number;
  isCrit: boolean;
  message: string;
  enemyState: CombatEnemyInstance;
  partSevered?: string;
  isFatal: boolean;
}

interface SkillResult {
  success: boolean;
  message: string;
  healAmount?: number;
  buffApplied?: StatusEffect;
  cost?: number;
}

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
  // State initialization moved to useState lazy init to prevent side-effects in render
  const [combatEnemy, setCombatEnemy] = useState<CombatEnemyInstance | null>(() => {
    if (enemyId) {
      const baseId = enemyId.split('-')[0].toUpperCase();
      const def = ENEMIES[baseId] || ENEMIES['SKELETON'];
      return CombatLogic.createEnemyInstance(def, enemyId);
    }
    return null;
  });

  // Sync initial enemy state up to Game.tsx only once on mount
  useEffect(() => {
    if (combatEnemy) {
      onEnemyUpdate(combatEnemy);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [pendingResult, setPendingResult] = useState<AttackResult | null>(null);
  const [pendingSkillResult, setPendingSkillResult] = useState<SkillResult | null>(null);

  const [playerAction, setPlayerAction] = useState<'idle' | 'attack' | 'hurt' | 'pray' | 'die'>(
    'idle'
  );
  const [enemyAction, setEnemyAction] = useState<'idle' | 'attack' | 'hurt' | 'death'>('idle');
  const [popups, setPopups] = useState<DamagePopup[]>([]);
  const [playerAttackVariant, setPlayerAttackVariant] = useState<1 | 2>(1);

  const shakeIntensity = useRef(0);
  const originalCamPos = useMemo(() => new THREE.Vector3(-0.5, 3, 6), []);

  const enemyData = ENEMIES[enemyId] || ENEMIES['SKELETON'];
  const theme = THEMES[themeId] || THEMES['DUNGEON'];
  const heroTextures = useTexture(HERO_URLS);

  // --- ACTION HANDLER ---
  useEffect(() => {
    if (requestedAction && combatPhase === 'player_turn' && combatEnemy) {
      if (requestedAction.startsWith('skill:')) {
        const skillId = requestedAction.split(':')[1];
        const result = CombatLogic.executeSkill(skillId, initialStats);

        if (result.success) {
          // Wrap state updates in timeout to avoid "setState during render" warning from parent
          setTimeout(() => {
            setPendingSkillResult(result);
            setCombatPhase('player_acting');
            setPlayerAction('pray');
            setRequestedAction(null);
          }, 0);
        }
      } else if (requestedAction.includes('|')) {
        const [attackType, partId] = requestedAction.split('|');
        const result = CombatLogic.calculatePlayerAttack(
          initialStats,
          combatEnemy,
          partId,
          attackType as 'slash' | 'heavy'
        );

        setTimeout(() => {
          setPendingResult(result);
          setCombatPhase('player_acting');
          setPlayerAction('attack');
          setPlayerAttackVariant(attackType === 'heavy' ? 2 : 1);
          setRequestedAction(null);
        }, 0);
      }
    }
  }, [requestedAction, combatPhase, combatEnemy, initialStats, setCombatPhase, setRequestedAction]);

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

  const spawnText = (text: string, pos: [number, number, number], color: string) => {
    const id = Date.now() + Math.random();
    setPopups((prev) => [...prev, { id, text, position: pos, color }]);
  };
  const removePopup = (id: number) => setPopups((prev) => prev.filter((p) => p.id !== id));

  // --- ANIMATION END HANDLERS ---
  const onPlayerAnimEnd = useCallback(() => {
    // 1. ATTACK END
    if (playerAction === 'attack' && pendingResult) {
      setPlayerAction('idle');
      const result = pendingResult;
      setCombatEnemy(result.enemyState);
      onEnemyUpdate(result.enemyState);

      if (result.hit) {
        setEnemyAction('hurt');
        shakeIntensity.current = result.isCrit ? 0.4 : 0.2;
        const color = result.isCrit ? '#ffaa00' : '#ffffff';
        spawnText(result.damageDealt.toString(), [1.5, 2, -1.5], color);

        if (result.partSevered) {
          setTimeout(() => spawnText('SEVERED!', [1.5, 2.5, -1.5], '#ff0000'), 200);
        }
      } else {
        spawnText('MISS', [1.5, 2, -1.5], '#888888');
      }
      setPendingResult(null);
    }

    // 2. PRAY/SKILL END
    if (playerAction === 'pray') {
      setPlayerAction('idle');

      // Apply results if we have them
      if (pendingSkillResult) {
        const result = pendingSkillResult;
        const nextStats = { ...initialStats };

        if (result.healAmount) {
          nextStats.hp = Math.min(nextStats.maxHp, nextStats.hp + result.healAmount);
          spawnText(`+${result.healAmount}`, [-1.5, 2, 2], '#00ff00');
        }

        if (result.buffApplied) {
          nextStats.statusEffects = [
            ...(nextStats.statusEffects || []).filter((e) => e.type !== result.buffApplied!.type),
            result.buffApplied!,
          ];
          spawnText('BUFF!', [-1.5, 2.5, 2], '#ffff00');
        }
        updatePlayerStats(nextStats);
        setPendingSkillResult(null);
      }

      // FIX: Force transition to enemy turn to avoid soft-lock
      setCombatPhase('enemy_turn');
    }

    // 3. TRANSITION IF ATTACK MISSED (No enemy reaction)
    if (playerAction === 'attack') {
      if (!pendingResult?.hit) {
        setTimeout(() => setCombatPhase('enemy_turn'), 500);
      }
    }
  }, [
    playerAction,
    pendingResult,
    pendingSkillResult,
    initialStats,
    onEnemyUpdate,
    setCombatPhase,
    updatePlayerStats,
  ]);

  const onEnemyAnimEnd = useCallback(() => {
    if (enemyAction === 'hurt') {
      setEnemyAction('idle');
      if (combatEnemy && combatEnemy.hp <= 0) {
        setCombatPhase('victory');
      } else {
        setCombatPhase('enemy_turn');
      }
    }

    if (enemyAction === 'attack') {
      setEnemyAction('idle');
      const dmg = enemyData.baseStats.attack;
      updatePlayerStats({
        ...initialStats,
        hp: Math.max(0, initialStats.hp - dmg),
      });

      setPlayerAction('hurt');
      spawnText(dmg.toString(), [-1.5, 2, 2], '#ff0000');
    }
  }, [enemyAction, combatEnemy, initialStats, enemyData, setCombatPhase, updatePlayerStats]);

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
        <AnimatedTorch position={[-5, 2, -5.9]} />
        <AnimatedTorch position={[5, 2, -5.9]} />

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
          position={[-1.5, -0.8, 2]}
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
          position={[1.5, -0.8, -1.5]}
          height={enemyData.scale}
          flip={true}
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
