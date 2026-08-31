import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SKILL_TREE } from '../../data/SkillTreeData';
import { SKILL_DATABASE } from '../../data/Skills';
import type { PlayerStats } from '../../types/GameTypes';
import { usePlayerStore } from '../../hooks/usePlayerStore';

interface SkillTreeProps {
  stats?: PlayerStats;
  onClose: () => void;
  onUnlock?: (skillId: string, cost: number) => void;
}

export const SkillTree: React.FC<SkillTreeProps> = ({ stats: propStats, onClose, onUnlock }) => {
  const storeStats = usePlayerStore((state) => state.stats);
  const purchaseSkill = usePlayerStore((state) => state.purchaseSkill);
  const equipSkills = usePlayerStore((state) => state.equipSkills);
  const stats = propStats || storeStats;

  // Derive the 4 unlockable tree skills
  const availableSkillIds = useMemo(() => {
    return ['divine_blessing', 'plunging_strike', 'blood_surge', 'weakening_strike'];
  }, []);

  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleUnlockSkill = useCallback(
    (skillId: string, cost: number) => {
      if (onUnlock) {
        onUnlock(skillId, cost);
      } else {
        purchaseSkill(skillId);
      }
    },
    [onUnlock, purchaseSkill]
  );

  const isEquipped = useCallback(
    (skillId: string) => stats.equippedSkills.includes(skillId),
    [stats.equippedSkills]
  );

  const handleToggleEquip = useCallback(
    (skillId: string) => {
      if (isEquipped(skillId)) {
        equipSkills(stats.equippedSkills.filter((id) => id !== skillId));
      } else {
        if (stats.equippedSkills.length < 4) {
          equipSkills([...stats.equippedSkills, skillId]);
        }
      }
    },
    [isEquipped, stats.equippedSkills, equipSkills]
  );

  const getStatus = useCallback(
    (id: string) => {
      if (stats.unlockedSkills.includes(id)) return 'unlocked';
      const cost = SKILL_TREE[id]?.cost ?? SKILL_DATABASE[id]?.cost ?? 100;
      return stats.xp >= cost ? 'available' : 'expensive';
    },
    [stats.unlockedSkills, stats.xp]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' || e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'ArrowLeft' || e.key === 'a') {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : availableSkillIds.length - 1));
      }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'ArrowRight' || e.key === 'd') {
        setSelectedIndex((prev) => (prev < availableSkillIds.length - 1 ? prev + 1 : 0));
      }
      if (e.key === 'Enter' || e.key === ' ') {
        const currentId = availableSkillIds[selectedIndex];
        if (!currentId) return;
        const status = getStatus(currentId);
        const cost = SKILL_TREE[currentId]?.cost ?? SKILL_DATABASE[currentId]?.cost ?? 100;

        if (status === 'available') {
          handleUnlockSkill(currentId, cost);
        } else if (status === 'unlocked') {
          handleToggleEquip(currentId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, availableSkillIds, onClose, getStatus, handleToggleEquip, handleUnlockSkill]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 font-serif p-8">
      <div className="w-[900px] h-[620px] bg-neutral-950 border border-neutral-800 flex flex-col shadow-2xl relative overflow-hidden">
        {/* HEADER */}
        <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50">
          <div>
            <h1 className="text-2xl font-serif text-amber-500 uppercase tracking-widest">
              Learn Memories
            </h1>
            <p className="text-xs text-neutral-500 tracking-wider">
              Spend Insight to unlock combat capabilities
            </p>
          </div>
          <div className="flex items-center gap-3 bg-black/60 px-4 py-2 border border-neutral-800 rounded">
            <span className="text-xs text-neutral-500 uppercase tracking-widest">Insight</span>
            <span className="text-2xl font-mono text-green-400">{stats.xp}</span>
            <span className="text-xs text-neutral-600 font-mono">XP</span>
          </div>
        </div>

        {/* 2x2 SKILL CARDS GRID */}
        <div className="flex-1 p-6 grid grid-cols-2 gap-4 bg-[#0a0a0a]">
          {availableSkillIds.map((id, idx) => {
            const def = SKILL_DATABASE[id];
            if (!def) return null;

            const cost = SKILL_TREE[id]?.cost ?? def.cost ?? 100;
            const status = getStatus(id);
            const isSelected = idx === selectedIndex;
            const equipped = isEquipped(id);

            return (
              <div
                key={id}
                onClick={() => setSelectedIndex(idx)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`p-5 border transition-all cursor-pointer flex flex-col justify-between relative group
                  ${
                    isSelected
                      ? 'border-amber-500 bg-neutral-900/80 shadow-[0_0_15px_rgba(245,158,11,0.15)] scale-[1.01]'
                      : 'border-neutral-800 bg-neutral-900/30 hover:border-neutral-700'
                  }`}
              >
                {/* Header info */}
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 uppercase tracking-wider rounded border ${
                          status === 'unlocked'
                            ? 'border-amber-900/50 text-amber-400 bg-amber-950/30'
                            : 'border-neutral-800 text-neutral-500 bg-neutral-950'
                        }`}
                      >
                        {def.type || 'Active'}
                      </span>
                      {equipped && (
                        <span className="text-[10px] font-mono px-2 py-0.5 uppercase tracking-wider rounded border border-green-800 text-green-400 bg-green-950/30">
                          Equipped
                        </span>
                      )}
                    </div>
                    {def.cost !== undefined && (
                      <span className="text-xs font-mono text-neutral-500">{def.cost} MP</span>
                    )}
                  </div>

                  <h3 className={`text-xl font-serif mb-2 ${def.color || 'text-neutral-200'}`}>
                    {def.name}
                  </h3>

                  <p className="text-xs text-neutral-400 italic leading-relaxed line-clamp-3">
                    "{def.description}"
                  </p>
                </div>

                {/* Footer Action */}
                <div className="mt-4 pt-3 border-t border-neutral-800/60 flex justify-between items-center">
                  <div className="text-xs font-mono">
                    {status === 'unlocked' ? (
                      <span className="text-amber-500 uppercase tracking-widest text-[10px]">
                        Unlocked
                      </span>
                    ) : (
                      <span className="text-neutral-400">
                        Cost:{' '}
                        <strong
                          className={status === 'available' ? 'text-green-400' : 'text-red-500'}
                        >
                          {cost} XP
                        </strong>
                      </span>
                    )}
                  </div>

                  {status === 'available' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnlockSkill(id, cost);
                      }}
                      className="px-4 py-1.5 border border-amber-600/80 bg-amber-900/30 text-amber-300 hover:bg-amber-600 hover:text-white uppercase tracking-widest text-[11px] transition-all"
                    >
                      Unlock
                    </button>
                  )}

                  {status === 'unlocked' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleEquip(id);
                      }}
                      className={`px-4 py-1.5 border text-[11px] uppercase tracking-widest transition-all ${
                        equipped
                          ? 'border-green-800 text-green-400 hover:border-red-800 hover:text-red-400'
                          : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'
                      }`}
                    >
                      {equipped ? 'Unequip' : 'Equip'}
                    </button>
                  )}

                  {status === 'expensive' && (
                    <span className="text-[10px] text-neutral-600 uppercase tracking-wider font-mono">
                      Locked (Needs XP)
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-900/50 flex justify-between items-center text-xs text-neutral-500 font-mono">
          <div>WASD / Arrows to Navigate • ENTER to Select • BACKSPACE / ESC to Leave</div>
          <button
            onClick={onClose}
            className="px-6 py-2 border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500 uppercase tracking-widest text-xs transition-colors font-serif"
          >
            Close Interface
          </button>
        </div>
      </div>
    </div>
  );
};
