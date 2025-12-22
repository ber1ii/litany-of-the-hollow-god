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

  if (selectedIndex > maxIndex) {
    setSelectedIndex(maxIndex);
  }

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
        // Use safeIndex here to be sure
        if (inventory[safeIndex]) {
          onUseItem(inventory[safeIndex]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inventory, safeIndex, onClose, onUseItem]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      {/* Container */}
      <div className="w-[1000px] h-[600px] bg-neutral-900 border-2 border-neutral-700 flex shadow-2xl relative">
        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-neutral-500 hover:text-white font-mono uppercase text-sm tracking-widest"
        >
          [Close Menu]
        </button>

        {/* LEFT COLUMN: Item List */}
        <div className="w-[30%] border-r border-neutral-700 flex flex-col bg-neutral-950/50">
          <div className="p-4 bg-neutral-900 border-b border-neutral-700">
            <h2 className="text-xl text-neutral-300 font-serif tracking-widest uppercase">
              Inventory
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {inventory.length === 0 && (
              <div className="text-gray-600 text-center mt-10 italic font-serif text-sm">
                - No items carried -
              </div>
            )}
            {inventory.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => setSelectedIndex(idx)}
                className={`p-3 mb-1 cursor-pointer flex justify-between items-center transition-all border-l-2 ${
                  idx === safeIndex
                    ? 'bg-neutral-800 text-white border-red-700 pl-4'
                    : 'text-neutral-500 hover:bg-neutral-900 border-transparent hover:text-neutral-300'
                }`}
              >
                <span className="font-serif tracking-wide text-sm">{item.name}</span>
                {item.count > 1 && (
                  <span className="text-xs font-mono text-neutral-600">x{item.count}</span>
                )}
              </div>
            ))}
          </div>

          <div className="p-2 border-t border-neutral-800 text-xs text-neutral-600 text-center font-mono">
            WASD to Select • ENTER to Use
          </div>
        </div>

        {/* RIGHT COLUMN: Item Details */}
        <div className="w-[70%] p-12 flex flex-col items-center text-center relative bg-gradient-to-b from-neutral-900 to-neutral-950">
          {selectedItem ? (
            <>
              {/* Icon */}
              <div className="w-32 h-32 mb-8 border border-neutral-700 bg-black flex items-center justify-center shadow-lg">
                <img
                  src={selectedItem.icon}
                  alt={selectedItem.name}
                  className="w-full h-full object-contain [image-rendering:pixelated]"
                />
              </div>

              {/* Name & Type */}
              <h3 className="text-3xl text-neutral-100 font-serif mb-2 tracking-wider">
                {selectedItem.name}
              </h3>
              <div className="text-xs text-red-900/70 font-bold uppercase tracking-[0.2em] mb-8 border-b border-neutral-800 pb-4 w-full max-w-md">
                — {selectedItem.type} —
              </div>

              {/* Description */}
              <p className="text-neutral-400 text-base leading-relaxed italic mb-8 max-w-lg">
                "{selectedItem.description}"
              </p>

              {/* Stats */}
              <div className="bg-neutral-950/50 p-4 w-full max-w-sm border border-neutral-800 mb-8">
                {selectedItem.effect ? (
                  <div className="text-green-500/80 text-sm font-mono flex justify-between">
                    <span className="uppercase text-xs text-neutral-600">Effect</span>
                    <span>
                      {selectedItem.effect.type.replace('_', ' ')} +{selectedItem.effect.value}
                    </span>
                  </div>
                ) : selectedItem.stats ? (
                  <div className="text-red-500/80 text-sm font-mono flex justify-between">
                    <span className="uppercase text-xs text-neutral-600">Power</span>
                    <span>ATK {selectedItem.stats.attack}</span>
                  </div>
                ) : (
                  <div className="text-neutral-700 text-xs italic">Key Item</div>
                )}
              </div>

              {/* Action Button */}
              <div className="mt-auto w-full max-w-xs">
                <button
                  onClick={() => onUseItem(selectedItem)}
                  className="w-full py-4 bg-red-950/30 hover:bg-red-900 text-red-200 border border-red-900/50 hover:border-red-500 uppercase tracking-[0.2em] transition-all text-sm group"
                >
                  <span className="group-hover:mr-2 transition-all">
                    {selectedItem.type === 'consumable' ? 'Consume' : 'Equip'}
                  </span>
                  <span className="opacity-0 group-hover:opacity-100 transition-all">➢</span>
                </button>
              </div>
            </>
          ) : (
            <div className="text-neutral-700 flex flex-col items-center justify-center h-full">
              <p className="font-serif italic text-lg">Select an item to inspect...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
