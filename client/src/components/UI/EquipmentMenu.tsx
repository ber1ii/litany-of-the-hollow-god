import React, { useState } from 'react';
import type { PlayerStats, InventoryItem } from '../../types/GameTypes';
import { SKILL_DATABASE } from '../../data/Skills';

interface EquipmentMenuProps {
  stats: PlayerStats;
  inventory: InventoryItem[];
  onClose: () => void;
  onEquipSkill: (newEquipped: string[]) => void;
}

// FIX: Define a specific type for tabs to avoid 'any'
type MenuTab = 'weapons' | 'skills' | 'talismans';

export const EquipmentMenu: React.FC<EquipmentMenuProps> = ({
  stats,
  inventory,
  onClose,
  onEquipSkill,
}) => {
  const [activeTab, setActiveTab] = useState<MenuTab>('skills');

  // --- SKILL LOGIC ---
  const handleToggleSkill = (skillId: string) => {
    const isEquipped = stats.equippedSkills.includes(skillId);

    if (isEquipped) {
      // Unequip
      onEquipSkill(stats.equippedSkills.filter((id) => id !== skillId));
    } else {
      // Equip (Max 4)
      if (stats.equippedSkills.length < 4) {
        onEquipSkill([...stats.equippedSkills, skillId]);
      } else {
        console.warn('Skill slots full!');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 font-serif">
      <div className="w-[800px] h-[600px] flex flex-col border border-neutral-800 bg-neutral-900 relative">
        {/* HEADER */}
        <div className="flex border-b border-neutral-800">
          {['Weapons', 'Skills', 'Talismans'].map((tabLabel) => {
            // FIX: Cast string to MenuTab type safely
            const tabKey = tabLabel.toLowerCase() as MenuTab;
            return (
              <button
                key={tabLabel}
                onClick={() => setActiveTab(tabKey)}
                className={`flex-1 py-4 uppercase tracking-widest text-sm transition-colors
                ${
                  activeTab === tabKey
                    ? 'bg-neutral-800 text-amber-500 border-b-2 border-amber-500'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {tabLabel}
              </button>
            );
          })}
        </div>

        {/* CONTENT */}
        <div className="flex-1 p-8 overflow-hidden">
          {activeTab === 'skills' && (
            <div className="flex h-full gap-8">
              {/* LEFT: EQUIPPED SLOTS */}
              <div className="w-1/3 flex flex-col gap-4">
                <div className="text-xs text-neutral-500 uppercase tracking-widest mb-2">
                  Memory Slots ({stats.equippedSkills.length}/4)
                </div>
                {Array.from({ length: 4 }).map((_, idx) => {
                  const skillId = stats.equippedSkills[idx];
                  const def = skillId ? SKILL_DATABASE[skillId] : null;

                  return (
                    <button
                      key={idx}
                      onClick={() => skillId && handleToggleSkill(skillId)}
                      className={`h-20 border flex items-center px-4 gap-4 transition-all
                        ${
                          def
                            ? 'border-amber-900/50 bg-amber-900/10 hover:bg-red-900/20 hover:border-red-900'
                            : 'border-neutral-800 bg-neutral-950/50'
                        }`}
                    >
                      <div
                        className={`w-10 h-10 border flex items-center justify-center text-lg
                        ${
                          def
                            ? 'border-amber-700 bg-neutral-900'
                            : 'border-neutral-800 text-neutral-800'
                        }`}
                      >
                        {def ? '★' : idx + 1}
                      </div>
                      <div className="text-left">
                        <div className={`text-sm ${def ? 'text-amber-100' : 'text-neutral-700'}`}>
                          {def ? def.name : 'Empty Slot'}
                        </div>
                        {def && <div className="text-[10px] text-neutral-500">{def.cost} MP</div>}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* RIGHT: AVAILABLE POOL */}
              <div className="flex-1 border-l border-neutral-800 pl-8 overflow-y-auto custom-scrollbar">
                <div className="text-xs text-neutral-500 uppercase tracking-widest mb-4">
                  Unlocked Memories
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {stats.unlockedSkills.map((id) => {
                    const def = SKILL_DATABASE[id];
                    const isEquipped = stats.equippedSkills.includes(id);
                    if (!def) return null;

                    return (
                      <button
                        key={id}
                        disabled={isEquipped}
                        onClick={() => handleToggleSkill(id)}
                        className={`p-3 border text-left transition-all relative group
                          ${
                            isEquipped
                              ? 'border-neutral-800 bg-neutral-900 opacity-50 cursor-default'
                              : 'border-neutral-700 bg-neutral-800 hover:border-amber-500 hover:bg-neutral-700'
                          }`}
                      >
                        <div className={`text-sm mb-1 ${def.color}`}>{def.name}</div>
                        <div className="text-[10px] text-neutral-400 line-clamp-2">
                          {def.description}
                        </div>

                        {isEquipped && (
                          <div className="absolute top-2 right-2 text-[10px] text-amber-600 uppercase tracking-tighter">
                            Equipped
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'weapons' && (
            // FIX: Using inventory prop to display weapons
            <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
              <div className="text-xs text-neutral-500 uppercase tracking-widest mb-4">
                Owned Weapons
              </div>
              <div className="grid grid-cols-1 gap-3">
                {inventory
                  .filter((i) => i.type === 'weapon')
                  .map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-4 p-4 border border-neutral-700 bg-neutral-800/50"
                    >
                      <div className="w-12 h-12 border border-neutral-600 bg-neutral-900 flex items-center justify-center text-2xl">
                        ⚔️
                      </div>
                      <div>
                        <div className="text-amber-100 font-serif text-lg">{item.name}</div>
                        <div className="text-xs text-neutral-500">{item.description}</div>
                        {item.stats && (
                          <div className="text-[10px] text-neutral-400 mt-1">
                            ATK: {item.stats.attack}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                {inventory.filter((i) => i.type === 'weapon').length === 0 && (
                  <div className="text-neutral-500 italic text-center mt-10">
                    No weapons carried.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'talismans' && (
            <div className="flex items-center justify-center h-full text-neutral-600 italic">
              Talisman slots sealed...
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-neutral-600 text-neutral-400 hover:text-white uppercase tracking-widest text-xs"
          >
            Finish Preparation
          </button>
        </div>
      </div>
    </div>
  );
};
