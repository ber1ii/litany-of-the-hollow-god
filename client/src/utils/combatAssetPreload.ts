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
    // KNIGHT_SPRITES values are plain URL strings (CombatSpriteDef),
    // unlike EnemyDef.sprites' { textureUrl, frames, ... } shape above —
    // treating them as objects with .textureUrl meant this silently
    // added nothing to the set, so no player sprite (including
    // attack_from_air.png) was ever actually preloaded.
    Object.values(KNIGHT_SPRITES).forEach((url) => {
      if (typeof url === 'string' && url.trim() !== '') {
        textureSet.add(url);
      }
    });
  }

  const urls = Array.from(textureSet);
  if (urls.length > 0) {
    useTexture.preload(urls);
  }
};
