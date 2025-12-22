import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { TILE_SIZE, TILE_TYPES } from './MapData';
import { getTileDef } from '../../data/TileRegistry';
import { hasLineOfSight, getWallOrientation } from '../../utils/MinimapUtils';

interface MinimapProps {
  map: number[][];
  playerPos: React.RefObject<THREE.Vector3>;
  playerRotation: React.RefObject<number>;
  enemyTracker: React.RefObject<Map<string, { x: number; z: number }>>;
}

export const Minimap: React.FC<MinimapProps> = ({
  map,
  playerPos,
  playerRotation,
  enemyTracker,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const ZOOM = 18;
  const VIEW_RADIUS = 10;
  const CANVAS_SIZE = 200;
  const FLASHLIGHT_FOV = Math.PI / 2.5;
  const FLASHLIGHT_DISTANCE = 8;

  // Cached item locations
  const staticItems = useMemo(() => {
    const items: { x: number; z: number; type: string; color: string }[] = [];
    map.forEach((row, z) => {
      row.forEach((tile, x) => {
        if (tile === TILE_TYPES.GOLD) items.push({ x, z, type: 'gold', color: '#ffd700' });
        if (tile === TILE_TYPES.KEY_SILVER) items.push({ x, z, type: 'key', color: '#c0c0c0' });
        if (tile === TILE_TYPES.POTION_RED) items.push({ x, z, type: 'health', color: '#ff4444' });
        if (tile === TILE_TYPES.POTION_BLUE) items.push({ x, z, type: 'mana', color: '#4444ff' });
        if (tile === TILE_TYPES.BONFIRE) items.push({ x, z, type: 'save', color: '#ff8800' });
      });
    });
    return items;
  }, [map]);

  const draw = (ctx: CanvasRenderingContext2D, px: number, pz: number, pRot: number) => {
    // Clear & Background
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const centerX = CANVAS_SIZE / 2;
    const centerY = CANVAS_SIZE / 2;

    const toCanvas = (wx: number, wz: number) => ({
      x: centerX + (wx - px) * ZOOM,
      y: centerY + (wz - pz) * ZOOM,
    });

    const startX = Math.max(0, Math.floor(px - VIEW_RADIUS));
    const endX = Math.min(map[0].length, Math.ceil(px + VIEW_RADIUS));
    const startZ = Math.max(0, Math.floor(pz - VIEW_RADIUS));
    const endZ = Math.min(map.length, Math.ceil(pz + VIEW_RADIUS));

    for (let z = startZ; z < endZ; z++) {
      for (let x = startX; x < endX; x++) {
        const tileId = map[z][x];
        if (tileId === 0) continue;

        const def = getTileDef(tileId);
        const { x: cx, y: cy } = toCanvas(x * TILE_SIZE, z * TILE_SIZE);

        const isClosedDoor =
          tileId === TILE_TYPES.DOOR_CLOSED || tileId === TILE_TYPES.DOOR_LOCKED_SILVER;

        // --- DRAW WALLS & DOORS ---
        if (def.type === 'wall' || isClosedDoor) {
          // COLOR LOGIC: Distinction between Wall and Door
          ctx.fillStyle = isClosedDoor ? '#d97706' : '#555'; // Amber for doors, Grey for walls

          // Get orientation to determine shape
          const orientation = getWallOrientation(x, z, map);

          // Width on Map: Use definition width
          let w = def.size.w;
          let h = 1;

          // If vertical, we swap w and h for the schematic drawing
          if (orientation === 'vertical') {
            const temp = w;
            w = h;
            h = temp;
          }

          // Draw "Thin" Schematic Lines
          const WALL_THICKNESS_MAP = 0.4; // 40% of a tile

          let drawW = ZOOM * w;
          let drawH = ZOOM * h;
          let offX = 0;
          let offY = 0;

          if (orientation === 'vertical') {
            drawW = ZOOM * WALL_THICKNESS_MAP;
            drawH = ZOOM * h; // Full length
            offX = (ZOOM - drawW) / 2; // Center horizontally
            offY = 0;
          } else {
            // Horizontal
            drawW = ZOOM * w; // Full length
            drawH = ZOOM * WALL_THICKNESS_MAP;
            offX = 0;
            offY = (ZOOM - drawH) / 2; // Center vertically
          }

          ctx.fillRect(cx + offX, cy + offY, drawW, drawH);
        } else if (
          def.type === 'floor' ||
          tileId === TILE_TYPES.DOOR_OPEN ||
          tileId === TILE_TYPES.BONFIRE
        ) {
          // Floor
          ctx.fillStyle = '#1a1a1a';
          ctx.fillRect(cx, cy, ZOOM * def.size.w, ZOOM * (def.size.h || 1));
          ctx.strokeStyle = '#222';
          ctx.lineWidth = 1;
          ctx.strokeRect(cx, cy, ZOOM, ZOOM);
        }
      }
    }

    // --- DRAW ITEMS ---
    staticItems.forEach((item) => {
      // 1. Check if item still exists on map
      if (
        map[item.z][item.x] === 0 ||
        (getTileDef(map[item.z][item.x]).type === 'floor' &&
          map[item.z][item.x] !== TILE_TYPES.BONFIRE)
      )
        return;

      // 2. Distance Check
      const dist = Math.sqrt(Math.pow(item.x - px, 2) + Math.pow(item.z - pz, 2));
      if (dist > VIEW_RADIUS) return;

      // 3. Line of Sight
      if (hasLineOfSight(px, pz, item.x + 0.5, item.z + 0.5, map)) {
        const { x: cx, y: cy } = toCanvas(item.x * TILE_SIZE, item.z * TILE_SIZE);

        ctx.fillStyle = item.color;

        if (item.type === 'save') {
          ctx.shadowColor = '#ff5500';
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.fillRect(cx + ZOOM / 2 - 3, cy + ZOOM / 2 - 3, 6, 6);
          ctx.fill();
        } else {
          ctx.shadowColor = item.color;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(cx + ZOOM / 2, cy + ZOOM / 2, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.shadowBlur = 0;
      }
    });

    // --- DRAW ENEMIES ---
    if (enemyTracker.current) {
      enemyTracker.current.forEach((pos) => {
        const ex = pos.x;
        const ez = pos.z;

        const dx = ex - px;
        const dz = ez - pz;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > FLASHLIGHT_DISTANCE) return;

        const angleToEnemy = Math.atan2(dz, dx);
        let angleDiff = angleToEnemy - pRot;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const inCone = Math.abs(angleDiff) < FLASHLIGHT_FOV / 2;

        if (dist < 1.5 || (inCone && hasLineOfSight(px, pz, ex, ez, map))) {
          const { x: cx, y: cy } = toCanvas(ex, ez);

          ctx.fillStyle = '#ff0000';
          ctx.shadowColor = '#ff0000';
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.arc(cx, cy, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });
    }

    // --- PLAYER ---
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(pRot);

    // Cone
    const coneGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, ZOOM * FLASHLIGHT_DISTANCE);
    coneGrad.addColorStop(0, 'rgba(255, 255, 200, 0.15)');
    coneGrad.addColorStop(1, 'rgba(255, 255, 200, 0)');

    ctx.fillStyle = coneGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, ZOOM * FLASHLIGHT_DISTANCE, -FLASHLIGHT_FOV / 2, FLASHLIGHT_FOV / 2);
    ctx.fill();

    // Arrow
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, 4);
    ctx.lineTo(-4, -4);
    ctx.fill();
    ctx.restore();

    // --- OVERLAY ---
    const grad = ctx.createRadialGradient(
      centerX,
      centerY,
      CANVAS_SIZE / 2 - 20,
      centerX,
      centerY,
      CANVAS_SIZE / 2
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.8, 'rgba(0,0,0,0.8)');
    grad.addColorStop(1, 'rgba(0,0,0,1)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, CANVAS_SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  };

  useEffect(() => {
    let animationFrameId: number;

    const renderLoop = () => {
      const canvas = canvasRef.current;
      if (canvas && playerPos.current) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const px = playerPos.current.x / TILE_SIZE;
          const pz = playerPos.current.z / TILE_SIZE;
          const pRot = playerRotation.current || 0;

          draw(ctx, px, pz, pRot);
        }
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [map, playerPos, playerRotation, enemyTracker, staticItems]);

  const labelStyle: React.CSSProperties = {
    position: 'absolute',
    color: '#555',
    fontSize: '12px',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    pointerEvents: 'none',
    zIndex: 20,
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
        boxShadow: '0 0 0 4px #222, 0 0 20px rgba(0,0,0,0.9)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
          backgroundSize: '100% 2px, 3px 100%',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      />
      <canvas ref={canvasRef} width={200} height={200} style={{ display: 'block' }} />

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
