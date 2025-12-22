import React, { useState, useMemo } from 'react';
import { SKILL_TREE } from '../../data/SkillTreeData';
import { SKILL_DATABASE } from '../../data/Skills';
import type { PlayerStats } from '../../types/GameTypes';

interface SkillTreeProps {
  stats: PlayerStats;
  onClose: () => void;
  onUnlock: (skillId: string, cost: number) => void;
}

export const SkillTree: React.FC<SkillTreeProps> = ({ stats, onClose, onUnlock }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visibleNodes = useMemo(() => {
    // eslint-disable-next-line
    return Object.entries(SKILL_TREE).filter(([_, node]) => {
      // Show if it's universal OR matches the player's class
      return !node.requiredClass || node.requiredClass === stats.classId;
    });
  }, [stats.classId]);

  const getStatus = (id: string) => {
    if (stats.unlockedSkills.includes(id)) return 'unlocked';
    const node = SKILL_TREE[id];

    // Safety check: if for some reason a skill of another class is checked
    if (node.requiredClass && node.requiredClass !== stats.classId) return 'locked';

    const canAfford = stats.xp >= node.cost;
    const reqsMet =
      node.requires.length === 0 || node.requires.every((r) => stats.unlockedSkills.includes(r));

    if (!reqsMet) return 'locked';
    return canAfford ? 'available' : 'expensive';
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 font-serif">
      <div className="w-[900px] h-[600px] bg-neutral-950 border-2 border-neutral-800 flex overflow-hidden shadow-2xl">
        {/* LEFT: THE TREE GRID */}
        <div className="flex-1 relative bg-[url('/ui/grid_dots.png')] bg-repeat opacity-90">
          <div className="absolute top-4 left-6 text-neutral-500 text-xs tracking-widest uppercase">
            {stats.classId} Ascension Ritual
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            {/* 2. MAP OVER VISIBLE NODES ONLY */}
            {visibleNodes.map(([id, node]) => {
              const status = getStatus(id);
              const isSelected = selectedId === id;

              return (
                <button
                  key={id}
                  onClick={() => setSelectedId(id)}
                  style={{
                    left: `calc(50% + ${node.x * 120}px)`,
                    top: `calc(50% + ${node.y * 120}px)`,
                  }}
                  className={`absolute w-14 h-14 -translate-x-1/2 -translate-y-1/2 border-2 rotate-45 transition-all
                    ${
                      status === 'unlocked'
                        ? 'border-amber-500 bg-amber-900/20 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                        : status === 'available'
                          ? 'border-neutral-500 bg-neutral-800 hover:border-white'
                          : status === 'expensive'
                            ? 'border-red-900/50 bg-neutral-900 opacity-80'
                            : 'border-neutral-800 bg-neutral-950 opacity-40'
                    }
                    ${isSelected ? 'scale-110 ring-2 ring-white border-white' : ''}
                  `}
                >
                  <div className="-rotate-45 flex items-center justify-center h-full text-lg">
                    {SKILL_DATABASE[id]?.name[0]}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT: DETAILS PANEL */}
        <div className="w-[300px] border-l border-neutral-800 p-8 flex flex-col bg-neutral-900/50">
          <div className="mb-10">
            <div className="text-[10px] text-neutral-500 uppercase tracking-[0.2em] mb-1">
              Soul Fragments
            </div>
            <div className="text-3xl font-mono text-green-500">
              {stats.xp} <span className="text-xs text-neutral-600">XP</span>
            </div>
          </div>

          {selectedId ? (
            <div className="flex-1 flex flex-col">
              <h2 className={`text-2xl mb-1 ${SKILL_DATABASE[selectedId].color}`}>
                {SKILL_DATABASE[selectedId].name}
              </h2>
              <div className="text-[10px] text-neutral-500 uppercase mb-4 tracking-widest">
                {SKILL_DATABASE[selectedId].type}
              </div>
              <p className="text-neutral-400 text-sm leading-relaxed italic">
                "{SKILL_DATABASE[selectedId].description}"
              </p>

              <div className="mt-auto pt-6 border-t border-neutral-800">
                <div className="flex justify-between text-sm mb-4">
                  <span className="text-neutral-500 uppercase text-[10px]">Requirement</span>
                  <span
                    className={
                      getStatus(selectedId) === 'unlocked' ? 'text-amber-500' : 'text-neutral-300'
                    }
                  >
                    {getStatus(selectedId) === 'unlocked'
                      ? 'UNLOCKED'
                      : `${SKILL_TREE[selectedId].cost} XP`}
                  </span>
                </div>

                {getStatus(selectedId) === 'available' && (
                  <button
                    onClick={() => onUnlock(selectedId, SKILL_TREE[selectedId].cost)}
                    className="w-full py-3 bg-white text-black text-xs uppercase tracking-[0.3em] hover:bg-amber-400 transition-colors"
                  >
                    Infuse
                  </button>
                )}
                {getStatus(selectedId) === 'locked' && (
                  <div className="text-red-900 text-[10px] text-center uppercase tracking-widest">
                    Prerequisites incomplete
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-neutral-700 italic text-sm text-center">
              Select a memory node to manifest
            </div>
          )}

          <button
            onClick={onClose}
            className="mt-8 text-[10px] text-neutral-600 hover:text-white uppercase tracking-widest transition-colors"
          >
            [ Close Ritual Rites ]
          </button>
        </div>
      </div>
    </div>
  );
};
