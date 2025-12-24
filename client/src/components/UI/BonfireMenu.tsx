import React, { useState, useEffect, useMemo } from 'react';

interface BonfireMenuProps {
  onClose: () => void;
  onQuit: () => void;
  onRest: () => void;
  onLevelUp: () => void;
  onSkillTree: () => void;
  onManageEquipment: () => void;
}

export const BonfireMenu: React.FC<BonfireMenuProps> = ({
  onClose,
  onQuit,
  onRest,
  onLevelUp,
  onSkillTree,
  onManageEquipment,
}) => {
  const menuOptions = useMemo(
    () => [
      { label: 'Level Up', action: onLevelUp },
      { label: 'Learn Skills', action: onSkillTree },
      { label: 'Rest', action: onRest },
      { label: 'Prepare', action: onManageEquipment },
      { label: 'Quit to Title', action: onQuit },
      { label: 'Leave Bonfire', action: onClose },
    ],
    [onClose, onQuit, onRest, onLevelUp, onSkillTree, onManageEquipment]
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
        menuOptions[selectedIndex].action();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, menuOptions]);

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-start bg-black/80 backdrop-blur-sm"
      style={{ paddingLeft: '15vmin' }}
    >
      <div className="flex flex-col items-start relative">
        {/* Decorative Line */}
        <div
          className="absolute left-0 top-0 bottom-0 bg-neutral-800"
          style={{ width: '1px', left: '-4vmin' }}
        />

        <h1
          className="font-serif text-amber-500 uppercase tracking-[0.2em] mb-[4vmin] drop-shadow-lg"
          style={{ fontSize: '4vmin' }}
        >
          Bonfire Lit
        </h1>

        <div className="flex flex-col gap-[1.5vmin] min-w-[30vmin]">
          {menuOptions.map((opt, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={opt.label}
                onClick={opt.action}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`group relative transition-all uppercase tracking-widest font-serif border ${
                  isSelected
                    ? 'bg-neutral-800 text-amber-100 border-neutral-600 scale-105'
                    : 'bg-transparent text-neutral-500 border-transparent hover:border-neutral-700'
                }`}
                style={{
                  padding: '1.5vmin 3vmin',
                  fontSize: '1.5vmin',
                }}
              >
                {/* Left Icon */}
                <span
                  className={`absolute transition-opacity text-amber-600 ${
                    isSelected ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={{
                    left: '1vmin',
                    fontSize: '1.2vmin',
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                >
                  ◈
                </span>

                {opt.label}

                {/* Right Icon */}
                <span
                  className={`absolute transition-opacity text-amber-600 ${
                    isSelected ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={{
                    right: '1vmin',
                    fontSize: '1.2vmin',
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                >
                  ◈
                </span>
              </button>
            );
          })}
        </div>

        <div className="border-t border-neutral-800 mt-[4vmin] pt-[2vmin]">
          <div className="text-neutral-600 font-mono" style={{ fontSize: '1.2vmin' }}>
            WASD to Navigate • ENTER to Select
          </div>
        </div>
      </div>
    </div>
  );
};
