import { useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { DungeonFloor } from './components/Game/DungeonFloor';
import { PlayerController } from './components/Game/PlayerController';
import { preloadAllAssets } from './utils/assetUtils';
import * as THREE from 'three';
import { LevelBuilder } from './components/Game/LevelBuilder';
import { LEVEL_1_MAP, TILE_TYPES } from './components/Game/MapData';
import { CombatScene } from './components/Combat/CombatScene';

preloadAllAssets();

function App() {
  // 1. Lift Map State
  const [mapData, setMapData] = useState(LEVEL_1_MAP);
  const [goldCount, setGoldCount] = useState(0);

  const [gameState, setGameState] = useState<'roam' | 'combat'>('roam');

  const playerPosRef = useRef(new THREE.Vector3(0, 0, 0));

  // 2. Interaction Handler
  const handleInteract = (x: number, z: number) => {
    setMapData((prev) => {
      const newMap = prev.map((row) => [...row]);
      const tile = newMap[z][x];

      if (tile === TILE_TYPES.DOOR_CLOSED) {
        newMap[z][x] = TILE_TYPES.DOOR_OPEN;
        // Optional: Play sound here
      } else if (tile === TILE_TYPES.DOOR_OPEN) {
        newMap[z][x] = TILE_TYPES.DOOR_CLOSED;
      }
      return newMap;
    });
  };

  const handlStep = (x: number, z: number) => {
    if (z < 0 || z >= mapData.length || x < 0 || x >= mapData[0].length) return;

    const tile = mapData[z][x];

    if (tile === TILE_TYPES.GOLD) {
      // Update map (remove gold)
      setMapData((prev) => {
        const newMap = prev.map((row) => [...row]);
        newMap[z][x] = TILE_TYPES.FLOOR;
        return newMap;
      });

      setGoldCount((c) => c + 1);
      console.log('Gold collected!');
    }
  };

  const startCombat = () => {
    console.log('Entering combat...');
    setGameState('combat');
  };

  const endCombat = (victory: boolean) => {
    setGameState('roam');
    if (victory) console.log('Enemy defeated');
  };

  return (
    // Force full screen and no scroll
    <div style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden' }}>
      {/* UI Layer: Changes based on State */}
      <div className="absolute top-5 left-5 text-white font-mono z-10 pointer-events-none">
        {gameState === 'roam' && (
          <>
            <p className="text-yellow-400 mb-2">WASD Move | E Interact</p>
            <p className="text-2xl font-bold text-yellow-500">GOLD: {goldCount}</p>
          </>
        )}
      </div>

      <Canvas shadows camera={{ position: [0, 3, 2], fov: 50 }}>
        <color attach="background" args={['#050505']} />
        <hemisphereLight color="#222244" groundColor="#050505" intensity={0.5} />

        {/* CONDITIONAL RENDERING */}
        {gameState === 'roam' ? (
          <>
            <DungeonFloor />
            {/* Pass startCombat to LevelBuilder -> Monster */}
            <LevelBuilder map={mapData} playerPos={playerPosRef} onCombatStart={startCombat} />
            <PlayerController
              map={mapData}
              onInteract={handleInteract}
              onStep={handlStep}
              playerRef={playerPosRef}
            />
          </>
        ) : (
          <CombatScene onBattleEnd={endCombat} />
        )}
      </Canvas>
    </div>
  );
}

export default App;
