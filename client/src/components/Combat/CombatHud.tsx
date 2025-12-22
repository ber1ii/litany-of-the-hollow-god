import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { PlayerStats, CombatEnemyInstance, InventoryItem } from '../../types/GameTypes';
import { SKILL_DATABASE } from '../../data/Skills';
import { WEAPON_TYPES, WEAPON_ATTACKS } from '../../data/WeaponRegistry';

interface CombatHudProps {
  combatState:
    | 'player_turn'
    | 'player_acting'
    | 'enemy_turn'
    | 'enemy_acting'
    | 'victory'
    | 'defeat';
  menuState: 'main' | 'attack_select' | 'items' | 'move_select' | 'skill_select';
  setMenuState: (
    state: 'main' | 'attack_select' | 'items' | 'move_select' | 'skill_select'
  ) => void;
  playerStats: PlayerStats;
  enemyInstance: CombatEnemyInstance | null;
  onAction: (actionId: string) => void;
  onLeave: (victory: boolean) => void;
  inventory: InventoryItem[];
}

interface CombatMenuOption {
  label: string;
  action: () => void;
  disabled: boolean;
  subtext?: string;
  icon?: string;
  color?: string;
}

// Helper: Find equipped weapon
const getEquippedWeaponId = (inventory: InventoryItem[]) => {
  const weapon = inventory.find((i) => i.type === 'weapon');
  return weapon ? weapon.id : 'rusty_sword';
};

