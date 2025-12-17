import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Character } from './Character';
import { useKeyboard } from '../../hooks/useKeyboard';
import { LEVEL_1_MAP, TILE_SIZE } from './MapData';

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

  const PLAYER_RADIUS = 0.35;
  const SHOULDER_WIDTH = 0.25;

  // Torch targeting mechanism
  const lightTarget = useMemo(() => {
    const obj = new THREE.Object3D();
    obj.position.set(0, 0, 5);
    return obj;
  }, []);

  const [animation, setAnimation] = useState<'idle' | 'walk'>('idle');
  const [direction, setDirection] = useState('S');

  const currentAim = useRef(new THREE.Vector3(0, 0, 5));
  const MOVEMENT_SPEED = 3;
  const prevTile = useRef({ x: -1, z: -1 });

  const isWalkable = (x: number, z: number) => {
    // Convert World Position 3D to Grid Coordinates
    // We add TILE_SIZE / 2 to offset because our objects are centered
    const gridX = Math.round(x / TILE_SIZE);
    const gridZ = Math.round(z / TILE_SIZE);

    // Safety check: Am i outside the map array?
    if (gridZ < 0 || gridZ >= LEVEL_1_MAP.length) return false;
    if (gridX < 0 || gridX >= LEVEL_1_MAP[0].length) return false;

    const tile = map[gridZ][gridX];

    // 0 = Floor, 3 = Open Door. (1 is Wall, 2 is Closed Door)
    return tile === 0 || tile === 3 || tile === 4 || tile === 5;
  };

  const getDirectionFromAngle = (angle: number) => {
    // Map angle (-PI to PI)
    // 0 is east, PI/2 is south, -PI/2 is North, Pi/-Pi is West
    const deg = THREE.MathUtils.radToDeg(angle);

    if (deg >= -22.5 && deg < 22.5) return 'E';
    if (deg >= 22.5 && deg < 67.5) return 'SE';
    if (deg >= 67.5 && deg < 112.5) return 'S';
    if (deg >= 112.5 && deg < 157.5) return 'SW';
    if (deg >= 157.5 || deg < -157.5) return 'W';
    if (deg >= -157.5 && deg < -112.5) return 'NW';
    if (deg >= -112.5 && deg < -67.5) return 'N';
    if (deg >= -67.5 && deg < -22.5) return 'NE';

    return 'S'; // Fallback
  };

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    playerRef.current.copy(groupRef.current.position);
    if (!lightTarget.parent) groupRef.current.add(lightTarget);

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

      const checkX = moveX > 0 ? nextX + PLAYER_RADIUS : nextX - PLAYER_RADIUS;

      if (
        isWalkable(checkX, currZ - SHOULDER_WIDTH) &&
        isWalkable(checkX, currZ + SHOULDER_WIDTH)
      ) {
        groupRef.current.position.x = nextX;
      }

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

    state.camera.position.x = THREE.MathUtils.lerp(
      state.camera.position.x,
      groupRef.current.position.x,
      0.1
    );
    state.camera.position.z = THREE.MathUtils.lerp(
      state.camera.position.z,
      groupRef.current.position.z + 2,
      0.1
    );
    state.camera.lookAt(groupRef.current.position);

    const currentGridX = Math.round(groupRef.current.position.x / TILE_SIZE);
    const currentGridZ = Math.round(groupRef.current.position.z / TILE_SIZE);

    if (currentGridX !== prevTile.current.x || currentGridZ !== prevTile.current.z) {
      onStep(currentGridX, currentGridZ);
      prevTile.current = { x: currentGridX, z: currentGridZ };
    }
  });

  return (
    <group ref={groupRef} position={[2, 0.5, 2]}>
      {/* 3. LIGHTING SETUP */}

      {/* The "Self Glow" PointLight (Reduced intensity) */}
      <pointLight
        position={[0, 2, 0]}
        intensity={5} // Lowered from 5
        distance={8} // Shorter range
        decay={2}
        color="#ffcfa1"
      />

      {/* Torch Cone in direction facing */}
      <spotLight
        position={[0, 1.5, 0]} // Shoulder height
        target={lightTarget} // Look at the invisible target orb
        intensity={20} // Very bright cone
        angle={0.6} // Cone width (~35 degrees)
        penumbra={0.5} // Soft edges on the cone
        distance={30} // Far reach
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-normalBias={0.05}
        color="#fffbd6" // Slightly cooler/brighter white than the torch
      />

      <Character action={animation} direction={direction} position={[0, 0, 0]} />
    </group>
  );
};
