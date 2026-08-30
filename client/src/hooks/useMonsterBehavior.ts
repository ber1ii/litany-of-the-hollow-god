import { useRef } from 'react';
import * as THREE from 'three';
import { TILE_SIZE } from '../components/Game/MapData';

export type Direction = 'N' | 'S' | 'E' | 'W';

export type MonsterBehavior =
  | { type: 'static'; facing?: Direction }
  | { type: 'patrol'; axis?: 'x' | 'z'; range?: number; speed?: number };

export function useMonsterBehavior(
  startX: number,
  startZ: number,
  behavior: MonsterBehavior = { type: 'static', facing: 'S' }
) {
  const patrolDir = useRef(1);

  const updatePosition = (
    currentPos: React.MutableRefObject<THREE.Vector3>,
    delta: number
  ): Direction => {
    if (behavior.type === 'static') {
      return behavior.facing || 'S';
    }

    if (behavior.type === 'patrol') {
      const axis = behavior.axis || 'x';
      const range = behavior.range ?? 2;
      const speed = behavior.speed ?? 1.5;
      const move = patrolDir.current * speed * delta;

      if (axis === 'x') {
        currentPos.current.x += move;
        const rightBound = (startX + range) * TILE_SIZE;
        const leftBound = (startX - range) * TILE_SIZE;

        if (currentPos.current.x > rightBound) patrolDir.current = -1;
        else if (currentPos.current.x < leftBound) patrolDir.current = 1;

        return patrolDir.current === 1 ? 'E' : 'W';
      } else {
        currentPos.current.z += move;
        const bottomBound = (startZ + range) * TILE_SIZE;
        const topBound = (startZ - range) * TILE_SIZE;

        if (currentPos.current.z > bottomBound) patrolDir.current = -1;
        else if (currentPos.current.z < topBound) patrolDir.current = 1;

        return patrolDir.current === 1 ? 'S' : 'N';
      }
    }

    return 'S';
  };

  return { updatePosition };
}
