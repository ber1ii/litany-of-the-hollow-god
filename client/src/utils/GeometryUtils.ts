import { SHEET_CONFIG } from '../data/TileRegistry';

export const getAtlasUVs = (col: number, row: number, widthTiles = 1, heightTiles = 1) => {
  const { width, height, tileSize } = SHEET_CONFIG;
  const inset = 0.5; // half-pixel inset

  const pixelX = col * tileSize + inset;
  const pixelY = row * tileSize + inset;
  const pixelW = widthTiles * tileSize - inset * 2;
  const pixelH = heightTiles * tileSize - inset * 2;

  const uMin = pixelX / width;
  const uMax = (pixelX + pixelW) / width;
  const vMax = 1 - pixelY / height;
  const vMin = 1 - (pixelY + pixelH) / height;

  return { uMin, uMax, vMin, vMax };
};
