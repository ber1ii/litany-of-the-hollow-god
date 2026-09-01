import { LEVEL_1_ASCII } from '../components/Game/MapData';
import { parseAsciiMap } from '../utils/MapParser';

export const LEVEL_REGISTRY: Record<string, number[][]> = {
  // Use a getter to execute parsing on demand
  get LEVEL_1() {
    return parseAsciiMap(LEVEL_1_ASCII);
  },
};

export const INITIAL_LEVEL_ID = 'LEVEL_1';
