import * as THREE from 'three';

// Fix for strict typing
type ThreeShader = {
  uniforms: { [key: string]: { value: unknown } };
  vertexShader: string;
  fragmentShader: string;
};

export const SmartWallShader = {
  // We strictly export the compiler function now.
  // No shared 'uniforms' object here to prevent memory linking issues.
  onBeforeCompile: (shader: ThreeShader) => {
    // 1. Inject Uniforms
    shader.uniforms.uPlayerPos = { value: new THREE.Vector3(0, 0, 0) };
    shader.uniforms.uWallType = { value: 0.0 };
    shader.uniforms.uIsVertical = { value: 0.0 };

    // 2. Inject Varying for World Position
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `
      #include <common>
      varying vec3 vWorldPosition;
      `
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `
      #include <worldpos_vertex>
      vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
      `
    );

    // 3. Inject Fading Logic into Fragment Shader
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `
      #include <common>
      uniform vec3 uPlayerPos;
      uniform float uWallType;
      uniform float uIsVertical;
      varying vec3 vWorldPosition;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      #include <dithering_fragment>

      // --- SMART WALL LOGIC ---
      if (uWallType > 0.5) {
        // 1. Check "South" of player (add buffer -0.2)
        if (vWorldPosition.z > uPlayerPos.z - 0.2) {
          
          // 2. Determine Margin (0.3 for vertical, 1.5 for horizontal)
          // We use mix() instead of ternary for better GPU compatibility
          float margin = mix(1.5, 0.3, step(0.5, uIsVertical));

          // 3. Distance Check (X-axis only)
          float dist = abs(vWorldPosition.x - uPlayerPos.x);

          // 4. Calculate Fade
          float fade = smoothstep(margin - 0.5, margin + 0.5, dist);

          // Apply Fade (min opacity 0.15)
          gl_FragColor.a *= max(0.15, fade);
        }
      }
      `
    );
  },
};
