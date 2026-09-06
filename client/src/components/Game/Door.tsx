import React, { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TILE_SIZE, DOOR_WIDTH, DOOR_HEIGHT, WALL_TOTAL_HEIGHT, WALL_THICKNESS } from './MapData';
import { SHEET_CONFIG } from '../../data/TileRegistry';
import { SmartWallShader } from '../Materials/SmartFadeMaterial';

interface DoorProps {
  x: number;
  z: number;
  isOpen: boolean;
  isLocked?: boolean;
  rotation?: number;
  playerPos: React.RefObject<THREE.Vector3>;
}

export const Door: React.FC<DoorProps> = ({ x, z, isOpen, isLocked, rotation = 0, playerPos }) => {
  const rawAtlas = useTexture('/textures/sheets/mainlevbuild.png');
  const rawWall = useTexture('/textures/environment/ground_stone.png');
  const isVertical = Math.abs(rotation) > 0.1;

  const { doorTexture, wallTexture } = useMemo(() => {
    const wT = rawWall.clone();
    wT.magFilter = THREE.NearestFilter;
    wT.colorSpace = THREE.SRGBColorSpace;
    wT.wrapS = THREE.RepeatWrapping;
    wT.wrapT = THREE.RepeatWrapping;

    const dT = rawAtlas.clone();
    dT.magFilter = THREE.NearestFilter;
    dT.minFilter = THREE.NearestFilter;
    dT.colorSpace = THREE.SRGBColorSpace;

    const col = 34;
    const row = 18;
    const w = 1;
    const h = 2;

    const totalCols = SHEET_CONFIG.width / SHEET_CONFIG.tileSize;
    const totalRows = SHEET_CONFIG.height / SHEET_CONFIG.tileSize;

    dT.repeat.set(w / totalCols, h / totalRows);
    dT.offset.x = col / totalCols;
    dT.offset.y = (totalRows - row - h) / totalRows;

    return { doorTexture: dT, wallTexture: wT };
  }, [rawAtlas, rawWall]);

  useEffect(() => {
    return () => {
      doorTexture.dispose();
      wallTexture.dispose();
    };
  }, [doorTexture, wallTexture]);

  // --- SMART MATERIALS ---
  const jambMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: '#222528', // Matches inner wall fill
      roughness: 0.95,
      transparent: true,
      depthWrite: true,
    });
    mat.onBeforeCompile = (shader) => {
      SmartWallShader.onBeforeCompile(shader);
      mat.userData.shader = shader;
      shader.uniforms.uWallType.value = 0.0; // doors never fade
      shader.uniforms.uIsVertical.value = isVertical ? 1.0 : 0.0;
    };
    return mat;
  }, [isVertical]);

  const grateMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      map: doorTexture,
      transparent: true,
      side: THREE.DoubleSide,
      color: isLocked ? '#ffaaaa' : '#ffffff',
      // Removed standard alphaTest to prevent the door from instantly vanishing when fade drops alpha below 0.5
    });
    mat.onBeforeCompile = (shader) => {
      SmartWallShader.onBeforeCompile(shader);
      mat.userData.shader = shader;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
      #include <map_fragment>
      #ifdef USE_MAP
        if (diffuseColor.a < 0.5) discard;
      #endif
      `
      );

      shader.uniforms.uWallType.value = 0.0; // doors never fade
      shader.uniforms.uIsVertical.value = isVertical ? 1.0 : 0.0;
    };
    return mat;
  }, [doorTexture, isLocked, isVertical]);

  const fillerMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      map: wallTexture,
      color: '#ffffff',
      roughness: 0.8,
      transparent: true,
      depthWrite: true,
    });
    mat.onBeforeCompile = (shader) => {
      SmartWallShader.onBeforeCompile(shader);
      mat.userData.shader = shader;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
      #include <map_fragment>
      #ifdef USE_MAP
        diffuseColor.rgb = mix(vec3(0.025, 0.027, 0.030), diffuseColor.rgb, diffuseColor.a);
        diffuseColor.a = 1.0; 
      #endif
      `
      );

      shader.uniforms.uWallType.value = 1.0; // filler fades like a normal wall
      shader.uniforms.uIsVertical.value = isVertical ? 1.0 : 0.0;
    };
    return mat;
  }, [wallTexture, isVertical]);

  // --- UNIFORM UPDATES ---
  useFrame(() => {
    if (playerPos.current) {
      if (jambMaterial.userData.shader) {
        jambMaterial.userData.shader.uniforms.uPlayerPos.value.copy(playerPos.current);
      }
      if (grateMaterial.userData.shader) {
        grateMaterial.userData.shader.uniforms.uPlayerPos.value.copy(playerPos.current);
      }
      if (fillerMaterial.userData.shader) {
        fillerMaterial.userData.shader.uniforms.uPlayerPos.value.copy(playerPos.current);
      }
    }
  });

  const FILLER_HEIGHT = WALL_TOTAL_HEIGHT - DOOR_HEIGHT;

  const { slideOffset } = useSpring({
    slideOffset: isOpen ? DOOR_WIDTH * 0.85 : 0,
    config: { mass: 1, tension: 120, friction: 20 },
  });

  const jambXOffset = DOOR_WIDTH / 2;

  return (
    <group position={[x * TILE_SIZE, 0, z * TILE_SIZE]} rotation={[0, rotation, 0]}>
      <group>
        <mesh
          position={[-jambXOffset, DOOR_HEIGHT / 2, 0]}
          material={jambMaterial}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.04, DOOR_HEIGHT, WALL_THICKNESS]} />
        </mesh>
        <mesh
          position={[jambXOffset, DOOR_HEIGHT / 2, 0]}
          material={jambMaterial}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.04, DOOR_HEIGHT, WALL_THICKNESS]} />
        </mesh>
      </group>

      <animated.group position-x={slideOffset}>
        <mesh position={[0, DOOR_HEIGHT / 2, 0]} material={grateMaterial} castShadow receiveShadow>
          <planeGeometry args={[DOOR_WIDTH, DOOR_HEIGHT]} />
        </mesh>
      </animated.group>

      <mesh
        position={[0, DOOR_HEIGHT + FILLER_HEIGHT / 2, 0]}
        material={fillerMaterial}
        receiveShadow
      >
        <boxGeometry args={[TILE_SIZE, FILLER_HEIGHT, WALL_THICKNESS]} />
      </mesh>
    </group>
  );
};
