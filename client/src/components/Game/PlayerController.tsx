import React, { useRef, useState, useMemo, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Character } from './Character';
import { useKeyboard } from '../../hooks/useKeyboard';
import { TILE_SIZE, TILE_TYPES, generateCollisionGrid } from './MapData';
import { getTileDef } from '../../data/TileRegistry';

// Re-declare helper locally to avoid dependencies/export issues
const isStructure = (v: number) => {
  const def = getTileDef(v);
  return (
    def &&
    (def.type === 'wall' ||
      v === TILE_TYPES.DOOR_CLOSED ||
      v === TILE_TYPES.DOOR_OPEN ||
      v === TILE_TYPES.DOOR_LOCKED_SILVER)
  );
};

interface PlayerControllerProps {
  map: number[][];
  onInteract: (x: number, z: number) => void;
  onStep: (x: number, z: number) => void;
  playerRef: React.RefObject<THREE.Vector3>;
}

export const PlayerController: React.FC<PlayerControllerProps> = ({
  map,
  onInteract,
  onStep,
  playerRef,
}) => {
  const input = useKeyboard();
  const groupRef = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    if (groupRef.current && playerRef.current) {
      groupRef.current.position.copy(playerRef.current);
    }
  }, []);

  const prevInteract = useRef(false);

  const collisionGrid = useMemo(() => generateCollisionGrid(map), [map]);

  const PLAYER_RADIUS = 0.2;
  const MOVEMENT_SPEED = 3;
  const WALL_THICKNESS = 0.25;

  const checkCollision = (nextX: number, nextZ: number) => {
    const gridX = Math.round(nextX / TILE_SIZE);
    const gridZ = Math.round(nextZ / TILE_SIZE);

    if (gridZ < 0 || gridZ >= map.length || gridX < 0 || gridX >= map[0].length) return true;

    const tileType = map[gridZ][gridX];

    // Door Hitbox (Center of tile)
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

          // --- DYNAMIC HITBOX ROTATION ---
          if (id !== 0) {
            const def = getTileDef(id);
            if (def.id === 100 || def.type !== 'wall') {
              // Default full block
            } else {
              const valNorth = z > 0 ? map[z - 1][x] : 0;
              const valSouth = z < map.length - 1 ? map[z + 1][x] : 0;
              const valWest = x > 0 ? map[z][x - 1] : 0;
              const valEast = x < map[0].length - 1 ? map[z][x + 1] : 0;

              // Vertical Chain check
              const isVertical =
                (isStructure(valNorth) || isStructure(valSouth)) &&
                !isStructure(valWest) &&
                !isStructure(valEast);

              if (isVertical) {
                // Rotated: Thin on X, Wide on Z
                halfW = WALL_THICKNESS / 2;
                halfD = TILE_SIZE / 2;
              } else {
                // Standard: Wide on X, Thin on Z
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
  const [direction, setDirection] = useState('S');
  const currentAim = useRef(new THREE.Vector3(0, 0, 5));
  const prevTile = useRef({ x: -1, z: -1 });

  const getDirectionFromAngle = (angle: number) => {
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

    playerRef.current.copy(groupRef.current.position);

    if (!lightTarget.parent) groupRef.current.add(lightTarget);

    if (input.interact && !prevInteract.current) {
      const currentX = groupRef.current.position.x;
      const currentZ = groupRef.current.position.z;

      const pGridX = Math.round(currentX / TILE_SIZE);
      const pGridZ = Math.round(currentZ / TILE_SIZE);

      const aimDir = currentAim.current.clone().normalize();

      const candidates = [
        { x: pGridX, z: pGridZ },
        {
          x: Math.round((currentX + aimDir.x * 0.8) / TILE_SIZE),
          z: Math.round((currentZ + aimDir.z * 0.8) / TILE_SIZE),
        },
      ];

      for (const c of candidates) {
        if (c.z >= 0 && c.z < map.length && c.x >= 0 && c.x < map[0].length) {
          const id = map[c.z][c.x];
          if (
            id === TILE_TYPES.KEY_SILVER ||
            id === TILE_TYPES.GOLD ||
            id === TILE_TYPES.DOOR_CLOSED ||
            id === TILE_TYPES.DOOR_OPEN ||
            id === TILE_TYPES.DOOR_LOCKED_SILVER
          ) {
            onInteract(c.x, c.z);
            break;
          }
        }
      }
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
      const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
      moveX /= length;
      moveZ /= length;

      const nextX = groupRef.current.position.x + moveX * MOVEMENT_SPEED * delta;
      const nextZ = groupRef.current.position.z + moveZ * MOVEMENT_SPEED * delta;

      if (!checkCollision(nextX, groupRef.current.position.z)) {
        groupRef.current.position.x = nextX;
      }
      if (!checkCollision(groupRef.current.position.x, nextZ)) {
        groupRef.current.position.z = nextZ;
      }
    } else {
      setAnimation('idle');
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

    const CAM_OFFSET_Y = 3;
    const CAM_OFFSET_Z = 2.5;

    state.camera.position.x = THREE.MathUtils.lerp(
      state.camera.position.x,
      groupRef.current.position.x,
      0.1
    );
    state.camera.position.y = THREE.MathUtils.lerp(
      state.camera.position.y,
      groupRef.current.position.y + CAM_OFFSET_Y,
      0.1
    );
    state.camera.position.z = THREE.MathUtils.lerp(
      state.camera.position.z,
      groupRef.current.position.z + CAM_OFFSET_Z,
      0.1
    );

    const lookTarget = groupRef.current.position.clone().add(new THREE.Vector3(0, 0, -1.0));
    state.camera.lookAt(lookTarget);

    const currentGridX = Math.round(groupRef.current.position.x / TILE_SIZE);
    const currentGridZ = Math.round(groupRef.current.position.z / TILE_SIZE);

    if (currentGridX !== prevTile.current.x || currentGridZ !== prevTile.current.z) {
      onStep(currentGridX, currentGridZ);
      prevTile.current = { x: currentGridX, z: currentGridZ };
    }
  });

  return (
    <group ref={groupRef}>
      <pointLight position={[0, 1, 0]} intensity={2.5} distance={2} decay={0} color="#fffbd6" />
      <spotLight
        position={[0, 1.2, 0.1]}
        target={lightTarget}
        intensity={15}
        angle={0.6}
        penumbra={0.5}
        distance={15}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-normalBias={0.05}
        color="#fffbd6"
      />
      <Character action={animation} direction={direction} position={[0, 0, 0]} />
    </group>
  );
};
