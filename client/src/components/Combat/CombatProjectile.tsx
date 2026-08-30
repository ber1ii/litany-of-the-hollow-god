import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CombatProjectileProps {
  type: string;
  startPos: [number, number, number];
  targetPos: [number, number, number];
  onHit: () => void;
}

export const CombatProjectile: React.FC<CombatProjectileProps> = ({
  type,
  startPos,
  targetPos,
  onHit,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const progress = useRef(0);
  const hasHit = useRef(false); // Add this guard

  const startVec = new THREE.Vector3(...startPos);
  const targetVec = new THREE.Vector3(...targetPos);

  const isBlood = type === 'blood_orb';

  useFrame((_, delta) => {
    // Abort if the mesh is gone OR if we already registered the hit
    if (!meshRef.current || hasHit.current) return;

    progress.current += delta * 2.5;

    meshRef.current.position.lerpVectors(startVec, targetVec, Math.min(progress.current, 1));
    meshRef.current.rotation.z += delta * 8;

    if (progress.current >= 1) {
      hasHit.current = true; // Lock the trigger
      onHit();
    }
  });

  return (
    <mesh ref={meshRef} position={startPos}>
      <sphereGeometry args={[isBlood ? 0.25 : 0.35, 16, 16]} />
      <meshBasicMaterial color={isBlood ? '#dc2626' : '#9333ea'} wireframe={!isBlood} />
      <pointLight color={isBlood ? '#ef4444' : '#a855f7'} intensity={2} distance={3} />
    </mesh>
  );
};
