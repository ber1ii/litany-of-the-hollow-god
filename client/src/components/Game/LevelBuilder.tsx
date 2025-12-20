import React, { useMemo, useCallback } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { SmartWall } from './SmartWall';
import { Door } from './Door';
import { Gold } from './Gold';
import { Monster } from './Monster';
import { getWallGroups, createWallGeometry } from '../../utils/WallGenerator';
import { TILE_TYPES, TILE_SIZE } from './MapData';
import { getTileDef } from '../../data/TileRegistry';
import { Key } from './Key';

// --- STATIC HELPERS (Moved outside to avoid hook dependencies) ---

const isStructure = (v: number) => {
  const def = getTileDef(v);
  return (
    def &&
    (def.type === 'wall' ||
      v === TILE_TYPES.DOOR_CLOSED ||
      v === TILE_TYPES.DOOR_OPEN ||
      v === TILE_TYPES.DOOR_LOCKED_SILVER)
  );
};

const isOpaqueWall = (v: number) => {
  const def = getTileDef(v);
  return def && def.type === 'wall';
};

interface LevelBuilderProps {
  map: number[][];
  playerPos: React.RefObject<THREE.Vector3>;
  onCombatStart: (id: string) => void;
  enemyTracker: React.RefObject<Map<string, { x: number; z: number }>>;
  deadEnemyIds: Set<string>;
}

