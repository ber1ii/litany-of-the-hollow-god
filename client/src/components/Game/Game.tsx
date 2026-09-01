import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { AtlasFloor } from './AtlasFloor';
import { PlayerController } from './PlayerController';
import * as THREE from 'three';
import { LevelBuilder } from './LevelBuilder';
import { TILE_TYPES, TILE_SIZE, PLAYER_SPAWN } from './MapData';
import { CombatScene } from '../Combat/CombatScene';
import { CombatHud } from '../Combat/CombatHud';
import type { InventoryItem } from '../../types/GameTypes';
import { ITEM_REGISTRY } from '../../data/ItemRegistry';
import { getTileDef } from '../../data/TileRegistry';
import { InventoryMenu } from '../UI/InventoryMenu';
import { BonfireMenu } from '../UI/BonfireMenu';
import { LevelUpMenu } from '../UI/LevelUpMenu';
import { LEVEL_REGISTRY, INITIAL_LEVEL_ID } from '../../data/LevelRegistry';
import { SaveManager } from '../../utils/SaveManager';
import type { SaveData } from '../../utils/SaveManager';
import { SkillTree } from '../UI/SkillTree';
import { EquipmentMenu } from '../UI/EquipmentMenu';
import { SanityEffects } from '../Effects/SanityEffects';
import { HUD } from '../UI/HUD';
import { usePlayerStore } from '../../hooks/usePlayerStore';
import { Minimap } from './Minimap';
import { DeathScreen } from '../UI/DeathScreen';
import { AudioManager } from '../../managers/AudioManager';
import { InteractPrompt } from './InteractPrompt';

