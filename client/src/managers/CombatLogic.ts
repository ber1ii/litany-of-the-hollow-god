import { WEAPON_ATTACKS, WEAPON_TYPES } from '../data/WeaponRegistry';
import { SKILL_DATABASE } from '../data/Skills';
import type { SkillDef } from '../data/Skills';
import type { CombatEnemyInstance, PlayerStats, EnemyDef, StatusEffect } from '../types/GameTypes';
import { SANITY_CONFIG } from '../data/SanityConfig';

export interface AttackResult {
  hit: boolean;
  damageDealt: number;
  isCrit: boolean;
  message: string;
  enemyState: CombatEnemyInstance;
  partSevered?: string;
  isFatal: boolean;
  lifestealHeal?: number;
}

export interface SkillResult {
  success: boolean;
  message: string;
  healAmount?: number;
  buffApplied?: StatusEffect;
  enemyDebuffApplied?: StatusEffect;
  cost?: number;
  hpCost?: number;
  attackResult?: AttackResult;
}

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

export const tickStatusEffects = (effects: StatusEffect[] = []): StatusEffect[] =>
  effects.map((e) => ({ ...e, duration: e.duration - 1 })).filter((e) => e.duration > 0);

// Tunable stat-scaling constants, kept together for easy balancing
export const STAT_TUNING = {
  CRIT_DAMAGE_BASE: 2.0, // base crit multiplier at 0 dexterity
  CRIT_DAMAGE_PER_DEX: 0.015, // + this per point of dexterity
  BUFF_POTENCY_PER_INT: 0.02, // + this fraction per point of intelligence, applied to buff.value / heals
};

