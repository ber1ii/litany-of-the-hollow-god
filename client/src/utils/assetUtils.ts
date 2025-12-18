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

const COMBAT_TEXTURES = [
  // Knight
  '/sprites/combat/knight/Idle.png',
  '/sprites/combat/knight/attack1.png',
  '/sprites/combat/knight/attack2.png',
  '/sprites/combat/knight/Hurt.png',
  '/sprites/combat/knight/Death.png',
  '/sprites/combat/knight/Pray.png',
  '/sprites/combat/skeleton/idle.png',
  '/sprites/combat/skeleton/attack.png',
  '/sprites/combat/skeleton/hurt.png',
  '/sprites/combat/skeleton/death.png',
];

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

  useTexture.preload(COMBAT_TEXTURES);

  console.log('Assets preloading finished...');
};
