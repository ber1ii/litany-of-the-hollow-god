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
  const hasHit = useRef(false);

  const startVec = new THREE.Vector3(...startPos);
  const targetVec = new THREE.Vector3(...targetPos);

  const isBlood = type === 'blood_orb';
  const isVenom = type === 'green_venom';
  const isDagger = type === 'dagger';

  let projColor = '#9333ea';
  let lightColor = '#a855f7';

  if (isBlood) {
    projColor = '#dc2626';
    lightColor = '#ef4444';
  } else if (isVenom) {
    projColor = '#15803d';
    lightColor = '#22c55e';
  } else if (isDagger) {
    projColor = '#a855f7'; // Purple aura for weakening dagger
    lightColor = '#c084fc';
  }

  useFrame((_, delta) => {
    if (!meshRef.current || hasHit.current) return;

    // Fast travel speed for dagger, slower for spell orbs
    const speed = isDagger ? 4.0 : 2.5;
    progress.current += delta * speed;

    meshRef.current.position.lerpVectors(startVec, targetVec, Math.min(progress.current, 1));

    if (isDagger) {
      // Point blade towards target
      meshRef.current.lookAt(targetVec);
      meshRef.current.rotateX(Math.PI / 2); // Align cone point forward
    } else {
      meshRef.current.rotation.z += delta * 8;
    }

    if (progress.current >= 1) {
      hasHit.current = true;
      onHit();
    }
  });

  return (
    <mesh ref={meshRef} position={startPos}>
      {isDagger ? (
        <coneGeometry args={[0.08, 0.4, 8]} />
      ) : (
        <sphereGeometry args={[isBlood ? 0.25 : 0.35, 16, 16]} />
      )}
      <meshStandardMaterial color={projColor} roughness={0.3} metalness={isDagger ? 0.8 : 0.1} />
      <pointLight color={lightColor} intensity={2} distance={3} />
    </mesh>
  );
};
