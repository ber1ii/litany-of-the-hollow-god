import { useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { AtlasFloor } from './components/Game/AtlasFloor';
import { PlayerController } from './components/Game/PlayerController';
import { preloadAllAssets } from './utils/assetUtils';
import * as THREE from 'three';
import { LevelBuilder } from './components/Game/LevelBuilder';
import { LEVEL_1_MAP, TILE_TYPES } from './components/Game/MapData';
import { CombatScene } from './components/Combat/CombatScene';
import { CombatHud } from './components/Combat/CombatHud';
import { INITIAL_STATS } from './types/GameTypes';
import type { PlayerStats } from './types/GameTypes';
import { ENEMIES } from './data/Enemies';
import { Minimap } from './components/Game/Minimap';

preloadAllAssets();

const FOG_COLOR = '#080810';

export type Item = {
  id: string;
  name: string;
  icon?: string;
};

function App() {
  const [mapData, setMapData] = useState(LEVEL_1_MAP);
  const [stats, setStats] = useState<PlayerStats>(INITIAL_STATS);
  const [gameState, setGameState] = useState<'roam' | 'combat' | 'gameover'>('roam');

  const [currentEnemyId, setCurrentEnemyId] = useState<string>('SKELETON');
  const [deadEnemyIds, setDeadEnemyIds] = useState<Set<string>>(new Set());
  const combatCooldown = useRef(false);

  const currentThemeId = 'DUNGEON';

  const playerPosRef = useRef(new THREE.Vector3(3, 0, 25));

  const enemyTracker = useRef(new Map<string, { x: number; z: number }>());
  const discoveredEnemies = useRef(new Set<string>());

  // --- INVENTORY & NOTIFICATIONS ---
  const [inventory, setInventory] = useState<Item[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);

  const addNotification = (msg: string) => {
    setNotifications((prev) => [...prev.slice(-4), msg]);
    setTimeout(() => setNotifications((prev) => prev.slice(1)), 3000);
  };

  const [combatPhase, setCombatPhase] = useState<
    'player_turn' | 'player_acting' | 'enemy_turn' | 'enemy_acting' | 'victory' | 'defeat'
  >('player_turn');
  const [menuState, setMenuState] = useState<'main' | 'attack_select' | 'items'>('main');
  const [enemyHp, setEnemyHp] = useState(50);
  const [requestedAction, setRequestedAction] = useState<string | null>(null);

  const handleInteract = (x: number, z: number) => {
    // FIX: Check current state BEFORE updating to avoid double-notification side effects
    const tile = mapData[z][x];

    // 1. Pick up Key
    if (tile === TILE_TYPES.KEY_SILVER) {
      addNotification('Picked up Silver Key');
      setInventory((prev) => [...prev, { id: 'silver_key', name: 'Silver Key' }]);

      setMapData((prev) => {
        const newMap = prev.map((row) => [...row]);
        newMap[z][x] = TILE_TYPES.FLOOR_BASE;
        return newMap;
      });
      return;
    }

    // 2. Doors
    if (tile === TILE_TYPES.DOOR_CLOSED) {
      setMapData((prev) => {
        const newMap = prev.map((row) => [...row]);
        newMap[z][x] = TILE_TYPES.DOOR_OPEN;
        return newMap;
      });
    } else if (tile === TILE_TYPES.DOOR_OPEN) {
      setMapData((prev) => {
        const newMap = prev.map((row) => [...row]);
        newMap[z][x] = TILE_TYPES.DOOR_CLOSED;
        return newMap;
      });
    } else if (tile === TILE_TYPES.DOOR_LOCKED_SILVER) {
      const hasKey = inventory.some((item) => item.id === 'silver_key');
      if (hasKey) {
        addNotification('Unlocked with Silver Key');
        setMapData((prev) => {
          const newMap = prev.map((row) => [...row]);
          newMap[z][x] = TILE_TYPES.DOOR_OPEN;
          return newMap;
        });
      } else {
        addNotification('Locked (Requires Silver Key)');
      }
    }
  };

  const handleStep = (x: number, z: number) => {
    if (z < 0 || z >= mapData.length || x < 0 || x >= mapData[0].length) return;
    const tile = mapData[z][x];
    if (tile === TILE_TYPES.GOLD) {
      addNotification('Picked up Gold');
      setStats((prev) => ({ ...prev, gold: prev.gold + 10 }));
      setMapData((prev) => {
        const newMap = prev.map((row) => [...row]);
        newMap[z][x] = TILE_TYPES.FLOOR_BASE;
        return newMap;
      });
    }
  };

  const startCombat = (enemyId: string) => {
    if (combatCooldown.current) return;
    if (deadEnemyIds.has(enemyId)) return;

    const baseId = enemyId.split('-')[0].toUpperCase();
    setCurrentEnemyId(enemyId);
    setGameState('combat');
    setCombatPhase('player_turn');
    setMenuState('main');
    setEnemyHp(ENEMIES[baseId]?.stats.maxHp || 50);
    setRequestedAction(null);
  };

  const endCombat = (result: { victory: boolean; hpRemaining: number }) => {
    if (result.victory) {
      setStats((prev) => {
        const xpGained = 50;
        let newXp = prev.xp + xpGained;
        let newLevel = prev.level;
        let newMaxHp = prev.maxHp;
        let newAttack = prev.attack;
        if (newXp >= prev.nextLevelXp) {
          newLevel++;
          newXp = newXp - prev.nextLevelXp;
          newMaxHp += 20;
          newAttack += 5;
          addNotification('Level Up!');
        }
        return {
          ...prev,
          hp: result.hpRemaining,
          xp: newXp,
          level: newLevel,
          nextLevelXp: prev.nextLevelXp * 1.5,
          attack: newAttack,
          maxHp: newMaxHp,
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
      {/* --- INVENTORY & NOTIFICATIONS UI --- */}
      {gameState === 'roam' && (
        <div className="absolute bottom-5 right-5 text-white font-mono z-10 text-right pointer-events-none">
          {/* Inventory List */}
          <div className="mb-4">
            <h3 className="text-yellow-400 border-b border-gray-600 mb-1 text-sm uppercase">
              Inventory
            </h3>
            {inventory.length === 0 && <p className="text-gray-500 text-xs">- Empty -</p>}
            {inventory.map((item, i) => (
              <p key={i} className="text-xs text-gray-300">
                {item.name}
              </p>
            ))}
          </div>

          {/* Notifications Feed */}
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
      )}

      {/* --- EXISTING UI --- */}
      {gameState === 'combat' && (
        <CombatHud
          combatState={combatPhase}
          menuState={menuState}
          setMenuState={setMenuState}
          playerStats={stats}
          enemyHp={enemyHp}
          enemyMaxHp={ENEMIES[currentEnemyId.split('-')[0].toUpperCase()]?.stats.maxHp || 50}
          enemyName={ENEMIES[currentEnemyId.split('-')[0].toUpperCase()]?.name || 'Enemy'}
          onAction={handlePlayerAction}
          onLeave={(victory) => endCombat({ victory, hpRemaining: stats.hp })}
        />
      )}

      {gameState === 'roam' && (
        <>
          <div className="absolute top-5 left-5 text-white font-mono z-10 pointer-events-none">
            <p className="text-yellow-400 mb-2">WASD Move | E Interact</p>
            <div className="flex gap-4">
              <p className="text-xl font-bold text-red-500">
                HP: {stats.hp}/{stats.maxHp}
              </p>
              <p className="text-xl font-bold text-blue-500">LVL: {stats.level}</p>
              <p className="text-xl font-bold text-green-500">XP: {Math.floor(stats.xp)}</p>
              <p className="text-xl font-bold text-green-500">💰: {Math.floor(stats.gold)}</p>
            </div>
          </div>
          <Minimap
            map={mapData}
            playerPos={playerPosRef}
            enemyTracker={enemyTracker}
            discoveredEnemies={discoveredEnemies}
          />
        </>
      )}

      {gameState === 'gameover' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-50">
          <div className="text-center">
            <h1 className="text-6xl text-red-600 font-mono mb-4">YOU DIED</h1>
            <button
              className="px-6 py-3 bg-white text-black font-mono hover:bg-gray-200"
              onClick={() => window.location.reload()}
            >
              TRY AGAIN
            </button>
          </div>
        </div>
      )}

      <Canvas shadows camera={{ position: [0, 3, 2.5], fov: 50 }}>
        <color attach="background" args={[FOG_COLOR]} />
        <hemisphereLight color="#222244" groundColor="#000000" intensity={0.3} />

        {gameState === 'roam' ? (
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
            />
          </>
        ) : gameState === 'combat' ? (
          <CombatScene
            enemyId={currentEnemyId}
            themeId={currentThemeId}
            initialStats={stats}
            combatPhase={combatPhase}
            setCombatPhase={setCombatPhase}
            enemyHp={enemyHp}
            setEnemyHp={setEnemyHp}
            requestedAction={requestedAction}
            setRequestedAction={setRequestedAction}
            updatePlayerHp={(newHp) => setStats((s) => ({ ...s, hp: newHp }))}
          />
        ) : null}
      </Canvas>
    </div>
  );
}
export default App;
