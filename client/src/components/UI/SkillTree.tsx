import React, { useState, useRef, useMemo } from 'react';
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

  // --- PAN & ZOOM STATE ---
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleZoom = (delta: number) => {
    setScale((prev) => Math.min(2, Math.max(0.5, prev + delta)));
  };

  // --- LOGIC ---
  const visibleNodes = useMemo(() => {
    // eslint-disable-next-line
    return Object.entries(SKILL_TREE).filter(([_, node]) => {
      return !node.requiredClass || node.requiredClass === stats.classId;
    });
  }, [stats.classId]);

  const getStatus = (id: string) => {
    if (stats.unlockedSkills.includes(id)) return 'unlocked';
    const node = SKILL_TREE[id];
    if (node.requiredClass && node.requiredClass !== stats.classId) return 'locked';
    const canAfford = stats.xp >= node.cost;
    const reqsMet =
      node.requires.length === 0 || node.requires.every((r) => stats.unlockedSkills.includes(r));
    if (!reqsMet) return 'locked';
    return canAfford ? 'available' : 'expensive';
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 font-serif">
      <div className="w-[1000px] h-[700px] bg-neutral-950 border-2 border-neutral-800 flex shadow-2xl overflow-hidden relative">
        {/* --- LEFT: CANVAS CONTAINER --- */}
        <div
          className="flex-1 relative bg-[#0a0a0a] overflow-hidden cursor-move"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Grid Pattern Background (Moves with offset) */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#333 1px, transparent 1px)',
              backgroundSize: `${40 * scale}px ${40 * scale}px`,
              backgroundPosition: `${offset.x}px ${offset.y}px`,
            }}
          />

          {/* CONTROLS */}
          <div className="absolute top-4 left-4 flex gap-2 z-10">
            <button
              onClick={() => handleZoom(0.1)}
              className="w-8 h-8 bg-neutral-800 border border-neutral-600 text-white hover:bg-neutral-700"
            >
              +
            </button>
            <button
              onClick={() => handleZoom(-0.1)}
              className="w-8 h-8 bg-neutral-800 border border-neutral-600 text-white hover:bg-neutral-700"
            >
              -
            </button>
            <button
              onClick={() => {
                setOffset({ x: 0, y: 0 });
                setScale(1);
              }}
              className="px-3 h-8 bg-neutral-800 border border-neutral-600 text-white text-xs hover:bg-neutral-700"
            >
              RESET
            </button>
          </div>

          <div className="absolute top-4 right-4 text-neutral-500 text-xs uppercase tracking-widest pointer-events-none">
            {stats.classId} Matrix
          </div>

          {/* TRANSFORM LAYER */}
          <div
            className="absolute left-1/2 top-1/2 w-0 h-0"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
          >
            {/* CONNECTOR LINES */}
            <svg className="absolute overflow-visible -translate-x-[500px] -translate-y-[500px] w-[1000px] h-[1000px] pointer-events-none">
              {visibleNodes.map(([id, node]) =>
                node.requires.map((reqId) => {
                  const parent = SKILL_TREE[reqId];
                  if (!parent) return null;
                  // Assuming parent is also visible, otherwise line might point to nothing
                  const startX = 500 + parent.x * 150;
                  const startY = 500 + parent.y * 150;
                  const endX = 500 + node.x * 150;
                  const endY = 500 + node.y * 150;
                  return (
                    <line
                      key={`${reqId}-${id}`}
                      x1={startX}
                      y1={startY}
                      x2={endX}
                      y2={endY}
                      stroke="#333"
                      strokeWidth="2"
                    />
                  );
                })
              )}
            </svg>

            {/* NODES */}
            {visibleNodes.map(([id, node]) => {
              const status = getStatus(id);
              const isSelected = selectedId === id;
              const def = SKILL_DATABASE[id];

              if (!def) return null;

              return (
                <button
                  key={id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(id);
                  }}
                  style={{
                    transform: `translate(${node.x * 150}px, ${node.y * 150}px) rotate(45deg)`,
                  }}
                  className={`absolute w-12 h-12 -ml-6 -mt-6 border-2 transition-colors duration-200
                    ${
                      status === 'unlocked'
                        ? 'border-amber-500 bg-amber-900/40 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                        : status === 'available'
                          ? 'border-neutral-400 bg-neutral-800 hover:border-white'
                          : 'border-neutral-800 bg-neutral-900 opacity-60'
                    }
                    ${isSelected ? 'ring-2 ring-white scale-110 z-10' : 'z-0'}
                  `}
                >
                  <div className="-rotate-45 flex items-center justify-center h-full text-lg">
                    {/* Placeholder Icon */}
                    {status === 'locked' ? '🔒' : def.name[0]}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* --- RIGHT: DETAILS PANEL --- */}
        <div className="w-[320px] bg-neutral-900 border-l border-neutral-800 p-6 flex flex-col z-20 shadow-xl">
          <div className="mb-8 border-b border-neutral-800 pb-4">
            <div className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1">
              Available Insight
            </div>
            <div className="text-3xl font-mono text-green-400">
              {stats.xp} <span className="text-sm text-neutral-600">XP</span>
            </div>
          </div>

          {selectedId ? (
            <div className="flex-1 flex flex-col animate-fadeIn">
              {(() => {
                const def = SKILL_DATABASE[selectedId];
                const cost = SKILL_TREE[selectedId].cost;
                const status = getStatus(selectedId);

                return (
                  <>
                    <h2 className={`text-2xl font-serif mb-1 ${def.color}`}>{def.name}</h2>
                    <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-6">
                      {def.type} Skill
                    </div>

                    <div className="text-sm text-neutral-300 leading-relaxed italic mb-8 border-l-2 border-neutral-700 pl-3">
                      "{def.description}"
                    </div>

                    <div className="mt-auto">
                      <div className="flex justify-between items-center mb-4 text-xs uppercase tracking-widest text-neutral-500">
                        <span>Unlock Cost</span>
                        <span
                          className={status === 'unlocked' ? 'text-amber-500' : 'text-neutral-300'}
                        >
                          {status === 'unlocked' ? 'OWNED' : `${cost} XP`}
                        </span>
                      </div>

                      {status === 'available' && (
                        <button
                          onClick={() => onUnlock(selectedId, cost)}
                          className="w-full py-3 border border-amber-600 bg-amber-900/20 text-amber-500 hover:bg-amber-600 hover:text-white transition-all uppercase tracking-widest text-xs"
                        >
                          Unlock Memory
                        </button>
                      )}
                      {status === 'locked' && (
                        <div className="w-full py-3 bg-neutral-950 text-neutral-600 border border-neutral-800 text-center text-xs uppercase tracking-widest">
                          Locked
                        </div>
                      )}
                      {status === 'expensive' && (
                        <div className="w-full py-3 bg-neutral-950 text-red-900 border border-red-900/30 text-center text-xs uppercase tracking-widest">
                          Insufficient XP
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm italic">
              Select a node to view details...
            </div>
          )}

          <button
            onClick={onClose}
            className="mt-6 w-full py-3 border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500 uppercase tracking-widest text-xs transition-colors"
          >
            Close Interface
          </button>
        </div>
      </div>
    </div>
  );
};
