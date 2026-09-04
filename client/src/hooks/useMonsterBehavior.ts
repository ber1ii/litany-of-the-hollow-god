import { useRef, useState } from 'react';
import * as THREE from 'three';
import { TILE_SIZE } from '../components/Game/MapData';

export type Direction = 'N' | 'S' | 'E' | 'W';

export type MonsterBehavior =
  | { type: 'static'; facing?: Direction; speed?: number }
  | { type: 'patrol'; axis?: 'x' | 'z'; range?: number; speed?: number };

const AGGRO_RANGE = 3.5;
const CHASE_SPEED_MULTIPLIER = 1.4;
const SEARCH_DURATION = 3.0;
const CHASE_REPATH_INTERVAL = 0.3;
const CHASE_DIRECT_DISTANCE = 1.2;

function canMoveTo(x: number, z: number, grid: boolean[][]): boolean {
  const gx = Math.round(x / TILE_SIZE);
  const gz = Math.round(z / TILE_SIZE);
  if (gz < 0 || gz >= grid.length || gx < 0 || gx >= grid[0].length) return false;
  return !grid[gz][gx];
}

function hasLineOfSight(
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  grid: boolean[][]
) {
  let x0 = Math.round(startX / TILE_SIZE);
  let y0 = Math.round(startZ / TILE_SIZE);
  const x1 = Math.round(endX / TILE_SIZE);
  const y1 = Math.round(endZ / TILE_SIZE);

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    if (y0 >= 0 && y0 < grid.length && x0 >= 0 && x0 < grid[0].length) {
      if (grid[y0][x0]) return false;
    }

    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
  return true;
}

interface Point {
  x: number;
  z: number;
}

function findPath(
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  grid: boolean[][]
): Point[] {
  const sx = Math.round(startX / TILE_SIZE);
  const sz = Math.round(startZ / TILE_SIZE);
  const ex = Math.round(endX / TILE_SIZE);
  const ez = Math.round(endZ / TILE_SIZE);

  if (sx === ex && sz === ez) return [];

  const queue: Point[] = [{ x: sx, z: sz }];
  const cameFrom = new Map<string, Point | null>();
  cameFrom.set(`${sx},${sz}`, null);

  const dirs = [
    { dx: 0, dz: -1 },
    { dx: 0, dz: 1 },
    { dx: -1, dz: 0 },
    { dx: 1, dz: 0 },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.x === ex && current.z === ez) break;

    for (const { dx, dz } of dirs) {
      const nx = current.x + dx;
      const nz = current.z + dz;

      if (nz >= 0 && nz < grid.length && nx >= 0 && nx < grid[0].length) {
        if (!grid[nz][nx] && !cameFrom.has(`${nx},${nz}`)) {
          cameFrom.set(`${nx},${nz}`, current);
          queue.push({ x: nx, z: nz });
        }
      }
    }
  }

  const path: Point[] = [];
  let curr: Point | undefined | null = { x: ex, z: ez };
  if (!cameFrom.has(`${ex},${ez}`)) return [];

  while (curr && (curr.x !== sx || curr.z !== sz)) {
    path.push(curr);
    curr = cameFrom.get(`${curr.x},${curr.z}`);
  }

  return path.reverse();
}

