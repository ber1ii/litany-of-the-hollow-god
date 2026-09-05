import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { TILE_SIZE, TILE_TYPES } from './MapData';
import { getTileDef } from '../../data/TileRegistry';
import { hasLineOfSight, getWallOrientation } from '../../utils/MinimapUtils';
import { buildStructureFootprint, getEffectiveTileId } from '../../utils/StructureFootprint';

interface MinimapProps {
  map: number[][];
  playerPos: React.RefObject<THREE.Vector3>;
  playerRotation: React.RefObject<number>;
  enemyTracker: React.RefObject<Map<string, { x: number; z: number }>>;
}

const COLORS = {
  bg: '#0a0806',
  floor: '#161210',
  floorStroke: '#211b17',
  wall: '#4a3f33',
  doorClosed: '#7a3b1e',
  doorLocked: '#5c6b52',
  gold: '#a8863f',
  key: '#8a9483',
  health: '#7a1f1f',
  mana: '#2f4a5c',
  save: '#c2571a',
  enemy: '#8b1a1a',
  player: '#c9bfa8',
  cone: 'rgba(140, 110, 60, 0.10)',
  compass: '#5e564a',
};

export const Minimap: React.FC<MinimapProps> = ({
  map,
  playerPos,
  playerRotation,
  enemyTracker,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const exploredTiles = useRef<Set<string>>(new Set());

  const footprint = useMemo(() => buildStructureFootprint(map), [map]);

  const ZOOM = 18;
  const VIEW_RADIUS = 10;
  const CANVAS_SIZE = 200;
  const FLASHLIGHT_FOV = Math.PI / 2.5;
  const FLASHLIGHT_DISTANCE = 8;
  const MEMORY_DIM = 0.35;

  const staticItems = useMemo(() => {
    const items: { x: number; z: number; type: string; color: string }[] = [];
    map.forEach((row, z) => {
      row.forEach((tile, x) => {
        if (tile === TILE_TYPES.GOLD) items.push({ x, z, type: 'gold', color: COLORS.gold });
        if (tile === TILE_TYPES.KEY_SILVER) items.push({ x, z, type: 'key', color: COLORS.key });
        if (tile === TILE_TYPES.POTION_RED)
          items.push({ x, z, type: 'health', color: COLORS.health });
        if (tile === TILE_TYPES.POTION_BLUE) items.push({ x, z, type: 'mana', color: COLORS.mana });
        if (tile === TILE_TYPES.BONFIRE) items.push({ x, z, type: 'save', color: COLORS.save });
      });
    });
    return items;
  }, [map]);

  useEffect(() => {
    let animationFrameId: number;

    const draw = (
      ctx: CanvasRenderingContext2D,
      px: number,
      pz: number,
      pRot: number,
      t: number
    ) => {
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      const centerX = CANVAS_SIZE / 2;
      const centerY = CANVAS_SIZE / 2;

      const toCanvas = (tx: number, tz: number) => ({
        x: centerX + (tx - px) * ZOOM,
        y: centerY + (tz - pz) * ZOOM,
      });

      const startX = Math.max(0, Math.floor(px - VIEW_RADIUS));
      const endX = Math.min(map[0].length, Math.ceil(px + VIEW_RADIUS));
      const startZ = Math.max(0, Math.floor(pz - VIEW_RADIUS));
      const endZ = Math.min(map.length, Math.ceil(pz + VIEW_RADIUS));

      for (let z = startZ; z < endZ; z++) {
        for (let x = startX; x < endX; x++) {
          const tileId = getEffectiveTileId(map, footprint, x, z);
          if (tileId === 0) continue;

          // --- FOG OF WAR ---
          const key = `${x},${z}`;
          const dist = Math.sqrt((x - px) ** 2 + (z - pz) ** 2);
          const currentlyVisible =
            dist <= VIEW_RADIUS && hasLineOfSight(px, pz, x, z, map, footprint);

          if (currentlyVisible) exploredTiles.current.add(key);
          else if (!exploredTiles.current.has(key)) continue;

          ctx.globalAlpha = currentlyVisible ? 1 : MEMORY_DIM;

          const def = getTileDef(tileId);
          const { x: cx, y: cy } = toCanvas(x, z);

          const isClosedDoor =
            tileId === TILE_TYPES.DOOR_CLOSED || tileId === TILE_TYPES.DOOR_LOCKED_SILVER;

          const isWallStructure =
            def.type === 'wall' ||
            (def.placement === 'structure' && def.type !== 'floor' && def.solid !== false);

          if (isWallStructure || isClosedDoor) {
            ctx.fillStyle =
              tileId === TILE_TYPES.DOOR_LOCKED_SILVER
                ? COLORS.doorLocked
                : tileId === TILE_TYPES.DOOR_CLOSED
                  ? COLORS.doorClosed
                  : COLORS.wall;

            if (def.placement === 'structure') {
              ctx.fillRect(cx - ZOOM / 2, cy - ZOOM / 2, ZOOM, ZOOM);
              ctx.strokeStyle = 'rgba(0,0,0,0.4)';
              ctx.lineWidth = 1;
              ctx.strokeRect(cx - ZOOM / 2, cy - ZOOM / 2, ZOOM, ZOOM);
            } else {
              const orientation = getWallOrientation(x, z, map);
              let w = 1;
              let h = 1;
              if (orientation === 'vertical') {
                const temp = w;
                w = h;
                h = temp;
              }

              const WALL_THICKNESS_MAP = 0.4;
              let drawW: number, drawH: number, offX: number, offY: number;

              if (orientation === 'vertical') {
                drawW = ZOOM * WALL_THICKNESS_MAP;
                drawH = ZOOM * h;
                offX = (ZOOM - drawW) / 2 - ZOOM / 2;
                offY = -ZOOM / 2;
              } else {
                drawW = ZOOM * w;
                drawH = ZOOM * WALL_THICKNESS_MAP;
                offX = -ZOOM / 2;
                offY = (ZOOM - drawH) / 2 - ZOOM / 2;
              }

              ctx.fillRect(cx + offX, cy + offY, drawW, drawH);
              ctx.strokeStyle = 'rgba(0,0,0,0.4)';
              ctx.lineWidth = 1;
              ctx.strokeRect(cx + offX, cy + offY, drawW, drawH);
            }
          } else if (
            def.type === 'floor' ||
            tileId === TILE_TYPES.DOOR_OPEN ||
            tileId === TILE_TYPES.BONFIRE
          ) {
            ctx.fillStyle = COLORS.floor;
            ctx.fillRect(cx - ZOOM / 2, cy - ZOOM / 2, ZOOM, ZOOM);
            ctx.strokeStyle = COLORS.floorStroke;
            ctx.lineWidth = 1;
            ctx.strokeRect(cx - ZOOM / 2, cy - ZOOM / 2, ZOOM, ZOOM);
          }

          ctx.globalAlpha = 1;
        }
      }

      // --- ITEMS ---
      staticItems.forEach((item) => {
        if (
          map[item.z][item.x] === 0 ||
          (getTileDef(map[item.z][item.x]).type === 'floor' &&
            map[item.z][item.x] !== TILE_TYPES.BONFIRE)
        )
          return;

        const dist = Math.sqrt((item.x - px) ** 2 + (item.z - pz) ** 2);
        if (dist > VIEW_RADIUS) return;
        if (!hasLineOfSight(px, pz, item.x, item.z, map, footprint)) return;

        const { x: cx, y: cy } = toCanvas(item.x, item.z);
        ctx.fillStyle = item.color;

        if (item.type === 'save') {
          ctx.shadowColor = item.color;
          ctx.shadowBlur = 8;
          ctx.fillRect(cx - 3, cy - 3, 6, 6);
        } else {
          ctx.shadowColor = item.color;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      });

      // --- ENEMIES ---
      if (enemyTracker.current) {
        const pulse = 0.65 + 0.35 * Math.sin(t / 350);

        enemyTracker.current.forEach((pos) => {
          const ex = pos.x / TILE_SIZE;
          const ez = pos.z / TILE_SIZE;
          const dx = ex - px;
          const dz = ez - pz;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist > FLASHLIGHT_DISTANCE) return;

          const angleToEnemy = Math.atan2(dz, dx);
          let angleDiff = angleToEnemy - pRot;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          const inCone = Math.abs(angleDiff) < FLASHLIGHT_FOV / 2;

          if (dist < 1.5 || (inCone && hasLineOfSight(px, pz, ex, ez, map, footprint))) {
            const { x: cx, y: cy } = toCanvas(ex, ez);
            ctx.fillStyle = COLORS.enemy;
            ctx.globalAlpha = pulse;
            ctx.shadowColor = COLORS.enemy;
            ctx.shadowBlur = 10 * pulse;
            ctx.beginPath();
            ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
          }
        });
      }

      // --- PLAYER ---
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(pRot);

      const coneGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, ZOOM * FLASHLIGHT_DISTANCE);
      coneGrad.addColorStop(0, COLORS.cone);
      coneGrad.addColorStop(1, 'rgba(140, 110, 60, 0)');
      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, ZOOM * FLASHLIGHT_DISTANCE, -FLASHLIGHT_FOV / 2, FLASHLIGHT_FOV / 2);
      ctx.fill();

      ctx.fillStyle = COLORS.player;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(-4, 4);
      ctx.lineTo(-4, -4);
      ctx.fill();
      ctx.restore();

      const grad = ctx.createRadialGradient(
        centerX,
        centerY,
        CANVAS_SIZE / 2 - 24,
        centerX,
        centerY,
        CANVAS_SIZE / 2
      );
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.75, 'rgba(0,0,0,0.75)');
      grad.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      ctx.strokeStyle = '#2b241c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, CANVAS_SIZE / 2 - 2, 0, Math.PI * 2);
      ctx.stroke();
    };

    const renderLoop = () => {
      const canvas = canvasRef.current;
      if (canvas && playerPos.current) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const px = playerPos.current.x / TILE_SIZE;
          const pz = playerPos.current.z / TILE_SIZE;
          const pRot = playerRotation.current || 0;
          draw(ctx, px, pz, pRot, performance.now());
        }
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [map, playerPos, playerRotation, enemyTracker, staticItems, FLASHLIGHT_FOV, footprint]);

  const labelStyle: React.CSSProperties = {
    position: 'absolute',
    color: COLORS.compass,
    fontSize: '11px',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: '1px',
    pointerEvents: 'none',
    zIndex: 20,
    textShadow: '1px 1px 0 #000',
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '25px',
        left: '25px',
        zIndex: 50,
        width: '200px',
        height: '200px',
        borderRadius: '50%',
        background: '#000',
        boxShadow: '0 0 0 3px #1c1712, 0 0 0 5px #3a2f22, 0 4px 14px rgba(0,0,0,0.9)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, transparent 1px, transparent 2px)',
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
          zIndex: 10,
          opacity: 0.5,
        }}
      />
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        style={{ width: '100%', height: '100%' }}
      />

      <div style={{ ...labelStyle, bottom: '5px', left: '50%', transform: 'translateX(-50%)' }}>
        S
      </div>
      <div style={{ ...labelStyle, top: '5px', left: '50%', transform: 'translateX(-50%)' }}>N</div>
      <div style={{ ...labelStyle, left: '5px', top: '50%', transform: 'translateY(-50%)' }}>W</div>
      <div style={{ ...labelStyle, right: '5px', top: '50%', transform: 'translateY(-50%)' }}>
        E
      </div>
    </div>
  );
};
