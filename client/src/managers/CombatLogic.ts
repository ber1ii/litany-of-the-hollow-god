import { WEAPON_ATTACKS } from '../data/WeaponRegistry';
import { SKILL_DATABASE } from '../data/Skills';
import type { SkillDef } from '../data/Skills';
import type { CombatEnemyInstance, PlayerStats, EnemyDef, StatusEffect } from '../types/GameTypes';

export interface AttackResult {
  hit: boolean;
  damageDealt: number;
  isCrit: boolean;
  message: string;
  enemyState: CombatEnemyInstance;
  partSevered?: string;
  isFatal: boolean;
  // HP restored to the player from an active lifesteal buff, if any.
  lifestealHeal?: number;
}

export interface SkillResult {
  success: boolean;
  message: string;
  healAmount?: number;
  buffApplied?: StatusEffect;
  cost?: number;
  hpCost?: number; // Added to support HP cost for skills like Blood Surge
  // Present when the skill is a damage-dealing skill (quick_attack,
  // heavy_attack, plunging_strike, ...) that was routed through the
  // normal attack pipeline. CombatScene uses this to drive the same
  // hit/miss/sever/crit visuals as a regular weapon attack.
  attackResult?: AttackResult;
}

// The animation state CombatPlayer knows how to render. Kept here (next
// to SkillDef) so CombatScene has a single source of truth for mapping a
// skill's `animation` field to something the sprite renderer understands.
export type PlayerCombatAction =
  'idle' | 'attack' | 'hurt' | 'pray' | 'die' | 'cast' | 'plunge' | 'blood_surge' | 'heal';

export const getSkillAnimation = (
  skillDef: SkillDef
): { action: PlayerCombatAction; variant?: 1 | 2 } => {
  switch (skillDef.animation) {
    case 'attack1':
      return { action: 'attack', variant: 1 };
    case 'attack2':
      return { action: 'attack', variant: 2 };
    case 'pray':
      return { action: 'pray' };
    case 'cast':
      return { action: 'cast' };
    case 'blood_surge':
      return { action: 'blood_surge' };
    case 'plunge':
      return { action: 'plunge' };
    default:
      return { action: 'cast' };
  }
};

// Bonus % added to a part's base severChance, indexed by how many limbs
// are already severed. Index 4+ (all limbs gone) is a guaranteed sever.
const SEVER_ESCALATION_TABLE = [0, 10, 40, 80, 100];

export const getSeverEscalationBonus = (severedLimbCount: number): number => {
  const idx = Math.min(severedLimbCount, SEVER_ESCALATION_TABLE.length - 1);
  return SEVER_ESCALATION_TABLE[idx];
};

export const rollSeverChance = (
  part: { severChance?: number },
  severedLimbCount: number
): boolean => {
  if (!part.severChance) return false;
  const effectiveChance = Math.min(
    100,
    part.severChance + getSeverEscalationBonus(severedLimbCount)
  );
  return Math.random() * 100 < effectiveChance;
};

// Decrements every player status effect's duration by 1 and drops any
// that have expired. Call once per completed player turn.
export const tickStatusEffects = (effects: StatusEffect[] = []): StatusEffect[] =>
  effects.map((e) => ({ ...e, duration: e.duration - 1 })).filter((e) => e.duration > 0);

// Resolves an "attack-like" id to a normalized attack definition. Accepts
// either a real WeaponRegistry id ('slash', 'stab', ...) or a
// SKILL_DATABASE id with a damageScale (quick_attack, heavy_attack,
// plunging_strike, ...), so calculatePlayerAttack can treat skills as
// weapon attacks with damageMult = skillDef.damageScale.
const resolveAttackDef = (attackId: string) => {
  const weaponAttack = WEAPON_ATTACKS[attackId];
  if (weaponAttack) return weaponAttack;

  const skillDef = SKILL_DATABASE[attackId];
  if (skillDef && skillDef.damageScale) {
    return {
      name: skillDef.name,
      description: skillDef.description,
      damageMult: skillDef.damageScale,
      accuracyMod: 0,
      critMod: 0,
      type: skillDef.type === 'magic' ? 'magic' : 'physical',
    };
  }

  return WEAPON_ATTACKS['slash'];
};

