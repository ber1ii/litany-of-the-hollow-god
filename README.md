# Litany of the Hollow God

A dark, grid-based horror RPG built as a custom 2.5D engine in React Three Fiber — combining real-time exploration with instanced turn-based combat.

> _"Do you remember when we carved that? You loved the curve of the jaw, it's ugly now."_

## About

You play as **The Penitent**, a soldier of the Cantorial Imperium who survived the recovery of a holy artifact that drove their entire squadron to madness. A voice now calls you toward **Cairn's End** — the foothold of a shattered divinity known as **The Hollow God**.

Eons ago, a single perfect being carved out its own capacity for doubt, empathy, and death — casting it away in an act called **The Great Severance**. What remained became the Hollow God: pure power, silent and purposeless. What was cast off reincarnates endlessly, forgetting each time, as the Penitent. The voice calling you to Cairn's End isn't asking you to serve — it's asking you to re-merge.

Explore the claustrophobic, rain-soaked ruins beneath **The Cathedral of Silence**, rest at cold-burning Votive Shrines, and descend toward the Citadel to face the **Triune of the Unvoiced** — three entities that exist to harvest you back into the fold.

### Inspirations

_Fear & Hunger_, _Silent Hill 2_, and FromSoftware's Souls-adjacent catalogue — _Dark Souls_, _Bloodborne_, _Elden Ring_, and _Demon's Souls_ — shape both the atmosphere and the mechanical cruelty of the game.

## Core Tech Stack

- **React** + **TypeScript**
- **React Three Fiber** / **Three.js** — 3D rendering
- **Zustand** — state management (`usePlayerStore`, `useCombatStore`)

## Engine Features

- **ASCII-to-3D map generator** — level layouts are authored as structured placement data and parsed into fully realized 3D geometry at runtime.
- **Structure footprint resolution** — distinguishes modular, tileable wall units (repeated and orientation-aware, with dynamic stretching/culling at joins) from large multi-tile set-piece structures (buildings, archways, monuments) placed as single anchored instances.
- **Discrete collision grid** — generated from level data, respecting each tile's true occupied footprint.
- **Dynamic camera tracking** — fixed, cinematic camera angles in the spirit of the original _Silent Hill 2_, deliberately obscuring threats until they're close.
- **Smart wall fading** — a custom shader (`SmartFadeMaterial`) that fades walls near the player to preserve visibility without breaking the claustrophobic framing.
- **16×16 tileset rendering** with nearest-neighbor filtering for a crunchy, PS1-era low-poly aesthetic.

## Gameplay Systems

- **Real-time exploration** — navigate the 3D world, solve puzzles, find keys, and unlock shortcuts back to safety.
- **Bonfire (Votive Shrine) checkpointing** — rest to restore HP and flasks, at the cost of respawning non-unique enemies.
- **Turn-based combat** — encountering an enemy transitions into an instanced combat screen (`CombatScene`) with high-detail pixel art sprites.
- **Limb targeting** — tactically dismember enemies (and be dismembered (in the future)): legs reduce evasion/charge attacks, arms disable weapons or spells, heads carry high risk/high reward for an instant kill.
- **Active parry system** — a dedicated, skill-based input during enemy attack phases that negates damage and opens a critical counter. (Future addition)
- **Sanity system** — a real-time-and-combat mechanic representing the breakdown between the Penitent and the God:
  - **High Sanity** — clean UI, the world as it is, enemies engage normally.
  - **Low Sanity** — distorted UI, hallucinated threats, basic enemies flee in fear instead of attacking.
  - **Zero Sanity (Fugue State)** — combat-only; the God takes control for 3 turns, dealing massive damage with no guarantee it won't turn on you. (Future addition)
- **Inventory & equipment management**, including weapon upgrades and a skill tree.

## Installation

**Using bun:**

```bash
bun install
bun run dev
```

**Using npm:**

```bash
npm install
npm run dev
```

## License

_TBD_
