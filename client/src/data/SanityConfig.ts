export const SANITY_CONFIG = {
  LOW_THRESHOLD: 0.3,
  CRITICAL_THRESHOLD: 0.15,

  // Penalties (Scaled linearly from LOW_THRESHOLD down to 0 sanity)
  ACCURACY_PENALTY_MAX: 5, // A very slight -5% to hit chance
  AGILITY_PENALTY_MAX: 2, // Slight drop to agility to mess with turn queueing
  VARIANCE_MULTIPLIER_MAX: 1.5,

  PHANTOM_ATTACK_CHANCE: 0.2,

  DRAIN: {
    VAMPIRE_HIT: 8,
    VAMPIRE_BOSS_HIT: 12,
    CURSED_TILE_STEP: 3,
  },
};
