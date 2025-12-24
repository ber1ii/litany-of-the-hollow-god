import * as THREE from 'three';

export const SanityShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSanity: { value: 1.0 },
    uTime: { value: 0.0 },
    uResolution: { value: new THREE.Vector2() },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uSanity;
    uniform float uTime;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    void main() {
      // 0.0 = Sane, 1.0 = Total Madness
      float madness = 1.0 - uSanity; 
      
      vec2 uv = vUv;
      
      // --- 1. SCREEN WARPING (Subtle & Thresholded) ---
      // Only starts warping if Sanity is below 70% (madness > 0.3)
      if (madness > 0.3) {
        // Remap madness 0.3->1.0 to 0.0->1.0 for smoother ramp
        float warpFactor = (madness - 0.3) / 0.7; 
        
        // Much gentler wave strength (0.01 max instead of 0.03)
        float waveStrength = 0.01 * warpFactor; 
        
        uv.x += sin(uv.y * 10.0 + uTime * 1.5) * waveStrength;
        
        // Breathing is very subtle now
        float breathe = sin(uTime) * 0.02 * warpFactor;
        uv -= 0.5;
        uv *= (1.0 - breathe);
        uv += 0.5;
      }

      // --- 2. CHROMATIC ABERRATION (RGB Shift) ---
      // Starts small, scales gently.
      // 0.001 is barely visible, 0.01 is noticeable but playable.
      float shift = 0.001 + (madness * 0.008);
      
      // Glitch twitch only at very low sanity (< 20%)
      if (madness > 0.8 && random(vec2(uTime, 0.0)) > 0.98) {
        shift += 0.02; 
      }

      vec4 r = texture2D(tDiffuse, uv + vec2(shift, 0.0));
      vec4 g = texture2D(tDiffuse, uv);
      vec4 b = texture2D(tDiffuse, uv - vec2(shift, 0.0));
      
      vec3 color = vec3(r.r, g.g, b.b);

      // --- 3. COLOR GRADING (Desaturation, not Blackening) ---
      // Only starts desaturating after 80% sanity
      if (madness > 0.2) {
        float gray = dot(color, vec3(0.299, 0.587, 0.114));
        vec3 mossGreen = vec3(gray * 0.6, gray * 0.7, gray * 0.6); // Lighter moss
        
        // Max mix is 0.6 (60%) so original colors always show through slightly
        color = mix(color, mossGreen, madness * 0.6);
      }

      // --- 4. VIGNETTE (Uneasy, not Blind) ---
      // Pulse only starts at < 50% sanity
      float pulse = 0.0;
      if (madness > 0.5) {
        pulse = sin(uTime * 3.0) * 0.05 * (madness - 0.5);
      }
      
      float radius = 0.8 - (madness * 0.3) + pulse;
      float dist = length(uv - 0.5);
      
      // smoothstep from radius to radius+0.4
      float vigVal = smoothstep(radius, radius - 0.6, dist);
      
      // CLAMP: Ensure vignette never makes pixels darker than 20% brightness
      // This prevents the "Pitch Black" screen issue.
      vigVal = max(0.2, vigVal);
      
      color *= vigVal;

      // --- 5. NOISE ---
      // Subtle film grain
      float noise = random(uv + uTime) * (0.02 + madness * 0.1);
      color -= noise;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};
