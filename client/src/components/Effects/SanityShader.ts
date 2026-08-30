export const sanityFragmentShader = /* glsl */ `
  uniform float uSanity;
  uniform float uTime;

  float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    // 0.0 = Sane, 1.0 = Total Madness
    float madness = 1.0 - uSanity;

    vec2 warpedUv = uv;

    // --- 1. SCREEN WARPING (Subtle & Thresholded) ---
    if (madness > 0.3) {
      float warpFactor = (madness - 0.3) / 0.7;
      float waveStrength = 0.01 * warpFactor;

      warpedUv.x += sin(warpedUv.y * 10.0 + uTime * 1.5) * waveStrength;

      float breathe = sin(uTime) * 0.02 * warpFactor;
      warpedUv -= 0.5;
      warpedUv *= (1.0 - breathe);
      warpedUv += 0.5;
    }

    // --- 2. CHROMATIC ABERRATION (RGB Shift) ---
    float shift = 0.001 + (madness * 0.014);

    // Glitch twitch kicks in earlier/more often — this is the primary
    // "impairment" signal now, not darkness.
    if (madness > 0.6 && random(vec2(uTime, 0.0)) > 0.96) {
      shift += 0.025;
    }

    vec4 r = texture2D(inputBuffer, warpedUv + vec2(shift, 0.0));
    vec4 g = texture2D(inputBuffer, warpedUv);
    vec4 b = texture2D(inputBuffer, warpedUv - vec2(shift, 0.0));

    vec3 color = vec3(r.r, g.g, b.b);

    // --- 3. COLOR GRADING (Desaturation, not Blackening) ---
    if (madness > 0.2) {
      float gray = dot(color, vec3(0.299, 0.587, 0.114));
      vec3 mossGreen = vec3(gray * 0.85, gray * 0.95, gray * 0.85);
      color = mix(color, mossGreen, madness * 0.5);
    }

    // --- 4. VIGNETTE (Uneasy, not Blind) ---
    float pulse = 0.0;
    if (madness > 0.5) {
      pulse = sin(uTime * 3.0) * 0.05 * (madness - 0.5);
    }

    if (madness > 0.15) {
      float radius = 0.85 - (madness * 0.15) + pulse;
      float dist = length(warpedUv - 0.5);

      float vigVal = smoothstep(radius, radius - 0.6, dist);
      vigVal = max(0.5, vigVal);

      color *= vigVal;
    }

    // --- 5. NOISE ---
    if (madness > 0.15) {
      float noise = random(warpedUv + uTime) * (0.01 + madness * 0.04);
      color -= noise;
    }

    outputColor = vec4(color, inputColor.a);
  }
`;
