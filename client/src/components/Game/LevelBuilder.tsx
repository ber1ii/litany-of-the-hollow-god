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
  onCombatStart: () => void; // <--- FIX 1: Add Prop
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

  const wallMeshes = useMemo(() => {
    const groups = getWallGroups(map);
    return groups.map((group, index) => {
      const geometry = createWallGeometry(group, map);
      return <SmartWall key={`wall-group-${index}`} geometry={geometry} texture={texture} />;
    });
  }, [map, texture]);

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
