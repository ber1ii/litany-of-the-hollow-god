export type ChaseEventState =
  | 'IDLE'
  | 'SPAWN_BOSS'
  | 'PAN_TO_BOSS'
  | 'PAN_TO_PLAYER'
  | 'SWORD_DROP_PROMPT'
  | 'CHASE_ACTIVE'
  | 'CAUGHT'
  | 'ESCAPE_PAN_TO_BOSS'
  | 'ESCAPE_HOLD'
  | 'ESCAPE_PAN_TO_PLAYER'
  | 'ESCAPED'
  | 'DONE';
