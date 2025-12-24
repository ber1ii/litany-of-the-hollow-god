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
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black">
      {/* Main Container - Scalable */}
      <div
        className="flex border border-neutral-800 bg-neutral-950/50 shadow-2xl relative"
        style={{ width: '90vw', height: '80vh', maxWidth: '1600px' }}
      >
        {/* Left: Portrait / Visuals */}
        <div className="flex-1 border-r border-neutral-800 relative overflow-hidden flex flex-col items-center justify-center bg-black">
          <div
            className="absolute inset-0 opacity-30 bg-cover bg-center transition-all duration-700"
            style={{
              backgroundImage: `url('/textures/classes/${currentClass.id.toLowerCase()}.jpg')`,
            }}
          />
          <div className="relative z-10 text-center">
            <div
              className="font-serif text-neutral-500 uppercase tracking-[0.5em] mb-[2vmin]"
              style={{ fontSize: '1.5vmin' }}
            >
              Class Selection
            </div>
            <div
              className="text-white font-serif uppercase tracking-widest drop-shadow-xl"
              style={{ fontSize: '5vmin' }}
            >
              {currentClass.name}
            </div>
          </div>
        </div>

        {/* Right: Stats & Details */}
        <div className="flex-1 flex flex-col" style={{ padding: '6vmin' }}>
          {/* Header */}
          <div className="mb-[4vmin] text-center border-b border-neutral-800 pb-[3vmin]">
            <h2
              className="text-amber-600 uppercase tracking-widest mb-[1vmin] text-shadow-lg font-serif"
              style={{ fontSize: '3vmin' }}
            >
              {currentClass.name}
            </h2>
            <p
              className="text-neutral-400 font-serif italic text-center opacity-70 tracking-wide"
              style={{ fontSize: '1.6vmin' }}
            >
              "{currentClass.tagline}"
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-x-[4vmin] gap-y-[2vmin] mb-[4vmin] max-w-[40vmin] mx-auto w-full">
            <StatRow label="Vitality" value={currentClass.baseStats.vitality || 10} />
            <StatRow label="Strength" value={currentClass.baseStats.strength || 10} />
            <StatRow label="Dexterity" value={currentClass.baseStats.dexterity || 10} />
            <StatRow label="Intelligence" value={currentClass.baseStats.intelligence || 10} />
            <StatRow label="Mind" value={currentClass.baseStats.mind || 10} />
            <StatRow label="Agility" value={currentClass.baseStats.agility || 10} />
          </div>

          {/* Description */}
          <p
            className="text-neutral-500 text-center leading-relaxed font-mono mb-[4vmin]"
            style={{ fontSize: '1.4vmin' }}
          >
            {currentClass.description}
          </p>

          {/* Confirm Button */}
          <button
            onClick={() => onConfirm(CLASS_KEYS[selectedIndex])}
            className="mt-auto bg-red-950/30 border border-red-900/50 hover:bg-red-900/50 hover:border-red-500 text-red-100 uppercase tracking-[0.25em] transition-all shadow-lg hover:shadow-red-900/20"
            style={{ padding: '2vmin 4vmin', fontSize: '1.5vmin' }}
          >
            Embark
          </button>
        </div>
      </div>

      {/* Footer Hint */}
      <div
        className="absolute text-neutral-600 font-mono tracking-widest opacity-50"
        style={{ bottom: '4vmin', fontSize: '1.2vmin' }}
      >
        ARROWS to Swap • ENTER to Select • BACKSPACE to Return
      </div>
    </div>
  );
};

const StatRow = ({ label, value }: { label: string; value: number }) => (
  <div className="flex justify-between items-center border-b border-neutral-800 pb-[0.5vmin]">
    <span className="text-neutral-500 uppercase tracking-wider" style={{ fontSize: '1.2vmin' }}>
      {label}
    </span>
    <span className="text-white font-mono" style={{ fontSize: '1.4vmin' }}>
      {value}
    </span>
  </div>
);
