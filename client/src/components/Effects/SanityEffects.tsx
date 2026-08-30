import React, { forwardRef, useMemo } from 'react';
import { EffectComposer } from '@react-three/postprocessing';
import { Effect, EffectAttribute } from 'postprocessing';
import * as THREE from 'three';
import { sanityFragmentShader } from './SanityShader';
import { usePlayerStore } from '../../hooks/usePlayerStore';

class SanityEffectImpl extends Effect {
  constructor() {
    super('SanityEffect', sanityFragmentShader, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, THREE.Uniform>([
        ['uSanity', new THREE.Uniform(1.0)],
        ['uTime', new THREE.Uniform(0.0)],
      ]),
    });
  }

  update(_renderer: THREE.WebGLRenderer, _inputBuffer: THREE.WebGLRenderTarget, deltaTime: number) {
    const timeUniform = this.uniforms.get('uTime');
    if (timeUniform) {
      timeUniform.value += deltaTime;
    }
  }
}

const SanityEffectPrimitive = forwardRef<SanityEffectImpl, { normalizedSanity: number }>(
  ({ normalizedSanity }, ref) => {
    const effect = useMemo(() => new SanityEffectImpl(), []);

    const sanityUniform = effect.uniforms.get('uSanity');
    if (sanityUniform) {
      sanityUniform.value = normalizedSanity;
    }

    return <primitive ref={ref} object={effect} dispose={null} />;
  }
);
SanityEffectPrimitive.displayName = 'SanityEffectPrimitive';

interface SanityEffectsProps {
  sanity?: number;
  maxSanity?: number;
}

export const SanityEffects: React.FC<SanityEffectsProps> = ({
  sanity: propSanity,
  maxSanity: propMaxSanity,
}) => {
  const storeStats = usePlayerStore((state) => state.stats);

  const sanity = propSanity ?? storeStats?.sanity ?? 100;
  const maxSanity = propMaxSanity ?? storeStats?.maxSanity ?? 100;

  const safeMax = maxSanity || 100;
  const normalizedSanity = Math.max(0, Math.min(1, sanity / safeMax));

  return (
    <EffectComposer>
      <SanityEffectPrimitive normalizedSanity={normalizedSanity} />
    </EffectComposer>
  );
};
