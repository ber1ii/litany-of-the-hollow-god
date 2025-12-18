// components/Combat/CombatScene.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Html, useTexture, Billboard } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';
import { motion } from 'framer-motion';
import { CombatUnit } from './CombatUnit';
import type { PlayerStats } from '../../types/GameTypes';
import { ENEMIES } from '../../data/Enemies';
import * as THREE from 'three';
import { THEMES } from '../../data/LevelThemes';
import { SKILL_DATABASE } from '../../data/Skills';
import type { SkillDef } from '../../data/Skills';

const TORCH_FRAMES = [
  '/sprites/props/torch/torch_1.png',
  '/sprites/props/torch/torch_2.png',
  '/sprites/props/torch/torch_3.png',
  '/sprites/props/torch/torch_4.png',
];

const AnimatedTorch = ({ position }: { position: [number, number, number] }) => {
  const textures = useTexture(TORCH_FRAMES);

  useMemo(() => {
    textures.forEach((t) => {
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace;
    });
  }, [textures]);

  const light = useRef<THREE.PointLight>(null);
  const [frameIndex, setFrameIndex] = useState(0);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    // 1. Animation: Cycle frames every 0.15s
    const index = Math.floor(t / 0.15) % 4;
    setFrameIndex(index);

    // 2. Light Flicker: Sine wave noise + random jitter
    if (light.current) {
      const flicker = Math.sin(t * 10) * 0.3 + Math.cos(t * 23) * 0.1 + (Math.random() - 0.5) * 0.2;
      light.current.intensity = 4 + flicker;
    }
  });

  return (
    <group position={position}>
      {/* The Visual Sprite */}
      <Billboard>
        <mesh>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={textures[frameIndex]} transparent alphaTest={0.5} />
        </mesh>
      </Billboard>

      {/* The Light Source */}
      <pointLight ref={light} position={[0, 0, 0.2]} color="#ffaa00" distance={12} decay={2} />
    </group>
  );
};

interface BattleResult {
  victory: boolean;
  hpRemaining: number;
  xpEarned: number;
}

interface CombatSceneProps {
  initialStats: PlayerStats;
  enemyId: string;
  themeId: string;
  onBattleEnd: (result: BattleResult) => void;
}

type CombatState =
  | 'player_turn'
  | 'player_acting'
  | 'enemy_turn'
  | 'enemy_acting'
  | 'victory'
  | 'defeat';
type ActionType = 'idle' | 'attack' | 'hurt' | 'die' | 'pray';
type MenuState = 'main' | 'attack_select' | 'items';

interface DamagePopup {
  id: number;
  text: string;
  position: [number, number, number];
  color: string;
}

const HERO_URLS = {
  idle: '/sprites/combat/knight/Idle.png',
  attack1: '/sprites/combat/knight/attack1.png',
  attack2: '/sprites/combat/knight/attack2.png',
  hurt: '/sprites/combat/knight/Hurt.png',
  death: '/sprites/combat/knight/Death.png',
  pray: '/sprites/combat/knight/Pray.png',
};

