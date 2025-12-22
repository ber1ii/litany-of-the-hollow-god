import React, { useState, useEffect, useMemo } from 'react';
import { SaveManager } from '../../utils/SaveManager';

interface MainMenuProps {
  onNewGame: () => void;
  onLoadGame: () => void;
  onContinue: () => void;
  onLorefinder: () => void;
  onOptions: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onNewGame,
  onLoadGame,
  onContinue,
  onLorefinder,
  onOptions,
}) => {
  // FIX: Initialize state once. No need for useEffect to "re-check" immediately on mount.
  const [hasSave] = useState(() => {
    const exists = SaveManager.hasSave();
    console.log('MainMenu mounted. Save file exists:', exists);
    return exists;
  });

  const options = useMemo(
    () => [
      { label: 'New Game', action: onNewGame, enabled: true },
      { label: 'Load Game', action: onLoadGame, enabled: hasSave },
      { label: 'Continue', action: onContinue, enabled: false },
      { label: 'Lorefinder', action: onLorefinder, enabled: false },
      { label: 'Options', action: onOptions, enabled: false },
    ],
    [onNewGame, onLoadGame, onContinue, onLorefinder, onOptions, hasSave]
  );

  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w') {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
      }
      if (e.key === 'ArrowDown' || e.key === 's') {
        setSelectedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (options[selectedIndex].enabled) {
          options[selectedIndex].action();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, options]);

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050505] text-white font-serif select-none overflow-hidden">
      {/* --- DECORATION: Background Vignette & Noise --- */}
      <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_center,_transparent_0%,_#000_100%)] z-0" />

      {/* --- DECORATION: Blood Spatters --- */}
      <div
        className="absolute top-[-5%] left-[-5%] w-96 h-96 opacity-60 pointer-events-none mix-blend-multiply"
        style={{
          background: 'radial-gradient(circle at center, #8a0303 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] opacity-50 pointer-events-none mix-blend-multiply"
        style={{
          background: 'radial-gradient(circle at center, #3d0000 0%, transparent 60%)',
          filter: 'blur(60px)',
        }}
      />
      <div
        className="absolute top-[20%] right-[15%] w-4 h-4 rounded-full bg-red-900 opacity-70 pointer-events-none blur-[1px]"
        style={{ boxShadow: '0 0 10px #8a0303' }}
      />
      <div className="absolute top-[25%] right-[18%] w-2 h-2 rounded-full bg-red-950 opacity-60 pointer-events-none" />

      {/* --- MAIN CONTENT --- */}
      <div className="z-10 text-center mb-16 relative">
        <div className="absolute inset-0 bg-red-900/20 blur-[100px] -z-10 rounded-full scale-150 opacity-50" />

        <h1 className="text-7xl md:text-9xl font-bold tracking-[0.15em] text-neutral-200 text-shadow-lg mb-4 font-serif relative">
          <span className="text-neutral-500 text-4xl block tracking-[0.5em] mb-2 uppercase font-light">
            Litany of the
          </span>
          HOLLOW GOD
        </h1>

        <div className="h-[2px] w-64 bg-gradient-to-r from-transparent via-red-900 to-transparent mx-auto mb-6 opacity-70"></div>

        <p className="text-red-900/60 tracking-[0.3em] text-xs uppercase font-mono">
          Ver. 0.0.1 - Pre-Alpha
        </p>
      </div>

      {/* Menu Options */}
      <div className="z-10 flex flex-col gap-2 w-80 relative">
        {options.map((opt, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={opt.label}
              disabled={!opt.enabled}
              onMouseEnter={() => setSelectedIndex(idx)}
              onClick={opt.action}
              className={`
                group relative px-6 py-3 text-center transition-all duration-300 border-l-2 border-r-2
                ${
                  !opt.enabled
                    ? 'opacity-30 cursor-not-allowed border-transparent text-neutral-600'
                    : isSelected
                      ? 'border-red-800/60 bg-red-950/10 scale-105'
                      : 'border-transparent hover:border-neutral-800'
                }
              `}
            >
              <span
                className={`absolute left-2 top-1/2 -translate-y-1/2 text-red-700 transition-opacity duration-300 font-serif text-xl
                  ${isSelected ? 'opacity-100' : 'opacity-0'}
                `}
              >
                ◈
              </span>
              <span
                className={`absolute right-2 top-1/2 -translate-y-1/2 text-red-700 transition-opacity duration-300 font-serif text-xl
                  ${isSelected ? 'opacity-100' : 'opacity-0'}
                `}
              >
                ◈
              </span>

              <span
                className={`
                  uppercase tracking-[0.2em] text-lg transition-colors font-semibold
                  ${isSelected ? 'text-red-500 text-shadow-sm' : 'text-neutral-400'}
                `}
              >
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="absolute bottom-8 text-neutral-800 text-[10px] tracking-[0.3em] font-mono opacity-50">
        © 2025 ber1ii
      </div>
    </div>
  );
};
