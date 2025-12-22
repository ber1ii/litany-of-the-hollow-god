import { INITIAL_STATS } from '../types/GameTypes';
import type { InventoryItem } from '../types/GameTypes';
import { ITEM_REGISTRY } from '../data/ItemRegistry';
import { CLASSES } from '../data/Classes';
import { INITIAL_LEVEL_ID } from '../data/LevelRegistry';
import type { PlayerStats } from '../types/GameTypes';
import type { ClassId } from '../data/Classes';

export interface SaveData {
  stats: PlayerStats;
  inventory: InventoryItem[];
  currentLevelId: string;
  playerPos: { x: number; y: number; z: number };
  playerRotation: number;
  deadEnemyIds: string[];
  levelChanges: Record<string, Record<string, number>>;
  timestamp: number;
}

const LOCAL_STORAGE_KEY = 'LITANY_SAVE_SLOT_1';

export const SaveManager = {
  // --- FACTORY ---
  createFreshSave: (classId: ClassId): SaveData => {
    const classDef = CLASSES[classId];

    // Merge base stats with class stats
    const stats: PlayerStats = {
      ...INITIAL_STATS,
      ...classDef.baseStats,
      // Ensure Vitals match Max if not explicitly set
      hp: classDef.baseStats.maxHp || INITIAL_STATS.maxHp,
      mp: classDef.baseStats.maxMp || INITIAL_STATS.maxMp,
    };

    // Construct Inventory
    const inventory: InventoryItem[] = classDef.startingItems
      .map((startItem) => {
        const def = ITEM_REGISTRY[startItem.id];
        // Fallback if item missing in registry
        if (!def) console.warn(`Missing item registry for ${startItem.id}`);
        return {
          ...def,
          count: startItem.count,
        } as InventoryItem;
      })
      .filter((i) => i.id); // Filter out undefineds

    return {
      stats,
      inventory,
      currentLevelId: INITIAL_LEVEL_ID,
      playerPos: { x: 3, y: 0, z: 25 }, // Default spawn
      playerRotation: 0,
      deadEnemyIds: [],
      levelChanges: {},
      timestamp: Date.now(),
    };
  },

  // --- STORAGE ---
  saveGame: async (data: SaveData): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        console.log('Saving to LocalStorage...');
        const json = JSON.stringify(data);
        localStorage.setItem(LOCAL_STORAGE_KEY, json);
        setTimeout(() => {
          console.log('Save Complete.');
          resolve(true);
        }, 500);
      } catch (e) {
        console.error('Save Failed', e);
        resolve(false);
      }
    });
  },

  loadGame: async (): Promise<SaveData | null> => {
    return new Promise((resolve) => {
      try {
        const json = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!json) {
          resolve(null);
          return;
        }
        const data = JSON.parse(json) as SaveData;
        resolve(data);
      } catch (e) {
        console.error('Load Failed', e);
        resolve(null);
      }
    });
  },

  hasSave: (): boolean => {
    return !!localStorage.getItem(LOCAL_STORAGE_KEY);
  },

  // --- SERIALIZATION HELPERS ---
  serializeLevelChanges: (map: Map<string, Map<string, number>>) => {
    const obj: Record<string, Record<string, number>> = {};
    map.forEach((changes, levelId) => {
      obj[levelId] = {};
      changes.forEach((tileId, key) => {
        obj[levelId][key] = tileId;
      });
    });
    return obj;
  },

  deserializeLevelChanges: (obj: Record<string, Record<string, number>>) => {
    const map = new Map<string, Map<string, number>>();
    if (!obj) return map;

    Object.entries(obj).forEach(([levelId, changes]) => {
      const innerMap = new Map<string, number>();
      Object.entries(changes).forEach(([key, tileId]) => {
        innerMap.set(key, tileId);
      });
      map.set(levelId, innerMap);
    });
    return map;
  },
};
