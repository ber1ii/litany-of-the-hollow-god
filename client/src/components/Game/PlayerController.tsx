import React, { useRef, useState, useMemo, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Character } from './Character';
import { useKeyboard } from '../../hooks/useKeyboard';
import {
  TILE_SIZE,
  TILE_TYPES,
  generateCollisionGrid,
  PLAYER_RADIUS,
  MOVEMENT_SPEED,
  WALL_THICKNESS,
  CAM_OFFSET_Y,
  CAM_OFFSET_Z,
} from './MapData';
import { getTileDef } from '../../data/TileRegistry';
import { buildStructureFootprint, getEffectiveTileId } from '../../utils/StructureFootprint';
import { SANITY_CONFIG } from '../../data/SanityConfig';
import { usePlayerStore } from '../../hooks/usePlayerStore';
import { AudioManager } from '../../managers/AudioManager';
import { getChunkCoords } from '../../utils/ChunkUtils';

interface PlayerControllerProps {
  map: number[][];
  onInteract: (x: number, z: number) => void;
  onStep: (x: number, z: number) => void;
  playerRef: React.RefObject<THREE.Vector3>;
  playerRotRef: React.MutableRefObject<number>;
  active?: boolean;
  isChased?: boolean;
  onInteractableChange?: (canInteract: boolean) => void;
  isSwordless?: boolean;
  targetFov?: number; // Optional prop to set the camera's field of view
  extraObstacles?: { x: number; z: number; radius: number }[]; // e.g. the landed chase boulder
}

type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

// Module-scope constant — never reallocated, shape never changes.
// (Facing-direction candidate is handled separately in the frame loop
// since it changes every frame; these four are the fixed cardinal checks.)
const NEIGHBOR_DIRS: { x: number; z: number }[] = [
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 },
];

const isStructureTile = (v: number) => {
  const d = getTileDef(v);
  return (
    d &&
    (d.type === 'wall' ||
      v === TILE_TYPES.DOOR_CLOSED ||
      v === TILE_TYPES.DOOR_OPEN ||
      v === TILE_TYPES.DOOR_LOCKED_SILVER)
  );
};

