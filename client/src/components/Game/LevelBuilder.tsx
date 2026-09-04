import React, { useMemo, useCallback } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { SmartWall } from './SmartWall';
import { Door } from './Door';
import { Gold } from './Gold';
import { Monster } from './Monster';
import { getWallGroups } from '../../utils/WallGenerator';
import { getWallOrientation } from '../../utils/WallOrientation';
import { TILE_TYPES, TILE_SIZE, WALL_THICKNESS, STRUCTURE_HEIGHT_DEFAULT } from './MapData';
import { getTileDef, SHEET_CONFIG } from '../../data/TileRegistry';
import type { TileDef } from '../../data/TileRegistry';
import { Torch } from './Torch';
import { Candle } from './Candle';
import { Bonfire } from './Bonfire';
import { Sign } from './Sign';
import { LootDrop } from './LootDrop';
import { ITEM_REGISTRY } from '../../data/ItemRegistry';
import type { MonsterType } from '../../types/GameTypes';
import { ENEMIES } from '../../data/Enemies';
import { buildStructureFootprint, getEffectiveTileId } from '../../utils/StructureFootprint';
import { Prop3D } from './Prop3D';

const ENEMY_TILE_CONFIG: Record<number, { type: MonsterType; prefix: string }> = {
  [TILE_TYPES.SKELETON]: { type: 'skeleton', prefix: 'skeleton' },
  [TILE_TYPES.ORC2]: { type: 'orc2', prefix: 'orc2' },
  [TILE_TYPES.ORC3]: { type: 'orc3', prefix: 'orc3' },
  [TILE_TYPES.VAMPIRE1]: { type: 'vampire1', prefix: 'vampire1' },
  [TILE_TYPES.VAMPIRE_BOSS]: { type: 'vampire_boss', prefix: 'vampire_boss' },
};

