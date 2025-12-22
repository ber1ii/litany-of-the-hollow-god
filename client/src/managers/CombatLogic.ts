import type { CombatEnemyInstance, PlayerStats, EnemyDef, StatusEffect } from '../types/GameTypes';

interface AttackResult {
  hit: boolean;
  damageDealt: number;
  isCrit: boolean;
  message: string;
  enemyState: CombatEnemyInstance;
  partSevered?: string;
  isFatal: boolean;
}

interface SkillResult {
  success: boolean;
  message: string;
  healAmount?: number;
  buffApplied?: StatusEffect;
  cost?: number;
}

export const CombatLogic = {
  createEnemyInstance: (def: EnemyDef, instanceId: string): CombatEnemyInstance => {
    const partsCopy = def.parts.map((p) => ({ ...p }));
    return {
      instanceId,
      defId: def.id,
      name: def.name,
      hp: def.baseStats.maxHp,
      maxHp: def.baseStats.maxHp,
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
    attackType: 'slash' | 'heavy' = 'slash'
  ): AttackResult => {
    const nextEnemy = { ...enemy, parts: enemy.parts.map((p) => ({ ...p })) };
    const targetPart = nextEnemy.parts.find((p) => p.id === targetPartId);

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

    // --- 1. HIT CHANCE MODIFIERS ---
    const baseAcc = 90;
    let accMod = 0;

    if (attackType === 'heavy') accMod -= 20;

    const hitThreshold = isExecutePhase ? 100 : baseAcc + targetPart.hitChanceMod + accMod;
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

    // --- 2. DAMAGE CALCULATION ---
    let rawDmg = Math.floor(Math.random() * 5) + 8; // Base 8-12

    if (attackType === 'heavy') {
      rawDmg = Math.floor(rawDmg * 1.5);
    }

    // Player Buffs (Pray)
    const damageBuff = player.statusEffects.find((e) => e.type === 'buff_damage');
    if (damageBuff) {
      const multiplier = 1 + damageBuff.value / 100;
      rawDmg = Math.floor(rawDmg * multiplier);
    }

    // Enemy Vulnerabilities
    rawDmg = Math.floor(rawDmg * nextEnemy.damageTakenMultiplier);
    rawDmg = Math.floor(rawDmg * targetPart.damageMultiplier);

    let isCrit = false;
    if (isExecutePhase || Math.random() < 0.05) {
      isCrit = true;
      rawDmg = Math.floor(rawDmg * 2.0);
    }

    // --- 3. APPLY DAMAGE ---
    targetPart.hp = Math.max(0, targetPart.hp - rawDmg);
    nextEnemy.hp = Math.max(0, nextEnemy.hp - rawDmg);

    let partSeveredName = undefined;
    let isFatal = nextEnemy.hp <= 0;

    if (targetPart.hp === 0 && !targetPart.isSevered) {
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

    let msg = `${attackType === 'heavy' ? 'Heavy hit' : 'Hit'} ${targetPart.name} for ${rawDmg}!`;
    if (isCrit) msg = `CRITICAL! ${targetPart.name} took ${rawDmg}!`;
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
    };
  },

  // RENAME: executeSkill (was useSkill)
  executeSkill: (skillId: string, player: PlayerStats): SkillResult => {
    if (skillId === 'pray') {
      const mindBonus = Math.floor(player.mind / 2);
      const healRoll = Math.floor(Math.random() * 6) + 10 + mindBonus;

      // Buff: +10% Dmg for 3 turns
      const buff: StatusEffect = {
        id: `pray_buff_${Date.now()}`,
        type: 'buff_damage',
        name: 'Divine Strength',
        duration: 3,
        value: 10,
      };

      return {
        success: true,
        message: 'Prayed for strength!',
        healAmount: healRoll,
        buffApplied: buff,
      };
    }
    return { success: false, message: 'Unknown skill' };
  },
};
