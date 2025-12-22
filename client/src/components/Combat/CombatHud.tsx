import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { SKILL_DATABASE } from '../../data/Skills';
import type { PlayerStats } from '../../types/GameTypes';

interface CombatHudProps {
  combatState:
    | 'player_turn'
    | 'player_acting'
    | 'enemy_turn'
    | 'enemy_acting'
    | 'victory'
    | 'defeat';
  menuState: 'main' | 'attack_select' | 'items';
  setMenuState: (state: 'main' | 'attack_select' | 'items') => void;
  playerStats: PlayerStats;
  enemyHp: number;
  enemyMaxHp: number;
  enemyName: string;
  onAction: (skillId: string) => void;
  onLeave: (victory: boolean) => void;
}

interface CombatMenuOption {
  label: string;
  action: () => void;
  disabled: boolean;
  subtext?: string;
  icon?: string;
}

export const CombatHud: React.FC<CombatHudProps> = ({
  combatState,
  menuState,
  setMenuState,
  playerStats,
  enemyHp,
  enemyMaxHp,
  enemyName,
  onAction,
  onLeave,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [prevCombatState, setPrevCombatState] = useState(combatState);
  if (combatState !== prevCombatState) {
    setPrevCombatState(combatState);
    setSelectedIndex(0);
  }

  // --- 1. DEFINE MENU OPTIONS BASED ON STATE ---
  const currentOptions = useMemo<CombatMenuOption[]>(() => {
    // A. VICTORY / DEFEAT SCREENS
    if (combatState === 'victory') {
      return [{ label: 'Leave Area', action: () => onLeave(true), disabled: false }];
    }
    if (combatState === 'defeat') {
      return [{ label: 'Accept Fate', action: () => onLeave(false), disabled: false }];
    }

    // B. PLAYER TURN MENUS
    if (combatState === 'player_turn') {
      if (menuState === 'main') {
        return [
          {
            label: 'Attack',
            action: () => {
              setMenuState('attack_select');
              setSelectedIndex(0);
            },
            disabled: false,
          },
          { label: 'Skills', action: () => {}, disabled: true, subtext: '(Empty)' },
          { label: 'Inventory', action: () => {}, disabled: true, subtext: '(WIP)' },
          { label: 'Flee', action: () => {}, disabled: true },
        ];
      } else if (menuState === 'attack_select') {
        const skills = ['slash', 'heavy', 'pray'].map((skillId) => {
          const skill = SKILL_DATABASE[skillId];
          return {
            label: skill.name,
            action: () => onAction(skillId),
            disabled: false,
          };
        });
        return [
          ...skills,
          {
            label: 'Back',
            action: () => {
              setMenuState('main');
              setSelectedIndex(0);
            },
            disabled: false,
            icon: '«',
          },
        ];
      }
    }

    return [];
  }, [combatState, menuState, setMenuState, onAction, onLeave]);

  // --- 2. KEYBOARD HANDLING ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (combatState !== 'player_turn' && combatState !== 'victory' && combatState !== 'defeat')
        return;

      if (currentOptions.length === 0) return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : currentOptions.length - 1));
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          setSelectedIndex((prev) => (prev < currentOptions.length - 1 ? prev + 1 : 0));
          break;
        case 'Enter':
        case ' ': {
          const opt = currentOptions[selectedIndex];
          if (!opt.disabled) {
            opt.action();
          }
          break;
        }
        case 'Backspace':
          if (menuState !== 'main' && combatState === 'player_turn') {
            setMenuState('main');
            setSelectedIndex(0);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentOptions, selectedIndex, combatState, menuState, setMenuState]);

  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      {/* 1. FLOATING ENEMY UI (Top Center) */}
      <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[300px] flex flex-col items-center">
        <h2 className="text-neutral-200 font-serif text-2xl mb-1 tracking-widest text-shadow-sm uppercase">
          {enemyName}
        </h2>
        {/* Enemy HP Bar */}
        <div className="w-full h-3 bg-neutral-950 border border-neutral-700 relative">
          <motion.div
            className="h-full bg-red-900"
            initial={{ width: '100%' }}
            animate={{ width: `${(enemyHp / enemyMaxHp) * 100}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
          <div className="absolute inset-0 border border-white/5" />
        </div>
      </div>

      {/* 2. BOTTOM HUD CONTAINER */}
      <div className="pointer-events-auto absolute bottom-0 right-0 w-full md:w-[50vw] max-w-3xl h-[240px] flex">
        {/* --- LEFT PANEL: COMMANDS --- */}
        <div className="w-[40%] bg-neutral-900/95 border-t-4 border-l-4 border-double border-neutral-700 p-4 flex flex-col shadow-2xl">
          <div className="mb-2 border-b border-neutral-800 pb-1 flex justify-between items-end">
            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
              Command
            </span>
            {menuState !== 'main' && (
              <span className="text-[10px] text-neutral-600 font-mono">[Backspace: Back]</span>
            )}
          </div>

          {combatState === 'player_turn' ? (
            <div
              className="flex flex-col gap-0.5 h-full overflow-y-auto scrollbar-none [&::-webkit-scrollbar]:hidden"
              style={{ scrollbarWidth: 'none' }}
            >
              {currentOptions.map((opt, idx) => (
                <ActionButton
                  key={idx}
                  label={opt.label}
                  subtext={opt.subtext || ''}
                  disabled={opt.disabled}
                  isSelected={idx === selectedIndex}
                  icon={opt.icon}
                  onClick={() => {
                    setSelectedIndex(idx);
                    if (!opt.disabled) opt.action();
                  }}
                  onHover={() => setSelectedIndex(idx)}
                />
              ))}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="font-serif text-lg text-neutral-600 tracking-widest animate-pulse">
                {combatState === 'victory'
                  ? 'VICTORY'
                  : combatState === 'defeat'
                    ? 'DEFEAT'
                    : 'WAITING...'}
              </span>
            </div>
          )}
        </div>

        {/* --- RIGHT PANEL: STATS & RESULT ACTIONS --- */}
        <div className="flex-1 bg-neutral-950/95 border-t-4 border-l border-double border-neutral-700 p-4 flex flex-col relative shadow-2xl">
          <div className="flex w-full text-neutral-600 text-[10px] font-mono mb-4 pb-1 border-b border-neutral-800 uppercase tracking-widest">
            <div className="w-1/3">Character</div>
            <div className="w-1/3 text-right pr-4">Vitality</div>
            <div className="w-1/3 text-right pr-4">Mind</div>
          </div>

          {/* Player Row */}
          <div className="flex w-full items-center relative group">
            {/* Name */}
            <div className="w-1/3 flex items-center gap-2">
              {combatState === 'player_turn' && (
                <div className="w-1.5 h-1.5 rotate-45 bg-amber-600 shadow-[0_0_8px_#d97706] animate-pulse" />
              )}
              <span className="text-xl font-serif text-neutral-300 group-hover:text-amber-100 transition-colors">
                Knight
              </span>
            </div>

            {/* HP Bar */}
            <div className="w-1/3 pr-6">
              <div className="w-full h-1.5 bg-neutral-900 border border-neutral-700 mb-1">
                <motion.div
                  className="h-full bg-red-800"
                  animate={{ width: `${(playerStats.hp / playerStats.maxHp) * 100}%` }}
                />
              </div>
              <div className="text-right font-mono text-[10px] text-neutral-500">
                {Math.floor(playerStats.hp)} <span className="text-neutral-700">/</span>{' '}
                {playerStats.maxHp}
              </div>
            </div>

            {/* Mind Bar (Updated to real stats) */}
            <div className="w-1/3 pr-6">
              <div className="w-full h-1.5 bg-neutral-900 border border-neutral-700 mb-1">
                <motion.div
                  className="h-full bg-blue-900/60"
                  animate={{ width: `${(playerStats.mp / playerStats.maxMp) * 100}%` }}
                />
              </div>
              <div className="text-right font-mono text-[10px] text-neutral-500">
                {Math.floor(playerStats.mp)} <span className="text-neutral-700">/</span>{' '}
                {playerStats.maxMp}
              </div>
            </div>
          </div>

          {/* VICTORY / DEFEAT ACTIONS */}
          {(combatState === 'victory' || combatState === 'defeat') && (
            <div className="absolute bottom-4 right-4 z-50 flex gap-4">
              {currentOptions.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={opt.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`
                    px-6 py-2 border font-serif tracking-widest uppercase transition-all shadow-lg text-sm
                    ${
                      idx === selectedIndex
                        ? 'bg-amber-900/40 border-amber-500 text-amber-100 scale-105'
                        : 'bg-neutral-800 border-neutral-600 text-neutral-400 hover:border-neutral-500'
                    }
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ActionButton = ({
  label,
  onClick,
  onHover,
  disabled = false,
  isSelected = false,
  icon = '◈',
  subtext,
}: {
  label: string;
  onClick?: () => void;
  onHover?: () => void;
  disabled?: boolean;
  isSelected?: boolean;
  icon?: string;
  subtext?: string;
}) => (
  <button
    onClick={disabled ? undefined : onClick}
    onMouseEnter={disabled ? undefined : onHover}
    disabled={disabled}
    className={`
      group relative w-full text-left px-3 py-2 border border-transparent
      transition-all duration-75
      ${
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : isSelected
            ? 'bg-neutral-800/80 border-neutral-700 text-amber-50'
            : 'hover:bg-neutral-800 hover:border-neutral-700 cursor-pointer text-neutral-400'
      }
    `}
  >
    {!disabled && (
      <span
        className={`absolute left-1.5 top-1/2 -translate-y-1/2 text-amber-700 transition-opacity text-xs ${
          isSelected ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {icon}
      </span>
    )}

    <div className="flex justify-between items-baseline pl-4">
      <span className="font-serif text-sm tracking-wide uppercase">{label}</span>

      {subtext && <span className="font-mono text-[10px] text-neutral-600">{subtext}</span>}
    </div>
  </button>
);