const isStructure = (v: number) => {
  if (
    v === TILE_TYPES.KEY_SILVER ||
    v === TILE_TYPES.GOLD ||
    v === TILE_TYPES.SKELETON ||
    v === TILE_TYPES.ORC2 ||
    v === TILE_TYPES.ORC3 ||
    v === TILE_TYPES.VAMPIRE1 ||
    v === TILE_TYPES.VAMPIRE_BOSS ||
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
  const isStructure = tileDef.placement === 'structure';

  const baseWidth = tileDef.size.w * TILE_SIZE;
  const depth = isStructure ? tileDef.size.h * TILE_SIZE : WALL_THICKNESS;

  const height = tileDef.wallHeight
    ? tileDef.wallHeight * TILE_SIZE
    : isStructure
      ? STRUCTURE_HEIGHT_DEFAULT
      : tileDef.size.h * TILE_SIZE;

  const totalWidth = baseWidth + stretchLeft + stretchRight;
  const geometry = new THREE.BoxGeometry(totalWidth, height, depth);

  const xOffset = (stretchRight - stretchLeft) / 2;
  geometry.translate(xOffset, height / 2, 0);

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

    geometry.clearGroups();
    geometry.addGroup(0, newIndices.length, 0);
  }

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
      (tx: number, tz: number) => getWallOrientation(map, tx, tz),
      [map]
    );

    const wallMeshes = useMemo(() => {
      const groups = getWallGroups(map);
      return groups.map((group, index) => {
        const tileId = group[0].id;
        const tileDef = getTileDef(tileId);
        const anchorX = group[0].x;
        const anchorZ = group[0].z;

        let posX = anchorX * TILE_SIZE;
        let posZ = anchorZ * TILE_SIZE;

        const offsetX = ((tileDef.size.w - 1) * TILE_SIZE) / 2;
        posX += offsetX;

        if (tileDef.placement === 'structure') {
          const offsetZ = ((tileDef.size.h - 1) * TILE_SIZE) / 2;
          posZ += offsetZ;
        }

        const isTopRow = anchorZ === 0;
        const isBottomRow = anchorZ === mapHeight - 1;
        const isLeftCol = anchorX === 0;
        const isRightCol = anchorX + tileDef.size.w >= mapWidth;

        const isModular = tileDef.placement === 'modular';

        let rotationY = 0;
        let stretchLeft = 0;
        let stretchRight = 0;
        let cullLeft = false;
        let cullRight = false;
        let type: 'rigid' | 'fadable' = 'fadable';

        if (isModular) {
          const myOrientation = getOrientation(anchorX, anchorZ);
          const isVertical = myOrientation === 'vertical';
          const STRETCH_AMOUNT = 0.5;

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

          type = isTopRow || isLeftCol || isRightCol ? 'rigid' : 'fadable';
        } else {
          type = 'rigid';
        }

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
  onEnemyChaseChange: (enemyId: string, isChasing: boolean) => void;
  enemiesActive?: boolean;
}

export const LevelBuilder: React.FC<LevelBuilderProps> = ({
  map,
  playerPos,
  onCombatStart,
  enemyTracker,
  deadEnemyIds,
  onEnemyChaseChange,
  enemiesActive = true,
}) => {
  const rawAtlas = useTexture('/textures/sheets/mainlevbuild.png');
  const texture = useMemo(() => {
    const t = rawAtlas.clone();
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [rawAtlas]);

  const collisionGrid = useMemo(() => {
    const footprint = buildStructureFootprint(map);
    return map.map((row, z) =>
      row.map((_, x) => {
        const id = getEffectiveTileId(map, footprint, x, z);
        if (id === 0) return false;
        const def = getTileDef(id);

        // Exclude floor structures from collision
        const isSolidWall =
          def.type === 'wall' ||
          (def.type === 'prop' && def.solid === true) ||
          (def.placement === 'structure' && def.type !== 'floor' && def.solid !== false);

        return isSolidWall || id === TILE_TYPES.DOOR_CLOSED || id === TILE_TYPES.DOOR_LOCKED_SILVER;
      })
    );
  }, [map]);

  const getOrientation = useCallback(
    (tx: number, tz: number) => getWallOrientation(map, tx, tz),
    [map]
  );

  const items = useMemo(() => {
    const list: React.ReactElement[] = [];
    map.forEach((row, z) => {
      row.forEach((tile, x) => {
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
              playerPos={playerPos}
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

        // Restored structural items
        if (tile === TILE_TYPES.TORCH_WALL) {
          list.push(<Torch key={`torch-${x}-${z}`} x={x} z={z} />);
        }
        if (tile === TILE_TYPES.CANDLE) {
          list.push(<Candle key={`candle-${x}-${z}`} x={x} z={z} />);
        }
        if (tile === TILE_TYPES.BONFIRE) {
          list.push(<Bonfire key={`bonfire-${x}-${z}`} x={x} z={z} />);
        }
        if (tile === TILE_TYPES.SIGN) {
          list.push(<Sign key={`sign-${x}-${z}`} x={x} z={z} playerPos={playerPos} />);
        }

        const enemyConfig = ENEMY_TILE_CONFIG[tile];
        if (enemyConfig) {
          const enemyKey = `${enemyConfig.prefix}-${x}-${z}`;
          const baseEnemyDef = ENEMIES[enemyConfig.type.toUpperCase()];

          if (!deadEnemyIds.has(enemyKey)) {
            list.push(
              <group key={`mon-${x}-${z}`} position={[0, 0.01, 0]}>
                <Monster
                  id={enemyKey}
                  type={enemyConfig.type}
                  startX={x}
                  startZ={z}
                  behavior={baseEnemyDef?.defaultBehavior}
                  playerPos={playerPos.current}
                  collisionGrid={collisionGrid}
                  onCombatStart={() => onCombatStart(enemyKey)}
                  enemyTracker={enemyTracker}
                  onChaseStateChange={onEnemyChaseChange}
                  active={enemiesActive}
                />
              </group>
            );
          }
        }

        const tileDef = getTileDef(tile);

        if (tileDef.type === 'prop' && tileDef.modelPath) {
          list.push(
            <Prop3D
              key={`prop-${tileDef.name}-${x}-${z}`}
              modelPath={tileDef.modelPath}
              gridX={x}
              gridZ={z}
              scale={tileDef.scale ?? 0.5}
            />
          );
        }

        if (tileDef.type === 'item' && tileDef.itemId) {
          const itemData = ITEM_REGISTRY[tileDef.itemId];
          if (itemData) {
            list.push(<LootDrop key={`item-${x}-${z}`} x={x} z={z} item={itemData} />);
          }
        }
      });
    });
    return list;
  }, [
    map,
    playerPos,
    onCombatStart,
    enemyTracker,
    deadEnemyIds,
    getOrientation,
    collisionGrid,
    onEnemyChaseChange,
    enemiesActive,
  ]);

  return (
    <group>
      <StaticLevel map={map} texture={texture} playerPos={playerPos} />
      {items}
    </group>
  );
};
