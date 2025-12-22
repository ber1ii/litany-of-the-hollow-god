import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { AtlasFloor } from './AtlasFloor';
import { PlayerController } from './PlayerController';
import * as THREE from 'three';
import { LevelBuilder } from './LevelBuilder';
import { TILE_TYPES } from './MapData';
import { CombatScene } from '../Combat/CombatScene';
import { CombatHud } from '../Combat/CombatHud';
import { INITIAL_STATS } from '../../types/GameTypes';
import type { PlayerStats, InventoryItem, CombatEnemyInstance } from '../../types/GameTypes';
import { ENEMIES } from '../../data/Enemies';
import { Minimap } from './Minimap';
import { CombatTransitionCamera } from './CombatTransitionCamera';
import { ITEM_REGISTRY } from '../../data/ItemRegistry';
import { getTileDef } from '../../data/TileRegistry';
import { InventoryMenu } from '../UI/InventoryMenu';
import { BonfireMenu } from '../UI/BonfireMenu';
import { LevelUpMenu } from '../UI/LevelUpMenu';
import { LEVEL_REGISTRY, INITIAL_LEVEL_ID } from '../../data/LevelRegistry';
import { SaveManager } from '../../utils/SaveManager';
import type { SaveData } from '../../utils/SaveManager';
import { SkillTree } from '../UI/SkillTree';

const FOG_COLOR = '#080810';

const AbyssPlane = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
    <planeGeometry args={[100, 100]} />
    <meshStandardMaterial color="#000000" roughness={1} />
  </mesh>
);

const overlayStyle = `
  @keyframes flashRed {
      0% { background-color: rgba(255, 0, 0, 0); transform: scale(1); }
      10% { background-color: rgba(255, 0, 0, 0.4); transform: scale(1.02); }
      100% { background-color: rgba(0, 0, 0, 1); transform: scale(1.1); }
  }
  @keyframes fadeWhite {
      0% { background-color: rgba(255, 255, 255, 0); }
      50% { background-color: rgba(255, 255, 255, 0.3); }
      100% { background-color: rgba(255, 255, 255, 0); }
  }
`;

interface GameProps {
  onExit: () => void;
  initialSaveData?: SaveData | null;
}

