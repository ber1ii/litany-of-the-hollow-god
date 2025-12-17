import { useTexture } from '@react-three/drei';

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

  console.log('Assets preloading finished...');
};
