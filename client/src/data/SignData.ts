export interface SignEntry {
  title: string;
  body: string;
}

export const SIGN_DATA: Record<string, SignEntry> = {
  '4,13': {
    title: 'Movement & UI',
    body: 'WASD/Arrows to move. Aiming is separate — hold the Arrow keys to face and strike a direction independent of your movement. Press [E] to interact, and [Tab] to open the inventory.',
  },
  '6,12': {
    title: 'The Bonfire',
    body: 'Rest here to save your progress and restore HP/Flasks. Bonfires are also where you spend wealth to level up stats.',
  },
  '8,12': {
    title: 'Attributes & Stats',
    body: 'Vitality increases Max HP. Strength scales weapon damage. Dexterity scales accuracy, crit chance, and crit damage. Agility increases actions per turn (at 2x enemy speed you strike twice) and accuracy. Mind raises Max MP. Intelligence boosts buff and debuff potency.',
  },
  '7,17': {
    title: 'Combat',
    body: 'Target a limb before going for the head. Severing limbs increases the sever chance of the head.',
  },
  '15,18': {
    title: 'Loot',
    body: 'Gold and items lie scattered about. Walk up and press [E] to collect.',
  },
  '23,20': {
    title: 'Sanity & Mental State',
    body: 'Your Sanity drains near certain cursed floor tiles and enemies. Low Sanity worsens your accuracy and worsens your perception of reality, causing hallucinations.',
  },
  '37,12': {
    title: 'Locked Doors',
    body: 'Some doors are sealed. You will need to find the matching key elsewhere to pass.',
  },
};

export const getSignData = (x: number, z: number): SignEntry | undefined => SIGN_DATA[`${x},${z}`];
