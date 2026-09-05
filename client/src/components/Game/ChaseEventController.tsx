import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import type { ChaseEventState } from '../../types/EventTypes';
import { AudioManager } from '../../managers/AudioManager';
import {
  CAM_OFFSET_Y,
  CAM_OFFSET_Z,
  MOVEMENT_SPEED,
  MONSTER_SCALE,
  TILE_SIZE,
  generateCollisionGrid,
} from './MapData';

interface ChaseEventProps {
  playerRef: React.RefObject<THREE.Vector3>;
  trigger1Pos: THREE.Vector3;
  trigger2Pos: THREE.Vector3;
  map: number[][];
  onPlayerCaught: () => void;
  onCinematicStart: () => void;
  onCinematicEnd: () => void;
  onSetSwordless: (val: boolean) => void;
  onShowPanicPrompt: (val: boolean) => void;
  onSetChaseFov: (isChasing: boolean) => void;
  onChaseActiveChange?: (isActive: boolean) => void;
  onBoulderLanded?: (pos: { x: number; z: number }) => void;
  playerRotRef: React.MutableRefObject<number>;
}

const VAMPIRE_BOSS_SHEET = {
  url: '/sprites/characters/vampire_boss/Vampires3_Walk_full.png',
  cols: 6,
  rows: 4,
};
const DIRECTION_ROW_MAP: Record<'S' | 'N' | 'W' | 'E', number> = { S: 0, N: 1, W: 2, E: 3 };

const BOSS_CHASE_SPEED = MOVEMENT_SPEED * 0.85;
const BOSS_BEHIND_DISTANCE = 3; // tiles back from the boulder point, toward trigger1 — reads as "trapped in the room behind"
const ESCAPE_ADVANCE_DISTANCE = TILE_SIZE * 6; // player must clear this far past trigger2 before the boulder cutscene locks in

// Raycast against the whole scene is expensive when done every frame.
// Every 4th frame is plenty for a smoothing camera-collision check — the
// camera itself is lerping toward the result, so a few-frame-old value
// (~50ms) is visually indistinguishable but cuts this cost by ~75%.
const RAYCAST_THROTTLE = 4;

const getCardinalDirection = (dx: number, dz: number): 'N' | 'S' | 'E' | 'W' => {
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? 'E' : 'W';
  return dz > 0 ? 'S' : 'N';
};

