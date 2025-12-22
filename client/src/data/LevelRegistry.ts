import { LEVEL_1_MAP } from '../components/Game/MapData';

export const LEVEL_REGISTRY: Record<string, number[][]> = {
  LEVEL_1: LEVEL_1_MAP,
  // Future levels go here:
  // LEVEL_2: LEVEL_2_MAP,
};

export const INITIAL_LEVEL_ID = 'LEVEL_1';
