import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { TILE_SIZE } from './MapData';
import { getTileDef } from '../../data/TileRegistry';

interface MinimapProps {
  map: number[][];
  playerPos: React.RefObject<THREE.Vector3>;
  enemyTracker: React.MutableRefObject<Map<string, { x: number; z: number }>>;
  // NEW PROP
  discoveredEnemies: React.MutableRefObject<Set<string>>;
}

export const Minimap: React.FC<MinimapProps> = ({
  map,
  playerPos,
  enemyTracker,
  discoveredEnemies,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const SCALE = 12;
  const mapWidth = map[0].length;
  const mapHeight = map.length;
  const canvasWidth = mapWidth * SCALE;
  const canvasHeight = mapHeight * SCALE;

  // Flashlight Radius in Game Units (approximate)
  const DISCOVERY_RADIUS = 8.0;

  const drawMap = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    for (let z = 0; z < mapHeight; z++) {
      for (let x = 0; x < mapWidth; x++) {
        const tileId = map[z][x];
        if (tileId === 0) continue;

        const def = getTileDef(tileId);
        const posX = x * SCALE;
        const posZ = z * SCALE;

        if (def.type === 'wall') {
          ctx.fillStyle = '#666';
          // FIX: Use 1 for depth
          ctx.fillRect(posX, posZ, SCALE * def.size.w, SCALE * 1);
        } else if (def.type === 'floor') {
          ctx.fillStyle = '#222';
          ctx.fillRect(posX, posZ, SCALE * def.size.w, SCALE * (def.size.h || 1));
        }
      }
    }
  };

  useEffect(() => {
    let animationFrameId: number;

    const renderLoop = () => {
      const canvas = canvasRef.current;
      if (canvas && playerPos.current) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          drawMap(ctx);

          // --- ENEMY LOGIC ---
          if (enemyTracker && enemyTracker.current) {
            // Iterate over all active enemies
            enemyTracker.current.forEach((pos, id) => {
              // 1. Check Distance for Discovery
              // We do this check every frame in the UI thread. It's very cheap.
              if (!discoveredEnemies.current.has(id)) {
                const dx = pos.x - playerPos.current!.x;
                const dz = pos.z - playerPos.current!.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                if (dist < DISCOVERY_RADIUS) {
                  discoveredEnemies.current.add(id);
                }
              }

              // 2. Draw ONLY if Discovered
              if (discoveredEnemies.current.has(id)) {
                const ex = (pos.x / TILE_SIZE) * SCALE;
                const ez = (pos.z / TILE_SIZE) * SCALE;

                ctx.fillStyle = '#ff3333';
                ctx.beginPath();
                ctx.arc(ex, ez, SCALE / 2.5, 0, Math.PI * 2);
                ctx.fill();
              }
            });
          }

          // Player
          const px = (playerPos.current.x / TILE_SIZE) * SCALE;
          const pz = (playerPos.current.z / TILE_SIZE) * SCALE;

          ctx.fillStyle = '#00ff00';
          ctx.beginPath();
          ctx.arc(px, pz, SCALE / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [map, playerPos, enemyTracker, discoveredEnemies]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        zIndex: 50,
        border: '4px solid #444',
        borderRadius: '4px',
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 0 15px rgba(0,0,0,0.9)',
      }}
    >
      <div
        style={{
          color: '#aaa',
          fontFamily: 'monospace',
          fontSize: '12px',
          fontWeight: 'bold',
          textAlign: 'center',
          background: '#1a1a1a',
          padding: '4px',
          borderBottom: '1px solid #333',
        }}
      >
        SECTOR MAP
      </div>
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        style={{ display: 'block' }}
      />
    </div>
  );
};
