import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
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
import { AtlasFloor } from './AtlasFloor';
import { getChunkCoords, getChunkKey } from '../../utils/ChunkUtils';
import { tileEventBus } from '../../utils/TileEventBus';

type Orientation = ReturnType<typeof getWallOrientation>;

function selectVisibleFromBuckets<T>(
  buckets: Map<string, T[]>,
  visibleChunkKeys: Set<string>
): T[] {
  if (visibleChunkKeys.size === 0) {
    return Array.from(buckets.values()).flat();
  }
  const result: T[] = [];
  for (const key of visibleChunkKeys) {
    const bucket = buckets.get(key);
    if (bucket) result.push(...bucket);
  }
  return result;
}

const ATLAS_URL = '/textures/sheets/mainlevbuild.png';
const configuredTextureCache = new Map<string, THREE.Texture>();

const getConfiguredAtlasTexture = (raw: THREE.Texture, url: string) => {
  const cached = configuredTextureCache.get(url);
  if (cached) return cached;

  const t = raw.clone();
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  configuredTextureCache.set(url, t);
  return t;
};

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
  if (def?.type === 'item') return false;
  return (
    def &&
    (def.type === 'wall' ||
      v === TILE_TYPES.DOOR_CLOSED ||
      v === TILE_TYPES.DOOR_OPEN ||
      v === TILE_TYPES.DOOR_LOCKED_SILVER)
  );
};

const isDoor = (v: number) => {
  return (
    v === TILE_TYPES.DOOR_CLOSED ||
    v === TILE_TYPES.DOOR_OPEN ||
    v === TILE_TYPES.DOOR_LOCKED_SILVER
  );
};

const isSolidTile = (id: number): boolean => {
  if (id === 0) return false;
  const def = getTileDef(id);
  const isSolidWall =
    def.type === 'wall' ||
    (def.type === 'prop' && def.solid === true) ||
    (def.placement === 'structure' && def.type !== 'floor' && def.solid !== false);
  return isSolidWall || id === TILE_TYPES.DOOR_CLOSED || id === TILE_TYPES.DOOR_LOCKED_SILVER;
};

