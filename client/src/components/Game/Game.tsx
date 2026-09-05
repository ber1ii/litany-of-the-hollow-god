import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { PlayerController } from './PlayerController';
import * as THREE from 'three';
import { LevelBuilder } from './LevelBuilder';
import { TILE_TYPES, TILE_SIZE, LEVEL_1_ASCII, LEVEL_2_ASCII } from './MapData';
import { CombatScene } from '../Combat/CombatScene';
import { CombatHud } from '../Combat/CombatHud';
import type { InventoryItem } from '../../types/GameTypes';
import { ITEM_REGISTRY } from '../../data/ItemRegistry';
import { getTileDef } from '../../data/TileRegistry';
import { buildStructureFootprint, getEffectiveTileId } from '../../utils/StructureFootprint';
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
import { getSignData, type SignEntry } from '../../data/SignData';
import { SignDialog } from './SignDialog';
import { getSpawnPosition, getMarkerCenter } from '../../utils/MapParser';
import { WallUniformDriver } from './SmartWall';
import { getVisibleChunkKeys } from '../../utils/ChunkUtils';
import { ChaseEventController } from './ChaseEventController';
import { tileEventBus } from '../../utils/TileEventBus';

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

const ASCII_MAPS: Record<string, string[]> = {
  LEVEL_1: LEVEL_1_ASCII,
  LEVEL_2: LEVEL_2_ASCII,
};