export const Game: React.FC<GameProps> = ({ onExit, initialSaveData }) => {
  // --- INITIALIZATION ---
  // eslint-disable-next-line
  const [currentLevelId, setCurrentLevelId] = useState(
    initialSaveData ? initialSaveData.currentLevelId : INITIAL_LEVEL_ID
  );

  const levelChanges = useRef<Map<string, Map<string, number>>>(
    initialSaveData ? SaveManager.deserializeLevelChanges(initialSaveData.levelChanges) : new Map()
  );

  const [mapData, setMapData] = useState(() => {
    const baseMap = LEVEL_REGISTRY[currentLevelId] || LEVEL_REGISTRY['LEVEL_1'];
    const activeMap = baseMap.map((row) => [...row]);

    if (initialSaveData && initialSaveData.levelChanges) {
      const changesObj = initialSaveData.levelChanges[currentLevelId];
      if (changesObj) {
        Object.entries(changesObj).forEach(([key, tileId]) => {
          const [x, z] = key.split(',').map(Number);
          if (activeMap[z] && activeMap[z][x] !== undefined) {
            activeMap[z][x] = tileId;
          }
        });
      }
    }
    return activeMap;
  });

  // FIX: Safe Stats Loading
  // This ensures 'statusEffects' and other new fields exist even if the save file is old.
  const [stats, setStats] = useState<PlayerStats>(() => {
    if (initialSaveData) {
      return {
        ...INITIAL_STATS,
        ...initialSaveData.stats,
        statusEffects: initialSaveData.stats.statusEffects || [],
      };
    }
    return INITIAL_STATS;
  });

  const [deadEnemyIds, setDeadEnemyIds] = useState<Set<string>>(
    initialSaveData ? new Set(initialSaveData.deadEnemyIds) : new Set()
  );

  const playerPosRef = useRef(
    initialSaveData
      ? new THREE.Vector3(
          initialSaveData.playerPos.x,
          initialSaveData.playerPos.y,
          initialSaveData.playerPos.z
        )
      : new THREE.Vector3(3, 0, 25)
  );

  const playerRotationRef = useRef(initialSaveData ? initialSaveData.playerRotation : 0);

  const [inventory, setInventory] = useState<InventoryItem[]>(
    initialSaveData
      ? initialSaveData.inventory
      : [
          { ...ITEM_REGISTRY['flask_crimson'], count: 3 },
          { ...ITEM_REGISTRY['flask_cerulean'], count: 2 },
        ]
  );

  // --- GAME STATE ---
  const [gameState, setGameState] = useState<
    'roam' | 'combat' | 'gameover' | 'combat_transition' | 'resting'
  >('roam');

  const [currentEnemyId, setCurrentEnemyId] = useState<string>('SKELETON');
  const [combatEnemy, setCombatEnemy] = useState<CombatEnemyInstance | null>(null);

  const combatCooldown = useRef(false);
  const currentThemeId = 'DUNGEON';
  const enemyTracker = useRef(new Map<string, { x: number; z: number }>());

  const [notifications, setNotifications] = useState<string[]>(
    initialSaveData ? ['Game Loaded.'] : []
  );
  const [isInventoryOpen, setInventoryOpen] = useState(false);
  const [isBonfireMenuOpen, setBonfireMenuOpen] = useState(false);
  const [isLevelUpOpen, setLevelUpOpen] = useState(false);
  const [isSkillTreeOpen, setSkillTreeOpen] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  const [menuState, setMenuState] = useState<
    'main' | 'attack_select' | 'items' | 'move_select' | 'skill_select'
  >('main');

  const addNotification = (msg: string) => {
    setNotifications((prev) => [...prev.slice(-4), msg]);
    setTimeout(() => setNotifications((prev) => prev.slice(1)), 3000);
  };

  const updateMapTile = (x: number, z: number, newTileId: number) => {
    setMapData((prev) => {
      const newMap = prev.map((row) => [...row]);
      newMap[z][x] = newTileId;
      return newMap;
    });
    if (!levelChanges.current.has(currentLevelId)) {
      levelChanges.current.set(currentLevelId, new Map());
    }
    levelChanges.current.get(currentLevelId)?.set(`${x},${z}`, newTileId);
  };

  const handleSkillUnlock = (skillId: string, cost: number) => {
    setStats((prev) => ({
      ...prev,
      xp: prev.xp - cost,
      unlockedSkills: [...prev.unlockedSkills, skillId],
    }));
  };

  const handleRest = async (statsOverride?: PlayerStats) => {
    setBonfireMenuOpen(false);
    setGameState('resting');

    const currentStats = statsOverride || stats;

    const restedStats = {
      ...currentStats,
      hp: currentStats.maxHp,
      mp: currentStats.maxMp,
      sanity: currentStats.maxSanity,
    };

    const restedInventory = inventory.map((item) => {
      if (item.id === 'flask_crimson') return { ...item, count: 3 };
      if (item.id === 'flask_cerulean') return { ...item, count: 2 };
      return item;
    });

    const nextDeadEnemies = new Set<string>();
    deadEnemyIds.forEach((id) => {
      const baseId = id.split('-')[0].toUpperCase();
      const def = ENEMIES[baseId];
      if (def && def.tier === 'boss') {
        nextDeadEnemies.add(id);
      }
    });

    setStats(restedStats);
    setInventory(restedInventory);
    setDeadEnemyIds(nextDeadEnemies);

    let doorsClosed = 0;
    setMapData((prev) => {
      const newMap = prev.map((row) => [...row]);
      for (let z = 0; z < newMap.length; z++) {
        for (let x = 0; x < newMap[0].length; x++) {
          if (newMap[z][x] === TILE_TYPES.DOOR_OPEN) {
            newMap[z][x] = TILE_TYPES.DOOR_CLOSED;
            if (!levelChanges.current.has(currentLevelId))
              levelChanges.current.set(currentLevelId, new Map());
            levelChanges.current.get(currentLevelId)?.set(`${x},${z}`, TILE_TYPES.DOOR_CLOSED);
            doorsClosed++;
          }
        }
      }
      return newMap;
    });

    if (doorsClosed > 0) addNotification('The doors slam shut...');

    setTimeout(() => setGameState('roam'), 1000);
    addNotification('Restored Health, Mind & Flasks.');

    setIsSaving(true);
    const success = await SaveManager.saveGame({
      stats: restedStats,
      inventory: restedInventory,
      currentLevelId: currentLevelId,
      playerPos: {
        x: playerPosRef.current.x,
        y: playerPosRef.current.y,
        z: playerPosRef.current.z,
      },
      playerRotation: playerRotationRef.current,
      deadEnemyIds: Array.from(nextDeadEnemies),
      levelChanges: SaveManager.serializeLevelChanges(levelChanges.current),
      timestamp: Date.now(),
    });

    setIsSaving(false);
    if (success) addNotification('Game Saved.');
    else addNotification('Error Saving Game.');
  };

  const handleLevelUpConfirm = (newStats: PlayerStats) => {
    setLevelUpOpen(false);
    addNotification(`Level Up! You are now Level ${newStats.level}.`);
    handleRest(newStats);
  };

  const [combatPhase, setCombatPhase] = useState<
    'player_turn' | 'player_acting' | 'enemy_turn' | 'enemy_acting' | 'victory' | 'defeat'
  >('player_turn');
  const [requestedAction, setRequestedAction] = useState<string | null>(null);
  const [transitionTarget, setTransitionTarget] = useState<{ x: number; z: number } | null>(null);

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        if (gameState === 'roam' && !isBonfireMenuOpen && !isLevelUpOpen) {
          setInventoryOpen((prev) => !prev);
        }
      }
      if (e.key === 'Escape') {
        if (isLevelUpOpen) setLevelUpOpen(false);
        else if (isBonfireMenuOpen) setBonfireMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [gameState, isInventoryOpen, isBonfireMenuOpen, isLevelUpOpen]);

  const handleUseItem = (item: InventoryItem) => {
    if (item.type === 'consumable' || item.type === 'flask') {
      let used = false;

      if (item.effect) {
        if (item.effect.type === 'heal') {
          if (stats.hp < stats.maxHp) {
            setStats((prev) => ({
              ...prev,
              hp: Math.min(prev.maxHp, prev.hp + item.effect!.value),
            }));
            addNotification(`Restored ${item.effect.value} HP`);
            used = true;
          } else {
            addNotification('Health is already full.');
          }
        }
        if (item.effect.type === 'restore_mind') {
          if (stats.mp < stats.maxMp) {
            setStats((prev) => ({
              ...prev,
              mp: Math.min(prev.maxMp, prev.mp + item.effect!.value),
            }));
            addNotification(`Restored Mind`);
            used = true;
          } else {
            addNotification('Mind is already full.');
          }
        }
      }

      if (used) {
        setInventory((prev) => {
          return prev
            .map((i) => {
              if (i.id === item.id) return { ...i, count: i.count - 1 };
              return i;
            })
            .filter((i) => i.type === 'flask' || i.count > 0);
        });
      }
    }

    if (item.type === 'weapon') {
      addNotification(`Equipped ${item.name} (Visuals WIP)`);
    }
  };

  const handleInteract = (x: number, z: number) => {
    const tileId = mapData[z][x];
    const tileDef = getTileDef(tileId);

    if (tileId === TILE_TYPES.BONFIRE) {
      setBonfireMenuOpen(true);
      return;
    }

    if (tileDef.type === 'item' && tileDef.itemId) {
      const item = ITEM_REGISTRY[tileDef.itemId];
      if (item) {
        addNotification(`Picked up ${item.name}`);
        setInventory((prev) => {
          const existingIdx = prev.findIndex((i) => i.id === item.id);
          if (existingIdx >= 0 && item.stackable) {
            const newInv = [...prev];
            newInv[existingIdx].count += 1;
            return newInv;
          }
          return [...prev, { ...item, count: 1 }];
        });
        updateMapTile(x, z, TILE_TYPES.FLOOR_BASE);
      }
      return;
    }

    if (tileId === TILE_TYPES.DOOR_LOCKED_SILVER) {
      const hasKey = inventory.some((i) => i.id === 'silver_key');
      if (hasKey) {
        addNotification('Unlocked with Silver Key');
        updateMapTile(x, z, TILE_TYPES.DOOR_OPEN);
      } else {
        addNotification('Locked (Requires Silver Key)');
      }
    } else if (tileId === TILE_TYPES.DOOR_CLOSED) {
      updateMapTile(x, z, TILE_TYPES.DOOR_OPEN);
    } else if (tileId === TILE_TYPES.DOOR_OPEN) {
      updateMapTile(x, z, TILE_TYPES.DOOR_CLOSED);
    }
  };

  const handleStep = (x: number, z: number) => {
    if (z < 0 || z >= mapData.length || x < 0 || x >= mapData[0].length) return;
    const tile = mapData[z][x];
    if (tile === TILE_TYPES.GOLD) {
      addNotification('Picked up Gold');
      setStats((prev) => ({ ...prev, gold: prev.gold + 10 }));
      updateMapTile(x, z, TILE_TYPES.FLOOR_BASE);
    }
  };

  const startCombat = (enemyId: string) => {
    if (combatCooldown.current) return;
    if (deadEnemyIds.has(enemyId)) return;

    const enemyPos = enemyTracker.current.get(enemyId);
    if (enemyPos) {
      setTransitionTarget(enemyPos);
    }

    setCurrentEnemyId(enemyId);
    setCombatEnemy(null);

    setGameState('combat_transition');

    setTimeout(() => {
      setGameState('combat');
      setCombatPhase('player_turn');
      setMenuState('main');
      setRequestedAction(null);
    }, 1500);
  };

  const endCombat = (result: { victory: boolean; hpRemaining: number }) => {
    if (result.victory) {
      setStats((prev) => {
        return {
          ...prev,
          hp: result.hpRemaining,
          xp: prev.xp + 50,
          gold: prev.gold + 20,
        };
      });

      setDeadEnemyIds((prev) => new Set(prev).add(currentEnemyId));
      if (enemyTracker.current) enemyTracker.current.delete(currentEnemyId);
      setGameState('roam');
    } else {
      if (result.hpRemaining > 0) {
        setStats((prev) => ({ ...prev, hp: result.hpRemaining }));
        setGameState('roam');
        combatCooldown.current = true;
        setTimeout(() => {
          combatCooldown.current = false;
        }, 2000);
      } else {
        setGameState('gameover');
      }
    }
  };

  const handlePlayerAction = (skillId: string) => {
    setRequestedAction(skillId);
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#000',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <style>{overlayStyle}</style>

      {isInventoryOpen && (
        <InventoryMenu
          inventory={inventory}
          onClose={() => setInventoryOpen(false)}
          onUseItem={handleUseItem}
        />
      )}

      {isBonfireMenuOpen && !isLevelUpOpen && (
        <BonfireMenu
          onClose={() => setBonfireMenuOpen(false)}
          onQuit={onExit}
          onRest={() => handleRest()}
          onLevelUp={() => setLevelUpOpen(true)}
          onSkillTree={() => {
            setBonfireMenuOpen(false);
            setSkillTreeOpen(true);
          }}
        />
      )}

      {isSkillTreeOpen && (
        <SkillTree
          stats={stats}
          onClose={() => setSkillTreeOpen(false)}
          onUnlock={handleSkillUnlock}
        />
      )}

      {isLevelUpOpen && (
        <LevelUpMenu
          stats={stats}
          onClose={() => setLevelUpOpen(false)}
          onConfirm={handleLevelUpConfirm}
        />
      )}

      {gameState === 'resting' && (
        <div
          className="absolute inset-0 z-[100] bg-white pointer-events-none"
          style={{ animation: 'fadeWhite 1s forwards' }}
        />
      )}

      {isSaving && (
        <div className="absolute top-5 right-5 text-neutral-500 font-mono text-xs animate-pulse z-[200]">
          SAVING...
        </div>
      )}

      {gameState === 'combat_transition' && (
        <div
          className="absolute inset-0 z-[100] pointer-events-none"
          style={{ animation: 'flashRed 1.4s forwards' }}
        />
      )}

      {gameState === 'roam' && !isInventoryOpen && !isBonfireMenuOpen && !isLevelUpOpen && (
        <>
          <div className="absolute top-5 left-5 text-white font-mono z-10 pointer-events-none">
            <p className="text-yellow-400 mb-2">WASD Move | E Interact</p>
            <div className="flex gap-4">
              <p className="text-xl font-bold text-red-500">
                HP: {stats.hp}/{stats.maxHp}
              </p>
              <p className="text-xl font-bold text-blue-500">LVL: {stats.level}</p>
              <p className="text-xl font-bold text-green-500">XP: {stats.xp}</p>
              <p className="text-xl font-bold text-amber-500">GOLD: {stats.gold}</p>
            </div>
          </div>

          <div className="absolute bottom-5 right-5 text-white font-mono z-10 text-right pointer-events-none">
            <div className="flex flex-col items-end gap-1">
              {notifications.map((msg, i) => (
                <div
                  key={i}
                  className="bg-gray-900/80 px-3 py-1 text-xs text-yellow-100 border-l-2 border-yellow-500"
                >
                  {msg}
                </div>
              ))}
            </div>
          </div>

          <div className="absolute bottom-5 left-5 text-white font-mono z-10 pointer-events-none">
            <Minimap
              map={mapData}
              playerPos={playerPosRef}
              playerRotation={playerRotationRef}
              enemyTracker={enemyTracker}
            />
          </div>
        </>
      )}

      {gameState === 'combat' && (
        <CombatHud
          combatState={combatPhase}
          menuState={menuState}
          setMenuState={setMenuState}
          playerStats={stats}
          enemyInstance={combatEnemy}
          onAction={handlePlayerAction}
          onLeave={(victory) => endCombat({ victory, hpRemaining: stats.hp })}
          inventory={inventory}
        />
      )}

      {gameState === 'gameover' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-50">
          <div className="text-center">
            <h1 className="text-6xl text-red-600 font-mono mb-4">YOU DIED</h1>
            <button
              className="px-6 py-3 bg-white text-black font-mono hover:bg-gray-200"
              onClick={onExit}
            >
              RETURN TO TITLE
            </button>
          </div>
        </div>
      )}

      <Canvas shadows camera={{ position: [0, 3, 2.5], fov: 50, near: 0.01 }}>
        <color attach="background" args={[FOG_COLOR]} />

        {gameState !== 'combat' && <fog attach="fog" args={['#000000', 5, 12]} />}
        <hemisphereLight color="#222244" groundColor="#000000" intensity={0.2} />

        {gameState !== 'combat' && <AbyssPlane />}

        {gameState === 'roam' || gameState === 'combat_transition' || gameState === 'resting' ? (
          <>
            <AtlasFloor map={mapData} />
            <LevelBuilder
              map={mapData}
              playerPos={playerPosRef}
              onCombatStart={startCombat}
              enemyTracker={enemyTracker}
              deadEnemyIds={deadEnemyIds}
            />

            <PlayerController
              map={mapData}
              onInteract={handleInteract}
              onStep={handleStep}
              playerRef={playerPosRef}
              playerRotRef={playerRotationRef}
              active={
                gameState === 'roam' && !isInventoryOpen && !isBonfireMenuOpen && !isLevelUpOpen
              }
            />

            {gameState === 'combat_transition' && transitionTarget && (
              <CombatTransitionCamera enemyPos={transitionTarget} />
            )}
          </>
        ) : gameState === 'combat' ? (
          <CombatScene
            key={currentEnemyId} // FIX: Force Remount on new enemy
            enemyId={currentEnemyId}
            themeId={currentThemeId}
            initialStats={stats}
            combatPhase={combatPhase}
            setCombatPhase={setCombatPhase}
            onEnemyUpdate={setCombatEnemy}
            requestedAction={requestedAction}
            setRequestedAction={setRequestedAction}
            updatePlayerStats={setStats}
          />
        ) : null}
      </Canvas>
    </div>
  );
};
