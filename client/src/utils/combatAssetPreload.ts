import { useTexture } from '@react-three/drei';
// Adjust these import paths to point to your actual data definitions
import { ENEMIES } from '../data/Enemies';
import { KNIGHT_SPRITES } from '../data/sprites/KnightSprites';

export const preloadEnemyAssets = () => {
  const textureSet = new Set<string>();

  Object.values(ENEMIES).forEach((def) => {
    if (def?.sprites) {
      Object.values(def.sprites).forEach((sprite) => {
        if (sprite && typeof sprite.textureUrl === 'string' && sprite.textureUrl.trim() !== '') {
          textureSet.add(sprite.textureUrl);
        }
      });
    }
  });

  const urls = Array.from(textureSet);
  if (urls.length > 0) {
    useTexture.preload(urls);
  }
};

export const preloadPlayerAssets = () => {
  const textureSet = new Set<string>();

  if (KNIGHT_SPRITES) {
    Object.values(KNIGHT_SPRITES).forEach((sprite) => {
      if (sprite && typeof sprite.textureUrl === 'string' && sprite.textureUrl.trim() !== '') {
        textureSet.add(sprite.textureUrl);
      }
    });
  }

  const urls = Array.from(textureSet);
  if (urls.length > 0) {
    useTexture.preload(urls);
  }
};
