import React, { useState, useEffect } from 'react';
import type { InventoryItem } from '../../types/GameTypes';

interface InventoryMenuProps {
  inventory: InventoryItem[];
  onClose: () => void;
  onUseItem: (item: InventoryItem) => void;
}

export const InventoryMenu: React.FC<InventoryMenuProps> = ({ inventory, onClose, onUseItem }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const maxIndex = Math.max(0, inventory.length - 1);
  const safeIndex = Math.min(selectedIndex, maxIndex);
  const selectedItem = inventory[safeIndex];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Tab') {
        onClose();
      }
      if (e.key === 'ArrowUp' || e.key === 'w') {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      }
      if (e.key === 'ArrowDown' || e.key === 's') {
        setSelectedIndex((prev) => Math.min(inventory.length - 1, prev + 1));
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (selectedItem) onUseItem(selectedItem);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, selectedItem, onUseItem, inventory.length]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-[4vmin]">
      {/* SCALABLE CONTAINER: Width/Height in %/vmin */}
      <div className="w-[90vw] max-w-[1600px] h-[80vh] flex border border-neutral-800 bg-black shadow-2xl relative">
        {/* LEFT: Item List */}
        <div className="flex-[2] border-r border-neutral-800 overflow-y-auto custom-scrollbar bg-neutral-950/50">
          <div className="p-[3vmin] sticky top-0 bg-neutral-950 border-b border-neutral-800 z-10 flex justify-between items-center">
            <h2
              className="font-serif text-neutral-400 uppercase tracking-[0.2em]"
              style={{ fontSize: '2vmin' }}
            >
              Inventory
            </h2>
            <span className="font-mono text-neutral-600" style={{ fontSize: '1.5vmin' }}>
              {inventory.length} Items
            </span>
          </div>

          <div className="p-[2vmin] grid gap-[1vmin]">
            {inventory.length === 0 && (
              <div className="text-neutral-600 p-8 text-center italic">Empty...</div>
            )}

            {inventory.map((item, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedIndex(idx)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`
                  p-[2vmin] border transition-all cursor-pointer flex justify-between items-center
                  ${
                    idx === safeIndex
                      ? 'bg-neutral-900 border-red-900/50 text-red-100'
                      : 'bg-transparent border-transparent text-neutral-500 hover:bg-neutral-900/50'
                  }
                `}
              >
                <div className="flex items-center gap-[2vmin]">
                  <div
                    className={`w-[1vmin] h-[1vmin] rotate-45 ${idx === safeIndex ? 'bg-red-500' : 'bg-neutral-800'}`}
                  />
                  <span className="uppercase tracking-wider" style={{ fontSize: '1.6vmin' }}>
                    {item.name}
                  </span>
                </div>
                {item.count > 1 && (
                  <span className="font-mono text-neutral-600" style={{ fontSize: '1.4vmin' }}>
                    x{item.count}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Details Panel */}
        <div className="flex-[3] p-[5vmin] flex flex-col relative bg-[url('/textures/ui_noise.png')]">
          <div className="absolute top-0 right-0 p-[2vmin] opacity-20 pointer-events-none">
            <div className="w-[20vmin] h-[20vmin] border border-neutral-500 rounded-full flex items-center justify-center">
              <div className="w-[15vmin] h-[15vmin] border border-neutral-700 rotate-45" />
            </div>
          </div>

          {selectedItem ? (
            <>
              <div className="border-b border-neutral-800 pb-[3vmin] mb-[3vmin]">
                <div
                  className="text-neutral-500 font-mono mb-[1vmin]"
                  style={{ fontSize: '1.2vmin' }}
                >
                  {selectedItem.type.toUpperCase()}
                </div>
                <h1
                  className="font-serif text-neutral-200 uppercase tracking-widest mb-[1vmin]"
                  style={{ fontSize: '4vmin' }}
                >
                  {selectedItem.name}
                </h1>
                <div className="w-[10vmin] h-[2px] bg-red-900/50" />
              </div>

              <div className="flex-1">
                <p
                  className="text-neutral-400 font-serif leading-relaxed italic mb-[4vmin]"
                  style={{ fontSize: '1.8vmin' }}
                >
                  "{selectedItem.description}"
                </p>

                {/* Stats Section */}
                {selectedItem.effect ? (
                  <div
                    className="flex items-center gap-[2vmin] text-green-700/80 font-mono"
                    style={{ fontSize: '1.5vmin' }}
                  >
                    <span className="uppercase text-neutral-600">Effect</span>
                    <span>
                      Restores {selectedItem.effect.value}{' '}
                      {selectedItem.effect.type === 'heal' ? 'HP' : 'MP'}
                    </span>
                  </div>
                ) : selectedItem.stats ? (
                  <div
                    className="flex items-center gap-[2vmin] text-red-500/80 font-mono"
                    style={{ fontSize: '1.5vmin' }}
                  >
                    <span className="uppercase text-neutral-600">Power</span>
                    <span>ATK {selectedItem.stats.attack}</span>
                  </div>
                ) : null}
              </div>

              {/* Action Button */}
              <button
                onClick={() => onUseItem(selectedItem)}
                className="w-full bg-red-950/30 hover:bg-red-900 text-red-200 border border-red-900/50 hover:border-red-500 uppercase tracking-[0.2em] transition-all group"
                style={{ padding: '2.5vmin', fontSize: '1.5vmin' }}
              >
                <span className="group-hover:mr-[1vmin] transition-all">
                  {selectedItem.type === 'consumable' ? 'Consume' : 'Equip'}
                </span>
                <span className="opacity-0 group-hover:opacity-100 transition-all">➢</span>
              </button>
            </>
          ) : (
            <div
              className="flex items-center justify-center h-full text-neutral-700 italic"
              style={{ fontSize: '2vmin' }}
            >
              Select an item...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
