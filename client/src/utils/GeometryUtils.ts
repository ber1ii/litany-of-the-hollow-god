import { SHEET_CONFIG } from '../data/TileRegistry';

export const getAtlasUVs = (col: number, row: number, widthTiles = 1, heightTiles = 1) => {
  const { width, height, tileSize } = SHEET_CONFIG;

  // Calculate pixel Coords
  const pixelX = col * tileSize;
  const pixelY = row * tileSize;
  const pixelW = widthTiles * tileSize;
  const pixelH = heightTiles * tileSize;

  // Conver to UV Space (0.0 -> 1.0)
  const uMin = pixelX / width;
  const uMax = (pixelX + pixelW) / width;

  // Threejs UVs (0,0 is bottom left, but images are top-left)
  // We flip the Y axis to match spritesheet coord
  const vMax = 1 - pixelY / height;
  const vMin = 1 - (pixelY + pixelH) / height;

  return { uMin, uMax, vMin, vMax };
};
