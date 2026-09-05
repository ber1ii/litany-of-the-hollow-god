import * as THREE from 'three';

// Fix for strict typing
type ThreeShader = {
  uniforms: { [key: string]: { value: unknown } };
  vertexShader: string;
  fragmentShader: string;
};

export const SmartWallShader = {
  onBeforeCompile: (shader: ThreeShader) => {
    // 1. Inject Uniforms
    shader.uniforms.uPlayerPos = { value: new THREE.Vector3(0, 0, 0) };
    shader.uniforms.uWallType = { value: 0.0 };
    shader.uniforms.uIsVertical = { value: 0.0 };

    // 2. Inject Varyings for Box Anchor + Face Role
    // vBoxAnchor is ONE point per wall box (its mesh/instance origin in
    // world space), the same for every vertex on every face of that box.
    // Using a shared anchor instead of each fragment's own world position
    // is what keeps front/back/side/top faces of a single box in perfect
    // agreement, and keeps adjacent boxes from disagreeing with each
    // other at the seam where they touch.
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `
      #include <common>
      varying vec3 vBoxAnchor;
      `
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `
      #include <worldpos_vertex>
      #ifdef USE_INSTANCING
        vBoxAnchor = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      #else
        vBoxAnchor = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      #endif
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
      varying vec3 vBoxAnchor;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      #include <dithering_fragment>

      // --- SMART WALL LOGIC ---
      // Every face of a box (front/back/side/top) reads the SAME
      // vBoxAnchor, so they all compute the identical fade value and
      // fade in lockstep. That's what removes the seam: two adjacent
      // boxes each fade as one solid unit instead of one face fading
      // while its neighbor's side face stays pinned opaque.
      if (uWallType > 0.5) {
        // 1. Check "South" of player (add buffer -0.2)
        if (vBoxAnchor.z > uPlayerPos.z - 0.2) {

          // 2. Determine Margin (0.3 for vertical, 1.5 for horizontal)
          // We use mix() instead of ternary for better GPU compatibility
          float margin = mix(1.5, 0.3, step(0.5, uIsVertical));

          // 3. Distance Check (X-axis only), from the box's anchor
          float dist = abs(vBoxAnchor.x - uPlayerPos.x);

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