export const CombatScene: React.FC<CombatSceneProps> = ({
  onBattleEnd,
  initialStats,
  enemyId,
  themeId,
}) => {
  const { camera } = useThree();

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

  const [combatState, setCombatState] = useState<CombatState>('player_turn');
  const [menuState, setMenuState] = useState<MenuState>('main');
  const [playerHp, setPlayerHP] = useState(initialStats.hp);
  const [enemyHp, setEnemyHp] = useState(50);
  const [playerAction, setPlayerAction] = useState<ActionType>('idle');
  const [enemyAction, setEnemyAction] = useState<ActionType>('idle');
  const [playerAttackVariant, setPlayerAttackVariant] = useState<1 | 2>(1);
  const [popups, setPopups] = useState<DamagePopup[]>([]);
  const [activeSkill, setActiveSkill] = useState<SkillDef | null>(null);

  const shakeIntensity = useRef(0);
  const originalCamPos = useRef(new THREE.Vector3(-0.5, 3, 6));

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

  // Motion FX
  const spawnText = (text: string, pos: [number, number, number], color: string) => {
    const id = Date.now() + Math.random();
    setPopups((prev) => [...prev, { id, text, position: pos, color }]);
  };

  const removePopup = (id: number) => {
    setPopups((prev) => prev.filter((p) => p.id !== id));
  };

  // Attack Logic
  const executePlayerAction = (skillId: string) => {
    if (combatState !== 'player_turn') return;

    const skill = SKILL_DATABASE[skillId];
    if (!skill) return;

    setActiveSkill(skill);
    setCombatState('player_acting');
    setMenuState('main');

    if (skill.animation === 'attack2') setPlayerAttackVariant(2);
    else setPlayerAttackVariant(1);

    setPlayerAction(skill.animation === 'pray' ? 'pray' : 'attack');
  };

  const onPlayerAnimEnd = useCallback(() => {
    if (playerAction === 'attack' && activeSkill) {
      setPlayerAction('idle');

      const baseDmg = activeSkill.damage || 10;
      const isCrit = Math.random() < (activeSkill.critChance || 0.1);
      const finalDmg = Math.floor(baseDmg * (isCrit ? 1.5 : 1) + (Math.random() * 4 - 2));

      setEnemyHp((prev) => Math.max(0, prev - finalDmg));
      setEnemyAction('hurt');
      shakeIntensity.current = isCrit ? 0.5 : 0.2;
      spawnText(finalDmg.toString(), [1.5, 2, -1.5], isCrit ? '#ffaa00' : '#ffffff');
    }

    if (playerAction === 'pray' && activeSkill) {
      setPlayerAction('idle');
      const healAmount = activeSkill.heal || 15;
      setPlayerHP((prev) => Math.min(initialStats.maxHp, prev + healAmount));
      spawnText(`+${healAmount}`, [-1.5, 2, 2], '#00ff00');
      setCombatState('enemy_turn');
    }

    // Reset
    if (playerAction !== 'idle') {
      // Only advance turn if we actually did something
      if (activeSkill?.type === 'utility' || activeSkill?.type === 'physical') {
        // Small delay before enemy acts
        setTimeout(() => setCombatState('enemy_turn'), 500);
      }
    }
  }, [playerAction, activeSkill, initialStats]);

  const onEnemyAnimEnd = useCallback(() => {
    if (enemyAction === 'hurt') {
      setEnemyAction('idle');
      if (enemyHp <= 0) {
        setCombatState('victory');
      } else {
        setCombatState('enemy_turn');
      }
    }

    if (enemyAction === 'attack') {
      setEnemyAction('idle');
      const dmg = enemyData.stats.attack;
      setPlayerHP((prev) => Math.max(0, prev - dmg));
      setPlayerAction('hurt');
      shakeIntensity.current = 0.3;
      spawnText(dmg.toString(), [-1.5, 2, 2], '#ff0000');
    }
  }, [enemyAction, enemyHp, enemyData]);

  useEffect(() => {
    if (playerAction === 'hurt') {
      const timer = setTimeout(() => {
        setPlayerAction('idle');
        if (playerHp <= 0) setCombatState('defeat');
        else setCombatState('player_turn');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [playerAction, playerHp]);

  // Enemy AI
  useEffect(() => {
    if (combatState === 'enemy_turn') {
      const timer = setTimeout(() => {
        setCombatState('enemy_acting');
        setEnemyAction('attack');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [combatState]);

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
      case 'die':
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

        {/* 3D FLOATING ENEMY UI */}
        <Html position={[1.5, 3.2, -1.5]} center zIndexRange={[50, 0]}>
          <div className="flex flex-col items-center select-none w-[200px]">
            <h2 className="text-white font-bold font-pixel text-2xl mb-1 text-shadow-md whitespace-nowrap bg-black/50 px-2">
              {enemyData.name.toUpperCase()}
            </h2>
            <div className="w-full h-3 bg-black border-2 border-white relative">
              <motion.div
                className="h-full bg-fh-red"
                initial={{ width: '100%' }}
                animate={{ width: `${(enemyHp / enemyData.stats.maxHp) * 100}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>
          </div>
        </Html>

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

      {/* --- HUD UI --- */}
      <Html fullscreen className="pointer-events-none font-pixel select-none z-50">
        <div className="w-full h-full relative">
          <div className="pointer-events-auto absolute bottom-14 right-8 w-[90%] md:w-[60%] lg:w-[45%] max-w-4xl h-auto min-h-[250px] bg-fh-black border-4 border-fh-border flex text-white shadow-2xl rounded-xl pb-16">
            {/* COMMANDS */}
            <div className="w-[180px] border-r-4 border-fh-border p-4 flex flex-col bg-[#1a1a1a] rounded-l-lg">
              {combatState === 'player_turn' ? (
                <div className="flex flex-col gap-3 text-2xl">
                  {menuState === 'main' ? (
                    <>
                      <button
                        onClick={() => setMenuState('attack_select')}
                        className="text-left hover:text-yellow-400 hover:bg-white/10 px-2 py-1 rounded transition-colors"
                      >
                        Attack
                      </button>
                      <button className="text-left text-gray-500 cursor-not-allowed px-2 py-1">
                        Skills
                      </button>
                      <button className="text-left hover:text-yellow-400 hover:bg-white/10 px-2 py-1 transition-colors rounded">
                        Inventory
                      </button>
                      <button className="text-left text-gray-500 cursor-not-allowed px-2 py-1">
                        Run
                      </button>
                    </>
                  ) : (
                    <>
                      {menuState === 'attack_select' && (
                        <div className="flex flex-col gap-2 text-2xl">
                          {/* Dynamic Skill List */}
                          {['slash', 'heavy', 'pray'].map((skillId) => {
                            const skill = SKILL_DATABASE[skillId];
                            return (
                              <button
                                key={skillId}
                                onClick={() => executePlayerAction(skillId)}
                                className={`text-left text-white hover:${skill.color.replace('text-', '')} hover:bg-white/10 px-2 py-1 rounded`}
                              >
                                ➢ {skill.name}
                              </button>
                            );
                          })}

                          <button
                            onClick={() => setMenuState('main')}
                            className="text-left text-gray-400 mt-2 hover:text-white px-2 py-1"
                          >
                            ➢ BACK
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="w-full h-full min-h-[160px] flex items-center justify-center text-center text-gray-500 animate-pulse text-2xl">
                  {combatState === 'victory'
                    ? 'VICTORY'
                    : combatState === 'defeat'
                      ? 'DEFEAT'
                      : 'WAIT'}
                </div>
              )}
            </div>

            {/* STATS */}
            <div className="flex-1 p-4 bg-fh-black flex flex-col rounded-r-lg relative">
              {/* Header */}
              <div className="flex w-full text-gray-500 text-lg mb-2 pb-2 border-b border-gray-700 uppercase tracking-widest">
                <div className="w-1/3">Name</div>
                <div className="w-1/3">Body</div>
                <div className="w-1/3">Mind</div>
              </div>

              {/* Player Row */}
              <div className="flex w-full items-center text-2xl relative group mt-2">
                <div className="w-1/3 flex items-center gap-3 overflow-hidden">
                  {combatState === 'player_turn' && (
                    <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse shadow-[0_0_8px_yellow] flex-shrink-0"></div>
                  )}
                  <span className="group-hover:text-yellow-200 transition-colors">Knight</span>
                </div>

                {/* Body (HP) */}
                <div className="w-1/3 pr-4">
                  <div className="w-full h-4 bg-black border border-gray-600 relative shadow-inner">
                    <motion.div
                      className="h-full bg-fh-red"
                      animate={{ width: `${(playerHp / initialStats.maxHp) * 100}%` }}
                    />
                  </div>
                  <div className="text-right text-lg mt-1 text-gray-400">
                    {playerHp}/{initialStats.maxHp}
                  </div>
                </div>

                {/* Mind */}
                <div className="w-1/3 pr-4">
                  <div className="w-full h-4 bg-black border border-gray-600 relative shadow-inner">
                    <div className="h-full w-[80%] bg-fh-blue"></div>
                  </div>
                  <div className="text-right text-lg mt-1 text-gray-400">80/100</div>
                </div>
              </div>

              {/* VICTORY / DEFEAT BUTTONS */}
              {(combatState === 'victory' || combatState === 'defeat') && (
                <div className="absolute bottom-4 right-4 z-50">
                  {combatState === 'victory' && (
                    <button
                      onClick={() =>
                        onBattleEnd({
                          victory: true,
                          hpRemaining: playerHp,
                          xpEarned: enemyData.stats.xpReward,
                        })
                      }
                      className="bg-yellow-700 text-white px-4 py-2 text-xl border-2 border-yellow-500 hover:bg-yellow-600 shadow-lg font-bold uppercase"
                    >
                      Leave Area ➢
                    </button>
                  )}
                  {combatState === 'defeat' && (
                    <button
                      onClick={() => onBattleEnd({ victory: false, hpRemaining: 0, xpEarned: 0 })}
                      className="bg-gray-800 text-white px-4 py-2 text-xl border-2 border-gray-500 hover:bg-gray-700 shadow-lg uppercase"
                    >
                      Accept Fate ➢
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
};
