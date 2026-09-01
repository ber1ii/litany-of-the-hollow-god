import { useRef } from 'react';
import * as THREE from 'three';
import { TILE_SIZE } from '../components/Game/MapData';

export type Direction = 'N' | 'S' | 'E' | 'W';

export type MonsterBehavior =
  | { type: 'static'; facing?: Direction; speed?: number }
  | { type: 'patrol'; axis?: 'x' | 'z'; range?: number; speed?: number };

const AGGRO_RANGE = 7;
const CHASE_SPEED_MULTIPLIER = 1.4;
const SEARCH_DURATION = 3.0;
// How often (seconds) chase recomputes its BFS path to the player.
// Not every frame — that's wasteful and unnecessary since the player
// doesn't teleport. Recomputing periodically keeps the path honest as
// the player moves while staying cheap.
const CHASE_REPATH_INTERVAL = 0.3;
// If the monster is already this close to the player, skip pathing and
// just close the last bit of distance directly — avoids visible "snapping
// to tile centers" when right on top of the player.
const CHASE_DIRECT_DISTANCE = 1.2;

// Single-tile collision check used by the chase branch below, so a
// monster moving in a straight line toward the player can't clip through
// a wall corner the way it could when it moved with zero collision checks.
function canMoveTo(x: number, z: number, grid: boolean[][]): boolean {
  const gx = Math.round(x / TILE_SIZE);
  const gz = Math.round(z / TILE_SIZE);
  if (gz < 0 || gz >= grid.length || gx < 0 || gx >= grid[0].length) return false;
  return !grid[gz][gx];
}

// --- 1. Line of Sight (Bresenham's) ---
function hasLineOfSight(
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  grid: boolean[][]
) {
  let x0 = Math.floor(startX);
  let y0 = Math.floor(startZ);
  const x1 = Math.floor(endX);
  const y1 = Math.floor(endZ);

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

// --- 2. Pathfinding (BFS) ---
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
  const sx = Math.floor(startX);
  const sz = Math.floor(startZ);
  const ex = Math.floor(endX);
  const ez = Math.floor(endZ);

  if (sx === ex && sz === ez) return [];

  const queue: Point[] = [{ x: sx, z: sz }];
  const cameFrom = new Map<string, Point | null>();
  cameFrom.set(`${sx},${sz}`, null);

  // 4-way orthogonal movement prevents corner-clipping
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

      // Check bounds and collision
      if (nz >= 0 && nz < grid.length && nx >= 0 && nx < grid[0].length) {
        if (!grid[nz][nx] && !cameFrom.has(`${nx},${nz}`)) {
          cameFrom.set(`${nx},${nz}`, current);
          queue.push({ x: nx, z: nz });
        }
      }
    }
  }

  // Backtrack to build the path
  const path: Point[] = [];
  let curr: Point | undefined | null = { x: ex, z: ez };
  if (!cameFrom.has(`${ex},${ez}`)) return []; // No path found

  while (curr && (curr.x !== sx || curr.z !== sz)) {
    path.push(curr);
    curr = cameFrom.get(`${curr.x},${curr.z}`);
  }

  // Reverse to get path from start -> end
  return path.reverse();
}

// --- 3. Monster AI Hook ---
export function useMonsterBehavior(
  startX: number,
  startZ: number,
  behavior: MonsterBehavior = { type: 'static', facing: 'S' },
  playerPos: THREE.Vector3,
  collisionGrid: boolean[][]
) {
  const patrolDir = useRef(1);
  const state = useRef<'default' | 'chase' | 'searching' | 'returning'>('default');
  const searchTimer = useRef(0);
  const pathRef = useRef<Point[]>([]); // Stores the active path home
  const chasePathRef = useRef<Point[]>([]); // NEW: BFS path toward the player during chase
  const chaseRepathTimer = useRef(0); // NEW: counts down to the next chase repath

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

    const hasLoS =
      distance < AGGRO_RANGE &&
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
        // Just entering chase — force an immediate path calculation
        // instead of waiting out the repath interval.
        chaseRepathTimer.current = 0;
      }
      state.current = 'chase';
      pathRef.current = []; // Clear any active return paths
    } else if (state.current === 'chase') {
      state.current = 'searching';
      searchTimer.current = SEARCH_DURATION;
      chasePathRef.current = []; // NEW: drop the stale chase path
    }

    // STATE EXECUTION
    if (state.current === 'chase') {
      const baseSpeed = behavior.speed ?? 1.5;
      const chaseSpeed = baseSpeed * CHASE_SPEED_MULTIPLIER;

      // (2nd pass): straight-line movement + per-axis sliding
      // still got the monster stuck walking-in-place against concave
      // corners (an L of two wall tiles blocks BOTH axes at once, and
      // since LoS to the player is unaffected the monster never dropped
      // into 'searching' to re-path). Chase now uses the same BFS
      // pathfinding 'returning' already relies on, recomputed every
      // CHASE_REPATH_INTERVAL seconds so it stays cheap. BFS naturally
      // routes around corners a straight line/slide cannot.
      if (distance <= CHASE_DIRECT_DISTANCE) {
        // Close enough — skip pathing, close the gap directly. Distance
        // is small enough that a wall corner isn't a realistic concern
        // here, and this avoids visible tile-snapping right next to the player.
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
          // BFS found no path (fully boxed in, or player is on an
          // unreachable tile) — fall back to the direct per-axis slide
          // rather than freezing entirely.
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
        // Generate the grid path home when returning begins
        pathRef.current = findPath(
          currentPos.current.x,
          currentPos.current.z,
          startX,
          startZ,
          collisionGrid
        );
      }
    } else if (state.current === 'returning') {
      // If we have nodes left in our path, walk to the next one
      if (pathRef.current.length > 0) {
        const nextNode = pathRef.current[0];
        const targetX = nextNode.x * TILE_SIZE;
        const targetZ = nextNode.z * TILE_SIZE;

        const hx = targetX - currentPos.current.x;
        const hz = targetZ - currentPos.current.z;
        const distToNode = Math.sqrt(hx * hx + hz * hz);

        // Arrived at the current tile, target the next one in the array
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
        // Path complete (or no path found), lock to home coordinates and resume default
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

  return { updatePosition };
}
