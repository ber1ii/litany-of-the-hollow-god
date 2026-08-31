import { create } from 'zustand';
import type { PlayerStats, InventoryItem } from '../types/GameTypes';
import { INITIAL_STATS } from '../types/GameTypes';
import { SKILL_TREE } from '../data/SkillTreeData';
import type { ItemDef } from '../data/ItemRegistry';

export type LevelingStat =
  'vitality' | 'strength' | 'dexterity' | 'intelligence' | 'mind' | 'agility';

// Single source of truth for the gold cost of the next level, shared by
// the store's commit action and LevelUpMenu's live preview — previously
// this formula was duplicated in the component only, so it could silently
// drift from whatever the store ended up doing.
export const getLevelUpCost = (currentLevel: number) =>
  Math.floor(100 * Math.pow(1.1, currentLevel - 1));

// Applies `points` (positive to invest, negative to refund) of a single
// leveling stat to a PlayerStats object, including secondary derived
// effects (vitality -> maxHp, strength -> attack). Pure function so it can
// be reused for both the uncommitted local preview in LevelUpMenu and the
// real commit in applyLevelUpAllocation below, guaranteeing they match.
export const applyStatPoints = (
  stats: PlayerStats,
  stat: LevelingStat,
  points: number
): PlayerStats => {
  const next = { ...stats };
  switch (stat) {
    case 'vitality':
      next.vitality += points;
      next.maxHp += points * 10;
      break;
    case 'strength':
      next.strength += points;
      next.attack += points * 2;
      break;
    case 'dexterity':
      next.dexterity += points;
      break;
    case 'intelligence':
      next.intelligence += points;
      break;
    case 'mind':
      next.mind += points;
      next.maxMp += points * 5;
      break;
    case 'agility':
      next.agility += points;
      break;
  }
  return next;
};

interface PlayerStore {
  stats: PlayerStats;
  inventory: InventoryItem[];
  equippedWeaponId: string;
  notifications: string[];
  lastRestedBonfireId: string | null;
  lastRestedPos: { x: number; y: number; z: number } | null;
  lastRestedRot: number;

  restAtBonfire: (
    bonfireId?: string,
    pos?: { x: number; y: number; z: number },
    rot?: number
  ) => void;
  respawn: () => void;

  // Initializers & System Sync
  initializeFromSave: (stats: PlayerStats, inventory: InventoryItem[]) => void;

  // Generic stats setter — still useful as an escape hatch for menus that
  // need to write several unrelated fields at once. Prefer a dedicated
  // action (applyLevelUpAllocation, equipSkills, purchaseSkill, ...) when
  // one already covers the case.
  setStats: (stats: PlayerStats | ((prev: PlayerStats) => PlayerStats)) => void;

  // Notifications (toast-style messages shown in the HUD)
  addNotification: (msg: string) => void;
  clearNotifications: () => void;

  // Inventory & Item Actions
  addItem: (itemDef: ItemDef, count?: number) => void;
  consumeItem: (itemId: string) => boolean;
  equipItem: (itemId: string) => void;
  // Removes an item from the inventory outright (e.g. a key spent to
  // unlock a door), regardless of stack count. Use consumeItem instead
  // for anything with a heal/restore effect or flask charges.
  removeItem: (itemId: string) => void;

  // Combat & Vitals Mutations
  modifyHp: (amount: number) => void;
  modifyMp: (amount: number) => void;
  modifySanity: (amount: number) => void;
  addRewards: (xp: number, gold: number) => void;

  // Progression
  // Commits a batch of leveling-stat purchases in one atomic write — used
  // by LevelUpMenu once the player confirms their staged (uncommitted)
  // allocation. Costs GOLD.
  applyLevelUpAllocation: (allocation: {
    goldSpent: number;
    levelsGained: number;
    statPoints: Partial<Record<LevelingStat, number>>;
  }) => void;
  // Unlocking skills costs XP.
  purchaseSkill: (skillId: string) => boolean;
  equipSkills: (skills: string[]) => void;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  stats: { ...INITIAL_STATS },
  inventory: [],
  equippedWeaponId: 'rusty_sword',
  notifications: [],
  lastRestedBonfireId: null,
  lastRestedPos: null,
  lastRestedRot: 0,

  initializeFromSave: (stats, inventory) => {
    const weaponItem = inventory.find((i) => i.type === 'weapon');
    set({
      stats: { ...INITIAL_STATS, ...stats, inventory },
      inventory,
      equippedWeaponId: weaponItem ? weaponItem.id : 'rusty_sword',
    });
  },

  setStats: (stats) =>
    set((state) => ({
      stats:
        typeof stats === 'function'
          ? (stats as (prev: PlayerStats) => PlayerStats)(state.stats)
          : stats,
    })),

  addNotification: (msg) =>
    set((state) => ({
      // Keep a short rolling window so the HUD doesn't grow unbounded.
      notifications: [...state.notifications, msg].slice(-5),
    })),

  clearNotifications: () => set({ notifications: [] }),

  addItem: (itemDef, count = 1) => {
    set((state) => {
      const existingIndex = state.inventory.findIndex((i) => i.id === itemDef.id);
      const updatedInventory = [...state.inventory];

      if (existingIndex >= 0 && itemDef.stackable) {
        updatedInventory[existingIndex] = {
          ...updatedInventory[existingIndex],
          count: updatedInventory[existingIndex].count + count,
        };
      } else {
        updatedInventory.push({ ...itemDef, count } as InventoryItem);
      }

      return {
        inventory: updatedInventory,
        stats: { ...state.stats, inventory: updatedInventory },
      };
    });
  },