export const LevelBuilder: React.FC<LevelBuilderProps> = ({
  map,
  playerPos,
  onCombatStart,
  enemyTracker,
  deadEnemyIds,
}) => {
  const rawAtlas = useTexture('/textures/sheets/mainlevbuild.png');

  const texture = useMemo(() => {
    const t = rawAtlas.clone();
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [rawAtlas]);

  const mapWidth = map[0].length;
  const mapHeight = map.length;

  // --- ORIENTATION HELPER ---
  const getOrientation = useCallback(
    (tx: number, tz: number) => {
      if (tx < 0 || tx >= mapWidth || tz < 0 || tz >= mapHeight) return 'none';

      const valNorth = tz > 0 ? map[tz - 1][tx] : 0;
      const valSouth = tz < mapHeight - 1 ? map[tz + 1][tx] : 0;
      const valWest = tx > 0 ? map[tz][tx - 1] : 0;
      const valEast = tx < mapWidth - 1 ? map[tz][tx + 1] : 0;

      // Vertical: Connected North/South but NOT West/East
      if (
        (isStructure(valNorth) || isStructure(valSouth)) &&
        !isStructure(valWest) &&
        !isStructure(valEast)
      ) {
        return 'vertical';
      }
      return 'horizontal';
    },
    [map, mapWidth, mapHeight]
  );

  // --- 1. MAIN WALLS ---
  const wallMeshes = useMemo(() => {
    const groups = getWallGroups(map);

    return groups.map((group, index) => {
      const tileId = group[0].id;
      const tileDef = getTileDef(tileId);

      const anchorX = group[0].x;
      const anchorZ = group[0].z;

      let posX = anchorX * TILE_SIZE;
      const posZ = anchorZ * TILE_SIZE;
      const offsetX = ((tileDef.size.w - 1) * TILE_SIZE) / 2;
      posX += offsetX;

      const isTopRow = anchorZ === 0;
      const isBottomRow = anchorZ === mapHeight - 1;
      const isLeftCol = anchorX === 0;
      const isRightCol = anchorX + tileDef.size.w >= mapWidth;

      // --- ROTATION ---
      let rotationY = 0;
      const currentOrientation = getOrientation(anchorX, anchorZ);
      const isVertical = currentOrientation === 'vertical';

      if (isVertical) {
        rotationY = Math.PI / 2;
      } else if (isLeftCol && !isTopRow && !isBottomRow) {
        rotationY = -Math.PI / 2;
      } else if (isRightCol && !isTopRow && !isBottomRow) {
        rotationY = Math.PI / 2;
      }

      let type: 'rigid' | 'fadable' = 'fadable';
      if (isTopRow || isLeftCol || isRightCol) {
        type = 'rigid';
      }

      // --- CULLING LOGIC (FIXED) ---
      let cullLeft = false;
      let cullRight = false;

      if (isVertical) {
        // Vertical Rotation (+90 deg):
        // Local Right (+X) rotates to World North (-Z).
        // Local Left (-X) rotates to World South (+Z).

        // If neighbor is North (-Z), we cull our North-facing side (Local Right).
        if (anchorZ > 0) {
          const idN = map[anchorZ - 1][anchorX];
          if (isOpaqueWall(idN) && getOrientation(anchorX, anchorZ - 1) === 'vertical') {
            cullRight = true; // FIX: North neighbor culls RIGHT face
          }
        }
        // If neighbor is South (+Z), we cull our South-facing side (Local Left).
        if (anchorZ < mapHeight - 1) {
          const idS = map[anchorZ + 1][anchorX];
          if (isOpaqueWall(idS) && getOrientation(anchorX, anchorZ + 1) === 'vertical') {
            cullLeft = true; // FIX: South neighbor culls LEFT face
          }
        }
      } else {
        // Horizontal (0 deg): Left is West, Right is East.
        const leftX = anchorX - 1;
        if (leftX >= 0) {
          const leftId = map[anchorZ][leftX];
          if (isOpaqueWall(leftId) && getOrientation(leftX, anchorZ) === 'horizontal') {
            cullLeft = true;
          }
        }
        const rightX = anchorX + tileDef.size.w;
        if (rightX < mapWidth) {
          const rightId = map[anchorZ][rightX];
          if (isOpaqueWall(rightId) && getOrientation(rightX, anchorZ) === 'horizontal') {
            cullRight = true;
          }
        }
      }

      const geometry = createWallGeometry(tileDef, { left: cullLeft, right: cullRight });

      return (
        <SmartWall
          key={`wall-${index}`}
          geometry={geometry}
          texture={texture}
          playerPos={playerPos}
          wallType={type}
          position={[posX, 0, posZ]}
          rotation={[0, rotationY, 0]}
        />
      );
    });
  }, [map, texture, playerPos, mapWidth, mapHeight, getOrientation]);

  // --- 2. CORNER MESHES ---
  const cornerMeshes = useMemo(() => {
    const corners = [
      { x: 0, z: 0 },
      { x: mapWidth - 1, z: 0 },
      { x: 0, z: mapHeight - 1 },
      { x: mapWidth - 1, z: mapHeight - 1 },
    ];

    return corners.flatMap((c, i) => {
      const tileId = map[c.z][c.x];
      if (tileId === 0) return [];

      const tileDef = getTileDef(tileId);
      const geometry = createWallGeometry(tileDef);

      const posX = c.x * TILE_SIZE;
      const posZ = c.z * TILE_SIZE;

      const hWall = (
        <SmartWall
          key={`corner-h-${i}`}
          geometry={geometry}
          texture={texture}
          playerPos={playerPos}
          wallType="rigid"
          position={[posX, 0, posZ]}
          rotation={[0, 0, 0]}
        />
      );

      const vWall = (
        <SmartWall
          key={`corner-v-${i}`}
          geometry={geometry}
          texture={texture}
          playerPos={playerPos}
          wallType="rigid"
          position={[posX, 0, posZ]}
          rotation={[0, Math.PI / 2, 0]}
        />
      );

      return [hWall, vWall];
    });
  }, [map, mapWidth, mapHeight, texture, playerPos]);

  // --- 3. ITEMS ---
  const items = useMemo(() => {
    const list: React.ReactElement[] = [];
    map.forEach((row, z) => {
      row.forEach((tile, x) => {
        // DOORS
        if (
          tile === TILE_TYPES.DOOR_CLOSED ||
          tile === TILE_TYPES.DOOR_OPEN ||
          tile === TILE_TYPES.DOOR_LOCKED_SILVER
        ) {
          const isLocked = tile === TILE_TYPES.DOOR_LOCKED_SILVER;

          let rotationY = 0;
          if (getOrientation(x, z) === 'vertical') {
            rotationY = Math.PI / 2;
          }

          list.push(
            <Door
              key={`door-${x}-${z}`}
              x={x}
              z={z}
              isOpen={tile === TILE_TYPES.DOOR_OPEN}
              isLocked={isLocked}
              rotation={rotationY}
            />
          );
        }

        if (tile === TILE_TYPES.GOLD) {
          list.push(
            <group key={`gold-${x}-${z}`} position={[0, 0.01, 0]}>
              <Gold x={x} z={z} />
            </group>
          );
        }

        if (tile === TILE_TYPES.KEY_SILVER) {
          list.push(<Key key={`key-${x}-${z}`} x={x} z={z} />);
        }

        if (tile === TILE_TYPES.SKELETON) {
          const monsterId = `skeleton-${x}-${z}`;
          if (!deadEnemyIds.has(monsterId)) {
            list.push(
              <group key={`mon-${x}-${z}`} position={[0, 0.01, 0]}>
                <Monster
                  id={monsterId}
                  type="skeleton"
                  startX={x}
                  startZ={z}
                  playerPos={playerPos.current}
                  onCombatStart={() => onCombatStart(monsterId)}
                  enemyTracker={enemyTracker}
                />
              </group>
            );
          }
        }
      });
    });
    return list;
  }, [map, playerPos, onCombatStart, enemyTracker, deadEnemyIds, getOrientation]);

  return (
    <group>
      {wallMeshes}
      {cornerMeshes}
      {items}
    </group>
  );
};