export function useMonsterBehavior(
  startX: number,
  startZ: number,
  behavior: MonsterBehavior = { type: 'static', facing: 'S' },
  playerPos: THREE.Vector3,
  collisionGrid: boolean[][],
  onChaseStateChange?: (isChasing: boolean) => void
) {
  const patrolDir = useRef(1);
  const state = useRef<'default' | 'chase' | 'searching' | 'returning'>('default');
  const [isChasing, setIsChasing] = useState(false);

  const searchTimer = useRef(0);
  const pathRef = useRef<Point[]>([]);
  const chasePathRef = useRef<Point[]>([]);
  const chaseRepathTimer = useRef(0);

  const facingRef = useRef<Direction>(
    behavior.type === 'static' && behavior.facing ? behavior.facing : 'S'
  );

  const updatePosition = (
    currentPos: React.MutableRefObject<THREE.Vector3>,
    delta: number
  ): Direction => {
    const dx = playerPos.x - currentPos.current.x;
    const dz = playerPos.z - currentPos.current.z;

    const distance = Math.sqrt(dx * dx + dz * dz);
    const tileDistance = distance / TILE_SIZE; // Convert world units to map tiles

    const isFacingPlayer = () => {
      if (behavior.type !== 'static' || !behavior.facing) return true;

      // Vector from monster to player
      const toPlayerX = dx / distance;
      const toPlayerZ = dz / distance;

      // Map direction string to normalized forward vector
      const forwardVectors: Record<Direction, { x: number; z: number }> = {
        N: { x: 0, z: -1 },
        S: { x: 0, z: 1 },
        E: { x: 1, z: 0 },
        W: { x: -1, z: 0 },
      };

      const fwd = forwardVectors[behavior.facing];
      const dot = toPlayerX * fwd.x + toPlayerZ * fwd.z;

      // Requires player to be within a 120-degree cone in front of monster (dot product > 0.5)
      return dot > 0.5;
    };

    const hasLoS =
      tileDistance < AGGRO_RANGE &&
      isFacingPlayer() &&
      hasLineOfSight(
        currentPos.current.x,
        currentPos.current.z,
        playerPos.x,
        playerPos.z,
        collisionGrid
      );

    // STATE TRANSITIONS
    if (hasLoS) {
      if (state.current !== 'chase') {
        chaseRepathTimer.current = 0;
        setIsChasing(true);
        onChaseStateChange?.(true);
      }
      state.current = 'chase';
      pathRef.current = [];
    } else if (state.current === 'chase') {
      state.current = 'searching';
      searchTimer.current = SEARCH_DURATION;
      chasePathRef.current = [];
      setIsChasing(false);
      onChaseStateChange?.(false);
    }

    // STATE EXECUTION
    if (state.current === 'chase') {
      const baseSpeed = behavior.speed ?? 1.5;
      const chaseSpeed = baseSpeed * CHASE_SPEED_MULTIPLIER;

      if (distance <= CHASE_DIRECT_DISTANCE) {
        chasePathRef.current = [];
        const moveX = (dx / distance) * chaseSpeed * delta;
        const moveZ = (dz / distance) * chaseSpeed * delta;
        const nextX = currentPos.current.x + moveX;
        const nextZ = currentPos.current.z + moveZ;

        if (canMoveTo(nextX, currentPos.current.z, collisionGrid)) {
          currentPos.current.x = nextX;
        }
        if (canMoveTo(currentPos.current.x, nextZ, collisionGrid)) {
          currentPos.current.z = nextZ;
        }

        if (Math.abs(dx) > Math.abs(dz)) {
          facingRef.current = dx > 0 ? 'E' : 'W';
        } else {
          facingRef.current = dz > 0 ? 'S' : 'N';
        }
      } else {
        chaseRepathTimer.current -= delta;
        if (chaseRepathTimer.current <= 0) {
          chaseRepathTimer.current = CHASE_REPATH_INTERVAL;
          chasePathRef.current = findPath(
            currentPos.current.x,
            currentPos.current.z,
            playerPos.x,
            playerPos.z,
            collisionGrid
          );
        }

        if (chasePathRef.current.length > 0) {
          const nextNode = chasePathRef.current[0];
          const targetX = nextNode.x * TILE_SIZE;
          const targetZ = nextNode.z * TILE_SIZE;

          const hx = targetX - currentPos.current.x;
          const hz = targetZ - currentPos.current.z;
          const distToNode = Math.sqrt(hx * hx + hz * hz);

          if (distToNode < 0.1) {
            currentPos.current.x = targetX;
            currentPos.current.z = targetZ;
            chasePathRef.current.shift();
          } else {
            currentPos.current.x += (hx / distToNode) * chaseSpeed * delta;
            currentPos.current.z += (hz / distToNode) * chaseSpeed * delta;

            if (Math.abs(hx) > Math.abs(hz)) {
              facingRef.current = hx > 0 ? 'E' : 'W';
            } else {
              facingRef.current = hz > 0 ? 'S' : 'N';
            }
          }
        } else {
          const moveX = (dx / distance) * chaseSpeed * delta;
          const moveZ = (dz / distance) * chaseSpeed * delta;
          const nextX = currentPos.current.x + moveX;
          const nextZ = currentPos.current.z + moveZ;

          if (canMoveTo(nextX, currentPos.current.z, collisionGrid)) {
            currentPos.current.x = nextX;
          }
          if (canMoveTo(currentPos.current.x, nextZ, collisionGrid)) {
            currentPos.current.z = nextZ;
          }
        }
      }
    } else if (state.current === 'searching') {
      searchTimer.current -= delta;
      if (searchTimer.current <= 0) {
        state.current = 'returning';
        pathRef.current = findPath(
          currentPos.current.x,
          currentPos.current.z,
          startX,
          startZ,
          collisionGrid
        );
      }
    } else if (state.current === 'returning') {
      if (pathRef.current.length > 0) {
        const nextNode = pathRef.current[0];
        const targetX = nextNode.x * TILE_SIZE;
        const targetZ = nextNode.z * TILE_SIZE;

        const hx = targetX - currentPos.current.x;
        const hz = targetZ - currentPos.current.z;
        const distToNode = Math.sqrt(hx * hx + hz * hz);

        if (distToNode < 0.1) {
          currentPos.current.x = targetX;
          currentPos.current.z = targetZ;
          pathRef.current.shift();
        } else {
          const baseSpeed = behavior.speed ?? 1.5;
          currentPos.current.x += (hx / distToNode) * baseSpeed * delta;
          currentPos.current.z += (hz / distToNode) * baseSpeed * delta;

          if (Math.abs(hx) > Math.abs(hz)) {
            facingRef.current = hx > 0 ? 'E' : 'W';
          } else {
            facingRef.current = hz > 0 ? 'S' : 'N';
          }
        }
      } else {
        currentPos.current.x = startX * TILE_SIZE;
        currentPos.current.z = startZ * TILE_SIZE;
        state.current = 'default';
      }
    }

    // DEFAULT BEHAVIOR
    if (state.current === 'default') {
      if (behavior.type === 'static') {
        facingRef.current = behavior.facing || 'S';
      } else if (behavior.type === 'patrol') {
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

          facingRef.current = patrolDir.current === 1 ? 'E' : 'W';
        } else {
          currentPos.current.z += move;
          const bottomBound = (startZ + range) * TILE_SIZE;
          const topBound = (startZ - range) * TILE_SIZE;

          if (currentPos.current.z > bottomBound) patrolDir.current = -1;
          else if (currentPos.current.z < topBound) patrolDir.current = 1;

          facingRef.current = patrolDir.current === 1 ? 'S' : 'N';
        }
      }
    }

    return facingRef.current;
  };

  return { updatePosition, isChasing };
}
