export interface SignEntry {
  title: string;
  body: string;
}

export const SIGN_DATA: Record<string, SignEntry> = {
  '5,4': {
    title: 'Movement',
    body: 'WASD/Arrows to move. Aiming is separate — hold the aim keys to face and strike a direction independent of your movement.',
  },
  '6,8': {
    title: 'The Bonfire',
    body: 'Rest here to save your progress and restore HP/Flasks. Bonfires are also where you spend souls to level up stats.',
  },
  '23,9': {
    title: 'Loot',
    body: 'Gold and items lie scattered about. Walk up and press [E] to collect.',
  },
  '21,17': {
    title: 'Locked Doors',
    body: 'Some doors are sealed. You will need to find the matching key elsewhere to pass.',
  },
  '16,19': {
    title: 'Combat: Limbs & Severing',
    body:
      'Target a limb before going for the head — striking already-damaged limbs raises your sever chance. ' +
      'Severing the head ends the fight instantly. Vitality raises max HP. Strength/Dexterity raise damage. ' +
      'Agility affects turn order and dodge. Mind raises max Sanity, which drains from certain enemies and cursed tiles — low Sanity worsens your accuracy.',
  },
  '6,21': {
    title: 'Mental State',
    body: 'Your Sanity drains near certain cursed floor tiles and enemies. Low Sanity worsens your accuracy in combat — rest at a bonfire to restore it fully.',
  },
};

export const getSignData = (x: number, z: number): SignEntry | undefined => SIGN_DATA[`${x},${z}`];
