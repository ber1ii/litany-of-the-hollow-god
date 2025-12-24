import React, { useState } from 'react';
import type { PlayerStats } from '../../types/GameTypes';

interface LevelUpMenuProps {
  stats: PlayerStats;
  onClose: () => void;
  onConfirm: (newStats: PlayerStats) => void;
}

type LevelingStat = 'vitality' | 'strength' | 'dexterity' | 'intelligence' | 'mind' | 'agility';

export const LevelUpMenu: React.FC<LevelUpMenuProps> = ({ stats, onClose, onConfirm }) => {
  const [tempStats, setTempStats] = useState({ ...stats });

  // Simple exponential curve
  const getLevelCost = (lvl: number) => Math.floor(100 * Math.pow(1.1, lvl - 1));

  const [currentGold, setCurrentGold] = useState(stats.gold);
  const [currentLevel, setCurrentLevel] = useState(stats.level);

  // We track how many points added per stat in this session
  const [invested, setInvested] = useState<Record<LevelingStat, number>>({
    vitality: 0,
    strength: 0,
    dexterity: 0,
    intelligence: 0,
    mind: 0,
    agility: 0,
  });

  const costForNextLevel = getLevelCost(currentLevel);

  const handleStatChange = (stat: LevelingStat, change: number) => {
    if (change > 0) {
      if (currentGold >= costForNextLevel) {
        setCurrentGold((g) => g - costForNextLevel);
        setCurrentLevel((l) => l + 1);
        setInvested((prev) => ({ ...prev, [stat]: prev[stat] + 1 }));

        setTempStats((prev) => {
          const next = { ...prev };
          if (stat === 'vitality') next.maxHp += 10;
          if (stat === 'strength') next.attack += 2;
          // Add other stat logic here
          return next;
        });
      }
    } else {
      // Refund logic
      if (invested[stat] > 0) {
        const costOfRefundedLevel = getLevelCost(currentLevel - 1);
        setCurrentGold((g) => g + costOfRefundedLevel);
        setCurrentLevel((l) => l - 1);
        setInvested((prev) => ({ ...prev, [stat]: prev[stat] - 1 }));

        setTempStats((prev) => {
          const next = { ...prev };
          if (stat === 'vitality') next.maxHp -= 10;
          if (stat === 'strength') next.attack -= 2;
          return next;
        });
      }
    }
  };

  const confirmChanges = () => {
    const finalStats = { ...tempStats, level: currentLevel, gold: currentGold };
    onConfirm(finalStats);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-end p-[5vmin]">
      <div
        className="bg-black/95 border-l-4 border-amber-800 p-[4vmin] flex flex-col shadow-2xl h-full backdrop-blur-md"
        style={{ width: '45vmin' }}
      >
        <h2
          className="font-serif text-amber-500 uppercase tracking-widest border-b border-neutral-800 pb-[2vmin] mb-[3vmin]"
          style={{ fontSize: '3vmin' }}
        >
          Level Up
        </h2>

        <div className="flex justify-between items-end mb-[4vmin] font-mono">
          <div>
            <div className="text-neutral-500 text-[1.2vmin]">Current Level</div>
            <div className="text-[3vmin] text-white">{currentLevel}</div>
          </div>
          <div className="text-right">
            <div className="text-neutral-500 text-[1.2vmin]">Souls Required</div>
            <div
              className={`${currentGold >= costForNextLevel ? 'text-white' : 'text-red-500'} text-[2vmin]`}
            >
              {costForNextLevel}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mb-[4vmin] bg-neutral-900/50 p-[1.5vmin] rounded">
          <span className="text-amber-200 uppercase tracking-wider text-[1.2vmin]">Held Gold</span>
          <span className="text-[2vmin] font-mono text-amber-500">{currentGold}</span>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-[1vmin]">
          {/* Stat Rows */}
          {(
            [
              'vitality',
              'strength',
              'dexterity',
              'intelligence',
              'mind',
              'agility',
            ] as LevelingStat[]
          ).map((stat) => (
            <div key={stat} className="flex items-center justify-between mb-[2vmin]">
              <span className="capitalize text-neutral-400 font-serif text-[1.6vmin]">{stat}</span>
              <div className="flex items-center gap-[2vmin]">
                <button
                  onClick={() => handleStatChange(stat, -1)}
                  disabled={invested[stat] === 0}
                  className="text-neutral-600 hover:text-white disabled:opacity-20 text-[2vmin]"
                >
                  ◀
                </button>
                <span
                  className={`font-mono text-[1.8vmin] w-[3vmin] text-center ${invested[stat] > 0 ? 'text-blue-400' : 'text-white'}`}
                >
                  {(stats[stat as keyof PlayerStats] as number) + invested[stat]}
                </span>
                <button
                  onClick={() => handleStatChange(stat, 1)}
                  disabled={currentGold < costForNextLevel}
                  className="text-neutral-600 hover:text-white disabled:opacity-20 text-[2vmin]"
                >
                  ▶
                </button>
              </div>
            </div>
          ))}

          {/* Preview Stats */}
          <div className="mt-[4vmin] pt-[2vmin] border-t border-neutral-800">
            <div className="text-neutral-500 uppercase text-[1vmin] mb-[1.5vmin] tracking-widest">
              Projection
            </div>
            <div className="flex justify-between items-center text-[1.2vmin] mb-[1vmin] text-neutral-300">
              <span>Max HP</span>
              <span className={tempStats.maxHp > stats.maxHp ? 'text-blue-400' : ''}>
                {stats.maxHp} {tempStats.maxHp > stats.maxHp && `→ ${tempStats.maxHp}`}
              </span>
            </div>
            <div className="flex justify-between items-center text-[1.2vmin] text-neutral-300">
              <span>Attack Power</span>
              <span className={tempStats.attack > stats.attack ? 'text-blue-400' : ''}>
                {stats.attack} {tempStats.attack > stats.attack && `→ ${tempStats.attack}`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-[1.5vmin] mt-[3vmin]">
          <button
            onClick={confirmChanges}
            disabled={Object.values(invested).every((v) => v === 0)}
            className="bg-amber-900/20 border border-amber-700/50 text-amber-100 hover:bg-amber-900/40 hover:border-amber-500 uppercase tracking-[0.2em] transition-all font-serif disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ padding: '2vmin', fontSize: '1.4vmin' }}
          >
            Confirm Level Up
          </button>
          <button
            onClick={onClose}
            className="border border-neutral-700 text-neutral-400 hover:bg-neutral-800 hover:text-white uppercase tracking-[0.2em] transition-all font-serif"
            style={{ padding: '1.5vmin', fontSize: '1.2vmin' }}
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
};