const resolveAttackDef = (attackId: string, equippedWeaponId: string) => {
  const skillDef = SKILL_DATABASE[attackId];

  if (skillDef?.scalesWithWeapon) {
    const moveId = WEAPON_TYPES[equippedWeaponId]?.[skillDef.scalesWithWeapon];
    const weaponAttack = moveId ? WEAPON_ATTACKS[moveId] : undefined;
    if (weaponAttack) {
      return {
        name: skillDef.name,
        description: skillDef.description,
        damageMult: weaponAttack.damageMult * (skillDef.damageScale ?? 1),
        accuracyMod: weaponAttack.accuracyMod + (skillDef.accuracyMod ?? 0),
        critMod: weaponAttack.critMod,
        type: weaponAttack.type,
      };
    }
  }

  const weaponAttack = WEAPON_ATTACKS[attackId];
  if (weaponAttack) return weaponAttack;

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
    attackId: string,
    equippedWeaponId: string
  ): AttackResult => {
    const nextEnemy = { ...enemy, parts: enemy.parts.map((p) => ({ ...p })) };
    const targetPart = nextEnemy.parts.find((p) => p.id === targetPartId);

    const attackDef = resolveAttackDef(attackId, equippedWeaponId);

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

    const baseAcc = 90;

    // --- SANITY PENALTIES ---
    const sanityRatio = player.sanity / player.maxSanity;
    let accuracyPenalty = 0;
    let agilityPenalty = 0;

    if (sanityRatio < SANITY_CONFIG.LOW_THRESHOLD) {
      const severity = (SANITY_CONFIG.LOW_THRESHOLD - sanityRatio) / SANITY_CONFIG.LOW_THRESHOLD;
      accuracyPenalty = SANITY_CONFIG.ACCURACY_PENALTY_MAX * severity;
      agilityPenalty = SANITY_CONFIG.AGILITY_PENALTY_MAX * severity;
    }
    // ------------------------

    const effectiveAgility = Math.max(0, player.agility - agilityPenalty);
    const agilityBonus = effectiveAgility * 0.5;

    // Subtract accuracy penalty from the raw threshold
    const rawThreshold =
      baseAcc + targetPart.hitChanceMod + attackDef.accuracyMod + agilityBonus - accuracyPenalty;
    const hitThreshold = isExecutePhase ? 100 : Math.min(95, Math.max(5, rawThreshold));

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

    let statDmg = player.attack;
    if (attackDef.type === 'magic') {
      statDmg = player.intelligence * 2;
    }

    let rawDmg = Math.floor(statDmg * attackDef.damageMult);

    const variance = 1 + (Math.random() * 0.2 - 0.1);
    rawDmg = Math.floor(rawDmg * variance);

    const damageBuff = player.statusEffects.find((e) => e.type === 'buff_damage');
    if (damageBuff) {
      const multiplier = 1 + damageBuff.value / 100;
      rawDmg = Math.floor(rawDmg * multiplier);
    }

    const vulneDebuff = nextEnemy.statusEffects?.find((e) => e.type === 'vulnerable');
    if (vulneDebuff) {
      rawDmg = Math.floor(rawDmg * (1 + vulneDebuff.value / 100));
    }

    rawDmg = Math.floor(rawDmg * nextEnemy.damageTakenMultiplier);
    rawDmg = Math.floor(rawDmg * targetPart.damageMultiplier);

    let isCrit = false;
    const critChance = 5 + attackDef.critMod + player.dexterity / 2;
    const critMultiplier =
      STAT_TUNING.CRIT_DAMAGE_BASE + player.dexterity * STAT_TUNING.CRIT_DAMAGE_PER_DEX;
    if (isExecutePhase || Math.random() * 100 < critChance) {
      isCrit = true;
      rawDmg = Math.floor(rawDmg * critMultiplier);
    }

    const partHasHp = targetPart.hasHp !== false;

    if (partHasHp) {
      targetPart.hp = Math.max(0, targetPart.hp - rawDmg);
      nextEnemy.hp = Math.max(0, nextEnemy.hp - rawDmg);
    } else {
      rawDmg = 0;
    }

    const lifestealEffect = player.statusEffects?.find((e) => e.type === 'lifesteal');
    const intPotency = 1 + player.intelligence * STAT_TUNING.BUFF_POTENCY_PER_INT;
    const lifestealHeal =
      lifestealEffect && rawDmg > 0
        ? Math.floor(rawDmg * ((lifestealEffect.value * intPotency) / 100))
        : 0;

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
    equippedWeaponId: string,
    targetPartId?: string
  ): SkillResult => {
    const skillDef = SKILL_DATABASE[skillId];

    if (!skillDef) {
      return { success: false, message: 'Unknown skill' };
    }

    if (skillDef.cost && player.mp < skillDef.cost) {
      return { success: false, message: 'Not enough Mind!' };
    }

    const intPotency = 1 + player.intelligence * STAT_TUNING.BUFF_POTENCY_PER_INT;
    let buffApplied: StatusEffect | undefined;
    let enemyDebuffApplied: StatusEffect | undefined;

    // Evaluate self buffs
    if (skillDef.buff) {
      const scaledValue = Math.floor(skillDef.buff.value * intPotency);
      buffApplied = {
        ...skillDef.buff,
        value: scaledValue,
        id: `${skillId}_${Date.now()}`,
      };
    }

    // Evaluate enemy debuffs
    if (skillDef.enemyDebuff) {
      const scaledValue = Math.floor(skillDef.enemyDebuff.value * intPotency);
      enemyDebuffApplied = {
        ...skillDef.enemyDebuff,
        value: scaledValue,
        id: `${skillId}_${Date.now()}`,
      };
    }

    // If skill executes an attack calculation
    if (skillDef.damageScale !== undefined || skillDef.scalesWithWeapon) {
      if (!targetPartId) {
        return { success: false, message: 'No target selected!' };
      }

      const attackResult = CombatLogic.calculatePlayerAttack(
        player,
        enemy,
        targetPartId,
        skillId,
        equippedWeaponId
      );

      let attackMsg = attackResult.message;
      if (enemyDebuffApplied) {
        attackMsg += ` (${skillDef.name} applied ${enemyDebuffApplied.name}!)`;
      }

      return {
        success: true,
        message: attackMsg,
        cost: skillDef.cost,
        attackResult,
        buffApplied,
        enemyDebuffApplied,
      };
    }

    // Non-attack skills (heals, pure buffs/debuffs)
    let message = `Used ${skillDef.name}`;
    let healAmount = 0;
    let hpCost = 0;

    if (skillDef.healBase !== undefined || skillDef.healLevelScale !== undefined) {
      const baseHeal = (skillDef.healBase || 0) + (skillDef.healLevelScale || 0) * playerLevel;
      healAmount = Math.floor(baseHeal * intPotency);
      message = `Restored ${healAmount} Vitality!`;
    }

    if (skillDef.hpCostPercent) {
      hpCost = Math.floor(player.hp * (skillDef.hpCostPercent / 100));
      if (hpCost <= 0 || player.hp - hpCost <= 0) {
        return { success: false, message: 'Not enough Vitality to sacrifice!' };
      }
    }

    if (buffApplied && !healAmount) {
      if (hpCost > 0) {
        message = `Sacrificed ${hpCost} Vitality for ${skillDef.buff!.name}!`;
      } else {
        message = `${skillDef.name} takes effect!`;
      }
    }

    if (enemyDebuffApplied && !buffApplied && !healAmount) {
      message = `${skillDef.name} weakens the enemy!`;
    }

    return {
      success: true,
      message,
      healAmount: healAmount > 0 ? healAmount : undefined,
      buffApplied,
      enemyDebuffApplied,
      cost: skillDef.cost,
      hpCost: hpCost > 0 ? hpCost : undefined,
    };
  },
};
