import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TILE_SIZE } from './MapData';

interface CombatTransitionCameraProps {
  enemyPos: { x: number; z: number };
}

export const CombatTransitionCamera: React.FC<CombatTransitionCameraProps> = ({ enemyPos }) => {
  const targetPos = useRef(new THREE.Vector3(enemyPos.x * TILE_SIZE, 0.5, enemyPos.z * TILE_SIZE));

  useFrame((state) => {
    const desiredCamPos = new THREE.Vector3(
      targetPos.current.x,
      targetPos.current.y + 1.5,
      targetPos.current.z + 2.0
    );

    // Reduced from 0.15 to 0.02 for a slow, creeping camera movement
    state.camera.position.lerp(desiredCamPos, 0.02);

    state.camera.lookAt(targetPos.current);

    if (state.camera instanceof THREE.PerspectiveCamera) {
      // Reduced from 0.1 to 0.02 for a slow FOV zoom
      state.camera.fov = THREE.MathUtils.lerp(state.camera.fov, 30, 0.02);
      state.camera.updateProjectionMatrix();
    }
  });

  return null;
};
