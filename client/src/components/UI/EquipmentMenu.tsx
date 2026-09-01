import React, { useState, useEffect } from 'react';
import type { PlayerStats, InventoryItem } from '../../types/GameTypes';
import { usePlayerStore } from '../../hooks/usePlayerStore';

interface EquipmentMenuProps {
  stats?: PlayerStats;
  inventory?: InventoryItem[];
  onClose: () => void;
}

type MenuTab = 'weapons' | 'talismans';

export const EquipmentMenu: React.FC<EquipmentMenuProps> = ({
  inventory: propInventory,
  onClose,
}) => {
  const storeInventory = usePlayerStore((state) => state.inventory);
  const equipItem = usePlayerStore((state) => state.equipItem);
  const equippedWeaponId = usePlayerStore((state) => state.equippedWeaponId);

  const inventory = propInventory || storeInventory;

  const [activeTab, setActiveTab] = useState<MenuTab>('weapons');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' || e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 font-serif">
      <div className="w-[800px] h-[600px] flex flex-col border border-neutral-800 bg-neutral-900 relative">
        <div className="flex border-b border-neutral-800">
          {['Weapons', 'Talismans'].map((tabLabel) => {
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

        <div className="flex-1 p-8 overflow-hidden">
          {activeTab === 'weapons' && (
            <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
              <div className="text-xs text-neutral-500 uppercase tracking-widest mb-4">
                Owned Weapons
              </div>
              <div className="grid grid-cols-1 gap-3">
                {inventory
                  .filter((i) => i.type === 'weapon')
                  .map((item, idx) => {
                    const isEquipped = item.id === equippedWeaponId;

                    return (
                      <button
                        key={idx}
                        onClick={() => equipItem(item.id)}
                        disabled={isEquipped}
                        className={`w-full flex items-center text-left gap-4 p-4 border transition-all ${
                          isEquipped
                            ? 'border-amber-500 bg-amber-900/20'
                            : 'border-neutral-700 bg-neutral-800/50 hover:bg-neutral-700 hover:border-amber-700'
                        }`}
                      >
                        <div className="w-12 h-12 border border-neutral-600 bg-neutral-900 flex items-center justify-center text-2xl shrink-0">
                          ⚔️
                        </div>
                        <div className="flex-1">
                          <div
                            className={`font-serif text-lg ${isEquipped ? 'text-amber-300' : 'text-amber-100'}`}
                          >
                            {item.name}
                          </div>
                          <div className="text-xs text-neutral-500">{item.description}</div>
                          {item.stats && (
                            <div className="text-[10px] text-neutral-400 mt-1">
                              ATK: {item.stats.attack}
                            </div>
                          )}
                        </div>
                        {isEquipped && (
                          <div className="text-[10px] text-amber-500 uppercase tracking-widest shrink-0">
                            Equipped
                          </div>
                        )}
                      </button>
                    );
                  })}
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

        <div className="p-4 border-t border-neutral-800 flex justify-between items-center text-xs text-neutral-600 font-mono">
          <span>BACKSPACE / ESC to Leave</span>
          <button
            onClick={onClose}
            className="px-6 py-2 border border-neutral-600 text-neutral-400 hover:text-white uppercase tracking-widest font-serif"
          >
            Finish Preparation
          </button>
        </div>
      </div>
    </div>
  );
};