const getInitialSpawnForLevel = (levelId: string) => {
  // Dynamically pull the correct ASCII map based on the ID, fallback to Level 1
  const asciiMap = ASCII_MAPS[levelId] || LEVEL_1_ASCII;

  // This correctly applies centering offsets and world coordinates for all levels
  return getSpawnPosition(asciiMap, TILE_SIZE);
};

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

  const [currentLevelId, setCurrentLevelId] = useState(
    initialSaveData ? initialSaveData.currentLevelId : INITIAL_LEVEL_ID
  );

  const [activeSign, setActiveSign] = useState<SignEntry | null>(null);
  const [isCinematic, setIsCinematic] = useState(false);
  // Reserved for the sword-drop mask/visual treatment planned for later —
  // for now it also flips true on the same event, but the sword's actual
  // removal from inventory below is independent of this flag.
  const [isSwordless /*setIsSwordless*/] = useState(false);
  const [showPanicPrompt, setShowPanicPrompt] = useState(false);

  const [chaseFov, setChaseFov] = useState(50);
  const WIDE_CHASE_FOV = 68;

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

  // Structure footprint for the current map — lets handleInteract resolve
  // any cell inside a multi-tile structure (e.g. dark_archway's 5x6
  // footprint) to that structure's tile id, not just its anchor cell.
  const footprint = useMemo(() => buildStructureFootprint(mapData), [mapData]);

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
      : getInitialSpawnForLevel(INITIAL_LEVEL_ID)
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
  const [isBossChaseActive, setIsBossChaseActive] = useState(false);
  const [boulderObstacle, setBoulderObstacle] = useState<{
    x: number;
    z: number;
    radius: number;
  } | null>(null);
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

  const [visibleChunkKeys, setVisibleChunkKeys] = useState<Set<string>>(() => new Set());

  const handleStep = useCallback(() => {
    if (!playerPosRef.current) return;
    setVisibleChunkKeys((prevKeys) =>
      getVisibleChunkKeys(playerPosRef.current.x, playerPosRef.current.z, 2, 3, prevKeys)
    );
  }, []);

  useEffect(() => {
    if (playerPosRef.current) {
      setVisibleChunkKeys(
        getVisibleChunkKeys(playerPosRef.current.x, playerPosRef.current.z, 2, 3)
      );
    }
  }, [currentLevelId]);

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

  // Remove mapVersion entirely — no longer needed.

  const updateMapTile = (x: number, z: number, newTileId: number) => {
    const oldTileId = mapData[z][x];
    if (oldTileId === newTileId) return;

    setMapData((prev) => {
      const newMap = [...prev]; // shallow clone of row array — O(height), cheap
      newMap[z] = [...prev[z]]; // clone only the touched row — O(width), cheap
      newMap[z][x] = newTileId;
      return newMap;
    });

    tileEventBus.emit(x, z, oldTileId, newTileId); // side effect stays outside the updater
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'e' && activeSign) {
        setActiveSign(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSign]);

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
    setBoulderObstacle(null);

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
    setBoulderObstacle(null);

    if (store.lastRestedPos) {
      playerPosRef.current.set(store.lastRestedPos.x, store.lastRestedPos.y, store.lastRestedPos.z);
      playerRotationRef.current = store.lastRestedRot;
    } else {
      // Dynamically grab the spawn for whatever map the player died on
      const spawnPoint = getInitialSpawnForLevel(currentLevelId);
      playerPosRef.current.copy(spawnPoint);
      playerRotationRef.current = 0;
    }

    setGameState('roam');
    addNotification('Awakened at the Bonfire.');
  };

  const handleInteract = (x: number, z: number) => {
    // Resolve via the structure footprint, not the raw map cell — a
    // multi-tile structure like dark_archway only has its id written at
    // its anchor cell, but PlayerController may hand us the coordinates of
    // any cell inside its footprint (e.g. the doorway edge facing the
    // room), so we need the same footprint-aware lookup here to match it
    // back to the structure correctly.
    const tileId = getEffectiveTileId(mapData, footprint, x, z);
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

    if (tileDef.type === 'prop' && tileId === TILE_TYPES.SIGN) {
      const data = getSignData(x, z);
      if (data) setActiveSign(data);
      return;
    }

    if (tileId === TILE_TYPES.ARCH_DARK) {
      // Toggle target level dynamically
      const nextLevelId = currentLevelId === 'LEVEL_1' ? 'LEVEL_2' : 'LEVEL_1';
      const baseMap = LEVEL_REGISTRY[nextLevelId];

      if (baseMap) {
        // Clone base map and re-apply stored map modifications for target level
        const nextMap = baseMap.map((row) => [...row]);
        const targetChanges = levelChanges.current.get(nextLevelId);
        if (targetChanges) {
          targetChanges.forEach((tId, key) => {
            const [x, z] = key.split(',').map(Number);
            if (nextMap[z] && nextMap[z][x] !== undefined) {
              nextMap[z][x] = tId;
            }
          });
        }

        setMapData(nextMap);
        setCurrentLevelId(nextLevelId);

        // Resolve spawn position for target map
        const spawnPos = getInitialSpawnForLevel(nextLevelId);
        playerPosRef.current.copy(spawnPos);

        // Reset local runtime level state
        setDeadEnemyIds(new Set());
        enemyTracker.current.clear();
        chasingEnemyIds.current.clear();
        setIsPlayerChased(false);
        setBoulderObstacle(null);
        playerRotationRef.current = 0;

        addNotification(
          nextLevelId === 'LEVEL_2' ? 'Entering Level 2...' : 'Returning to Level 1...'
        );
      }
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
      const GOLD_PICKUP_AMOUNT = 125;
      AudioManager.play('collect-coin', { category: 'sfx' });
      addRewards(0, GOLD_PICKUP_AMOUNT);
      addNotification(`Picked up ${GOLD_PICKUP_AMOUNT} Gold.`);
      updateMapTile(x, z, TILE_TYPES.BASE_FLOOR);
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
        updateMapTile(x, z, TILE_TYPES.BASE_FLOOR);
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

  const trigger1Pos = useMemo(
    () => getMarkerCenter(LEVEL_2_ASCII, '!') ?? new THREE.Vector3(281.75, 0, 42),
    []
  );
  const trigger2Pos = useMemo(
    () => getMarkerCenter(LEVEL_2_ASCII, '*') ?? new THREE.Vector3(331.25, 0, 12),
    []
  );

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

      {gameState === 'roam' && activeSign && (
        <SignDialog sign={activeSign} onClose={() => setActiveSign(null)} />
      )}

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

      {showPanicPrompt && (
        <div className="absolute inset-x-0 top-1/3 text-center pointer-events-none z-50">
          <p className="font-mono text-red-600 text-xl tracking-widest bg-black/80 inline-block px-4 py-2 border border-red-900 animate-pulse">
            Our hero drops his sword in panic
          </p>
        </div>
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

        {!isCinematic && <SanityEffects sanity={stats.sanity} maxSanity={stats.maxSanity} />}
        {gameState !== 'combat' && <AbyssPlane />}

        {gameState === 'roam' || gameState === 'combat_transition' || gameState === 'resting' ? (
          <>
            <LevelBuilder
              key={`builder-${currentLevelId}`}
              map={mapData}
              playerPos={playerPosRef}
              visibleChunkKeys={visibleChunkKeys}
              onCombatStart={(id: string) => {
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
            <WallUniformDriver playerPos={playerPosRef} />
            <PlayerController
              key={`player-${currentLevelId}`}
              map={mapData}
              onInteract={handleInteract}
              onInteractableChange={setCanInteract}
              isSwordless={isSwordless}
              onStep={handleStep}
              isChased={isPlayerChased || isBossChaseActive}
              extraObstacles={boulderObstacle ? [boulderObstacle] : undefined}
              playerRef={playerPosRef}
              playerRotRef={playerRotationRef}
              targetFov={chaseFov}
              active={
                gameState === 'roam' &&
                !isCinematic &&
                !isInventoryOpen &&
                !isBonfireMenuOpen &&
                !isSkillTreeOpen &&
                !activeSign
              }
            />
            {/* Mounted AFTER PlayerController so, at the shared default
                priority-0, its useFrame runs second each frame — see the
                note in ChaseEventController.tsx for why priority is no
                longer used for this. */}
            {currentLevelId === 'LEVEL_2' && (
              <ChaseEventController
                key={`chase-${currentLevelId}`} // forces remount/reset if level changes mid-event
                playerRef={playerPosRef}
                map={mapData}
                playerRotRef={playerRotationRef}
                trigger1Pos={trigger1Pos}
                trigger2Pos={trigger2Pos}
                onPlayerCaught={() => {
                  AudioManager.play('player-death', { category: 'sfx' });
                  setGameState('gameover');
                }}
                onCinematicStart={() => setIsCinematic(true)}
                onCinematicEnd={() => setIsCinematic(false)}
                onSetSwordless={(val) => {
                  //setIsSwordless(val);
                  // The chase event fires this once (val=true) the moment
                  // the hero panics and drops his sword — actually remove
                  // it from inventory here. NOTE: 'rusty_sword' is a guess
                  // at the item id in ItemRegistry.ts — swap this for the
                  // real key if it differs.
                  if (val) {
                    removeItem('rusty_sword');
                    addNotification('You dropped your sword!');
                  }
                }}
                onShowPanicPrompt={setShowPanicPrompt}
                onSetChaseFov={(active) => setChaseFov(active ? WIDE_CHASE_FOV : 50)}
                onChaseActiveChange={setIsBossChaseActive}
                onBoulderLanded={(pos) => setBoulderObstacle({ x: pos.x, z: pos.z, radius: 1.3 })}
              />
            )}
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