export const CombatHud: React.FC<CombatHudProps> = ({
  combatState,
  menuState,
  setMenuState,
  playerStats,
  enemyInstance,
  onAction,
  onLeave,
  inventory,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [prevCombatState, setPrevCombatState] = useState(combatState);

  // Determine available attacks based on weapon
  const weaponId = useMemo(() => getEquippedWeaponId(inventory || []), [inventory]);
  const availableAttacks = useMemo(
    () => WEAPON_TYPES[weaponId] || WEAPON_TYPES['rusty_sword'],
    [weaponId]
  );

  const [selectedMove, setSelectedMove] = useState<string>(availableAttacks[0]);

  if (combatState !== prevCombatState) {
    setPrevCombatState(combatState);
    setSelectedIndex(0);
  }

  const currentOptions = useMemo<CombatMenuOption[]>(() => {
    if (combatState === 'victory')
      return [{ label: 'Leave Area', action: () => onLeave(true), disabled: false }];
    if (combatState === 'defeat')
      return [{ label: 'Accept Fate', action: () => onLeave(false), disabled: false }];

    if (combatState === 'player_turn') {
      if (menuState === 'main') {
        return [
          {
            label: 'Attack',
            action: () => {
              setMenuState('move_select');
              setSelectedIndex(0);
            },
            disabled: false,
          },
          {
            label: 'Skills',
            action: () => {
              setMenuState('skill_select');
              setSelectedIndex(0);
            },
            disabled: false,
          },
          { label: 'Inventory', action: () => {}, disabled: true, subtext: '(WIP)' },
          { label: 'Flee', action: () => {}, disabled: true },
        ];
      } else if (menuState === 'move_select') {
        // Dynamic Attack List
        const attackOptions = availableAttacks
          .map((attackId) => {
            const def = WEAPON_ATTACKS[attackId];

            // Safety Check
            if (!def) {
              console.warn(`Missing weapon attack definition for ID: ${attackId}`);
              return null;
            }

            return {
              label: def.name,
              subtext: def.description,
              action: () => {
                setSelectedMove(attackId);
                setMenuState('attack_select');
                setSelectedIndex(0);
              },
              disabled: false,
            };
          })
          .filter((opt) => opt !== null) as CombatMenuOption[];

        return [
          ...attackOptions,
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
      } else if (menuState === 'attack_select' && enemyInstance) {
        // Limb Targeting
        const attackDef = WEAPON_ATTACKS[selectedMove];
        const limbOptions = enemyInstance.parts.map((part) => {
          const hitChance = Math.min(
            100,
            Math.max(0, 90 + part.hitChanceMod + (attackDef?.accuracyMod || 0))
          );
          const isDead = part.isSevered;

          return {
            label: part.name,
            action: () => onAction(`${selectedMove}|${part.id}`),
            disabled: isDead,
            subtext: isDead ? 'SEVERED' : `${part.hp}/${part.maxHp} HP • ${hitChance}% Hit`,
            icon: isDead ? 'X' : '◈',
            color: part.hitChanceMod < 0 ? 'text-red-400' : 'text-green-400',
          };
        });
        return [
          ...limbOptions,
          {
            label: 'Back',
            action: () => {
              setMenuState('move_select');
              setSelectedIndex(0);
            },
            disabled: false,
            icon: '«',
          },
        ];
      } else if (menuState === 'skill_select') {
        const unlocked = playerStats.unlockedSkills || [];

        const skillOptions = unlocked
          .map((skillId) => {
            const def = SKILL_DATABASE[skillId];
            if (!def) return null;

            return {
              label: def.name,
              subtext: `${def.cost ? def.cost + ' MP' : ''} ${def.description}`,
              action: () => onAction(`skill:${def.id}`),
              disabled: (def.cost || 0) > playerStats.mp,
              icon: '★',
            };
          })
          .filter(Boolean) as CombatMenuOption[];

        return [
          ...skillOptions,
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
  }, [
    combatState,
    menuState,
    setMenuState,
    onAction,
    onLeave,
    enemyInstance,
    selectedMove,
    playerStats.mp,
    playerStats.unlockedSkills,
    availableAttacks,
  ]);

  // Key Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!['player_turn', 'victory', 'defeat'].includes(combatState)) return;
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
        case ' ':
          if (!currentOptions[selectedIndex].disabled) {
            currentOptions[selectedIndex].action();
          }
          break;
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

  const enemyName = enemyInstance?.name || 'Unknown';
  const enemyHp = enemyInstance?.hp || 0;
  const enemyMaxHp = enemyInstance?.maxHp || 100;

  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[300px] flex flex-col items-center">
        <h2 className="text-neutral-200 font-serif text-2xl mb-1 tracking-widest text-shadow-sm uppercase">
          {enemyName}
        </h2>
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

      <div className="pointer-events-auto absolute bottom-0 right-0 w-full md:w-[50vw] max-w-3xl h-[240px] flex">
        <div className="w-[40%] bg-neutral-900/95 border-t-4 border-l-4 border-double border-neutral-700 p-4 flex flex-col shadow-2xl">
          <div className="mb-2 border-b border-neutral-800 pb-1 flex justify-between items-end">
            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
              {menuState === 'attack_select'
                ? 'Target Limb'
                : menuState === 'move_select'
                  ? 'Select Style'
                  : menuState === 'skill_select'
                    ? 'Skills'
                    : 'Command'}
            </span>
            {menuState !== 'main' && (
              <span className="text-[10px] text-neutral-600 font-mono">[Backspace: Back]</span>
            )}
          </div>

          {combatState === 'player_turn' ? (
            <div className="flex flex-col gap-0.5 h-full overflow-y-auto scrollbar-none">
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
                {combatState.toUpperCase().replace('_', ' ')}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 bg-neutral-950/95 border-t-4 border-l border-double border-neutral-700 p-4 flex flex-col relative shadow-2xl">
          <div className="flex w-full items-center relative group pt-4">
            <div className="w-1/3 flex items-center gap-2">
              <span className="text-xl font-serif text-neutral-300">Knight</span>
            </div>
            <div className="w-2/3 pr-6">
              <div className="w-full h-2 bg-neutral-900 border border-neutral-700 mb-2">
                <motion.div
                  className="h-full bg-red-800"
                  animate={{ width: `${(playerStats.hp / playerStats.maxHp) * 100}%` }}
                />
              </div>
              <div className="w-full h-1.5 bg-neutral-900 border border-neutral-700">
                <motion.div
                  className="h-full bg-blue-900/60"
                  animate={{ width: `${(playerStats.mp / playerStats.maxMp) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {(combatState === 'victory' || combatState === 'defeat') && (
            <div className="absolute bottom-4 right-4 z-50 flex gap-4">
              {currentOptions.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={opt.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-6 py-2 border font-serif tracking-widest uppercase transition-all shadow-lg text-sm
                    ${idx === selectedIndex ? 'bg-amber-900/40 border-amber-500 text-amber-100 scale-105' : 'bg-neutral-800 border-neutral-600 text-neutral-400'}`}
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

interface ActionButtonProps {
  label: string;
  onClick?: () => void;
  onHover?: () => void;
  disabled?: boolean;
  isSelected?: boolean;
  icon?: string;
  subtext?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  onClick,
  onHover,
  disabled = false,
  isSelected = false,
  icon = '◈',
  subtext,
}) => (
  <button
    onClick={disabled ? undefined : onClick}
    onMouseEnter={disabled ? undefined : onHover}
    disabled={disabled}
    className={`group relative w-full text-left px-3 py-2 border border-transparent transition-all duration-75
      ${disabled ? 'opacity-40 cursor-not-allowed' : isSelected ? 'bg-neutral-800/80 border-neutral-700 text-amber-50' : 'hover:bg-neutral-800 hover:border-neutral-700 cursor-pointer text-neutral-400'}`}
  >
    {!disabled && (
      <span
        className={`absolute left-1.5 top-1/2 -translate-y-1/2 text-amber-700 transition-opacity text-xs ${isSelected ? 'opacity-100' : 'opacity-0'}`}
      >
        {icon}
      </span>
    )}
    <div className="flex justify-between items-baseline pl-4">
      <span className="font-serif text-sm tracking-wide uppercase">{label}</span>
      {subtext && <span className="font-mono text-[10px] text-neutral-500">{subtext}</span>}
    </div>
  </button>
);