  consumeItem: (itemId) => {
    let success = false;
    const { stats, inventory } = get();
    const itemIndex = inventory.findIndex((i) => i.id === itemId);

    if (itemIndex === -1) return false;

    const item = inventory[itemIndex];
    if (item.count <= 0) return false;

    const nextStats = { ...stats };

    // Apply Vitals Restoration
    if (item.effect) {
      if (item.effect.type === 'heal') {
        if (nextStats.hp >= nextStats.maxHp) return false;
        nextStats.hp = Math.min(nextStats.maxHp, nextStats.hp + (item.effect.value || 0));
        success = true;
      } else if (item.effect.type === 'restore_mind') {
        if (nextStats.mp >= nextStats.maxMp) return false;
        nextStats.mp = Math.min(nextStats.maxMp, nextStats.mp + (item.effect.value || 0));
        success = true;
      }
    }

    if (!success && item.type !== 'flask') return false;

    // Handle Stack / Flask Charges
    const updatedInventory = [...inventory];
    if (item.type === 'flask') {
      if (nextStats.flaskCharges > 0) {
        nextStats.flaskCharges -= 1;
        updatedInventory[itemIndex] = { ...item, count: nextStats.flaskCharges };
        success = true;
      } else {
        return false;
      }
    } else {
      if (item.count > 1) {
        updatedInventory[itemIndex] = { ...item, count: item.count - 1 };
      } else {
        updatedInventory.splice(itemIndex, 1);
      }
    }

    nextStats.inventory = updatedInventory;
    set({ stats: nextStats, inventory: updatedInventory });
    return success;
  },

  equipItem: (itemId) => {
    const { inventory, stats } = get();
    const item = inventory.find((i) => i.id === itemId);
    if (!item) return;

    if (item.type === 'weapon') {
      const weaponAtk = item.stats?.attack || 5;
      set({
        equippedWeaponId: itemId,
        stats: {
          ...stats,
          attack: stats.strength + weaponAtk,
        },
      });
    }
  },

  removeItem: (itemId) => {
    set((state) => {
      const updatedInventory = state.inventory.filter((i) => i.id !== itemId);
      return {
        inventory: updatedInventory,
        stats: { ...state.stats, inventory: updatedInventory },
      };
    });
  },

  modifyHp: (amount) =>
    set((state) => ({
      stats: {
        ...state.stats,
        hp: Math.max(0, Math.min(state.stats.maxHp, state.stats.hp + amount)),
      },
    })),

  modifyMp: (amount) =>
    set((state) => ({
      stats: {
        ...state.stats,
        mp: Math.max(0, Math.min(state.stats.maxMp, state.stats.mp + amount)),
      },
    })),

  modifySanity: (amount) =>
    set((state) => ({
      stats: {
        ...state.stats,
        sanity: Math.max(0, Math.min(state.stats.maxSanity, state.stats.sanity + amount)),
      },
    })),

  restAtBonfire: (bonfireId, pos, rot) =>
    set((state) => {
      const updatedStats = {
        ...state.stats,
        hp: state.stats.maxHp,
        mp: state.stats.maxMp,
        sanity: state.stats.maxSanity,
        flaskCharges: state.stats.maxFlaskCharges,
      };

      const refreshedInventory = state.inventory.map((item) => {
        if (item.type === 'flask') {
          return { ...item, count: state.stats.maxFlaskCharges };
        }
        return item;
      });

      return {
        stats: { ...updatedStats, inventory: refreshedInventory },
        inventory: refreshedInventory,
        ...(bonfireId && { lastRestedBonfireId: bonfireId }),
        ...(pos && { lastRestedPos: pos }),
        ...(rot !== undefined && { lastRestedRot: rot }),
      };
    }),

  addRewards: (xp, gold) =>
    set((state) => ({
      stats: {
        ...state.stats,
        xp: state.stats.xp + xp,
        gold: state.stats.gold + gold,
      },
    })),

  applyLevelUpAllocation: ({ goldSpent, levelsGained, statPoints }) =>
    set((state) => {
      let nextStats: PlayerStats = {
        ...state.stats,
        gold: Math.max(0, state.stats.gold - goldSpent),
        level: state.stats.level + levelsGained,
      };

      (Object.keys(statPoints) as LevelingStat[]).forEach((stat) => {
        const points = statPoints[stat] ?? 0;
        if (points) nextStats = applyStatPoints(nextStats, stat, points);
      });

      return { stats: nextStats };
    }),

  respawn: () =>
    set((state) => {
      // Dark Souls style respawn resets vitals and flasks, but doesn't wipe inventory
      const updatedStats = {
        ...state.stats,
        hp: state.stats.maxHp,
        mp: state.stats.maxMp,
        sanity: state.stats.maxSanity,
        flaskCharges: state.stats.maxFlaskCharges,
      };

      const refreshedInventory = state.inventory.map((item) => {
        if (item.type === 'flask') return { ...item, count: state.stats.maxFlaskCharges };
        return item;
      });

      return {
        stats: { ...updatedStats, inventory: refreshedInventory },
        inventory: refreshedInventory,
      };
    }),

  purchaseSkill: (skillId) => {
    const { stats } = get();
    const node = SKILL_TREE[skillId];

    if (!node || stats.xp < node.cost || stats.unlockedSkills.includes(skillId)) {
      return false;
    }

    const meetsPrereqs = node.requires.every((req) => stats.unlockedSkills.includes(req));
    if (!meetsPrereqs) return false;

    set((state) => ({
      stats: {
        ...state.stats,
        xp: state.stats.xp - node.cost,
        unlockedSkills: [...state.stats.unlockedSkills, skillId],
      },
    }));
    return true;
  },

  equipSkills: (skills) =>
    set((state) => ({
      stats: { ...state.stats, equippedSkills: skills },
    })),
}));