export const PlayerController: React.FC<PlayerControllerProps> = ({
  map,
  onInteract,
  onStep,
  playerRef,
  playerRotRef,
  active = true,
  isChased = false,
  onInteractableChange,
  isSwordless = false,
  targetFov = 50, // Default FOV if not provided
  extraObstacles,
}) => {
  const input = useKeyboard();
  const groupRef = useRef<THREE.Group>(null);
  const canInteractRef = useRef(false);
  const prevChunk = useRef({ cx: -1, cz: -1 });

  // Reusable scratch objects — avoids per-frame allocation/GC churn that
  // was causing periodic hitches, most noticeable during the chase where
  // multiple systems are running useFrame simultaneously.
  const tmpAimDir = useRef(new THREE.Vector3()).current;
  const tmpLookTarget = useRef(new THREE.Vector3()).current;
  const candidatesBuf = useRef<{ x: number; z: number }[]>([]).current;
  const seenBuf = useRef(new Set<string>()).current;

  useLayoutEffect(() => {
    if (groupRef.current && playerRef.current) {
      groupRef.current.position.copy(playerRef.current);
    }
  }, [playerRef, map]);

  const prevInteract = useRef(false);
  const stepAudioTimer = useRef(0);
  const WALK_AUDIO_INTERVAL = 0.38;
  const CHASE_AUDIO_INTERVAL = 0.28; // Faster step rhythm when chased
  const CHASE_SPEED_MULTIPLIER = 1.3; // Player moves faster than base while chased

  const collisionGrid = useMemo(() => generateCollisionGrid(map), [map]);

  // Structure footprint (e.g. dark_archway's 5x6 footprint anchored at a
  // single 'D' cell) so interact-detection can resolve any cell inside a
  // multi-tile structure to that structure's tile id, not just the anchor.
  const footprint = useMemo(() => buildStructureFootprint(map), [map]);

  const checkCollision = (nextX: number, nextZ: number) => {
    if (!groupRef.current) return true;

    const currentX = groupRef.current.position.x;
    const currentZ = groupRef.current.position.z;
    const currGridX = Math.round(currentX / TILE_SIZE);
    const currGridZ = Math.round(currentZ / TILE_SIZE);

    const gridX = Math.round(nextX / TILE_SIZE);
    const gridZ = Math.round(nextZ / TILE_SIZE);

    if (gridZ < 0 || gridZ >= map.length || gridX < 0 || gridX >= map[0].length) return true;

    if (extraObstacles) {
      for (const obs of extraObstacles) {
        const odx = nextX - obs.x;
        const odz = nextZ - obs.z;
        const minDist = obs.radius + PLAYER_RADIUS;
        if (odx * odx + odz * odz < minDist * minDist) return true;
      }
    }

    const currentTileId = map[currGridZ]?.[currGridX];
    const isTrappedInDoor =
      currentTileId === TILE_TYPES.DOOR_CLOSED || currentTileId === TILE_TYPES.DOOR_LOCKED_SILVER;

    if (currGridX === gridX && currGridZ === gridZ && isTrappedInDoor) {
      return false;
    }

    const tileType = map[gridZ][gridX];

    if (tileType === TILE_TYPES.DOOR_CLOSED || tileType === TILE_TYPES.DOOR_LOCKED_SILVER) {
      const dx = nextX - gridX * TILE_SIZE;
      const dz = nextZ - gridZ * TILE_SIZE;
      if (Math.abs(dx) < 0.5 && Math.abs(dz) < 0.5) return true;
    }

    const minGX = Math.max(0, gridX - 1);
    const maxGX = Math.min(map[0].length - 1, gridX + 1);
    const minGZ = Math.max(0, gridZ - 1);
    const maxGZ = Math.min(map.length - 1, gridZ + 1);

    for (let z = minGZ; z <= maxGZ; z++) {
      for (let x = minGX; x <= maxGX; x++) {
        if (collisionGrid[z][x]) {
          const id = map[z][x];
          let halfW = TILE_SIZE / 2;
          let halfD = TILE_SIZE / 2;

          if (id !== 0) {
            const def = getTileDef(id);
            if (def.id === 100 || def.type !== 'wall') {
              // Default
            } else {
              const valNorth = z > 0 ? map[z - 1][x] : 0;
              const valSouth = z < map.length - 1 ? map[z + 1][x] : 0;
              const valWest = x > 0 ? map[z][x - 1] : 0;
              const valEast = x < map[0].length - 1 ? map[z][x + 1] : 0;

              const isVertical =
                (isStructureTile(valNorth) || isStructureTile(valSouth)) &&
                !isStructureTile(valWest) &&
                !isStructureTile(valEast);

              if (isVertical) {
                halfW = WALL_THICKNESS / 2;
                halfD = TILE_SIZE / 2;
              } else {
                halfW = TILE_SIZE / 2;
                halfD = WALL_THICKNESS / 2;
              }
            }
          }

          const wallX = x * TILE_SIZE;
          const wallZ = z * TILE_SIZE;

          const clampedX = Math.max(wallX - halfW, Math.min(nextX, wallX + halfW));
          const clampedZ = Math.max(wallZ - halfD, Math.min(nextZ, wallZ + halfD));

          const dx = nextX - clampedX;
          const dz = nextZ - clampedZ;
          const distanceSquared = dx * dx + dz * dz;

          if (distanceSquared < PLAYER_RADIUS * PLAYER_RADIUS) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const lightTarget = useMemo(() => {
    const obj = new THREE.Object3D();
    obj.position.set(0, 0, 5);
    return obj;
  }, []);

  const [animation, setAnimation] = useState<'idle' | 'walk'>('idle');
  const [direction, setDirection] = useState<Direction>('S');
  const currentAim = useRef(new THREE.Vector3(0, 0, 5));
  const prevTile = useRef({ x: -1, z: -1 });

  const getDirectionFromAngle = (angle: number): Direction => {
    const deg = THREE.MathUtils.radToDeg(angle);
    if (deg >= -22.5 && deg < 22.5) return 'E';
    if (deg >= 22.5 && deg < 67.5) return 'SE';
    if (deg >= 67.5 && deg < 112.5) return 'S';
    if (deg >= 112.5 && deg < 157.5) return 'SW';
    if (deg >= 157.5 || deg < -157.5) return 'W';
    if (deg >= -157.5 && deg < -112.5) return 'NW';
    if (deg >= -112.5 && deg < -67.5) return 'N';
    if (deg >= -67.5 && deg < -22.5) return 'NE';
    return 'S';
  };

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    if (!active) {
      setAnimation('idle');
      stepAudioTimer.current = 0;
      if (canInteractRef.current) {
        canInteractRef.current = false;
        onInteractableChange?.(false);
      }
      return;
    }

    AudioManager.updateListenerPosition(
      [groupRef.current.position.x, groupRef.current.position.y, groupRef.current.position.z],
      [currentAim.current.x, 0, currentAim.current.z]
    );

    if (!lightTarget.parent) groupRef.current.add(lightTarget);

    // --- INTERACTABLE DETECTION (runs every frame, independent of keypress) ---
    const currentX = groupRef.current.position.x;
    const currentZ = groupRef.current.position.z;
    const pGridX = Math.round(currentX / TILE_SIZE);
    const pGridZ = Math.round(currentZ / TILE_SIZE);

    // Was `currentAim.current.clone().normalize()` — reuse a scratch vector
    // instead of allocating a new Vector3 every frame.
    tmpAimDir.copy(currentAim.current).normalize();
    const aimDir = tmpAimDir;

    const primaryDx = Math.abs(aimDir.x) > Math.abs(aimDir.z) ? Math.sign(aimDir.x) : 0;
    const primaryDz = Math.abs(aimDir.x) > Math.abs(aimDir.z) ? 0 : Math.sign(aimDir.z);

    // Was: build a fresh `neighborOffsets` array, a fresh `candidates`
    // array + objects, and a fresh `Set` with string keys — every single
    // frame, regardless of movement. Now reuses pooled buffers.
    candidatesBuf.length = 0;
    seenBuf.clear();

    candidatesBuf.push({ x: pGridX, z: pGridZ });
    seenBuf.add(`${pGridX},${pGridZ}`);

    // Facing direction is checked first (matches original priority order).
    const facingX = pGridX + primaryDx;
    const facingZ = pGridZ + primaryDz;
    const facingKey = `${facingX},${facingZ}`;
    if (!seenBuf.has(facingKey)) {
      seenBuf.add(facingKey);
      candidatesBuf.push({ x: facingX, z: facingZ });
    }

    for (const off of NEIGHBOR_DIRS) {
      const cx = pGridX + off.x;
      const cz = pGridZ + off.z;
      const key = `${cx},${cz}`;
      if (!seenBuf.has(key)) {
        seenBuf.add(key);
        candidatesBuf.push({ x: cx, z: cz });
      }
    }

    const candidates = candidatesBuf;

    let foundCandidate: { x: number; z: number } | null = null;

    for (const c of candidates) {
      if (c.z >= 0 && c.z < map.length && c.x >= 0 && c.x < map[0].length) {
        // Resolve via the structure footprint, not the raw map cell: a
        // multi-tile structure like dark_archway only has its id written
        // at the anchor cell, but every cell in its footprint should still
        // read as that structure for interact purposes (e.g. standing
        // next to the archway's doorway edge, not just at its anchor).
        const id = getEffectiveTileId(map, footprint, c.x, c.z);
        const def = getTileDef(id);

        if (
          (def.type === 'item' && def.itemId) ||
          id === TILE_TYPES.KEY_SILVER ||
          id === TILE_TYPES.GOLD ||
          id === TILE_TYPES.DOOR_CLOSED ||
          id === TILE_TYPES.DOOR_OPEN ||
          id === TILE_TYPES.DOOR_LOCKED_SILVER ||
          id === TILE_TYPES.BONFIRE ||
          id === TILE_TYPES.SIGN ||
          id === TILE_TYPES.ARCH_DARK
        ) {
          foundCandidate = c;
          break;
        }
      }
    }

    const isInteractable = foundCandidate !== null;
    if (isInteractable !== canInteractRef.current) {
      canInteractRef.current = isInteractable;
      onInteractableChange?.(isInteractable);
    }

    if (input.interact && !prevInteract.current && foundCandidate) {
      onInteract(foundCandidate.x, foundCandidate.z);
      prevInteract.current = input.interact;
      return; // Halts the frame loop to prevent overwriting the new spawnPos
    }
    prevInteract.current = input.interact;

    let moveX = 0;
    let moveZ = 0;
    if (input.forward) moveZ -= 1;
    if (input.backward) moveZ += 1;
    if (input.left) moveX -= 1;
    if (input.right) moveX += 1;

    let aimX = 0;
    let aimZ = 0;
    if (input.aimForward) aimZ -= 1;
    if (input.aimBackward) aimZ += 1;
    if (input.aimLeft) aimX -= 1;
    if (input.aimRight) aimX += 1;

    const isAiming = aimX !== 0 || aimZ !== 0;
    const isMoving = moveX !== 0 || moveZ !== 0;

    if (isMoving) {
      setAnimation('walk');

      // Player Footstep Audio Triggering
      stepAudioTimer.current += delta;
      const currentInterval = isChased ? CHASE_AUDIO_INTERVAL : WALK_AUDIO_INTERVAL;

      if (stepAudioTimer.current >= currentInterval) {
        const soundKey = isChased ? 'footsteps_chase' : 'footsteps_walk';
        const soundVolume = isChased ? 0.5 : 0.35;
        AudioManager.play(soundKey, { volume: soundVolume });
        stepAudioTimer.current = 0;
      }

      const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
      moveX /= length;
      moveZ /= length;

      const speedMultiplier = isChased ? CHASE_SPEED_MULTIPLIER : 1;
      const nextX = groupRef.current.position.x + moveX * MOVEMENT_SPEED * speedMultiplier * delta;
      const nextZ = groupRef.current.position.z + moveZ * MOVEMENT_SPEED * speedMultiplier * delta;

      if (!checkCollision(nextX, groupRef.current.position.z)) {
        groupRef.current.position.x = nextX;
      }
      if (!checkCollision(groupRef.current.position.x, nextZ)) {
        groupRef.current.position.z = nextZ;
      }

      playerRef.current.copy(groupRef.current.position);
    } else {
      setAnimation('idle');
      stepAudioTimer.current = WALK_AUDIO_INTERVAL;
    }

    let targetX = currentAim.current.x;
    let targetZ = currentAim.current.z;

    if (isAiming) {
      targetX = aimX * 1.5;
      targetZ = aimZ * 1.5;
    } else if (isMoving) {
      targetX = moveX * 1.5;
      targetZ = moveZ * 1.5;
    }

    currentAim.current.x = THREE.MathUtils.lerp(currentAim.current.x, targetX, 0.1);
    currentAim.current.z = THREE.MathUtils.lerp(currentAim.current.z, targetZ, 0.1);

    lightTarget.position.set(currentAim.current.x, 0, currentAim.current.z);

    const lookAngle = Math.atan2(currentAim.current.z, currentAim.current.x);
    setDirection(getDirectionFromAngle(lookAngle));

    playerRotRef.current = lookAngle;

    const dampFactor = 1 - Math.exp(-6 * delta);

    state.camera.position.x = THREE.MathUtils.lerp(
      state.camera.position.x,
      groupRef.current.position.x,
      dampFactor
    );
    state.camera.position.y = THREE.MathUtils.lerp(
      state.camera.position.y,
      groupRef.current.position.y + CAM_OFFSET_Y,
      dampFactor
    );
    state.camera.position.z = THREE.MathUtils.lerp(
      state.camera.position.z,
      groupRef.current.position.z + CAM_OFFSET_Z,
      dampFactor
    );

    if (state.camera instanceof THREE.PerspectiveCamera) {
      state.camera.fov = THREE.MathUtils.lerp(state.camera.fov, targetFov, dampFactor);
      state.camera.updateProjectionMatrix();
    }

    // Was: `groupRef.current.position.clone().add(new THREE.Vector3(0, 0, -1.0))`
    // — allocated two Vector3s every frame. Reuse a scratch vector instead.
    tmpLookTarget.copy(groupRef.current.position);
    tmpLookTarget.z -= 1.0;
    state.camera.lookAt(tmpLookTarget);

    const currentGridX = Math.round(groupRef.current.position.x / TILE_SIZE);
    const currentGridZ = Math.round(groupRef.current.position.z / TILE_SIZE);

    const { cx, cz } = getChunkCoords(currentGridX, currentGridZ);
    if (cx !== prevChunk.current.cx || cz !== prevChunk.current.cz) {
      onStep(cx, cz);
      prevChunk.current = { cx, cz };
    }

    if (currentGridX !== prevTile.current.x || currentGridZ !== prevTile.current.z) {
      // Remove the old onStep(currentGridX, currentGridZ) from here
      const currentTileId = map[currentGridZ]?.[currentGridX];
      if (currentTileId === TILE_TYPES.COBBLESTONE_5) {
        usePlayerStore.getState().modifySanity(-SANITY_CONFIG.DRAIN.CURSED_TILE_STEP);
      }
      prevTile.current = { x: currentGridX, z: currentGridZ };
    }
  });

  return (
    <group ref={groupRef}>
      <pointLight position={[0, 1, 0]} intensity={2.5} distance={2} decay={0} color="#ffd59e" />
      <spotLight
        position={[0, 1.2, 0.1]}
        target={lightTarget}
        intensity={20}
        angle={0.6}
        penumbra={0.5}
        distance={15}
        castShadow
        shadow-mapSize={[256, 256]}
        shadow-normalBias={0.05}
        color="#ffd59e"
      />
      <Character
        action={animation}
        direction={direction}
        position={[0, 0.15, 0]}
        isSwordless={isSwordless}
      />
    </group>
  );
};
