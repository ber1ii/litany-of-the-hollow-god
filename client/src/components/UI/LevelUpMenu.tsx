import React, { useState } from 'react';
import type { PlayerStats } from '../../types/GameTypes';

interface LevelUpMenuProps {
  stats: PlayerStats;
  onClose: () => void;
  onConfirm: (newStats: PlayerStats, cost: number) => void;
}

type LevelingStat = 'vitality' | 'strength' | 'dexterity' | 'intelligence' | 'mind' | 'agility';

export const LevelUpMenu: React.FC<LevelUpMenuProps> = ({ stats, onClose, onConfirm }) => {
  const [tempStats, setTempStats] = useState({ ...stats });

  const getLevelCost = (lvl: number) => Math.floor(100 * Math.pow(1.1, lvl - 1));

  const [currentGold, setCurrentGold] = useState(stats.gold);
  const [currentLevel, setCurrentLevel] = useState(stats.level);

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
        setCurrentGold((prev) => prev - costForNextLevel);
        setTempStats((prev) => ({ ...prev, [stat]: prev[stat] + 1 }));
        setInvested((prev) => ({ ...prev, [stat]: prev[stat] + 1 }));
        setCurrentLevel((prev) => prev + 1);
      }
    } else {
      if (invested[stat] > 0) {
        const refund = getLevelCost(currentLevel - 1);
        setCurrentGold((prev) => prev + refund);
        setTempStats((prev) => ({ ...prev, [stat]: prev[stat] - 1 }));
        setInvested((prev) => ({ ...prev, [stat]: prev[stat] - 1 }));
        setCurrentLevel((prev) => prev - 1);
      }
    }
  };

  const confirmChanges = () => {
    const newStats = { ...tempStats };
    newStats.maxHp = 100 + newStats.vitality * 10;
    newStats.attack = 10 + newStats.strength * 2;
    newStats.gold = currentGold;
    newStats.level = currentLevel;

    onConfirm(newStats, stats.gold - currentGold);
  };

  const statLabels: { key: LevelingStat; label: string; desc: string }[] = [
    { key: 'vitality', label: 'Vitality', desc: 'Increases HP' },
    { key: 'strength', label: 'Strength', desc: 'Increases Phys DMG' },
    { key: 'dexterity', label: 'Dexterity', desc: 'Increases Crit/Speed' },
    { key: 'intelligence', label: 'Intelligence', desc: 'Increases Magic DMG' },
    { key: 'mind', label: 'Mind', desc: 'Increases MP & Sanity' },
    { key: 'agility', label: 'Agility', desc: 'Increases Dodge' },
  ];

  return (
    <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/95 backdrop-blur-md">
      <div className="w-[900px] h-[600px] flex border-2 border-neutral-700 shadow-2xl bg-[#080808]">
        {/* LEFT: Stats Panel */}
        <div className="w-[60%] p-8 border-r border-neutral-800 flex flex-col relative">
          <div className="flex justify-between items-end mb-6 border-b border-neutral-700 pb-4">
            <div>
              <h2 className="text-3xl font-serif text-amber-500 tracking-[0.2em] uppercase">
                Level Up
              </h2>
              <p className="text-neutral-500 font-mono text-xs mt-1">
                Invest souls to strengthen your vessel
              </p>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-neutral-500 uppercase tracking-widest">
                Required Souls
              </div>
              <div
                className={`font-mono text-xl ${currentGold < costForNextLevel ? 'text-red-500' : 'text-white'}`}
              >
                {costForNextLevel}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {statLabels.map(({ key, label, desc }) => (
              <div
                key={key}
                className="flex justify-between items-center p-2 hover:bg-white/5 rounded transition-colors group"
              >
                <div className="flex flex-col">
                  <span className="text-neutral-300 font-serif text-xl group-hover:text-white transition-colors">
                    {label}
                  </span>
                  <span className="text-[10px] text-neutral-600 font-mono">{desc}</span>
                </div>

                <div className="flex items-center gap-6">
                  {/* Current Value */}
                  <span
                    className={`font-mono text-2xl w-8 text-center ${invested[key] > 0 ? 'text-blue-400' : 'text-white'}`}
                  >
                    {tempStats[key]}
                  </span>

                  {/* Controls */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStatChange(key, -1)}
                      disabled={invested[key] <= 0}
                      className={`
                        w-8 h-8 flex items-center justify-center border font-bold text-lg transition-all
                        ${
                          invested[key] <= 0
                            ? 'border-neutral-800 text-neutral-700 cursor-not-allowed bg-transparent'
                            : 'border-red-900/50 bg-red-950/30 text-red-500 hover:bg-red-900 hover:text-white hover:border-red-500'
                        }
                      `}
                    >
                      -
                    </button>
                    <button
                      onClick={() => handleStatChange(key, 1)}
                      disabled={currentGold < costForNextLevel}
                      className={`
                        w-8 h-8 flex items-center justify-center border font-bold text-lg transition-all
                        ${
                          currentGold < costForNextLevel
                            ? 'border-neutral-800 text-neutral-700 cursor-not-allowed bg-transparent'
                            : 'border-amber-700/50 bg-amber-950/30 text-amber-500 hover:bg-amber-700 hover:text-white hover:border-amber-500'
                        }
                      `}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Overview Panel */}
        <div className="w-[40%] p-8 flex flex-col bg-neutral-900/30">
          <div className="flex justify-between items-end mb-8 border-b border-neutral-700 pb-4">
            <div className="flex flex-col">
              <span className="text-xs text-neutral-500 uppercase tracking-widest">Level</span>
              <span className="text-5xl text-white font-mono">{currentLevel}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs text-neutral-500 uppercase tracking-widest">Souls Held</span>
              <span className="text-2xl text-amber-400 font-mono">{currentGold}</span>
            </div>
          </div>

          {/* Derived Stats Preview */}
          <div className="flex flex-col gap-6 text-sm font-mono text-neutral-400 mb-auto">
            <div className="space-y-2">
              <div className="text-xs text-neutral-600 uppercase tracking-widest border-b border-neutral-800 pb-1">
                Combat Stats
              </div>
              <div className="flex justify-between items-center">
                <span>Max HP</span>
                <span
                  className={`text-lg ${tempStats.maxHp > stats.maxHp ? 'text-blue-400' : 'text-white'}`}
                >
                  {stats.maxHp} {tempStats.maxHp > stats.maxHp && `→ ${tempStats.maxHp}`}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Attack Power</span>
                <span
                  className={`text-lg ${tempStats.attack > stats.attack ? 'text-blue-400' : 'text-white'}`}
                >
                  {stats.attack} {tempStats.attack > stats.attack && `→ ${tempStats.attack}`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={confirmChanges}
              className="py-4 bg-amber-900/20 border border-amber-700/50 text-amber-100 hover:bg-amber-900/40 hover:border-amber-500 hover:shadow-[0_0_15px_rgba(245,158,11,0.2)] uppercase tracking-[0.2em] transition-all font-serif text-sm"
            >
              Confirm Level Up
            </button>
            <button
              onClick={onClose}
              className="py-3 border border-neutral-700 text-neutral-400 hover:bg-neutral-800 hover:text-white uppercase tracking-[0.2em] transition-all font-serif text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
