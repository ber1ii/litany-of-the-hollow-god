import { useTexture } from '@react-three/drei';
// Import the preloaders
import { preloadPlayerAssets } from '../components/Combat/CombatPlayer';
import { preloadEnemyAssets } from '../components/Combat/CombatEnemy';

const FRAME_COUNTS: Record<string, number> = {
  walk: 8,
  idle: 1,
};

const DIRECTIONS = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'];

export const getSpritePaths = (character: string, action: string, direction: string) => {
  const count = FRAME_COUNTS[action] || 1;
  const paths: string[] = [];

  for (let i = 1; i <= count; i++) {
    paths.push(`/sprites/characters/${character}/${action}/${direction}/${i}.png`);
  }

  return paths;
};

export const preloadAllAssets = () => {
  // 1. Preload Roam Sprites (Hero & Enemies on Map)
  const characters = ['hero', 'skeleton'];
  const actions = ['idle', 'walk'];

  characters.forEach((char) => {
    actions.forEach((action) => {
      DIRECTIONS.forEach((dir) => {
        const paths = getSpritePaths(char, action, dir);
        useTexture.preload(paths);
      });
    });
  });
  console.log('Roam Assets Preloaded');

  // 2. Preload Combat Sprites (Decoupled)
  preloadPlayerAssets();
  preloadEnemyAssets();

  // 3. Preload UI/Props (Optional, if you want to centralize Torch/Flasks)
  useTexture.preload([
    '/sprites/props/torch/torch_1.png',
    '/sprites/props/torch/torch_2.png',
    '/sprites/props/torch/torch_3.png',
    '/sprites/props/torch/torch_4.png',
    '/sprites/props/red_vial/potion_red_drop.png',
    '/sprites/props/blue_vial/potion_blue_drop.png',
    '/sprites/items/weapons/sword_rusty.png',
  ]);
};
