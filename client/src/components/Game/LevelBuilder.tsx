import React, { useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { SmartWall } from './SmartWall';
import { Door } from './Door';
import { Gold } from './Gold';
import { Monster } from './Monster';
import { getWallGroups, createWallGeometry } from '../../utils/WallGenerator';
import { TILE_TYPES } from './MapData';

interface LevelBuilderProps {
  map: number[][];
  playerPos: React.MutableRefObject<THREE.Vector3>;
  onCombatStart: () => void;
}

export const LevelBuilder: React.FC<LevelBuilderProps> = ({ map, playerPos, onCombatStart }) => {
  const rawWallTexture = useTexture('/textures/environment/ground_stone.png');

  const texture = useMemo(() => {
    const t = rawWallTexture.clone();
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [rawWallTexture]);

  const mapWidth = map[0].length;

  const wallMeshes = useMemo(() => {
    const groups = getWallGroups(map);

    return groups.map((group, index) => {
      // 1. Analyze Position
      const isLeft = group.some((b) => b.x === 0);
      const isRight = group.some((b) => b.x === mapWidth - 1);
      const isTop = group.some((b) => b.z === 0);

      // 2. Determine Type
      let type: 'rigid' | 'fadable' = 'fadable';

      if (isTop || isLeft || isRight) {
        type = 'rigid';
      }

      // 3. Determine Forced Faces
      const forceFaces: string[] = [];

      if (isLeft && type === 'rigid') forceFaces.push('E');
      if (isRight && type === 'rigid') forceFaces.push('W');
      if (isTop) forceFaces.push('S');

      const geometry = createWallGeometry(group, map, forceFaces);

      return (
        <SmartWall
          key={`wall-${index}`}
          geometry={geometry}
          texture={texture}
          playerPos={playerPos}
          wallType={type}
        />
      );
    });
  }, [map, texture, playerPos, mapWidth]);

  const items = useMemo(() => {
    const list: React.ReactElement[] = [];
    map.forEach((row, z) => {
      row.forEach((tile, x) => {
        if (tile === TILE_TYPES.DOOR_CLOSED || tile === TILE_TYPES.DOOR_OPEN) {
          list.push(
            <Door key={`door-${x}-${z}`} x={x} z={z} isOpen={tile === TILE_TYPES.DOOR_OPEN} />
          );
        }
        if (tile === TILE_TYPES.GOLD) {
          list.push(<Gold key={`gold-${x}-${z}`} x={x} z={z} />);
        }
        if (tile === TILE_TYPES.SKELETON) {
          list.push(
            <Monster
              key={`mon-${x}-${z}`}
              type="skeleton"
              startX={x}
              startZ={z}
              playerPos={playerPos.current}
              onCombatStart={onCombatStart}
            />
          );
        }
      });
    });
    return list;
  }, [map, playerPos, onCombatStart]);

  return (
    <group>
      {wallMeshes}
      {items}
    </group>
  );
};