const FOG_COLOR = '#040408';

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
  // Store Subscriptions
  const stats = usePlayerStore((state) => state.stats);
  const inventory = usePlayerStore((state) => state.inventory);
  const initializeFromSave = usePlayerStore((state) => state.initializeFromSave);
  const consumeItem = usePlayerStore((state) => state.consumeItem);
  const equipItem = usePlayerStore((state) => state.equipItem);
  const addItem = usePlayerStore((state) => state.addItem);
  const removeItem = usePlayerStore((state) => state.removeItem);
  const restAtBonfire = usePlayerStore((state) => state.restAtBonfire);
  const addRewards = usePlayerStore((state) => state.addRewards);
  const unlockSkill = usePlayerStore((state) => state.purchaseSkill);
  const setStats = usePlayerStore((state) => state.setStats);

  const [currentLevelId] = useState(
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

  // Initialize Store on Mount
  useEffect(() => {
    if (initialSaveData) {
      initializeFromSave(initialSaveData.stats, initialSaveData.inventory);
    } else {
      initializeFromSave(usePlayerStore.getState().stats, [
        { ...ITEM_REGISTRY['flask_crimson'], count: 3 },
        { ...ITEM_REGISTRY['flask_cerulean'], count: 2 },
      ]);
    }
  }, [initialSaveData, initializeFromSave]);

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
      : new THREE.Vector3(PLAYER_SPAWN.x * TILE_SIZE, 0, PLAYER_SPAWN.z * TILE_SIZE)
  );

  const playerRotationRef = useRef(initialSaveData ? initialSaveData.playerRotation : 0);

  const [gameState, setGameState] = useState<
    'roam' | 'combat' | 'gameover' | 'combat_transition' | 'resting'
  >('roam');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const [currentEnemyId, setCurrentEnemyId] = useState<string>('SKELETON');

  const chasingEnemyIds = useRef<Set<string>>(new Set());
  const [isPlayerChased, setIsPlayerChased] = useState(false);
  const handleEnemyChaseChange = (enemyId: string, isChasing: boolean) => {
    if (isChasing) chasingEnemyIds.current.add(enemyId);
    else chasingEnemyIds.current.delete(enemyId);
    setIsPlayerChased(chasingEnemyIds.current.size > 0);
  };
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
  const [isEquipmentMenuOpen, setEquipmentMenuOpen] = useState(false);
  const [canInteract, setCanInteract] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    AudioManager.playAmbient('ambiance-water-drip-long');

    const eerieKeys = ['eerie_creak', 'eerie_highpitch', 'eerie_whoosh'];
    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleStinger = () => {
      timeoutId = setTimeout(
        () => {
          if (gameStateRef.current === 'roam') {
            const key = eerieKeys[Math.floor(Math.random() * eerieKeys.length)];
            AudioManager.play(key, { category: 'ambient' });
          }
          scheduleStinger();
        },
        8000 + Math.random() * 15000
      );
    };
    scheduleStinger();

    return () => {
      clearTimeout(timeoutId);
      AudioManager.stopAmbient();
    };
  }, []);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleCough = () => {
      timeoutId = setTimeout(
        () => {
          const currentStats = usePlayerStore.getState().stats;
          const hpRatio = currentStats.hp / currentStats.maxHp;
          if (gameStateRef.current === 'roam' && hpRatio > 0 && hpRatio < 0.25) {
            AudioManager.play('low_hp_cough', { category: 'sfx' });
          }
          scheduleCough();
        },
        10000 + Math.random() * 12000
      );
    };
    scheduleCough();

    return () => clearTimeout(timeoutId);
  }, []);

  const SANITY_STINGER_FALLBACK_MS = 18500;
  const sanitySoundLockRef = useRef(false);
  const prevSanityRef = useRef(stats.sanity);
  useEffect(() => {
    if (stats.sanity < prevSanityRef.current && !sanitySoundLockRef.current) {
      sanitySoundLockRef.current = true;
      const clearLock = () => {
        sanitySoundLockRef.current = false;
      };
      const source = AudioManager.play('sanity-going-down', { category: 'sfx' });
      if (source) {
        source.onended = clearLock;
      } else {
        setTimeout(clearLock, SANITY_STINGER_FALLBACK_MS);
      }
    }
    prevSanityRef.current = stats.sanity;
  }, [stats.sanity]);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        if (gameState === 'roam' && !isBonfireMenuOpen && !isSkillTreeOpen && !isLevelUpOpen) {
          setInventoryOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, isBonfireMenuOpen, isSkillTreeOpen, isLevelUpOpen]);

  const handleRest = async () => {
    setBonfireMenuOpen(false);
    setGameState('resting');

    restAtBonfire(
      currentLevelId,
      { x: playerPosRef.current.x, y: playerPosRef.current.y, z: playerPosRef.current.z },
      playerRotationRef.current
    );

    AudioManager.play('divine-blessing', { category: 'sfx' });

    setDeadEnemyIds(new Set());
    if (enemyTracker.current) enemyTracker.current.clear();
    chasingEnemyIds.current.clear();
    setIsPlayerChased(false);

    setTimeout(() => setGameState('roam'), 1000);
    addNotification('Restored Health, Mind & Flasks.');

    setIsSaving(true);
    const success = await SaveManager.saveGame({
      stats: usePlayerStore.getState().stats,
      inventory: usePlayerStore.getState().inventory,
      currentLevelId: currentLevelId,
      playerPos: {
        x: playerPosRef.current.x,
        y: playerPosRef.current.y,
        z: playerPosRef.current.z,
      },
      playerRotation: playerRotationRef.current,
      deadEnemyIds: [],
      levelChanges: SaveManager.serializeLevelChanges(levelChanges.current),
      timestamp: Date.now(),
    });

    setIsSaving(false);
    if (success) addNotification('Game Saved.');
    else addNotification('Error Saving Game.');
  };

  const handleUseItem = (item: InventoryItem) => {
    if (item.type === 'consumable' || item.type === 'flask') {
      const success = consumeItem(item.id);
      if (success) {
        AudioManager.play('flask-open', { category: 'sfx' });
        AudioManager.play('flask-drink', { category: 'sfx' });
        addNotification(`Used ${item.name}`);
      } else {
        addNotification(`Cannot use ${item.name}`);
      }
    } else if (item.type === 'weapon') {
      AudioManager.play('equip-weapon', { category: 'sfx' });
      equipItem(item.id);
      addNotification(`Equipped ${item.name}`);
    }
  };

  const handleRespawn = () => {
    AudioManager.play('divine-blessing', { category: 'sfx' });
    const store = usePlayerStore.getState();
    store.respawn();

    setDeadEnemyIds(new Set());
    if (enemyTracker.current) enemyTracker.current.clear();
    chasingEnemyIds.current.clear();
    setIsPlayerChased(false);

    if (store.lastRestedPos) {
      playerPosRef.current.set(store.lastRestedPos.x, store.lastRestedPos.y, store.lastRestedPos.z);
      playerRotationRef.current = store.lastRestedRot;
    } else {
      playerPosRef.current.set(PLAYER_SPAWN.x * TILE_SIZE, 0, PLAYER_SPAWN.z * TILE_SIZE);
      playerRotationRef.current = 0;
    }

    setGameState('roam');
    addNotification('Awakened at the Bonfire.');
  };

  const handleInteract = (x: number, z: number) => {
    const tileId = mapData[z][x];
    const tileDef = getTileDef(tileId);

    if (tileId === TILE_TYPES.BONFIRE) {
      setBonfireMenuOpen(true);
      return;
    }

    if (tileId === TILE_TYPES.DOOR_CLOSED) {
      AudioManager.play('door-open', { category: 'sfx' });
      updateMapTile(x, z, TILE_TYPES.DOOR_OPEN);
      addNotification('Door opened.');
      return;
    }

    if (tileId === TILE_TYPES.DOOR_OPEN) {
      const pGridX = Math.round(playerPosRef.current.x / TILE_SIZE);
      const pGridZ = Math.round(playerPosRef.current.z / TILE_SIZE);
      const isStandingInDoor = pGridX === x && pGridZ === z;
      if (isStandingInDoor) {
        addNotification("Can't close a door you're standing in.");
      } else {
        AudioManager.play('door-close', { category: 'sfx' });
        updateMapTile(x, z, TILE_TYPES.DOOR_CLOSED);
        addNotification('Door closed.');
      }
      return;
    }

    if (tileId === TILE_TYPES.DOOR_LOCKED_SILVER) {
      const hasKey = inventory.some((i) => i.id === 'silver_key');
      if (hasKey) {
        removeItem('silver_key');
        AudioManager.play('unlock-door', { category: 'sfx' });
        updateMapTile(x, z, TILE_TYPES.DOOR_OPEN);
        addNotification('Unlocked door with Silver Key.');
      } else {
        addNotification('Locked. Need Silver Key.');
      }
      return;
    }

    if (tileId === TILE_TYPES.GOLD) {
      const GOLD_PICKUP_AMOUNT = 25;
      AudioManager.play('collect-coin', { category: 'sfx' });
      addRewards(0, GOLD_PICKUP_AMOUNT);
      addNotification(`Picked up ${GOLD_PICKUP_AMOUNT} Gold.`);
      updateMapTile(x, z, TILE_TYPES.FLOOR_BASE);
      return;
    }

    if (tileDef.type === 'item' && tileDef.itemId) {
      const item = ITEM_REGISTRY[tileDef.itemId];
      if (item) {
        AudioManager.play(item.type === 'weapon' ? 'equip-weapon' : 'pick-up-talisman', {
          category: 'sfx',
        });
        addNotification(`Picked up ${item.name}`);
        addItem(item, 1);
        updateMapTile(x, z, TILE_TYPES.FLOOR_BASE);
      }
      return;
    }
  };

  const endCombat = (result: { victory: boolean; hpRemaining: number }) => {
    if (result.victory) {
      addRewards(50, 20);
      setDeadEnemyIds((prev) => new Set(prev).add(currentEnemyId));
      if (enemyTracker.current) enemyTracker.current.delete(currentEnemyId);
      setGameState('roam');
    } else {
      if (stats.hp > 0) {
        setGameState('roam');
        combatCooldown.current = true;
        setTimeout(() => {
          combatCooldown.current = false;
        }, 2000);
      } else {
        AudioManager.play('player-death', { category: 'sfx' });
        AudioManager.play('player-death-drop-sword', { category: 'sfx' });
        setGameState('gameover');
      }
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
      <style>{overlayStyle}</style>

      {isSaving && (
        <div className="absolute top-4 right-4 z-50 font-mono text-xs text-amber-400 bg-black/80 px-3 py-1 border border-amber-500/50 rounded animate-pulse">
          Saving...
        </div>
      )}

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
          onManageEquipment={() => {
            setBonfireMenuOpen(false);
            setEquipmentMenuOpen(true);
          }}
        />
      )}

      {isEquipmentMenuOpen && (
        <EquipmentMenu
          stats={stats}
          inventory={inventory}
          onClose={() => setEquipmentMenuOpen(false)}
        />
      )}

      {isLevelUpOpen && (
        <LevelUpMenu
          stats={stats}
          onClose={() => setLevelUpOpen(false)}
          onConfirm={(newStats) => {
            setStats(newStats);
            setLevelUpOpen(false);
            handleRest();
          }}
        />
      )}

      {isSkillTreeOpen && (
        <SkillTree
          stats={stats}
          onUnlock={(skillId) => unlockSkill(skillId)}
          onClose={() => setSkillTreeOpen(false)}
        />
      )}

      {gameState === 'roam' &&
        !isInventoryOpen &&
        !isBonfireMenuOpen &&
        !isLevelUpOpen &&
        !isSkillTreeOpen && <HUD stats={stats} notifications={notifications} />}

      {gameState === 'roam' &&
        canInteract &&
        !isInventoryOpen &&
        !isBonfireMenuOpen &&
        !isLevelUpOpen &&
        !isSkillTreeOpen && <InteractPrompt />}

      {gameState === 'gameover' && <DeathScreen onRespawn={handleRespawn} />}

      {gameState === 'combat' && (
        <CombatHud
          onLeave={(victory) => endCombat({ victory, hpRemaining: stats.hp })}
          inventory={inventory}
        />
      )}

      {(gameState === 'roam' || gameState === 'resting') && (
        <Minimap
          map={mapData}
          playerPos={playerPosRef}
          playerRotation={playerRotationRef}
          enemyTracker={enemyTracker}
        />
      )}

      <Canvas
        shadows
        dpr={[1, 1.5]}
        performance={{ min: 0.5 }}
        camera={{ position: [0, 3, 2.5], fov: 50, near: 0.01 }}
      >
        <color attach="background" args={[FOG_COLOR]} />
        {gameState !== 'combat' && <fog attach="fog" args={['#000000', 5, 12]} />}
        <hemisphereLight color="#222244" groundColor="#000000" intensity={0.2} />

        <SanityEffects sanity={stats.sanity} maxSanity={stats.maxSanity} />
        {gameState !== 'combat' && <AbyssPlane />}

        {gameState === 'roam' || gameState === 'combat_transition' || gameState === 'resting' ? (
          <>
            <AtlasFloor map={mapData} />
            <LevelBuilder
              map={mapData}
              playerPos={playerPosRef}
              onCombatStart={(id) => {
                chasingEnemyIds.current.delete(id);
                setIsPlayerChased(chasingEnemyIds.current.size > 0);
                setCurrentEnemyId(id);
                setGameState('combat');
              }}
              enemyTracker={enemyTracker}
              deadEnemyIds={deadEnemyIds}
              onEnemyChaseChange={handleEnemyChaseChange}
              enemiesActive={!isBonfireMenuOpen && !isSkillTreeOpen && !isLevelUpOpen}
            />
            <PlayerController
              map={mapData}
              onInteract={handleInteract}
              onInteractableChange={setCanInteract}
              onStep={() => {}}
              isChased={isPlayerChased}
              playerRef={playerPosRef}
              playerRotRef={playerRotationRef}
              active={
                gameState === 'roam' && !isInventoryOpen && !isBonfireMenuOpen && !isSkillTreeOpen
              }
            />
          </>
        ) : gameState === 'combat' ? (
          <CombatScene
            key={currentEnemyId}
            enemyId={currentEnemyId}
            themeId={currentThemeId}
            initialStats={stats}
            onDefeat={() => endCombat({ victory: false, hpRemaining: 0 })}
            onFlee={() => endCombat({ victory: false, hpRemaining: stats.hp })}
          />
        ) : null}
      </Canvas>
    </div>
  );
};
