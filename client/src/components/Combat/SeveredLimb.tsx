import { useRef, useState, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Mesh } from 'three';
import { Sparkles } from '@react-three/drei';

export type LimbVariant = 'flesh' | 'bone';

// Per-variant visual tuning. Add more variants here as new enemy families
// need their own look (e.g. 'ectoplasm', 'metal') instead of branching
// inline in the component.
const LIMB_VARIANT_STYLES: Record<
  LimbVariant,
  {
    color: string;
    debrisColor: string;
    debrisSize: number;
    debrisSpeed: number;
    debrisCount: number;
  }
> = {
  flesh: {
    color: '#5a0000',
    debrisColor: '#8a0303',
    debrisSize: 3,
    debrisSpeed: 0.2,
    debrisCount: 25,
  },
  bone: {
    color: '#d8d3c4', // off-white bone
    debrisColor: '#ece7d8', // pale bone-dust
    debrisSize: 2, // finer than blood droplets
    debrisSpeed: 0.35, // dust drifts a bit more than blood splatters
    debrisCount: 35, // denser puff, since dust particles read as smaller
  },
};

interface SeveredLimbProps {
  partId: string;
  initialPosition: [number, number, number];
  variant?: LimbVariant;
}

export const SeveredLimb = ({ partId, initialPosition, variant = 'flesh' }: SeveredLimbProps) => {
  const meshRef = useRef<Mesh>(null);
  const [isSettled, setIsSettled] = useState(false);
  const style = LIMB_VARIANT_STYLES[variant];

  // Stable, deterministic initial ref values — no impure calls here, so
  // this is safe to construct during render. The actual randomization
  // happens in useLayoutEffect below, since Math.random() can only run
  // outside render (in an effect or event handler), never inside it —
  // guarding with an `if (ref.current === null)` check in the render body
  // is not sufficient for this project's lint rule.
  const velocity = useRef(new Vector3());
  const rotationSpeed = useRef(0);

  // Runs once, synchronously after mount and before the browser paints (so
  // useFrame never ticks with an un-randomized velocity). Mutates the
  // existing Vector3/number in place rather than replacing the ref, since
  // ref writes are fine in effects.
  useLayoutEffect(() => {
    velocity.current.set(
      (Math.random() - 0.5) * 8, // Random X arc
      Math.random() * 5 + 5, // Upward Y burst
      (Math.random() - 0.5) * 2 // Slight Z depth
    );
    rotationSpeed.current = (Math.random() - 0.5) * 15;
  }, []);

  // Constants
  const GRAVITY = 25;
  const BOUNCE_DAMPING = 0.4;
  const FRICTION = 0.7;
  const FLOOR_HEIGHT = 0; // Adjust to match your AtlasFloor Y-coordinate

  useFrame((_state, delta) => {
    if (!meshRef.current || isSettled) return;

    // Apply gravity
    velocity.current.y -= GRAVITY * delta;

    // Apply velocity to position
    meshRef.current.position.addScaledVector(velocity.current, delta);

    // Spin while flying
    meshRef.current.rotation.z += rotationSpeed.current * delta;

    // Ground collision
    if (meshRef.current.position.y <= FLOOR_HEIGHT) {
      meshRef.current.position.y = FLOOR_HEIGHT;
      velocity.current.y *= -BOUNCE_DAMPING;

      // Horizontal friction
      velocity.current.x *= FRICTION;
      velocity.current.z *= FRICTION;

      // Stop simulating when the bounce energy is depleted
      if (Math.abs(velocity.current.y) < 0.5) {
        setIsSettled(true);
      }
    }
  });

  return (
    <mesh ref={meshRef} position={initialPosition} name={partId} castShadow>
      {/* Placeholder flesh/bone chunk - replace with sprite if you add limb textures later */}
      <boxGeometry args={[0.3, 0.3, 0.3]} />
      <meshStandardMaterial color={style.color} roughness={0.8} />

      {/* Debris trail effect: Renders only while moving. Blood for flesh
          enemies, pale dust puff for bone/undead enemies. */}
      {!isSettled && (
        <Sparkles
          count={style.debrisCount}
          scale={1.5}
          size={style.debrisSize}
          speed={style.debrisSpeed}
          opacity={0.8}
          color={style.debrisColor}
        />
      )}
    </mesh>
  );
};
