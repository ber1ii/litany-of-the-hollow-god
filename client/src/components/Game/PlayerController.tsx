import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Character } from './Character';
import { useKeyboard } from '../../hooks/useKeyboard';
import { LEVEL_1_MAP, TILE_SIZE, TILE_TYPES } from './MapData';

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
  const prevInteract = useRef(false);

  const PLAYER_RADIUS = 0.2;
  const SHOULDER_WIDTH = 0.15;

  const lightTarget = useMemo(() => {
    const obj = new THREE.Object3D();
    obj.position.set(0, 0, 5);
    return obj;
  }, []);

  const [animation, setAnimation] = useState<'idle' | 'walk'>('idle');
  const [direction, setDirection] = useState('S');

  const currentAim = useRef(new THREE.Vector3(0, 0, 5));
  const MOVEMENT_SPEED = 2.25;
  const prevTile = useRef({ x: -1, z: -1 });

  // --- COLLISION LOGIC ---
  const isWalkable = (x: number, z: number) => {
    const gridX = Math.round(x / TILE_SIZE);
    const gridZ = Math.round(z / TILE_SIZE);

    if (gridZ < 0 || gridZ >= LEVEL_1_MAP.length) return false;
    if (gridX < 0 || gridX >= LEVEL_1_MAP[0].length) return false;

    const tile = map[gridZ][gridX];

    return tile !== TILE_TYPES.WALL && tile !== TILE_TYPES.DOOR_CLOSED;
  };

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

    // INTERACT LOGIC
    if (input.interact && !prevInteract.current) {
      const aimDir = currentAim.current.clone().normalize();
      const interactX = groupRef.current.position.x + aimDir.x * TILE_SIZE;
      const interactZ = groupRef.current.position.z + aimDir.z * TILE_SIZE;

      const gridX = Math.round(interactX / TILE_SIZE);
      const gridZ = Math.round(interactZ / TILE_SIZE);

      if (gridZ >= 0 && gridZ < map.length && gridX >= 0 && gridX < map[0].length) {
        onInteract(gridX, gridZ);
      }
    }
    prevInteract.current = input.interact;

    // MOVEMENT LOGIC
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
      const currZ = groupRef.current.position.z;

      // X Axis Collision
      const checkX = moveX > 0 ? nextX + PLAYER_RADIUS : nextX - PLAYER_RADIUS;
      if (
        isWalkable(checkX, currZ - SHOULDER_WIDTH) &&
        isWalkable(checkX, currZ + SHOULDER_WIDTH)
      ) {
        groupRef.current.position.x = nextX;
      }

      // Z Axis Collision
      const checkZ = moveZ > 0 ? nextZ + PLAYER_RADIUS : nextZ - PLAYER_RADIUS;
      const currentXPos = groupRef.current.position.x;

      if (
        isWalkable(currentXPos - SHOULDER_WIDTH, checkZ) &&
        isWalkable(currentXPos + SHOULDER_WIDTH, checkZ)
      ) {
        groupRef.current.position.z = nextZ;
      }
    } else {
      setAnimation('idle');
    }

    // AIMING LOGIC
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
    <group ref={groupRef} position={[2, 0.5, 2]}>
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
