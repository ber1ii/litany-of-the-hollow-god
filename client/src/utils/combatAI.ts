import type { CombatEnemyInstance, EnemyDef, EnemyAttackDef } from '../types/GameTypes';

/**
 * Returns all attacks the enemy is currently physically capable of performing based on intact limbs.
 */
export const getAvailableAttacks = (
  enemyInstance: CombatEnemyInstance,
  enemyDef: EnemyDef
): EnemyAttackDef[] => {
  const severedSet = new Set(enemyInstance.parts.filter((p) => p.isSevered).map((p) => p.id));

  return enemyDef.attacks.filter((attack) => {
    // 1. Single part check
    if (attack.requiredPartId && severedSet.has(attack.requiredPartId)) {
      return false;
    }

    // 2. OR check: At least one specified part MUST be intact (not severed)
    if (attack.requiredAnyParts && attack.requiredAnyParts.length > 0) {
      const hasAtLeastOneIntact = attack.requiredAnyParts.some((partId) => !severedSet.has(partId));
      if (!hasAtLeastOneIntact) return false;
    }

    // 3. AND check: ALL specified parts MUST be intact
    if (attack.requiredAllParts && attack.requiredAllParts.length > 0) {
      const hasAllIntact = attack.requiredAllParts.every((partId) => !severedSet.has(partId));
      if (!hasAllIntact) return false;
    }

    return true;
  });
};

/**
 * Chooses a random available attack for the enemy.
 * Returns null if the enemy cannot perform any attacks.
 */
export const selectEnemyAttack = (
  enemyInstance: CombatEnemyInstance,
  enemyDef: EnemyDef
): EnemyAttackDef | null => {
  const available = getAvailableAttacks(enemyInstance, enemyDef);
  if (available.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * available.length);
  return available[randomIndex];
};