export const ChaseEventController: React.FC<ChaseEventProps> = ({
  playerRef,
  playerRotRef,
  trigger1Pos,
  trigger2Pos,
  map,
  onPlayerCaught,
  onCinematicStart,
  onCinematicEnd,
  onSetSwordless,
  onShowPanicPrompt,
  onSetChaseFov,
  onChaseActiveChange,
  onBoulderLanded,
}) => {
  const [eventState, setEventState] = useState<ChaseEventState>('IDLE');
  const [bossDirection, setBossDirection] = useState<'N' | 'S' | 'E' | 'W'>('S');

  const bossPos = useRef(new THREE.Vector3());
  const cameraTarget = useRef(new THREE.Vector3());
  const timer = useRef(0);
  const shakeTimer = useRef(0);
  const hasPassedTrigger2 = useRef(false);

  const [isBoulderDropped, setIsBoulderDropped] = useState(false);
  const boulderY = useRef(10);

  const bossGroupRef = useRef<THREE.Group>(null);
  const bossMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const boulderMeshRef = useRef<THREE.Mesh>(null);
  const raycaster = useRef(new THREE.Raycaster()).current;
  const wallsGroupRef = useRef<THREE.Object3D | null>(null);

  // Reusable scratch vectors — every one of these used to be a `new
  // THREE.Vector3(...)` or `.clone()` created every single frame, which is
  // exactly the kind of steady GC pressure that shows up as random lag
  // spikes even on strong hardware. None of these need to persist across
  // frames, so a single shared instance per purpose is safe.
  const tmpDir = useRef(new THREE.Vector3()).current; // moveBossToward's direction calc
  const tmpFlatA = useRef(new THREE.Vector3()).current; // flattened (y=0) distance checks
  const tmpFlatB = useRef(new THREE.Vector3()).current;
  const tmpDesired = useRef(new THREE.Vector3()).current; // desired camera position per pan state
  const tmpLookTarget = useRef(new THREE.Vector3()).current; // camera lookAt target
  const tmpRayDir = useRef(new THREE.Vector3()).current; // getSafeCameraPos's ray direction
  const cachedSafePos = useRef(new THREE.Vector3()).current; // getSafeCameraPos's last computed/throttled result
  const raycastFrameCount = useRef(0);

  const rawTexture = useTexture(VAMPIRE_BOSS_SHEET.url);
  const bossTexture = useMemo(() => {
    const tex = rawTexture.clone();
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1 / VAMPIRE_BOSS_SHEET.cols, 1 / VAMPIRE_BOSS_SHEET.rows);
    tex.needsUpdate = true;
    return tex;
  }, [rawTexture]);

  const collisionGrid = useMemo(() => generateCollisionGrid(map), [map]);

  const isBlocked = (x: number, z: number) => {
    const gridX = Math.round(x / TILE_SIZE);
    const gridZ = Math.round(z / TILE_SIZE);
    if (gridZ < 0 || gridZ >= map.length || gridX < 0 || gridX >= map[0].length) return true;
    return collisionGrid[gridZ][gridX];
  };

  const moveBossToward = (target: THREE.Vector3, speed: number, delta: number) => {
    // Was: `const dir = new THREE.Vector3().subVectors(target, bossPos.current);`
    // Runs every frame for the entire chase — now reuses a scratch vector.
    tmpDir.subVectors(target, bossPos.current);
    tmpDir.y = 0;
    if (tmpDir.lengthSq() < 0.0001) return;
    tmpDir.normalize();

    const step = speed * delta;
    const nextX = bossPos.current.x + tmpDir.x * step;
    const nextZ = bossPos.current.z + tmpDir.z * step;

    if (!isBlocked(nextX, bossPos.current.z)) {
      bossPos.current.x = nextX;
    }
    if (!isBlocked(bossPos.current.x, nextZ)) {
      bossPos.current.z = nextZ;
    }
  };

  const getSafeCameraPos = (
    from: THREE.Vector3,
    desired: THREE.Vector3,
    scene: THREE.Scene
  ): THREE.Vector3 => {
    // Was: `new THREE.Vector3().subVectors(...)` every call, plus
    // `from.clone().add(...)` on every hit — both every frame during any
    // camera-pan state. Now reuses scratch vectors.
    tmpRayDir.subVectors(desired, from);
    const dist = tmpRayDir.length();
    if (dist < 0.01) {
      cachedSafePos.copy(desired);
      return cachedSafePos;
    }
    tmpRayDir.normalize();

    // Throttle the actual scene-wide raycast — `intersectObjects` walking
    // the whole scene graph recursively every frame was the single most
    // expensive thing happening during camera pans. Reusing the last
    // result on skipped frames is imperceptible since the camera is
    // lerping toward it anyway.
    const doRaycast = raycastFrameCount.current % RAYCAST_THROTTLE === 0;
    raycastFrameCount.current += 1;
    if (!doRaycast) {
      return cachedSafePos;
    }

    if (!wallsGroupRef.current) {
      wallsGroupRef.current = scene.getObjectByName('level-walls') ?? null;
    }
    const raycastTargets = wallsGroupRef.current ? wallsGroupRef.current.children : scene.children;

    raycaster.set(from, tmpRayDir);
    raycaster.far = dist;
    const hits = raycaster.intersectObjects(raycastTargets, true);
    if (hits.length > 0) {
      const safeDist = Math.max(hits[0].distance - 0.3, 0.5);
      cachedSafePos.copy(from).add(tmpRayDir.multiplyScalar(safeDist));
      return cachedSafePos;
    }
    cachedSafePos.copy(desired);
    return cachedSafePos;
  };

  useFrame((state, delta) => {
    if (!playerRef.current) return;
    // A single big delta (e.g. from a chunk-load hitch) would otherwise blow
    // straight through timer.current thresholds and lerp-distance checks in
    // one frame, collapsing the whole cinematic invisibly. Clamp it.
    delta = Math.min(delta, 1 / 30);
    const playerPos = playerRef.current;

    // --- STATE 0: DETECT TRIGGER 1 ---
    if (eventState === 'IDLE') {
      // Was: two `new THREE.Vector3(...)` every frame, for as long as the
      // player is anywhere on this level before the chase triggers.
      tmpFlatA.set(playerPos.x, 0, playerPos.z);
      tmpFlatB.set(trigger1Pos.x, 0, trigger1Pos.z);

      if (tmpFlatA.distanceTo(tmpFlatB) < 1.5) {
        const angle = playerRotRef.current;
        const behind = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(-3);
        bossPos.current.copy(playerPos).add(behind);
        setBossDirection(
          getCardinalDirection(playerPos.x - bossPos.current.x, playerPos.z - bossPos.current.z)
        );
        AudioManager.play('vampire-spawn-in', { category: 'sfx' });

        onCinematicStart();
        setEventState('SPAWN_BOSS');
      }
    }

    // --- STATE 1: PAN CAMERA TO BOSS ---
    if (eventState === 'SPAWN_BOSS') {
      // Was: `bossPos.current.clone().add(new THREE.Vector3(0, 1.5, 3))` every frame.
      tmpDesired.copy(bossPos.current);
      tmpDesired.y += 1.5;
      tmpDesired.z += 3;
      cameraTarget.current.copy(getSafeCameraPos(bossPos.current, tmpDesired, state.scene));
      state.camera.position.lerp(cameraTarget.current, delta * 4);
      state.camera.lookAt(bossPos.current);

      if (state.camera.position.distanceTo(cameraTarget.current) < 0.3) {
        timer.current = 0;
        setEventState('PAN_TO_BOSS');
      }
    }

    // --- STATE 2: HOLD ON BOSS & PAN BACK ---
    if (eventState === 'PAN_TO_BOSS') {
      timer.current += delta;
      state.camera.lookAt(bossPos.current);
      if (timer.current > 1.2) {
        setEventState('PAN_TO_PLAYER');
      }
    }

    if (eventState === 'PAN_TO_PLAYER') {
      // Was: two separate `.clone().add(new THREE.Vector3(...))` every frame.
      tmpDesired.copy(playerPos);
      tmpDesired.y += CAM_OFFSET_Y;
      tmpDesired.z += CAM_OFFSET_Z;
      cameraTarget.current.copy(getSafeCameraPos(playerPos, tmpDesired, state.scene));
      state.camera.position.lerp(cameraTarget.current, delta * 5);

      tmpLookTarget.copy(playerPos);
      tmpLookTarget.z -= 1.0;
      state.camera.lookAt(tmpLookTarget);

      if (state.camera.position.distanceTo(cameraTarget.current) < 0.3) {
        onSetSwordless(true);
        onShowPanicPrompt(true);
        timer.current = 0;
        setEventState('SWORD_DROP_PROMPT');
      }
    }

    // --- STATE 3: DISPLAY PROMPT & START CHASE ---
    if (eventState === 'SWORD_DROP_PROMPT') {
      timer.current += delta;
      state.camera.lookAt(playerPos);
      if (timer.current > 2.0) {
        onShowPanicPrompt(false);
        onCinematicEnd();
        onSetChaseFov(true); // widen FOV — boss stays in frame during the chase
        onChaseActiveChange?.(true); // player speed boost kicks in via isChased
        AudioManager.playBGM('combat-ost');
        setEventState('CHASE_ACTIVE');
      }
    }

    // --- STATE 4: CHASE AI & ESCAPE/DEATH CHECKS ---
    if (eventState === 'CHASE_ACTIVE') {
      const dx = playerPos.x - bossPos.current.x;
      const dz = playerPos.z - bossPos.current.z;
      const newDir = getCardinalDirection(dx, dz);
      if (newDir !== bossDirection) setBossDirection(newDir);

      moveBossToward(playerPos, BOSS_CHASE_SPEED, delta);

      if (bossPos.current.distanceTo(playerPos) < 1.0) {
        setEventState('CAUGHT');
        onSetChaseFov(false); // revert FOV — chase ended in a death, not the boulder
        onChaseActiveChange?.(false);
        AudioManager.stopBGM();
        onPlayerCaught();
      }

      // Was: two `new THREE.Vector3(...)` every frame for the entire chase
      // duration — the single biggest steady-state allocation cost during
      // the segment you're feeling the spikes in.
      tmpFlatA.set(playerPos.x, 0, playerPos.z);
      tmpFlatB.set(trigger2Pos.x, 0, trigger2Pos.z);
      const distPastTrigger2 = tmpFlatA.distanceTo(tmpFlatB);

      if (!hasPassedTrigger2.current && distPastTrigger2 < 1.5) {
        hasPassedTrigger2.current = true; // reached the escape point — chase keeps going a beat longer
      }

      // Player keeps full control and the chase stays live for a few more
      // steps past the trigger, so the boulder reads as sealing the corridor
      // BEHIND them rather than freezing them the instant they touch it.
      if (hasPassedTrigger2.current && distPastTrigger2 >= ESCAPE_ADVANCE_DISTANCE) {
        // Snap the boss to a fixed spot behind the boulder point (back toward
        // trigger1) so the cutaway reliably reads as "boss trapped in the
        // room behind us", regardless of exactly how close it got mid-chase.
        // This only runs once (state transitions away immediately after),
        // so a one-off allocation here is not a concern.
        const corridorDir = new THREE.Vector3()
          .subVectors(trigger2Pos, trigger1Pos)
          .setY(0)
          .normalize();
        bossPos.current.copy(trigger2Pos).sub(corridorDir.multiplyScalar(BOSS_BEHIND_DISTANCE));
        setBossDirection(
          getCardinalDirection(playerPos.x - bossPos.current.x, playerPos.z - bossPos.current.z)
        );

        onCinematicStart(); // freeze player control for the boulder cutscene
        timer.current = 0;
        setEventState('ESCAPE_PAN_TO_BOSS');
      }
    }

    // --- STATE 4b: ESCAPE CUTSCENE — CONFIRM BOSS IS TRAPPED BEHIND ---
    if (eventState === 'ESCAPE_PAN_TO_BOSS') {
      tmpDesired.copy(bossPos.current);
      tmpDesired.y += 1.5;
      tmpDesired.z += 3;
      cameraTarget.current.copy(getSafeCameraPos(bossPos.current, tmpDesired, state.scene));
      state.camera.position.lerp(cameraTarget.current, delta * 4);
      state.camera.lookAt(bossPos.current);

      if (state.camera.position.distanceTo(cameraTarget.current) < 0.3) {
        timer.current = 0;
        setEventState('ESCAPE_HOLD');
      }
    }

    if (eventState === 'ESCAPE_HOLD') {
      timer.current += delta;
      state.camera.lookAt(bossPos.current);
      if (timer.current > 1.0) {
        setEventState('ESCAPE_PAN_TO_PLAYER');
      }
    }

    if (eventState === 'ESCAPE_PAN_TO_PLAYER') {
      tmpDesired.copy(playerPos);
      tmpDesired.y += CAM_OFFSET_Y;
      tmpDesired.z += CAM_OFFSET_Z;
      cameraTarget.current.copy(getSafeCameraPos(playerPos, tmpDesired, state.scene));
      state.camera.position.lerp(cameraTarget.current, delta * 5);

      tmpLookTarget.copy(playerPos);
      tmpLookTarget.z -= 1.0;
      state.camera.lookAt(tmpLookTarget);

      if (state.camera.position.distanceTo(cameraTarget.current) < 0.3) {
        setIsBoulderDropped(true);
        AudioManager.play('event-ground-shake', { category: 'sfx' });
        shakeTimer.current = 0;
        setEventState('ESCAPED');
      }
    }

    // --- STATE 5: ESCAPED & CAMERA SHAKE ---
    if (eventState === 'ESCAPED') {
      boulderY.current = THREE.MathUtils.lerp(boulderY.current, 0, delta * 8);

      shakeTimer.current += delta;
      if (shakeTimer.current < 1.0) {
        const intensity = (1.0 - shakeTimer.current) * 0.2;
        state.camera.position.x += Math.sin(state.clock.elapsedTime * 50) * intensity;
        state.camera.position.y += Math.cos(state.clock.elapsedTime * 45) * intensity;
      } else {
        onSetChaseFov(false); // shake settled — revert FOV, event is over
        onChaseActiveChange?.(false);
        AudioManager.stopBGM();
        onBoulderLanded?.({ x: trigger2Pos.x, z: trigger2Pos.z });
        onCinematicEnd(); // hand control back — player is now past the boulder
        setEventState('DONE');
      }
    }

    // --- SYNC BOSS MESH & ANIMATE SPRITE ---
    if (
      bossGroupRef.current &&
      eventState !== 'IDLE' &&
      eventState !== 'CAUGHT' &&
      eventState !== 'DONE'
    ) {
      bossGroupRef.current.position.copy(bossPos.current);
    }
    if (bossMaterialRef.current?.map) {
      const map = bossMaterialRef.current.map;
      const rowIndex = DIRECTION_ROW_MAP[bossDirection] ?? 0;
      const frameIndex =
        eventState === 'CHASE_ACTIVE'
          ? Math.floor(state.clock.elapsedTime * 8) % VAMPIRE_BOSS_SHEET.cols
          : 0;
      const offsetX = frameIndex / VAMPIRE_BOSS_SHEET.cols;
      const offsetY = 1 - (rowIndex + 1) / VAMPIRE_BOSS_SHEET.rows;
      map.offset.set(offsetX, offsetY);
    }

    if (boulderMeshRef.current && isBoulderDropped) {
      boulderMeshRef.current.position.set(trigger2Pos.x, boulderY.current, trigger2Pos.z);
    }
  });
  // Note: no priority arg here. A non-zero priority disables R3F's automatic
  // render-at-end-of-frame globally for as long as this component is
  // mounted — which caused the total freeze during cutscenes when
  // SanityEffects (the other non-zero-priority subscriber) unmounted and
  // nothing was left to call gl.render(). Execution order relative to
  // PlayerController is now guaranteed by JSX mount order instead (both at
  // the default priority 0) — see Game.tsx, ChaseEventController must stay
  // mounted after PlayerController.

  return (
    <>
      {eventState !== 'IDLE' && eventState !== 'CAUGHT' && eventState !== 'DONE' && (
        <group ref={bossGroupRef}>
          <Billboard lockX={false} lockY={false} lockZ={false}>
            <mesh position={[0, 0.15, 0]}>
              <planeGeometry args={[MONSTER_SCALE, MONSTER_SCALE]} />
              <meshStandardMaterial
                ref={bossMaterialRef}
                map={bossTexture}
                transparent
                alphaTest={0.5}
              />
            </mesh>
          </Billboard>
        </group>
      )}

      {isBoulderDropped && (
        <mesh ref={boulderMeshRef}>
          <sphereGeometry args={[1.5, 16, 16]} />
          <meshStandardMaterial color="#444444" roughness={0.9} />
        </mesh>
      )}
    </>
  );
};
