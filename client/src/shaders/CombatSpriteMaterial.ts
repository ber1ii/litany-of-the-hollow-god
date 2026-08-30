import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';

export const CombatSpriteMaterial = shaderMaterial(
  {
    map: new THREE.Texture(),
    maskMap: new THREE.Texture(),
    hasMask: 0.0,
    hitEffect: 0.0,
    effectColor: new THREE.Color(1, 1, 1),
    dissolveAmount: 0.0,
    severedLimbs: new THREE.Vector4(0, 0, 0, 0), // x=LeftArm, y=RightArm, z=LeftLeg, w=RightLeg
    time: 0.0,
    spriteRepeat: new THREE.Vector2(1, 1),
    spriteOffset: new THREE.Vector2(0, 0),
  },
  // Vertex Shader
  `
    varying vec2 vUv;
    uniform vec2 spriteRepeat;
    uniform vec2 spriteOffset;
    
    void main() {
      vUv = uv * spriteRepeat + spriteOffset;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment Shader
  `
    uniform sampler2D map;
    uniform sampler2D maskMap;
    uniform float hasMask;
    uniform float hitEffect;
    uniform vec3 effectColor;
    uniform float dissolveAmount;
    uniform vec4 severedLimbs;
    uniform float time;

    varying vec2 vUv;

    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    void main() {
      vec4 texColor = texture2D(map, vUv);
      if (texColor.a < 0.1) discard;

      if (hasMask > 0.5) {
        vec4 maskColor = texture2D(maskMap, vUv);

        // Yellow = Red + Green channels active (Right Leg / w)
        bool isYellow = maskColor.r > 0.5 && maskColor.g > 0.5;
        // Pure Red (Left Arm / x)
        bool isRed = maskColor.r > 0.5 && !isYellow;
        // Pure Green (Right Arm / y)
        bool isGreen = maskColor.g > 0.5 && !isYellow;
        // Pure Blue (Left Leg / z)
        bool isBlue = maskColor.b > 0.5 && !isYellow;

        if (isRed && severedLimbs.x > 0.5) discard;
        if (isGreen && severedLimbs.y > 0.5) discard;
        if (isBlue && severedLimbs.z > 0.5) discard;
        if (isYellow && severedLimbs.w > 0.5) discard;
      }

      float noise = random(vUv * 15.0);
      if (noise < dissolveAmount) discard;

      vec3 finalColor = mix(texColor.rgb, effectColor, hitEffect);

      if (dissolveAmount > 0.0 && noise < dissolveAmount + 0.08) {
         finalColor = mix(finalColor, vec3(0.8, 0.1, 0.0), 0.9); 
      }

      gl_FragColor = vec4(finalColor, texColor.a);
      
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `
);
