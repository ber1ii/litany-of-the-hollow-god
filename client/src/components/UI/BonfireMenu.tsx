import React, { useState, useEffect, useMemo } from 'react';

interface BonfireMenuProps {
  onClose: () => void;
  onQuit: () => void;
  onRest: () => void;
  onLevelUp: () => void; // NEW
}

export const BonfireMenu: React.FC<BonfireMenuProps> = ({ onClose, onQuit, onRest, onLevelUp }) => {
  const menuOptions = useMemo(
    () => [
      { label: 'Level Up', action: onLevelUp }, // Wired up
      {
        label: 'Rest',
        action: onRest,
      },
      { label: 'Manage Equipment', action: () => console.log('Equip clicked') },
      { label: 'Quit to Title', action: onQuit },
      { label: 'Leave Bonfire', action: onClose },
    ],
    [onClose, onQuit, onRest, onLevelUp]
  );

  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w') {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : menuOptions.length - 1));
      }
      if (e.key === 'ArrowDown' || e.key === 's') {
        setSelectedIndex((prev) => (prev < menuOptions.length - 1 ? prev + 1 : 0));
      }

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        menuOptions[selectedIndex].action();
      }

      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, onClose, menuOptions]);

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-[400px] border-y-4 border-double border-neutral-600 bg-neutral-900/95 p-8 text-center shadow-2xl relative">
        <div className="mb-8">
          <h2 className="text-3xl font-serif text-amber-500 tracking-[0.2em] uppercase border-b border-neutral-700 pb-4">
            Bonfire
          </h2>
          <p className="text-xs text-neutral-500 mt-2 font-mono uppercase tracking-widest">
            Respite from the dark
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {menuOptions.map((opt, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={opt.label}
                onClick={opt.action}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`group relative px-6 py-3 transition-all uppercase tracking-widest font-serif border ${
                  isSelected
                    ? 'bg-neutral-800 text-amber-100 border-neutral-600 scale-105'
                    : 'bg-transparent text-neutral-500 border-transparent hover:border-neutral-700'
                }`}
              >
                <span
                  className={`absolute left-4 transition-opacity text-amber-600 ${
                    isSelected ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  ◈
                </span>

                {opt.label}

                <span
                  className={`absolute right-4 transition-opacity text-amber-600 ${
                    isSelected ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  ◈
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 pt-4 border-t border-neutral-800">
          <div className="text-[10px] text-neutral-600 font-mono">
            WASD to Navigate • ENTER to Select
          </div>
        </div>
      </div>
    </div>
  );
};
