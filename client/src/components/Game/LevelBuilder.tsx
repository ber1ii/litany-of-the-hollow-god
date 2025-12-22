import React, { useMemo, useCallback } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { SmartWall } from './SmartWall';
import { Door } from './Door';
import { Gold } from './Gold';
import { Monster } from './Monster';
import { getWallGroups } from '../../utils/WallGenerator';
import { TILE_TYPES, TILE_SIZE } from './MapData';
import { getTileDef, SHEET_CONFIG } from '../../data/TileRegistry';
import type { TileDef } from '../../data/TileRegistry';
import { Torch } from './Torch';
import { Candle } from './Candle';
import { Bonfire } from './Bonfire';
import { LootDrop } from './LootDrop';
import { ITEM_REGISTRY } from '../../data/ItemRegistry';

// --- STATIC HELPERS ---

const isStructure = (v: number) => {
  if (
    v === TILE_TYPES.KEY_SILVER ||
    v === TILE_TYPES.GOLD ||
    v === TILE_TYPES.SKELETON ||
    v === TILE_TYPES.POTION_RED ||
    v === TILE_TYPES.POTION_BLUE ||
    v === TILE_TYPES.BONFIRE
  ) {
    return false;
  }
  const def = getTileDef(v);
  if (def.type === 'item') return false;
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

const isDoor = (v: number) => {
  return (
    v === TILE_TYPES.DOOR_CLOSED ||
    v === TILE_TYPES.DOOR_OPEN ||
    v === TILE_TYPES.DOOR_LOCKED_SILVER
  );
};

const createSmartGeometry = (
  tileDef: TileDef,
  stretchLeft: number,
  stretchRight: number,
  cullLeft: boolean,
  cullRight: boolean
) => {
  const WALL_THICKNESS = 0.25;
  const baseWidth = tileDef.size.w * TILE_SIZE;
  const height = tileDef.size.h;

  const totalWidth = baseWidth + stretchLeft + stretchRight;
  const geometry = new THREE.BoxGeometry(totalWidth, height, WALL_THICKNESS);

  const xOffset = (stretchRight - stretchLeft) / 2;
  geometry.translate(xOffset, height / 2, 0);

  // Index Manipulation for Culling
  const indexAttribute = geometry.getIndex();
  if (indexAttribute) {
    const oldIndices = indexAttribute.array;
    const newIndices = [];

    if (!cullRight) {
      for (let i = 0; i < 6; i++) newIndices.push(oldIndices[i]);
    }
    if (!cullLeft) {
      for (let i = 6; i < 12; i++) newIndices.push(oldIndices[i]);
    }
    for (let i = 12; i < oldIndices.length; i++) {
      newIndices.push(oldIndices[i]);
    }
    geometry.setIndex(newIndices);
  }

  // UV Mapping
  const uvs = geometry.attributes.uv;
  const texW = SHEET_CONFIG.width;
  const texH = SHEET_CONFIG.height;
  const tilePx = SHEET_CONFIG.tileSize;

  const col = tileDef.atlasPos.col;
  const row = tileDef.atlasPos.row;
  const wTiles = tileDef.size.w;
  const hTiles = tileDef.size.h;

  const uMin = (col * tilePx) / texW;
  const uMax = ((col + wTiles) * tilePx) / texW;
  const vMax = 1 - (row * tilePx) / texH;
  const vMin = 1 - ((row + hTiles) * tilePx) / texH;

  for (let i = 0; i < uvs.count; i++) {
    const u = uvs.getX(i);
    const v = uvs.getY(i);
    const newU = uMin + u * (uMax - uMin);
    const newV = vMin + v * (vMax - vMin);
    uvs.setXY(i, newU, newV);
  }

  geometry.attributes.uv.needsUpdate = true;
  return geometry;
};

const StaticLevel = React.memo(
  ({
    map,
    texture,
    playerPos,
  }: {
    map: number[][];
    texture: THREE.Texture;
    playerPos: React.RefObject<THREE.Vector3>;
  }) => {
    const mapWidth = map[0].length;
    const mapHeight = map.length;

    const getOrientation = useCallback(
      (tx: number, tz: number) => {
        if (tx < 0 || tx >= mapWidth || tz < 0 || tz >= mapHeight) return 'none';
        if (!isStructure(map[tz][tx])) return 'none';

        const valNorth = tz > 0 ? map[tz - 1][tx] : 0;
        const valSouth = tz < mapHeight - 1 ? map[tz + 1][tx] : 0;
        const valWest = tx > 0 ? map[tz][tx - 1] : 0;
        const valEast = tx < mapWidth - 1 ? map[tz][tx + 1] : 0;

        if (isStructure(valNorth) && isStructure(valSouth)) return 'vertical';
        if (isStructure(valWest) && isStructure(valEast)) return 'horizontal';
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

    // 1. WALLS
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

        let rotationY = 0;
        const myOrientation = getOrientation(anchorX, anchorZ);
        const isVertical = myOrientation === 'vertical';

        let stretchLeft = 0;
        let stretchRight = 0;
        const STRETCH_AMOUNT = 0.5;
        let cullLeft = false;
        let cullRight = false;

        if (isVertical) {
          rotationY = Math.PI / 2;
          if (anchorZ > 0) {
            const nID = map[anchorZ - 1][anchorX];
            const nOr = getOrientation(anchorX, anchorZ - 1);
            if (isStructure(nID) && nOr === 'horizontal') stretchRight = STRETCH_AMOUNT;
            if (isOpaqueWall(nID) && nOr === 'vertical') cullRight = true;
          }
          if (anchorZ < mapHeight - 1) {
            const sID = map[anchorZ + 1][anchorX];
            const sOr = getOrientation(anchorX, anchorZ + 1);
            if (isStructure(sID) && sOr === 'horizontal') stretchLeft = STRETCH_AMOUNT;
            if (isOpaqueWall(sID) && sOr === 'vertical') cullLeft = true;
          }
        } else {
          if (isLeftCol && !isTopRow && !isBottomRow) rotationY = -Math.PI / 2;
          else if (isRightCol && !isTopRow && !isBottomRow) rotationY = Math.PI / 2;

          if (anchorX > 0) {
            const wID = map[anchorZ][anchorX - 1];
            const wOr = getOrientation(anchorX - 1, anchorZ);
            if (isStructure(wID) && wOr === 'vertical') stretchLeft = STRETCH_AMOUNT;
            if (isOpaqueWall(wID) && wOr === 'horizontal') cullLeft = true;
          }
          const rightEdgeX = anchorX + tileDef.size.w;
          if (rightEdgeX < mapWidth) {
            const eID = map[anchorZ][rightEdgeX];
            const eOr = getOrientation(rightEdgeX, anchorZ);
            if (isStructure(eID) && eOr === 'vertical') stretchRight = STRETCH_AMOUNT;
            if (isOpaqueWall(eID) && eOr === 'horizontal') cullRight = true;
          }
        }

        let type: 'rigid' | 'fadable' = 'fadable';
        if (isTopRow || isLeftCol || isRightCol) type = 'rigid';

        const geometry = createSmartGeometry(
          tileDef,
          stretchLeft,
          stretchRight,
          cullLeft,
          cullRight
        );

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

    // 2. CORNERS
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
        const geometry = createSmartGeometry(tileDef, 0, 0, false, false);
        const posX = c.x * TILE_SIZE;
        const posZ = c.z * TILE_SIZE;
        return [
          <SmartWall
            key={`c-h-${i}`}
            geometry={geometry}
            texture={texture}
            playerPos={playerPos}
            wallType="rigid"
            position={[posX, 0, posZ]}
            rotation={[0, 0, 0]}
          />,
          <SmartWall
            key={`c-v-${i}`}
            geometry={geometry}
            texture={texture}
            playerPos={playerPos}
            wallType="rigid"
            position={[posX, 0, posZ]}
            rotation={[0, Math.PI / 2, 0]}
          />,
        ];
      });
    }, [map, mapWidth, mapHeight, texture, playerPos]);

    return (
      <group>
        {wallMeshes}
        {cornerMeshes}
      </group>
    );
  },
  // CUSTOM COMPARATOR
  (prevProps, nextProps) => {
    if (prevProps.texture !== nextProps.texture || prevProps.playerPos !== nextProps.playerPos) {
      return false;
    }
    const h = prevProps.map.length;
    const w = prevProps.map[0].length;

    for (let z = 0; z < h; z++) {
      for (let x = 0; x < w; x++) {
        const prevId = prevProps.map[z][x];
        const nextId = nextProps.map[z][x];
        if (prevId !== nextId) {
          if (!isStructure(prevId) && !isStructure(nextId)) continue;
          if (isDoor(prevId) && isDoor(nextId)) continue;
          return false;
        }
      }
    }
    return true;
  }
);

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

  const getOrientation = useCallback(
    (tx: number, tz: number) => {
      if (tx < 0 || tx >= mapWidth || tz < 0 || tz >= mapHeight) return 'none';
      if (!isStructure(map[tz][tx])) return 'none';
      const valNorth = tz > 0 ? map[tz - 1][tx] : 0;
      const valSouth = tz < mapHeight - 1 ? map[tz + 1][tx] : 0;
      const valWest = tx > 0 ? map[tz][tx - 1] : 0;
      const valEast = tx < mapWidth - 1 ? map[tz][tx + 1] : 0;
      if (isStructure(valNorth) && isStructure(valSouth)) return 'vertical';
      if (isStructure(valWest) && isStructure(valEast)) return 'horizontal';
      if (
        (isStructure(valNorth) || isStructure(valSouth)) &&
        !isStructure(valWest) &&
        !isStructure(valEast)
      )
        return 'vertical';
      return 'horizontal';
    },
    [map, mapWidth, mapHeight]
  );

  // --- 3. DYNAMIC ITEMS ---
  const items = useMemo(() => {
    const list: React.ReactElement[] = [];
    map.forEach((row, z) => {
      row.forEach((tile, x) => {
        // --- 1. DOORS ---
        if (isDoor(tile)) {
          const isLocked = tile === TILE_TYPES.DOOR_LOCKED_SILVER;
          let rotationY = 0;
          if (getOrientation(x, z) === 'vertical') rotationY = Math.PI / 2;
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

        // --- 2. SPECIAL ITEMS (GOLD) ---
        if (tile === TILE_TYPES.GOLD) {
          list.push(
            <group key={`gold-${x}-${z}`} position={[0, 0.01, 0]}>
              <Gold x={x} z={z} />
            </group>
          );
        }

        // --- 3. ENEMIES ---
        if (tile === TILE_TYPES.SKELETON && !deadEnemyIds.has(`skeleton-${x}-${z}`)) {
          list.push(
            <group key={`mon-${x}-${z}`} position={[0, 0.01, 0]}>
              <Monster
                id={`skeleton-${x}-${z}`}
                type="skeleton"
                startX={x}
                startZ={z}
                playerPos={playerPos.current}
                onCombatStart={() => onCombatStart(`skeleton-${x}-${z}`)}
                enemyTracker={enemyTracker}
              />
            </group>
          );
        }

        // --- 4. PROPS ---
        if (tile === TILE_TYPES.TORCH_WALL) {
          list.push(<Torch key={`torch-${x}-${z}`} x={x} z={z} />);
        }
        if (tile === TILE_TYPES.CANDLE) {
          list.push(<Candle key={`candle-${x}-${z}`} x={x} z={z} />);
        }
        // NEW: BONFIRE
        if (tile === TILE_TYPES.BONFIRE) {
          list.push(<Bonfire key={`bonfire-${x}-${z}`} x={x} z={z} />);
        }

        // --- 5. GENERIC ITEMS (REGISTRY) ---
        const tileDef = getTileDef(tile);
        if (tileDef.type === 'item' && tileDef.itemId) {
          const itemData = ITEM_REGISTRY[tileDef.itemId];
          if (itemData) {
            list.push(<LootDrop key={`item-${x}-${z}`} x={x} z={z} item={itemData} />);
          }
        }
      });
    });
    return list;
  }, [map, playerPos, onCombatStart, enemyTracker, deadEnemyIds, getOrientation]);

  return (
    <group>
      <StaticLevel map={map} texture={texture} playerPos={playerPos} />
      {items}
    </group>
  );
};
