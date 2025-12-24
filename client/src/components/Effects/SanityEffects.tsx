import React, { useRef } from 'react';
import { useFrame, useThree, extend } from '@react-three/fiber';
import { Effects } from '@react-three/drei';
// @ts-ignore
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { SanityShader } from './SanityShader';
import * as THREE from 'three';

extend({ ShaderPass });

interface SanityEffectsProps {
  sanity: number;
  maxSanity: number;
}

export const SanityEffects: React.FC<SanityEffectsProps> = ({ sanity, maxSanity }) => {
  const shaderRef = useRef<ShaderPass>(null);
  const { size } = useThree();

  // Safety check to prevent NaN
  const safeMax = maxSanity || 100;
  const normalizedSanity = Math.max(0, Math.min(1, sanity / safeMax));

  useFrame((state) => {
    // Access the reference
    const pass = shaderRef.current;

    // We check for 'pass.material' to ensure the shader program exists
    if (pass && pass.material) {
      pass.material.uniforms.uTime.value = state.clock.getElapsedTime();
      pass.material.uniforms.uSanity.value = normalizedSanity;
    }
  });

  return (
    <Effects>
      {/* @ts-ignore */}
      <shaderPass
        ref={shaderRef}
        attach="passes"
        args={[SanityShader]}
        uniforms-uResolution-value={new THREE.Vector2(size.width, size.height)}
        renderToScreen
      />
    </Effects>
  );
};