const createSmartGeometry = (
  tileDef: TileDef,
  stretchLeft: number,
  stretchRight: number,
  cullLeft: boolean,
  cullRight: boolean
) => {
  const isStructureTile = tileDef.placement === 'structure';

  const baseWidth = tileDef.size.w * TILE_SIZE;
  const depth = isStructureTile ? tileDef.size.h * TILE_SIZE : WALL_THICKNESS;

  const height = tileDef.wallHeight
    ? tileDef.wallHeight * TILE_SIZE
    : isStructureTile
      ? STRUCTURE_HEIGHT_DEFAULT
      : tileDef.size.h * TILE_SIZE;

  const totalWidth = baseWidth + stretchLeft + stretchRight;
  const geometry = new THREE.BoxGeometry(totalWidth, height, depth);

  const xOffset = (stretchRight - stretchLeft) / 2;
  geometry.translate(xOffset, height / 2, 0);

  // Per-vertex face role consumed by SmartWallShader:
  //   0 = front/back face — the only faces allowed to fade near the player
  //   1 = left/right/top/bottom — must stay fully opaque, or fading them
  //       exposes the hollow interior of the box (no bottom cap) as the
  //       "artifacting" glitch when standing next to a wall.
  // BoxGeometry vertex order: right(0-3), left(4-7), top(8-11),
  // bottom(12-15), front(16-19), back(20-23).
  const faceRoleArray = new Float32Array(24);
  for (let i = 0; i < 16; i++) faceRoleArray[i] = 1;
  for (let i = 16; i < 24; i++) faceRoleArray[i] = 0;
  geometry.setAttribute('faceRole', new THREE.Float32BufferAttribute(faceRoleArray, 1));

  const indexAttribute = geometry.getIndex();
  if (indexAttribute) {
    const oldIndices = indexAttribute.array;
    const newIndices: number[] = [];

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

// StaticLevel receives a MAP SNAPSHOT that is frozen for the component's
// lifetime (see `structuralMap` below) — wall/floor tile placement never
// changes during gameplay (doors/items are separate overlay elements), so
// there is no need for this to ever recompute after mount.
const StaticLevel = React.memo(
  ({
    map,
    texture,
    visibleChunkKeys,
  }: {
    map: number[][];
    texture: THREE.Texture;
    playerPos: React.RefObject<THREE.Vector3>;
    visibleChunkKeys: Set<string>;
  }) => {
    const mapWidth = map[0].length;
    const mapHeight = map.length;

    const getOrientation = useCallback(
      (tx: number, tz: number) => getWallOrientation(map, tx, tz),
      [map]
    );

    const wallMeshesByChunk = useMemo(() => {
      const buckets = new Map<string, React.ReactElement[]>();
      const groups = getWallGroups(map);
      groups.forEach((group, index) => {
        const anchorX = group[0].x;
        const anchorZ = group[0].z;

        const { cx, cz } = getChunkCoords(anchorX, anchorZ);
        const chunkKey = getChunkKey(cx, cz);

        const tileId = group[0].id;
        const tileDef = getTileDef(tileId);

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
        const cullLeft = false;
        const cullRight = false;
        const type: 'rigid' | 'fadable' = 'fadable';

        if (isModular) {
          const myOrientation = getOrientation(anchorX, anchorZ);
          const isVertical = myOrientation === 'vertical';
          // Was a hardcoded 0.5 — if that didn't exactly match this
          // project's WALL_THICKNESS, the stretched box fell short of
          // fully overlapping the perpendicular wall at the corner,
          // leaving a sliver gap that exposed the always-opaque side
          // face as a hard line. Using WALL_THICKNESS directly guarantees
          // full overlap regardless of tile dimensions.
          const STRETCH_AMOUNT = WALL_THICKNESS;

          if (isVertical) {
            rotationY = Math.PI / 2;
            if (anchorZ > 0) {
              const nID = map[anchorZ - 1][anchorX];
              const nOr = getOrientation(anchorX, anchorZ - 1);
              if (isStructure(nID) && nOr === 'horizontal') stretchRight = STRETCH_AMOUNT;
              // Deliberately NOT culling the shared side face between two
              // same-orientation neighbors here. Those faces point directly
              // away from any outside camera (default FrontSide backface
              // culling already hides them), so culling them was a pure
              // overdraw "optimization" — but under transparent blending it
              // made the box non-watertight, letting the renderer draw
              // through the gap at oblique angles (the torn-seam glitch).
            }
            if (anchorZ < mapHeight - 1) {
              const sID = map[anchorZ + 1][anchorX];
              const sOr = getOrientation(anchorX, anchorZ + 1);
              if (isStructure(sID) && sOr === 'horizontal') stretchLeft = STRETCH_AMOUNT;
            }
          } else {
            if (isLeftCol && !isTopRow && !isBottomRow) rotationY = -Math.PI / 2;
            else if (isRightCol && !isTopRow && !isBottomRow) rotationY = Math.PI / 2;
          }
        }

        const geometry = createSmartGeometry(
          tileDef,
          stretchLeft,
          stretchRight,
          cullLeft,
          cullRight
        );

        const el = (
          <SmartWall
            key={`w-${index}`}
            geometry={geometry}
            texture={texture}
            wallType={type}
            position={[posX, 0, posZ]}
            rotation={[0, rotationY, 0]}
          />
        );

        const bucket = buckets.get(chunkKey) ?? [];
        bucket.push(el);
        buckets.set(chunkKey, bucket);
      });
      return buckets;
    }, [map, mapWidth, mapHeight, texture, getOrientation]);

    const wallMeshes = useMemo(
      () => selectVisibleFromBuckets(wallMeshesByChunk, visibleChunkKeys),
      [wallMeshesByChunk, visibleChunkKeys]
    );

    const cornerMeshes = useMemo(() => {
      const corners = [
        { x: 0, z: 0 },
        { x: mapWidth - 1, z: 0 },
        { x: 0, z: mapHeight - 1 },
        { x: mapWidth - 1, z: mapHeight - 1 },
      ];
      return corners.flatMap((c, i) => {
        const { cx, cz } = getChunkCoords(c.x, c.z);
        const chunkKey = getChunkKey(cx, cz);

        if (visibleChunkKeys.size > 0 && !visibleChunkKeys.has(chunkKey)) {
          return [];
        }

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
            wallType="rigid"
            position={[posX, 0, posZ]}
            rotation={[0, 0, 0]}
          />,
          <SmartWall
            key={`c-v-${i}`}
            geometry={geometry}
            texture={texture}
            wallType="rigid"
            position={[posX, 0, posZ]}
            rotation={[0, Math.PI / 2, 0]}
          />,
        ];
      });
    }, [map, mapWidth, mapHeight, texture, visibleChunkKeys]);

    return (
      <group name="level-walls">
        {wallMeshes}
        {cornerMeshes}
      </group>
    );
  }
  // No custom comparator needed: `map` is now a frozen snapshot reference
  // that never changes post-mount, so React.memo's default prop-reference
  // check already skips re-render on every gameplay tile edit for free.
);

interface CellBuilderCtx {
  playerPos: React.RefObject<THREE.Vector3>;
  onCombatStart: (id: string) => void;
  enemyTracker: React.RefObject<Map<string, { x: number; z: number }>>;
  onEnemyChaseChange: (enemyId: string, isChasing: boolean) => void;
  enemiesActive: boolean;
  deadEnemyIds: Set<string>;
  collisionGrid: boolean[][];
  getOrientation: (x: number, z: number) => Orientation;
}

interface CellEntry {
  key: string;
  element: React.ReactElement;
  enemyKey?: string;
}

// Builds every renderable element for a single grid cell. Pure function —
// safe to call both at initial build time and inside a later patch.
function buildCellElements(tile: number, x: number, z: number, ctx: CellBuilderCtx): CellEntry[] {
  const out: CellEntry[] = [];

  if (isDoor(tile)) {
    const isLocked = tile === TILE_TYPES.DOOR_LOCKED_SILVER;
    let rotationY = 0;
    if (ctx.getOrientation(x, z) === 'vertical') rotationY = Math.PI / 2;
    out.push({
      key: `door-${x}-${z}`,
      element: (
        <Door
          key={`door-${x}-${z}`}
          x={x}
          z={z}
          isOpen={tile === TILE_TYPES.DOOR_OPEN}
          isLocked={isLocked}
          rotation={rotationY}
          playerPos={ctx.playerPos}
        />
      ),
    });
  }

  if (tile === TILE_TYPES.GOLD) {
    out.push({
      key: `gold-${x}-${z}`,
      element: (
        <group key={`gold-${x}-${z}`} position={[0, 0.01, 0]}>
          <Gold x={x} z={z} />
        </group>
      ),
    });
  }

  if (tile === TILE_TYPES.TORCH_WALL) {
    out.push({ key: `torch-${x}-${z}`, element: <Torch key={`torch-${x}-${z}`} x={x} z={z} /> });
  }
  if (tile === TILE_TYPES.CANDLE) {
    out.push({ key: `candle-${x}-${z}`, element: <Candle key={`candle-${x}-${z}`} x={x} z={z} /> });
  }
  if (tile === TILE_TYPES.BONFIRE) {
    out.push({
      key: `bonfire-${x}-${z}`,
      element: <Bonfire key={`bonfire-${x}-${z}`} x={x} z={z} />,
    });
  }
  if (tile === TILE_TYPES.SIGN) {
    out.push({
      key: `sign-${x}-${z}`,
      element: <Sign key={`sign-${x}-${z}`} x={x} z={z} playerPos={ctx.playerPos} />,
    });
  }

  const enemyConfig = ENEMY_TILE_CONFIG[tile];
  if (enemyConfig) {
    const enemyKey = `${enemyConfig.prefix}-${x}-${z}`;
    const baseEnemyDef = ENEMIES[enemyConfig.type.toUpperCase()];

    if (!ctx.deadEnemyIds.has(enemyKey)) {
      out.push({
        key: `mon-${x}-${z}`,
        enemyKey,
        element: (
          <group key={`mon-${x}-${z}`} position={[0, 0.01, 0]}>
            <Monster
              id={enemyKey}
              type={enemyConfig.type}
              startX={x}
              startZ={z}
              behavior={baseEnemyDef?.defaultBehavior}
              playerPos={ctx.playerPos.current}
              collisionGrid={ctx.collisionGrid}
              onCombatStart={() => ctx.onCombatStart(enemyKey)}
              enemyTracker={ctx.enemyTracker}
              onChaseStateChange={ctx.onEnemyChaseChange}
              active={ctx.enemiesActive}
            />
          </group>
        ),
      });
    }
  }

  const tileDef = getTileDef(tile);

  if (tileDef.type === 'prop' && tileDef.modelPath) {
    out.push({
      key: `prop-${tileDef.name}-${x}-${z}`,
      element: (
        <Prop3D
          key={`prop-${tileDef.name}-${x}-${z}`}
          modelPath={tileDef.modelPath}
          gridX={x}
          gridZ={z}
          scale={tileDef.scale ?? 0.5}
        />
      ),
    });
  }

  if (tileDef.type === 'item' && tileDef.itemId) {
    const itemData = ITEM_REGISTRY[tileDef.itemId];
    if (itemData) {
      out.push({
        key: `item-${x}-${z}`,
        element: <LootDrop key={`item-${x}-${z}`} x={x} z={z} item={itemData} />,
      });
    }
  }

  return out;
}

function buildAllBuckets(map: number[][], ctx: CellBuilderCtx) {
  const buckets = new Map<string, CellEntry[]>();
  const enemyLocations = new Map<string, { chunkKey: string; key: string }>();

  map.forEach((row, z) => {
    row.forEach((tile, x) => {
      const cells = buildCellElements(tile, x, z, ctx);
      if (cells.length === 0) return;

      const { cx, cz } = getChunkCoords(x, z);
      const chunkKey = getChunkKey(cx, cz);
      const bucket = buckets.get(chunkKey) ?? [];
      for (const entry of cells) {
        bucket.push(entry);
        if (entry.enemyKey) enemyLocations.set(entry.enemyKey, { chunkKey, key: entry.key });
      }
      buckets.set(chunkKey, bucket);
    });
  });

  return { buckets, enemyLocations };
}

function buildCollisionGrid(map: number[][]): boolean[][] {
  const footprint = buildStructureFootprint(map);
  return map.map((row, z) =>
    row.map((_, x) => isSolidTile(getEffectiveTileId(map, footprint, x, z)))
  );
}

// Immutable single-cell patch: clones only the affected chunk's array, and
// the outer Map — never touches other chunks' arrays. O(chunk size), not
// O(map size).
function patchBucketsForCell(
  buckets: Map<string, CellEntry[]>,
  x: number,
  z: number,
  newEntries: CellEntry[]
): Map<string, CellEntry[]> {
  const { cx, cz } = getChunkCoords(x, z);
  const chunkKey = getChunkKey(cx, cz);
  const suffix = `-${x}-${z}`;

  const oldList = buckets.get(chunkKey) ?? [];
  const filtered = oldList.filter((e) => !e.key.endsWith(suffix));
  const nextList = newEntries.length > 0 ? [...filtered, ...newEntries] : filtered;

  const next = new Map(buckets);
  if (nextList.length > 0) next.set(chunkKey, nextList);
  else next.delete(chunkKey);
  return next;
}

function removeEntryFromBuckets(
  buckets: Map<string, CellEntry[]>,
  chunkKey: string,
  key: string
): Map<string, CellEntry[]> {
  const oldList = buckets.get(chunkKey);
  if (!oldList) return buckets;
  const filtered = oldList.filter((e) => e.key !== key);
  if (filtered.length === oldList.length) return buckets;
  const next = new Map(buckets);
  if (filtered.length > 0) next.set(chunkKey, filtered);
  else next.delete(chunkKey);
  return next;
}

function replaceEntryInBuckets(
  buckets: Map<string, CellEntry[]>,
  chunkKey: string,
  entry: CellEntry
): Map<string, CellEntry[]> {
  const oldList = buckets.get(chunkKey);
  if (!oldList) return buckets;
  const idx = oldList.findIndex((e) => e.key === entry.key);
  if (idx === -1) return buckets;
  const nextList = [...oldList];
  nextList[idx] = entry;
  const next = new Map(buckets);
  next.set(chunkKey, nextList);
  return next;
}

interface LevelBuilderProps {
  map: number[][];
  playerPos: React.RefObject<THREE.Vector3>;
  visibleChunkKeys: Set<string>;
  onCombatStart: (id: string) => void;
  enemyTracker: React.RefObject<Map<string, { x: number; z: number }>>;
  deadEnemyIds: Set<string>;
  onEnemyChaseChange: (enemyId: string, isChasing: boolean) => void;
  enemiesActive?: boolean;
}

export const LevelBuilder: React.FC<LevelBuilderProps> = ({
  map,
  playerPos,
  visibleChunkKeys,
  onCombatStart,
  enemyTracker,
  deadEnemyIds,
  onEnemyChaseChange,
  enemiesActive = true,
}) => {
  const rawAtlas = useTexture(ATLAS_URL);
  const texture = useMemo(() => getConfiguredAtlasTexture(rawAtlas, ATLAS_URL), [rawAtlas]);

  // Frozen snapshot of the map as it was at mount. LevelBuilder remounts on
  // level change (key={`builder-${currentLevelId}`} in Game.tsx), so this
  // is exactly the map for the level's whole lifetime. Wall/floor layout
  // never changes at runtime (doors/items are separate overlay elements),
  // so nothing derived from this needs to react to gameplay tile edits —
  // this is what eliminates the full-map rescans on pickup.
  const [structuralMap] = useState(() => map);

  const getOrientation = useCallback(
    (tx: number, tz: number) => getWallOrientation(structuralMap, tx, tz),
    [structuralMap]
  );

  // Live, mutable-by-patch state. Lazy initializers run exactly once, at
  // mount, so this is a one-time O(map size) build — not a per-render cost.
  const [collisionGrid, setCollisionGrid] = useState<boolean[][]>(() =>
    buildCollisionGrid(structuralMap)
  );

  // Bundle buckets + enemy locations into one state object so both update
  // together via functional setState — no ref read/write during render.
  const [levelData, setLevelData] = useState<{
    buckets: Map<string, CellEntry[]>;
    enemyLocations: Map<string, { chunkKey: string; key: string }>;
  }>(() =>
    buildAllBuckets(structuralMap, {
      playerPos,
      onCombatStart,
      enemyTracker,
      onEnemyChaseChange,
      enemiesActive,
      deadEnemyIds,
      collisionGrid,
      getOrientation,
    })
  );

  // --- Live "current props" ref, updated after every render, read only
  // from inside effects/event callbacks (never during render). This keeps
  // patchCell/tileEventBus callbacks correct without needing to
  // resubscribe whenever a prop changes. ---
  const liveRef = useRef({
    playerPos,
    onCombatStart,
    enemyTracker,
    onEnemyChaseChange,
    enemiesActive,
    deadEnemyIds,
    getOrientation,
  });
  useEffect(() => {
    liveRef.current = {
      playerPos,
      onCombatStart,
      enemyTracker,
      onEnemyChaseChange,
      enemiesActive,
      deadEnemyIds,
      getOrientation,
    };
  });

  // Patch exactly one cell on a tile-change event: O(1) collision update +
  // O(chunk size) item-bucket update. No full-map work.
  useEffect(() => {
    return tileEventBus.subscribe((x, z, _oldId, newId) => {
      setCollisionGrid((prev) => {
        const nextSolid = isSolidTile(newId);
        if (prev[z][x] === nextSolid) return prev;
        const next = [...prev];
        next[z] = [...prev[z]];
        next[z][x] = nextSolid;
        return next;
      });

      setLevelData((prev) => {
        const l = liveRef.current;
        const cells = buildCellElements(newId, x, z, {
          playerPos: l.playerPos,
          onCombatStart: l.onCombatStart,
          enemyTracker: l.enemyTracker,
          onEnemyChaseChange: l.onEnemyChaseChange,
          enemiesActive: l.enemiesActive,
          deadEnemyIds: l.deadEnemyIds,
          collisionGrid, // stale-by-one-tick is fine; monsters don't spawn from pickups
          getOrientation: l.getOrientation,
        });

        const nextBuckets = patchBucketsForCell(prev.buckets, x, z, cells);
        let nextLocations = prev.enemyLocations;
        for (const entry of cells) {
          if (entry.enemyKey) {
            const { cx, cz } = getChunkCoords(x, z);
            if (nextLocations === prev.enemyLocations) nextLocations = new Map(prev.enemyLocations);
            nextLocations.set(entry.enemyKey, { chunkKey: getChunkKey(cx, cz), key: entry.key });
          }
        }
        return { buckets: nextBuckets, enemyLocations: nextLocations };
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enemy death: remove just that one cached element.
  const prevDeadRef = useRef<Set<string>>(deadEnemyIds);
  useEffect(() => {
    if (deadEnemyIds !== prevDeadRef.current) {
      const newlyDead = Array.from(deadEnemyIds).filter((id) => !prevDeadRef.current.has(id));
      if (newlyDead.length > 0) {
        setLevelData((prev) => {
          let buckets = prev.buckets;
          const enemyLocations = new Map(prev.enemyLocations);
          for (const id of newlyDead) {
            const loc = enemyLocations.get(id);
            if (loc) {
              buckets = removeEntryFromBuckets(buckets, loc.chunkKey, loc.key);
              enemyLocations.delete(id);
            }
          }
          return { buckets, enemyLocations };
        });
      }
      prevDeadRef.current = deadEnemyIds;
    }
  }, [deadEnemyIds]);

  // enemiesActive toggle: patch only live monster entries, not the whole map.
  const prevActiveRef = useRef(enemiesActive);
  useEffect(() => {
    if (enemiesActive !== prevActiveRef.current) {
      prevActiveRef.current = enemiesActive;
      const l = liveRef.current;
      setLevelData((prev) => {
        let buckets = prev.buckets;
        for (const [enemyKey, loc] of prev.enemyLocations) {
          const parts = enemyKey.split('-');
          const z = Number(parts[parts.length - 1]);
          const x = Number(parts[parts.length - 2]);
          const tile = structuralMap[z][x];
          const cells = buildCellElements(tile, x, z, {
            playerPos: l.playerPos,
            onCombatStart: l.onCombatStart,
            enemyTracker: l.enemyTracker,
            onEnemyChaseChange: l.onEnemyChaseChange,
            enemiesActive,
            deadEnemyIds: l.deadEnemyIds,
            collisionGrid,
            getOrientation: l.getOrientation,
          });
          const match = cells.find((c) => c.key === loc.key);
          if (match) buckets = replaceEntryInBuckets(buckets, loc.chunkKey, match);
        }
        return { ...prev, buckets };
      });
    }
  }, [enemiesActive, structuralMap, collisionGrid]);

  const items = useMemo(() => {
    const flat = selectVisibleFromBuckets(levelData.buckets, visibleChunkKeys);
    return flat.map((e) => e.element);
  }, [levelData.buckets, visibleChunkKeys]);

  return (
    <group>
      <AtlasFloor map={structuralMap} visibleChunkKeys={visibleChunkKeys} />
      <StaticLevel
        map={structuralMap}
        texture={texture}
        playerPos={playerPos}
        visibleChunkKeys={visibleChunkKeys}
      />
      {items}
    </group>
  );
};
