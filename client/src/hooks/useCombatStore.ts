import { create } from 'zustand';
import type { PlayerStats, CombatEnemyInstance, EnemyAttackDef } from '../types/GameTypes';
import { ENEMIES } from '../data/Enemies';
import { selectEnemyAttack } from '../utils/combatAI';

export type CombatTurnState =
  'player_turn' | 'player_acting' | 'enemy_turn' | 'enemy_acting' | 'victory' | 'defeat';

export type CinematicMode = 'none' | 'heavy_cleave' | 'decapitating_sweep';
export type RequestedAction = string | null;

// Tunable — how many times faster the player must be (agility vs
// enemy speed) to earn one extra queued turn before the enemy acts.
// e.g. ratio 2.0 => player needs 2x the enemy's speed for +1 turn.
const AGILITY_EXTRA_TURN_RATIO = 2.0;
const MAX_EXTRA_TURNS = 1; // cap so speed stacking can't runaway-loop combat

// Called once per enemy encounter (or whenever agility/enemy speed
// changes) to decide how many consecutive player turns are queued before
// the enemy gets to act. Returns 1 (normal) or 2 (one bonus turn).
export const calculateExtraPlayerTurns = (playerAgility: number, enemySpeed: number): number => {
  if (enemySpeed <= 0) return 0;
  const ratio = playerAgility / enemySpeed;
  return Math.min(MAX_EXTRA_TURNS, Math.floor(ratio / AGILITY_EXTRA_TURN_RATIO));
};

interface CombatStore {
  turnState: CombatTurnState;
  playerStats: PlayerStats | null;
  enemyInstance: CombatEnemyInstance | null;

  targetPartId: string | null;
  requestedAction: RequestedAction;
  activeSkillId: string | null;
  activeItemId: string | null;
  activeWeaponAttackId: string | null;

  severedParts: Record<string, boolean>;
  cinematicMode: CinematicMode;
  currentAttackDef?: EnemyAttackDef;
  skillCooldowns: Record<string, number>;

  // How many player turns remain before control passes to the enemy.
  // CombatScene should check this after a player action resolves: if > 0,
  // decrement and stay in 'player_turn' instead of calling triggerEnemyTurn().
  queuedPlayerTurns: number;

  setTurnState: (state: CombatTurnState) => void;
  setPlayerStats: (stats: PlayerStats | ((prev: PlayerStats) => PlayerStats)) => void;
  setEnemyInstance: (enemy: CombatEnemyInstance | null) => void;
  setTargetPartId: (partId: string | null) => void;
  severLimb: (partId: string) => void;
  triggerCinematic: (mode: CinematicMode) => void;

  setRequestedAction: (action: RequestedAction) => void;
  setActiveSkillId: (skillId: string | null) => void;
  setActiveWeaponAttackId: (skillId: string | null) => void;
  setActiveItemId: (itemId: string | null) => void;
  setCurrentAttackDef: (attackDef?: EnemyAttackDef) => void;

  setSkillCooldown: (skillId: string, turns: number) => void;
  tickCooldowns: () => void;

  initQueuedTurns: (playerAgility: number, enemySpeed: number) => void;
  consumeQueuedTurn: () => boolean; // returns true if a bonus turn was consumed (stay on player_turn)

  triggerEnemyTurn: () => void;
  damageEnemyPart: (partIndex: number, damage: number) => void;
  resetCombat: () => void;
}

export const useCombatStore = create<CombatStore>((set, get) => ({
  turnState: 'player_turn',
  playerStats: null,
  enemyInstance: null,
  targetPartId: null,
  requestedAction: null,
  activeSkillId: null,
  activeItemId: null,
  severedParts: {},
  cinematicMode: 'none',
  currentAttackDef: undefined,
  skillCooldowns: {},
  activeWeaponAttackId: null,
  queuedPlayerTurns: 0,

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
  setActiveSkillId: (skillId) => set({ activeSkillId: skillId }),
  setActiveWeaponAttackId: (attackId) => set({ activeWeaponAttackId: attackId }),
  setActiveItemId: (itemId) => set({ activeItemId: itemId }),
  setCurrentAttackDef: (attackDef) => set({ currentAttackDef: attackDef }),

  setSkillCooldown: (skillId, turns) =>
    set((state) => ({ skillCooldowns: { ...state.skillCooldowns, [skillId]: turns } })),

  tickCooldowns: () =>
    set((state) => {
      const updatedCooldowns = { ...state.skillCooldowns };
      Object.keys(updatedCooldowns).forEach((key) => {
        if (updatedCooldowns[key] > 0) updatedCooldowns[key] -= 1;
      });
      return { skillCooldowns: updatedCooldowns };
    }),

  // Call at combat start (and after any agility/enemy-speed change)
  // to seed how many extra player turns this fight grants.
  initQueuedTurns: (playerAgility, enemySpeed) =>
    set({ queuedPlayerTurns: calculateExtraPlayerTurns(playerAgility, enemySpeed) }),

  // Call after a player action resolves, BEFORE deciding whether to
  // call triggerEnemyTurn(). If this returns true, CombatScene should skip
  // triggerEnemyTurn and let the player act again.
  consumeQueuedTurn: () => {
    const { queuedPlayerTurns } = get();
    if (queuedPlayerTurns > 0) {
      set({ queuedPlayerTurns: queuedPlayerTurns - 1 });
      return true;
    }
    return false;
  },

  triggerEnemyTurn: () => {
    const { enemyInstance } = get();
    if (!enemyInstance) return;

    const baseId = (enemyInstance.instanceId || '').split('-')[0].toUpperCase();
    const enemyDef = ENEMIES[baseId] || ENEMIES['SKELETON'];

    const chosenAttack = selectEnemyAttack(enemyInstance, enemyDef);

    if (!chosenAttack) {
      set({ turnState: 'enemy_acting', currentAttackDef: undefined, requestedAction: 'idle' });
      setTimeout(() => {
        get().tickCooldowns();
        set({ turnState: 'player_turn', requestedAction: null });
      }, 1200);
      return;
    }

    set({ currentAttackDef: chosenAttack, turnState: 'enemy_acting', requestedAction: 'attack' });
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

      return { enemyInstance: { ...state.enemyInstance, hp: newEnemyHp, parts: updatedParts } };
    });
  },

  resetCombat: () =>
    set({
      turnState: 'player_turn',
      playerStats: null,
      enemyInstance: null,
      targetPartId: null,
      requestedAction: null,
      activeSkillId: null,
      activeItemId: null,
      severedParts: {},
      cinematicMode: 'none',
      currentAttackDef: undefined,
      skillCooldowns: {},
      activeWeaponAttackId: null,
      queuedPlayerTurns: 0,
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
