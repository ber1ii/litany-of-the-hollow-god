export const TILE_SIZE = 2;

export const TILE_TYPES = {
  FLOOR: 0,
  WALL: 1,
  DOOR_CLOSED: 2,
  DOOR_OPEN: 3,
  GOLD: 4,
  SKELETON: 5,
};

export const LEVEL_1_MAP = [
  [1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 5, 0, 0, 1],
  [1, 1, 1, 2, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 4, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1],
];
