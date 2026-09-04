import React, { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { TILE_SIZE } from './MapData';

interface Prop3DProps {
  modelPath: string;
  gridX: number;
  gridZ: number;
  scale?: number;
  rotationY?: number;
  yOffset?: number;
}

export const Prop3D: React.FC<Prop3DProps> = ({
  modelPath,
  gridX,
  gridZ,
  scale = 1,
  rotationY = 0,
  yOffset = 0,
}) => {
  // The path starts from the public folder
  const { scene } = useGLTF(modelPath);

  // Clone the scene so we can reuse the same model across the map
  const clone = useMemo(() => scene.clone(), [scene]);

  return (
    <primitive
      object={clone}
      position={[gridX * TILE_SIZE, yOffset, gridZ * TILE_SIZE]}
      scale={scale}
      rotation={[0, rotationY, 0]}
    />
  );
};

useGLTF.preload('/sprites/props/3D Props/Small Props Pack/gLTF/Props/FirePlace_1_1_A.glb');
useGLTF.preload('/sprites/props/3D Props/Small Props Pack/gLTF/Props/Stool_A.glb');
useGLTF.preload('/sprites/props/3D Props/Small Props Pack/gLTF/Props/Bag_1_A.glb');
