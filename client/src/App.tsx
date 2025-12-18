import { useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { AtlasFloor } from './components/Game/AtlasFloor';
import { PlayerController } from './components/Game/PlayerController';
import { preloadAllAssets } from './utils/assetUtils';
import * as THREE from 'three';
import { LevelBuilder } from './components/Game/LevelBuilder';
import { LEVEL_1_MAP, TILE_TYPES } from './components/Game/MapData';
import { CombatScene } from './components/Combat/CombatScene';
import { INITIAL_STATS } from './types/GameTypes';
import type { PlayerStats } from './types/GameTypes';

preloadAllAssets();

function App() {
  // 1. Lift Map State
  const [mapData, setMapData] = useState(LEVEL_1_MAP);
  const [stats, setStats] = useState<PlayerStats>(INITIAL_STATS);
  const [gameState, setGameState] = useState<'roam' | 'combat' | 'gameover'>('roam');
  const [currentEnemyId, setCurrentEnemyId] = useState<string>('SKELETON');
  const currentThemeId = 'DUNGEON';
  const playerPosRef = useRef(new THREE.Vector3(0, 0, 0));

  const fogArgs = gameState === 'combat' ? ['#050505', 10, 25] : ['#050505', 4, 12];

  // 2. Interaction Handler
  const handleInteract = (x: number, z: number) => {
    setMapData((prev) => {
      const newMap = prev.map((row) => [...row]);
      const tile = newMap[z][x];

      if (tile === TILE_TYPES.DOOR_CLOSED) {
        newMap[z][x] = TILE_TYPES.DOOR_OPEN;
      } else if (tile === TILE_TYPES.DOOR_OPEN) {
        newMap[z][x] = TILE_TYPES.DOOR_CLOSED;
      }
      return newMap;
    });
  };

  const handleStep = (x: number, z: number) => {
    if (z < 0 || z >= mapData.length || x < 0 || x >= mapData[0].length) return;

    const tile = mapData[z][x];

    if (tile === TILE_TYPES.GOLD) {
      // Update map (remove gold)
      setMapData((prev) => {
        const newMap = prev.map((row) => [...row]);
        newMap[z][x] = TILE_TYPES.FLOOR_BASE;
        return newMap;
      });

      setStats((prev) => ({ ...prev, gold: prev.gold + 10 }));
    }
  };

  const startCombat = (enemyId = 'SKELETON') => {
    setCurrentEnemyId(enemyId);
    setGameState('combat');
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

          return {
            ...prev,
            maxHp: newMaxHp,
            xp: newXp,
            level: newLevel,
            nextLevelXp: prev.nextLevelXp * 1.5,
            attack: newAttack,
          };
        }

        return {
          ...prev,
          hp: result.hpRemaining,
          xp: newXp,
        };
      });
      setGameState('roam');
    } else {
      setGameState('gameover');
    }
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
      {/* HUD */}
      <div className="absolute top-5 left-5 text-white font-mono z-10 pointer-events-none">
        {gameState === 'roam' && (
          <>
            <p className="text-yellow-400 mb-2">WASD Move | E Interact</p>
            <div className="flex gap-4">
              <p className="text-xl font-bold text-red-500">
                HP: {stats.hp}/{stats.maxHp}
              </p>
              <p className="text-xl font-bold text-blue-500">LVL: {stats.level}</p>
              <p className="text-xl font-bold text-green-500">XP: {Math.floor(stats.xp)}</p>
              <p className="text-xl font-bold text-green-500">💰: {Math.floor(stats.gold)}</p>
            </div>
          </>
        )}
      </div>

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
        <color attach="background" args={['#050505']} />
        <fog attach="fog" args={fogArgs as [string, number, number]} />
        <hemisphereLight color="#222244" groundColor="#050505" intensity={0.8} />

        {gameState === 'roam' ? (
          <>
            {/* LAYER 2: Decorative Atlas Patches */}
            <AtlasFloor map={mapData} />

            <LevelBuilder map={mapData} playerPos={playerPosRef} onCombatStart={startCombat} />
            <PlayerController
              map={mapData}
              onInteract={handleInteract}
              onStep={handleStep}
              playerRef={playerPosRef}
            />
          </>
        ) : gameState === 'combat' ? (
          <CombatScene
            onBattleEnd={endCombat}
            initialStats={stats}
            enemyId={currentEnemyId}
            themeId={currentThemeId}
          />
        ) : null}
      </Canvas>
    </div>
  );
}

export default App;
