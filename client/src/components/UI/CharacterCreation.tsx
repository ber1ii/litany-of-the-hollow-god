import React, { useState, useEffect } from 'react';
import { CLASSES } from '../../data/Classes';
import type { ClassId } from '../../data/Classes';

interface CharacterCreationProps {
  onConfirm: (classId: ClassId) => void;
  onBack: () => void;
}

const CLASS_KEYS = Object.keys(CLASSES) as ClassId[];

export const CharacterCreation: React.FC<CharacterCreationProps> = ({ onConfirm, onBack }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const currentClass = CLASSES[CLASS_KEYS[selectedIndex]];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'd') {
        setSelectedIndex((prev) => (prev < CLASS_KEYS.length - 1 ? prev + 1 : 0));
      }
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : CLASS_KEYS.length - 1));
      }
      if (e.key === 'Enter' || e.key === ' ') {
        onConfirm(CLASS_KEYS[selectedIndex]);
      }
      if (e.key === 'Escape' || e.key === 'Backspace') {
        onBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, onConfirm, onBack]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#050505] text-white font-serif select-none">
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none opacity-30 bg-[radial-gradient(circle_at_center,_#1a1a1a_0%,_#000_100%)] z-0" />

      <div className="z-10 w-[1000px] h-[700px] flex border-y-4 border-double border-neutral-800 bg-neutral-950/90 shadow-2xl relative">
        {/* Header */}
        <div className="absolute -top-16 left-0 w-full text-center">
          <h1 className="text-5xl text-neutral-300 tracking-[0.3em] uppercase text-shadow-md font-bold">
            Origin
          </h1>
          <p className="text-neutral-600 font-mono text-xs mt-2">Who were you before the fall?</p>
        </div>

        {/* LEFT: Stats & Info */}
        <div className="w-[35%] p-8 border-r border-neutral-800 flex flex-col justify-center bg-black/20">
          <div className="space-y-5">
            <StatRow label="Vitality" value={currentClass.baseStats.vitality || 10} />
            <StatRow label="Strength" value={currentClass.baseStats.strength || 10} />
            <StatRow label="Dexterity" value={currentClass.baseStats.dexterity || 10} />
            <StatRow label="Intelligence" value={currentClass.baseStats.intelligence || 10} />
            <StatRow label="Mind" value={currentClass.baseStats.mind || 10} />
            <StatRow label="Agility" value={currentClass.baseStats.agility || 10} />
          </div>

          <div className="mt-8 pt-8 border-t border-neutral-800">
            <div className="text-neutral-500 text-xs font-mono uppercase mb-3 tracking-widest">
              Starting Gear
            </div>
            <ul className="text-sm text-neutral-400 space-y-2 font-mono">
              {currentClass.startingItems.map((item, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-amber-900">◈</span>
                  {item.id.replace(/_/g, ' ').toUpperCase()}
                  <span className="text-neutral-600 text-xs">x{item.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* CENTER: Character Visual */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
          {/* Navigation Arrows */}
          <button
            className="absolute left-6 top-1/2 -translate-y-1/2 text-5xl text-neutral-700 hover:text-amber-500 transition-colors"
            onClick={() =>
              setSelectedIndex((prev) => (prev > 0 ? prev - 1 : CLASS_KEYS.length - 1))
            }
          >
            «
          </button>
          <button
            className="absolute right-6 top-1/2 -translate-y-1/2 text-5xl text-neutral-700 hover:text-amber-500 transition-colors"
            onClick={() =>
              setSelectedIndex((prev) => (prev < CLASS_KEYS.length - 1 ? prev + 1 : 0))
            }
          >
            »
          </button>

          {/* Portrait Preview (Updated for Icon) */}
          <div className="w-64 h-96 bg-black border-2 border-neutral-800 flex items-center justify-center mb-8 relative group overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)]">
            <img
              src="/sprites/icons/knight_icon.png" // Using the specific placeholder
              alt="Class Portrait"
              className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity duration-700 scale-105 group-hover:scale-110"
            />

            {/* Vignette Overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_#000_120%)] pointer-events-none" />

            {/* Scanline/Texture overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.2)_50%)] bg-[length:100%_4px] pointer-events-none opacity-50" />

            {/* Border glow on hover */}
            <div className="absolute inset-0 border border-white/0 group-hover:border-white/10 transition-colors duration-500 pointer-events-none" />
          </div>

          <h2 className="text-6xl font-bold text-amber-600 uppercase tracking-widest mb-2 text-shadow-lg font-serif">
            {currentClass.name}
          </h2>
          <p className="text-neutral-400 font-serif italic text-center max-w-sm mb-6 opacity-70 tracking-wide text-sm">
            "{currentClass.tagline}"
          </p>

          <p className="text-neutral-500 text-xs text-center max-w-sm leading-relaxed font-mono">
            {currentClass.description}
          </p>

          <button
            onClick={() => onConfirm(CLASS_KEYS[selectedIndex])}
            className="mt-auto px-16 py-4 bg-red-950/30 border border-red-900/50 hover:bg-red-900/50 hover:border-red-500 text-red-100 uppercase tracking-[0.25em] transition-all shadow-lg hover:shadow-red-900/20"
          >
            Embark
          </button>
        </div>
      </div>

      {/* Footer Hint */}
      <div className="absolute bottom-8 text-neutral-600 font-mono text-xs tracking-widest opacity-50">
        ARROWS to Swap • ENTER to Select • BACKSPACE to Return
      </div>
    </div>
  );
};

const StatRow = ({ label, value }: { label: string; value: number }) => (
  <div className="flex justify-between items-center border-b border-neutral-900/50 pb-1">
    <span className="text-neutral-500 uppercase tracking-widest text-xs font-semibold">
      {label}
    </span>
    <span className={`font-mono text-lg ${value > 12 ? 'text-amber-500' : 'text-neutral-300'}`}>
      {value}
    </span>
  </div>
);
