import { WEAPON_ATTACKS } from '../data/WeaponRegistry';
import { SKILL_DATABASE } from '../data/Skills';
import type { CombatEnemyInstance, PlayerStats, EnemyDef, StatusEffect } from '../types/GameTypes';

export interface AttackResult {
  hit: boolean;
  damageDealt: number;
  isCrit: boolean;
  message: string;
  enemyState: CombatEnemyInstance;
  partSevered?: string;
  isFatal: boolean;
}

export interface SkillResult {
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
    attackId: string
  ): AttackResult => {
    const nextEnemy = { ...enemy, parts: enemy.parts.map((p) => ({ ...p })) };
    const targetPart = nextEnemy.parts.find((p) => p.id === targetPartId);

    // 1. Get Weapon Attack Definition
    const attackDef = WEAPON_ATTACKS[attackId] || WEAPON_ATTACKS['slash'];

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

    // Weapon Multiplier
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

    let msg = `${attackDef.name} hit ${targetPart.name} for ${rawDmg}!`;
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

  //eslint-disable-next-line
  executeSkill: (skillId: string, player: PlayerStats, enemy: CombatEnemyInstance): SkillResult => {
    const skillDef = SKILL_DATABASE[skillId];

    if (!skillDef) {
      return { success: false, message: 'Unknown skill' };
    }

    if (skillDef.cost && player.mp < skillDef.cost) {
      return { success: false, message: 'Not enough Mana!' };
    }

    let message = `Used ${skillDef.name}`;
    let healAmount = 0;
    let buffApplied = undefined;

    // --- SKILL SPECIFIC LOGIC ---

    // 1. PRAY (Strength Scaling)
    if (skillId === 'pray') {
      const strBonus = Math.floor(player.strength * 1.5);
      healAmount = (skillDef.heal || 0) + strBonus;
      if (skillDef.buff) {
        buffApplied = { ...skillDef.buff, id: `pray_${Date.now()}` };
        message += ` Gained ${skillDef.buff.name}!`;
      }
    }

    // 2. DEATH MARK (Debuff Enemy)
    else if (skillId === 'death_mark') {
      if (skillDef.buff) {
        buffApplied = { ...skillDef.buff, id: `mark_${Date.now()}` };
        message = 'Marked enemy for death!';
      }
    }

    // 3. FLAME OF FRENZY
    else if (skillId === 'flame_of_frenzy') {
      message = 'Unleashed Flame of Frenzy!';
    }

    return {
      success: true,
      message,
      healAmount: healAmount > 0 ? healAmount : undefined,
      buffApplied,
      cost: skillDef.cost,
    };
  },
};
