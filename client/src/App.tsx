import { useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
// ... imports unchanged ...
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

preloadAllAssets();

// Define the atmospheric color once to ensure background and fog match perfectly.
// Using a very dark blue-grey instead of pure black for softer transitions.
const FOG_COLOR = '#080810';

function App() {
  // ... state setup unchanged ...
  const [mapData, setMapData] = useState(LEVEL_1_MAP);
  const [stats, setStats] = useState<PlayerStats>(INITIAL_STATS);
  const [gameState, setGameState] = useState<'roam' | 'combat' | 'gameover'>('roam');
  const [currentEnemyId, setCurrentEnemyId] = useState<string>('SKELETON');
  const currentThemeId = 'DUNGEON';
  const playerPosRef = useRef(new THREE.Vector3(0, 0, 0));

  const [combatPhase, setCombatPhase] = useState<
    'player_turn' | 'player_acting' | 'enemy_turn' | 'enemy_acting' | 'victory' | 'defeat'
  >('player_turn');
  const [menuState, setMenuState] = useState<'main' | 'attack_select' | 'items'>('main');
  const [enemyHp, setEnemyHp] = useState(50);
  const [requestedAction, setRequestedAction] = useState<string | null>(null);

  const currentEnemyDef = ENEMIES[currentEnemyId] || ENEMIES['SKELETON'];

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
    setCombatPhase('player_turn');
    setMenuState('main');
    setEnemyHp(ENEMIES[enemyId].stats.maxHp);
    setRequestedAction(null);
  };
  const endCombat = (result: { victory: boolean; hpRemaining: number }) => {
    if (result.victory) {
      // ... xp logic ...
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
        return { ...prev, hp: result.hpRemaining, xp: newXp };
      });
      setStats((prev) => ({ ...prev, hp: result.hpRemaining }));
      setGameState('roam');
    } else {
      setGameState('gameover');
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
      {/* ... Keep HUD and Menus unchanged ... */}
      {gameState === 'combat' && (
        <CombatHud
          combatState={combatPhase}
          menuState={menuState}
          setMenuState={setMenuState}
          playerStats={stats}
          enemyHp={enemyHp}
          enemyMaxHp={currentEnemyDef.stats.maxHp}
          enemyName={currentEnemyDef.name}
          onAction={handlePlayerAction}
          onLeave={(victory) => endCombat({ victory, hpRemaining: stats.hp })}
        />
      )}
      {gameState === 'roam' && (
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
        {/* 1. Matching Background Color */}
        <color attach="background" args={[FOG_COLOR]} />

        {/* 3. Lower ambient light to make shadows deeper and fog transition smoother */}
        <hemisphereLight color="#222244" groundColor="#000000" intensity={0.3} />

        {gameState === 'roam' ? (
          <>
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
