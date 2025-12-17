// components/Combat/CombatScene.tsx
import React, { useState, useEffect } from 'react';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { CombatUnit } from './CombatUnit';

interface CombatSceneProps {
  onBattleEnd: (victory: boolean) => void;
}

export const CombatScene: React.FC<CombatSceneProps> = ({ onBattleEnd }) => {
  const [turn, setTurn] = useState<'player' | 'enemy'>('player');
  const { camera } = useThree();

  useEffect(() => {
    const originalPos = camera.position.clone();
    const originalRot = camera.rotation.clone();

    camera.position.set(0, 1.5, 6);
    camera.lookAt(0, 0.5, 0);

    return () => {
      camera.position.copy(originalPos);
      camera.rotation.copy(originalRot);
    };
  }, [camera]);

  const FLOOR_LEVEL = -0.8;

  return (
    <group>
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 5, 2]} intensity={2} color="#ffffff" />
      <pointLight position={[-3, 2, 2]} intensity={5} color="#4444ff" distance={10} />
      <pointLight position={[3, 2, 2]} intensity={5} color="#ff4444" distance={10} />

      {/* 1. HERO */}
      <CombatUnit
        textureUrl="/sprites/combat/knight/Idle.png"
        frames={8}
        columns={2}
        rows={4}
        // FIX: Position Y is now the floor level exactly
        position={[-2, FLOOR_LEVEL, 0]}
        height={3} // Adjust height if you want him bigger/smaller
      />

      {/* 2. SKELETON */}
      <CombatUnit
        textureUrl="/sprites/combat/skeleton/idle.png"
        frames={3}
        columns={3}
        rows={1}
        position={[2, FLOOR_LEVEL, 0]}
        height={3}
        flip={true}
      />

      {/* Background */}
      <mesh position={[0, 0, -2]}>
        <planeGeometry args={[20, 12]} />
        <meshBasicMaterial color="#1a1a1a" />
      </mesh>

      {/* Floor Visual */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_LEVEL, 0]}>
        <planeGeometry args={[20, 10]} />
        <meshBasicMaterial color="#0f0f0f" />
      </mesh>

      {/* UI Overlay */}
      <Html position={[0, 0, 0]} center>
        <div className="flex flex-col items-center gap-4 select-none">
          <h1 className="text-4xl text-red-600 font-bold font-mono tracking-widest text-shadow-md">
            COMBAT
          </h1>
          <div className="bg-gray-900 border-2 border-white p-6 rounded-lg text-white font-mono min-w-[300px] text-center shadow-lg">
            <p className="mb-4 text-xl">
              TURN: <span className="text-yellow-400">{turn.toUpperCase()}</span>
            </p>
            <div className="flex justify-center gap-4">
              <button
                className="px-6 py-2 bg-blue-800 hover:bg-blue-700 rounded border border-blue-500 transition-colors"
                onClick={() => setTurn(turn === 'player' ? 'enemy' : 'player')}
              >
                SKIP
              </button>
              <button
                className="px-6 py-2 bg-red-800 hover:bg-red-700 rounded border border-red-500 transition-colors"
                onClick={() => onBattleEnd(true)}
              >
                WIN
              </button>
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
};
