import { Object3DNode, MaterialNode } from "@react-three/fiber";
import { ShaderMaterial } from "three";

// Define the Uniforms interface so TS knows what props you can pass
type SmartFadeMaterialProps = {
  uPlayerPos?: THREE.Vector3;
  uBaseOpacity?: number;
  uWallType?: number; // 0.0 or 1.0
  color?: string | THREE.Color;
  map?: THREE.Texture | null;
  transparent?: boolean;
} & MaterialNode<ShaderMaterial, typeof ShaderMaterial>;

declare module "@react-three/fiber" {
  interface ThreeElements {
    smartFadeMaterial: SmartFadeMaterialProps;
  }
}
