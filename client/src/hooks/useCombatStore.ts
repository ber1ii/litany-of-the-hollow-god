import { create } from 'zustand';
import type { PlayerStats, CombatEnemyInstance, EnemyAttackDef } from '../types/GameTypes';
import { ENEMIES } from '../data/Enemies';
import { selectEnemyAttack } from '../utils/combatAI';

export type CombatTurnState =
  'player_turn' | 'player_acting' | 'enemy_turn' | 'enemy_acting' | 'victory' | 'defeat';

export type CinematicMode = 'none' | 'heavy_cleave' | 'decapitating_sweep';

interface CombatStore {
  turnState: CombatTurnState;
  playerStats: PlayerStats | null;
  enemyInstance: CombatEnemyInstance | null;
  targetPartId: string | null;
  severedParts: Record<string, boolean>;
  cinematicMode: CinematicMode;
  requestedAction: string | null;
  currentAttackDef?: EnemyAttackDef;

  setTurnState: (state: CombatTurnState) => void;
  setPlayerStats: (stats: PlayerStats | ((prev: PlayerStats) => PlayerStats)) => void;
  setEnemyInstance: (enemy: CombatEnemyInstance | null) => void;
  setTargetPartId: (partId: string | null) => void;
  severLimb: (partId: string) => void;
  triggerCinematic: (mode: CinematicMode) => void;
  setRequestedAction: (action: string | null) => void;
  setCurrentAttackDef: (attackDef?: EnemyAttackDef) => void;
  triggerEnemyTurn: () => void;
  damageEnemyPart: (partIndex: number, damage: number) => void;
  resetCombat: () => void;
}

export const useCombatStore = create<CombatStore>((set, get) => ({
  turnState: 'player_turn',
  playerStats: null,
  enemyInstance: null,
  targetPartId: null,
  severedParts: {},
  cinematicMode: 'none',
  requestedAction: null,
  currentAttackDef: undefined,

  setTurnState: (state) => set({ turnState: state }),
  setPlayerStats: (stats) =>
    set((state) => ({
      playerStats:
        typeof stats === 'function' && state.playerStats
          ? stats(state.playerStats)
          : (stats as PlayerStats),
    })),
  setEnemyInstance: (enemy) => set({ enemyInstance: enemy }),
  setTargetPartId: (partId) => set({ targetPartId: partId }),
  severLimb: (partId) =>
    set((state) => ({ severedParts: { ...state.severedParts, [partId]: true } })),
  triggerCinematic: (mode) => set({ cinematicMode: mode }),
  setRequestedAction: (action) => set({ requestedAction: action }),
  setCurrentAttackDef: (attackDef) => set({ currentAttackDef: attackDef }),

  triggerEnemyTurn: () => {
    const { enemyInstance } = get();
    if (!enemyInstance) return;

    const baseId = (enemyInstance.instanceId || '').split('-')[0].toUpperCase();
    const enemyDef = ENEMIES[baseId] || ENEMIES['SKELETON'];

    // Select attack filtered by intact limbs
    const chosenAttack = selectEnemyAttack(enemyInstance, enemyDef);

    if (!chosenAttack) {
      // Enemy is too dismembered to perform any special attacks
      set({
        turnState: 'enemy_acting',
        currentAttackDef: undefined,
        requestedAction: 'idle',
      });

      // Pass turn back to player after short delay
      setTimeout(() => {
        set({ turnState: 'player_turn', requestedAction: null });
      }, 1200);
      return;
    }

    set({
      currentAttackDef: chosenAttack,
      turnState: 'enemy_acting',
      requestedAction: 'attack',
    });
  },

  damageEnemyPart: (partIndex: number, damage: number) => {
    set((state) => {
      if (!state.enemyInstance) return state;

      const updatedParts = [...state.enemyInstance.parts];
      const targetPart = updatedParts[partIndex];

      if (!targetPart || targetPart.isSevered) return state;

      const newPartHp = Math.max(0, targetPart.hp - damage);
      const newlySevered = newPartHp === 0;

      updatedParts[partIndex] = {
        ...targetPart,
        hp: newPartHp,
        isSevered: targetPart.isSevered || newlySevered,
      };

      const newEnemyHp = Math.max(0, state.enemyInstance.hp - damage);

      return {
        enemyInstance: {
          ...state.enemyInstance,
          hp: newEnemyHp,
          parts: updatedParts,
        },
      };
    });
  },

  resetCombat: () =>
    set({
      turnState: 'player_turn',
      playerStats: null,
      enemyInstance: null,
      targetPartId: null,
      severedParts: {},
      cinematicMode: 'none',
      requestedAction: null,
      currentAttackDef: undefined,
    }),
}));

export const getEnemyDebuffs = (enemyInstance: CombatEnemyInstance | null) => {
  if (!enemyInstance?.parts) return { atkMultiplier: 1.0, speedMultiplier: 1.0 };

  const parts = enemyInstance.parts;

  const severedArms = (parts[0]?.isSevered ? 1 : 0) + (parts[1]?.isSevered ? 1 : 0);
  const severedLegs = (parts[2]?.isSevered ? 1 : 0) + (parts[3]?.isSevered ? 1 : 0);

  return {
    atkMultiplier: Math.max(0.4, 1.0 - severedArms * 0.3),
    speedMultiplier: Math.max(0.3, 1.0 - severedLegs * 0.35),
  };
};