export const CombatLogic = {
  createEnemyInstance: (
    def: EnemyDef,
    instanceId: string,
    playerLevel: number = 1
  ): CombatEnemyInstance => {
    const scaleFactor = def.tier === 'boss' ? 1.0 : 1 + 0.12 * (playerLevel - 1);
    const scaleStat = (stat: number) => Math.floor(stat * scaleFactor);

    const partsCopy = def.parts.map((p) => ({
      ...p,
      hp: p.hasHp === false ? 0 : scaleStat(p.hp),
      maxHp: p.hasHp === false ? 0 : scaleStat(p.maxHp),
    }));

    const totalHp = partsCopy.reduce(
      (sum: number, p) => sum + (p.hasHp === false ? 0 : p.maxHp),
      0
    );

    return {
      instanceId,
      defId: def.id,
      name: def.name,
      hp: totalHp,
      maxHp: totalHp,
      attack: scaleStat(def.baseStats.attack),
      defense: scaleStat(def.baseStats.defense),
      speed: scaleStat(def.baseStats.speed),
      parts: partsCopy,
      statusEffects: [],
      attackDebuff: 0,
      damageTakenMultiplier: 1.0,
    };
  },

  calculatePlayerAttack: (
    player: PlayerStats,
    enemy: CombatEnemyInstance,
    targetPartId: string,
    attackId: string
  ): AttackResult => {
    const nextEnemy = { ...enemy, parts: enemy.parts.map((p) => ({ ...p })) };
    const targetPart = nextEnemy.parts.find((p) => p.id === targetPartId);

    // 1. Get Attack Definition (weapon attack OR a damage-skill treated as one)
    const attackDef = resolveAttackDef(attackId);

    if (!targetPart || targetPart.isSevered) {
      return {
        hit: false,
        damageDealt: 0,
        isCrit: false,
        message: 'Invalid Target!',
        enemyState: enemy,
        isFatal: false,
      };
    }

    const activeLimbs = nextEnemy.parts.filter((p) => !p.isSevered && !p.isVital);
    const isExecutePhase = activeLimbs.length === 0;

    // --- 2. HIT CHANCE ---
    const baseAcc = 90;
    const hitThreshold = isExecutePhase
      ? 100
      : baseAcc + targetPart.hitChanceMod + attackDef.accuracyMod;

    const hitRoll = Math.random() * 100;

    if (hitRoll > hitThreshold) {
      return {
        hit: false,
        damageDealt: 0,
        isCrit: false,
        message: `Missed ${targetPart.name}!`,
        enemyState: enemy,
        isFatal: false,
      };
    }

    // --- 3. DAMAGE CALCULATION ---
    let statDmg = player.attack;

    // Magic Scaling
    if (attackDef.type === 'magic') {
      statDmg = player.intelligence * 2;
    }

    // Weapon Multiplier (or skill damageScale, resolved above)
    let rawDmg = Math.floor(statDmg * attackDef.damageMult);

    // Variance
    const variance = 1 + (Math.random() * 0.2 - 0.1);
    rawDmg = Math.floor(rawDmg * variance);

    // Player Buffs
    const damageBuff = player.statusEffects.find((e) => e.type === 'buff_damage');
    if (damageBuff) {
      const multiplier = 1 + damageBuff.value / 100;
      rawDmg = Math.floor(rawDmg * multiplier);
    }

    // Enemy Vulnerabilities
    const vulneDebuff = nextEnemy.statusEffects?.find((e) => e.type === 'vulnerable');
    if (vulneDebuff) {
      rawDmg = Math.floor(rawDmg * (1 + vulneDebuff.value / 100));
    }

    rawDmg = Math.floor(rawDmg * nextEnemy.damageTakenMultiplier);
    rawDmg = Math.floor(rawDmg * targetPart.damageMultiplier);

    // Crit Logic
    let isCrit = false;
    const critChance = 5 + attackDef.critMod + player.dexterity / 2;
    if (isExecutePhase || Math.random() * 100 < critChance) {
      isCrit = true;
      rawDmg = Math.floor(rawDmg * 2.0);
    }

    // --- 4. APPLY DAMAGE ---
    const partHasHp = targetPart.hasHp !== false;

    if (partHasHp) {
      targetPart.hp = Math.max(0, targetPart.hp - rawDmg);
      nextEnemy.hp = Math.max(0, nextEnemy.hp - rawDmg);
    } else {
      rawDmg = 0; // hpless parts (head) take no damage — only the sever roll matters
    }

    // Lifesteal: heal the player for a % of the damage actually dealt if
    // they have an active lifesteal buff (e.g. from Blood Surge).
    const lifestealEffect = player.statusEffects?.find((e) => e.type === 'lifesteal');
    const lifestealHeal =
      lifestealEffect && rawDmg > 0 ? Math.floor(rawDmg * (lifestealEffect.value / 100)) : 0;

    let partSeveredName = undefined;
    let isFatal = nextEnemy.hp <= 0;

    const severedLimbCount = nextEnemy.parts.filter((p) => p.isSevered).length;
    const canSever = targetPart.isSeverable !== false;
    const severedByHp = partHasHp && targetPart.hp === 0;
    const severedByChance = canSever && rollSeverChance(targetPart, severedLimbCount);

    if (canSever && !targetPart.isSevered && (severedByHp || severedByChance)) {
      targetPart.isSevered = true;
      partSeveredName = targetPart.name;

      if (targetPart.isVital) {
        isFatal = true;
        nextEnemy.hp = 0;
      } else {
        nextEnemy.attackDebuff += 2;
        nextEnemy.damageTakenMultiplier += 0.2;
      }
    }

    let msg = partHasHp
      ? `${attackDef.name} hit ${targetPart.name} for ${rawDmg}!`
      : `${attackDef.name} connects with ${targetPart.name}!`;
    if (isCrit && partHasHp) msg = `CRITICAL! ${targetPart.name} took ${rawDmg}!`;
    if (partSeveredName) msg += ` Severed ${partSeveredName}!`;
    if (isFatal) msg += ` Enemy Defeated!`;

    return {
      hit: true,
      damageDealt: rawDmg,
      isCrit,
      message: msg,
      enemyState: nextEnemy,
      partSevered: partSeveredName,
      isFatal,
      lifestealHeal: lifestealHeal || undefined,
    };
  },

  executeSkill: (
    skillId: string,
    player: PlayerStats,
    enemy: CombatEnemyInstance,
    playerLevel: number,
    targetPartId?: string
  ): SkillResult => {
    const skillDef = SKILL_DATABASE[skillId];

    if (!skillDef) {
      return { success: false, message: 'Unknown skill' };
    }

    // Standard MP Cost Check — applies to every skill with a `cost`.
    if (skillDef.cost && player.mp < skillDef.cost) {
      return { success: false, message: 'Not enough Mind!' };
    }

    // --- Damage-dealing skills (quick_attack, heavy_attack, plunging_strike, ...) ---
    // Routed through calculatePlayerAttack so hit chance, crit, sever
    // rolls, and lifesteal all stay consistent with regular attacks.
    if (skillDef.damageScale) {
      if (!targetPartId) {
        return { success: false, message: 'No target selected!' };
      }

      const attackResult = CombatLogic.calculatePlayerAttack(player, enemy, targetPartId, skillId);

      return {
        success: true,
        message: attackResult.message,
        cost: skillDef.cost,
        attackResult,
      };
    }

    // --- Non-damage skills: heals and/or buffs, driven generically off the def ---
    let message = `Used ${skillDef.name}`;
    let healAmount = 0;
    let hpCost = 0;
    let buffApplied: StatusEffect | undefined;

    if (skillDef.healBase !== undefined || skillDef.healLevelScale !== undefined) {
      healAmount = (skillDef.healBase || 0) + (skillDef.healLevelScale || 0) * playerLevel;
      message = `Restored ${healAmount} Vitality!`;
    }

    if (skillDef.hpCostPercent) {
      hpCost = Math.floor(player.hp * (skillDef.hpCostPercent / 100));
      // Guard: never let a self-cost skill reduce the caster to 0 or below.
      if (hpCost <= 0 || player.hp - hpCost <= 0) {
        return { success: false, message: 'Not enough Vitality to sacrifice!' };
      }
    }

    if (skillDef.buff) {
      buffApplied = { ...skillDef.buff, id: `${skillId}_${Date.now()}` };
      if (hpCost > 0) {
        message = `Sacrificed ${hpCost} Vitality for ${skillDef.buff.name}!`;
      } else if (!healAmount) {
        message = `${skillDef.name} takes effect!`;
      }
    }

    return {
      success: true,
      message,
      healAmount: healAmount > 0 ? healAmount : undefined,
      buffApplied,
      cost: skillDef.cost,
      hpCost: hpCost > 0 ? hpCost : undefined,
    };
  },
};
