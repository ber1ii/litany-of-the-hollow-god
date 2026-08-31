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
  const hasHit = useRef(false); // Add this guard[cite: 17]

  const startVec = new THREE.Vector3(...startPos);
  const targetVec = new THREE.Vector3(...targetPos);

  const isBlood = type === 'blood_orb';
  const isVenom = type === 'green_venom';

  // Define colors based on projectile type
  let projColor = '#9333ea'; // default magic (purple)
  let lightColor = '#a855f7';

  if (isBlood) {
    projColor = '#dc2626'; // Red
    lightColor = '#ef4444';
  } else if (isVenom) {
    projColor = '#15803d'; // Green for Orc2
    lightColor = '#22c55e';
  }

  useFrame((_, delta) => {
    // Abort if the mesh is gone OR if we already registered the hit[cite: 17]
    if (!meshRef.current || hasHit.current) return;

    progress.current += delta * 2.5;

    meshRef.current.position.lerpVectors(startVec, targetVec, Math.min(progress.current, 1));
    meshRef.current.rotation.z += delta * 8;

    if (progress.current >= 1) {
      hasHit.current = true; // Lock the trigger[cite: 17]
      onHit();
    }
  });

  return (
    <mesh ref={meshRef} position={startPos}>
      <sphereGeometry args={[isBlood ? 0.25 : 0.35, 16, 16]} />
      <meshBasicMaterial color={projColor} wireframe={!isBlood} />
      <pointLight color={lightColor} intensity={2} distance={3} />
    </mesh>
  );
};
