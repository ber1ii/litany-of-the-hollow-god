import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import type { InventoryItem } from '../../types/GameTypes';
import { SKILL_DATABASE } from '../../data/Skills';
import { WEAPON_ATTACKS, WEAPON_TYPES } from '../../data/WeaponRegistry';
import { getSeverEscalationBonus } from '../../managers/CombatLogic';
import { useCombatStore } from '../../hooks/useCombatStore';
import { usePlayerStore } from '../../hooks/usePlayerStore';

interface CombatHudProps {
  onLeave: (victory: boolean) => void;
  inventory?: InventoryItem[];
}

interface CombatMenuOption {
  label: string;
  action: () => void;
  disabled: boolean;
  subtext?: string;
  badge?: string;
  icon?: string;
  color?: string;
}

const BASE_SKILL_IDS = ['quick_attack', 'heavy_attack'];

export const CombatHud: React.FC<CombatHudProps> = ({ onLeave, inventory: propInventory }) => {
  const storeInventory = usePlayerStore((state) => state.inventory);
  const equippedWeaponId = usePlayerStore((state) => state.equippedWeaponId);
  const inventory: InventoryItem[] = propInventory || storeInventory;

  const turnState = useCombatStore((state) => state.turnState);
  const playerStats = useCombatStore((state) => state.playerStats);
  const enemyInstance = useCombatStore((state) => state.enemyInstance);
  const setRequestedAction = useCombatStore((state) => state.setRequestedAction);
  const setTargetPartId = useCombatStore((state) => state.setTargetPartId);
  const skillCooldowns = useCombatStore((state) => state.skillCooldowns);
  const activeSkillId = useCombatStore((state) => state.activeSkillId);
  const setActiveSkillId = useCombatStore((state) => state.setActiveSkillId);

  const [menuState, setMenuState] = useState<
    'main' | 'skill_select' | 'skill_target_select' | 'item_select'
  >('main');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [prevCombatState, setPrevCombatState] = useState(turnState);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  if (turnState !== prevCombatState) {
    setPrevCombatState(turnState);
    setSelectedIndex(0);
    if (turnState === 'player_turn') {
      setMenuState('main');
      setActiveSkillId(null);
    }
  }

  useEffect(() => {
    if (menuState === 'skill_target_select' && enemyInstance?.parts) {
      const selectedPart = enemyInstance.parts[selectedIndex];
      if (selectedPart && !selectedPart.isSevered) {
        setTargetPartId(selectedPart.id);
      } else {
        setTargetPartId(null);
      }
    } else {
      setTargetPartId(null);
    }
  }, [menuState, selectedIndex, enemyInstance, setTargetPartId]);

  const activeAccMod = useMemo(() => {
    if (!activeSkillId) return 0;
    const skillDef = SKILL_DATABASE[activeSkillId];
    if (skillDef?.scalesWithWeapon) {
      const moveId = WEAPON_TYPES[equippedWeaponId]?.[skillDef.scalesWithWeapon];
      const weaponAttack = moveId ? WEAPON_ATTACKS[moveId] : undefined;
      return (weaponAttack?.accuracyMod ?? 0) + (skillDef.accuracyMod ?? 0);
    }
    return SKILL_DATABASE[activeSkillId]?.accuracyMod ?? 0;
  }, [activeSkillId, equippedWeaponId]);

  const activeCooldownsList = useMemo(() => {
    return Object.entries(skillCooldowns)
      .filter(([id, cd]) => cd > 0 && SKILL_DATABASE[id])
      .map(([id, cd]) => ({ id, name: SKILL_DATABASE[id].name, cd }));
  }, [skillCooldowns]);

  const currentOptions = useMemo<CombatMenuOption[]>(() => {
    if (turnState === 'victory')
      return [{ label: 'Leave Area', action: () => onLeave(true), disabled: false }];
    if (turnState === 'defeat')
      return [{ label: 'Accept Fate', action: () => onLeave(false), disabled: false }];

    if (turnState === 'player_turn') {
      if (menuState === 'main') {
        const hasUsableItems = inventory.some(
          (i: InventoryItem) => ['consumable', 'flask'].includes(i.type) && i.count > 0
        );

        return [
          {
            label: 'Skills',
            action: () => {
              setMenuState('skill_select');
              setSelectedIndex(0);
            },
            disabled: false,
          },
          {
            label: 'Items',
            action: () => {
              setMenuState('item_select');
              setSelectedIndex(0);
            },
            disabled: !hasUsableItems,
          },
          {
            label: 'Flee',
            subtext: '5% chance to escape',
            action: () => setRequestedAction('flee'),
            disabled: false,
            color: 'text-red-400',
          },
        ];
      }

      if (menuState === 'skill_select' && playerStats) {
        const equipped = playerStats.equippedSkills || [];
        const skillIds = [
          ...BASE_SKILL_IDS,
          ...equipped.filter((id) => !BASE_SKILL_IDS.includes(id)),
        ];

        const skillOptions = skillIds
          .map((skillId) => {
            const def = SKILL_DATABASE[skillId];
            if (!def) return null;

            const mpOk = !def.cost || def.cost <= playerStats.mp;
            const hpOk =
              !def.hpCostPercent ||
              Math.floor(playerStats.hp * (def.hpCostPercent / 100)) < playerStats.hp;
            const cooldownLeft = skillCooldowns[skillId] || 0;
            const onCooldown = cooldownLeft > 0;

            const costParts = [];
            if (def.cost) costParts.push(`${def.cost}MP`);
            if (def.hpCostPercent) costParts.push(`${def.hpCostPercent}%HP`);
            if (def.cooldown && def.cooldown > 1) {
              costParts.push(`${def.cooldown - 1}T Base`);
            }
            const costLabel = costParts.join(' • ') || 'FREE';

            let badgeLabel = costLabel;
            let colorClass = 'text-amber-600';

            if (onCooldown) {
              badgeLabel = `CD: ${cooldownLeft}T`;
              colorClass = 'text-neutral-500';
            } else if (!mpOk) {
              badgeLabel = `NO MP (${def.cost})`;
              colorClass = 'text-red-500';
            } else if (!hpOk) {
              badgeLabel = `NO HP`;
              colorClass = 'text-red-500';
            }

            return {
              label: def.name,
              subtext: onCooldown ? `Recovering — ${def.description}` : def.description,
              badge: badgeLabel,
              action: () => {
                if (def.damageScale || def.scalesWithWeapon) {
                  setActiveSkillId(skillId);
                  setMenuState('skill_target_select');
                  setSelectedIndex(0);
                } else {
                  setRequestedAction(`skill:${skillId}`);
                }
              },
              disabled: !mpOk || !hpOk || onCooldown,
              icon: '★',
              color: colorClass,
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

      if (menuState === 'skill_target_select' && enemyInstance && activeSkillId) {
        const severedCount = enemyInstance.parts.filter((p) => p.isSevered).length;

        const limbOptions = enemyInstance.parts.map((part) => {
          const hitChance = Math.min(100, Math.max(0, 90 + part.hitChanceMod + activeAccMod));
          const isDead = part.isSevered;
          const partHasHp = part.hasHp !== false;
          const effectiveSeverChance = part.severChance
            ? Math.min(100, part.severChance + getSeverEscalationBonus(severedCount))
            : 0;

          const subtext = isDead
            ? 'SEVERED'
            : partHasHp
              ? `${part.hp}/${part.maxHp} HP • ${hitChance}% Hit`
              : `${hitChance}% Hit • ${effectiveSeverChance}% Sever`;

          return {
            label: part.name,
            action: () => {
              setRequestedAction(`skill:${activeSkillId}|${part.id}`);
              setActiveSkillId(null);
            },
            disabled: isDead,
            subtext,
            icon: isDead ? 'X' : '◈',
            color: hitChance < 70 ? 'text-red-400' : 'text-green-400',
          };
        });

        return [
          ...limbOptions,
          {
            label: 'Back',
            action: () => {
              setMenuState('skill_select');
              setSelectedIndex(0);
            },
            disabled: false,
            icon: '«',
          },
        ];
      }

      if (menuState === 'item_select') {
        const usableItems = inventory.filter(
          (i: InventoryItem) => ['consumable', 'flask'].includes(i.type) && i.count > 0
        );

        const itemOptions = usableItems.map((item: InventoryItem) => ({
          label: item.name,
          subtext: `Restores ${item.effect?.type === 'heal' ? 'HP' : 'MP'}`,
          badge: `x${item.count}`,
          action: () => setRequestedAction(`item:${item.id}`),
          disabled: false,
          icon: '⚗',
          color: item.type === 'flask' ? 'text-blue-400' : 'text-green-400',
        })) as CombatMenuOption[];

        return [
          ...itemOptions,
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
    turnState,
    menuState,
    enemyInstance,
    playerStats,
    onLeave,
    setRequestedAction,
    setMenuState,
    setSelectedIndex,
    inventory,
    skillCooldowns,
    activeSkillId,
    setActiveSkillId,
    activeAccMod,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!['player_turn', 'victory', 'defeat'].includes(turnState)) return;
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
          if (!currentOptions[selectedIndex]?.disabled) {
            currentOptions[selectedIndex]?.action();
          }
          break;
        case 'Backspace':
          if (turnState === 'player_turn') {
            if (menuState === 'skill_target_select') {
              setMenuState('skill_select');
              setSelectedIndex(0);
            } else if (menuState !== 'main') {
              setMenuState('main');
              setSelectedIndex(0);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentOptions, selectedIndex, turnState, menuState, setMenuState, setSelectedIndex]);

  useEffect(() => {
    optionRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, menuState]);

  const enemyName = enemyInstance?.name || 'Unknown';
  const enemyHp = enemyInstance?.hp || 0;
  const enemyMaxHp = enemyInstance?.maxHp || 100;

  const playerHp = playerStats?.hp || 0;
  const playerMaxHp = playerStats?.maxHp || 100;
  const playerMp = playerStats?.mp || 0;
  const playerMaxMp = playerStats?.maxMp || 100;

  const isTargetingLimb = menuState === 'skill_target_select' && turnState === 'player_turn';
  const hoveredLimb =
    isTargetingLimb && enemyInstance?.parts ? enemyInstance.parts[selectedIndex] : null;

  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[300px] flex flex-col items-center">
        <h2 className="text-neutral-200 font-serif text-2xl mb-1 tracking-widest text-shadow-sm uppercase">
          {enemyName}
        </h2>
        <div className="w-full flex items-center gap-1.5">
          <span className="text-[8px] font-mono text-neutral-600 uppercase tracking-widest w-5">
            Hp
          </span>
          <div className="flex-1 h-3 bg-neutral-950 border border-neutral-700 relative">
            <motion.div
              className="h-full bg-red-900"
              initial={{ width: '100%' }}
              animate={{ width: `${(enemyHp / enemyMaxHp) * 100}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
            <div className="absolute inset-0 border border-white/5" />
          </div>
        </div>

        {isTargetingLimb && hoveredLimb && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-[240px] flex flex-col items-center mt-3 p-2 bg-neutral-900/90 border border-neutral-700/50 shadow-lg"
          >
            <div className="w-full flex justify-between items-end mb-1">
              <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest">
                Target: {hoveredLimb.name}
              </span>
              <span
                className={`text-[10px] font-mono ${
                  Math.min(100, Math.max(0, 90 + hoveredLimb.hitChanceMod + activeAccMod)) < 70
                    ? 'text-red-400'
                    : 'text-green-400'
                }`}
              >
                {Math.min(100, Math.max(0, 90 + hoveredLimb.hitChanceMod + activeAccMod))}% HIT
              </span>
            </div>

            {hoveredLimb.hasHp === false ? (
              <div className="w-full flex justify-between items-center">
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                  Vital — Sever Only
                </span>
              </div>
            ) : (
              <div className="w-full h-1.5 bg-neutral-950 border border-neutral-700 relative">
                <motion.div
                  className="h-full bg-amber-600"
                  animate={{ width: `${(hoveredLimb.hp / hoveredLimb.maxHp) * 100}%` }}
                />
              </div>
            )}
          </motion.div>
        )}
      </div>

      <div className="pointer-events-auto absolute bottom-0 right-0 w-full md:w-[60vw] max-w-[min(90vw,64rem)] h-[clamp(270px,22vh,380px)] flex">
        {/* Active Cooldowns Mini HUD Tracker */}
        {activeCooldownsList.length > 0 && (
          <div className="absolute bottom-[100%] right-0 mb-3 flex gap-2 items-end pointer-events-none">
            {activeCooldownsList.map((item) => (
              <div
                key={item.id}
                className="bg-neutral-900/95 border-t-2 border-amber-700 shadow-lg px-4 py-1.5 flex flex-col items-center justify-center rounded-sm"
              >
                <span className="text-[9px] font-mono uppercase tracking-widest text-neutral-400">
                  {item.name}
                </span>
                <span className="text-sm font-serif text-amber-500 animate-pulse">
                  {item.cd}T Left
                </span>
              </div>
            ))}
          </div>
        )}

        <style>{`
          .combat-menu-scroll::-webkit-scrollbar { width: 5px; }
          .combat-menu-scroll::-webkit-scrollbar-thumb { background: #57534e; border-radius: 2px; }
          .combat-menu-scroll::-webkit-scrollbar-thumb:hover { background: #78716c; }
          .combat-menu-scroll::-webkit-scrollbar-track { background: transparent; }
        `}</style>
        <div className="w-[42%] bg-neutral-900/95 border-t-4 border-l-4 border-double border-neutral-700 p-4 flex flex-col shadow-2xl">
          <div className="mb-2 border-b border-neutral-800 pb-1.5 flex justify-between items-end">
            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
              {menuState === 'skill_target_select'
                ? 'Target Limb'
                : menuState === 'skill_select'
                  ? 'Skills'
                  : menuState === 'item_select'
                    ? 'Items'
                    : 'Command'}
            </span>
            {menuState !== 'main' && (
              <span className="text-[9px] text-neutral-600 font-mono tracking-wide">⌫ Back</span>
            )}
          </div>

          {turnState === 'player_turn' ? (
            <div className="flex flex-col gap-0.5 h-full overflow-y-auto combat-menu-scroll pr-1">
              {currentOptions.map((opt, idx) => (
                <ActionButton
                  key={idx}
                  ref={(el) => {
                    optionRefs.current[idx] = el;
                  }}
                  label={opt.label}
                  subtext={opt.subtext || ''}
                  badge={opt.badge}
                  disabled={opt.disabled}
                  isSelected={idx === selectedIndex}
                  icon={opt.icon}
                  color={opt.color}
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
                {turnState.toUpperCase().replace('_', ' ')}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 bg-neutral-950/95 border-t-4 border-l border-double border-neutral-700 p-4 flex flex-col relative shadow-2xl">
          <div className="flex w-full items-center relative group pt-4">
            <div className="w-1/3 flex items-center gap-2">
              <span className="text-xl font-serif text-neutral-300">Knight</span>
            </div>
            <div className="w-2/3 pr-6 flex flex-col gap-2">
              {/* HP Bar */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-red-400 uppercase tracking-wider w-6">
                  HP
                </span>
                <div className="flex-1 h-4 bg-neutral-900 border border-neutral-700 relative overflow-hidden rounded-xs">
                  <motion.div
                    className="h-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.6)]"
                    animate={{ width: `${(playerHp / playerMaxHp) * 100}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                    {playerHp} / {playerMaxHp}
                  </span>
                </div>
              </div>

              {/* MP Bar */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider w-6">
                  MP
                </span>
                <div className="flex-1 h-4 bg-neutral-900 border border-neutral-700 relative overflow-hidden rounded-xs">
                  <motion.div
                    className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]"
                    animate={{ width: `${(playerMp / playerMaxMp) * 100}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                    {playerMp} / {playerMaxMp}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {(turnState === 'victory' || turnState === 'defeat') && (
            <div className="absolute bottom-4 right-4 z-50 flex gap-4">
              {currentOptions.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={opt.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-6 py-2 border font-serif tracking-widest uppercase transition-all shadow-lg text-sm
                    ${
                      idx === selectedIndex
                        ? 'bg-amber-900/40 border-amber-500 text-amber-100 scale-105'
                        : 'bg-neutral-800 border-neutral-600 text-neutral-400'
                    }`}
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
  badge?: string;
  color?: string;
}

const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  (
    {
      label,
      onClick,
      onHover,
      disabled = false,
      isSelected = false,
      icon = '◈',
      subtext,
      badge,
      color,
    },
    ref
  ) => (
    <button
      ref={ref}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={disabled ? undefined : onHover}
      disabled={disabled}
      className={`group relative w-full text-left pl-3 pr-2.5 py-2 border-l-2 transition-all duration-100
        ${
          disabled
            ? 'opacity-35 cursor-not-allowed border-transparent'
            : isSelected
              ? 'bg-neutral-800/70 border-amber-500'
              : 'border-transparent hover:bg-neutral-800/40 hover:border-neutral-600 cursor-pointer'
        }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`shrink-0 text-[11px] w-3 text-center transition-opacity ${
            isSelected && !disabled ? 'opacity-100' : 'opacity-30'
          } ${color || 'text-amber-600'}`}
        >
          {disabled ? '×' : icon}
        </span>
        <span
          className={`flex-1 font-serif text-sm tracking-wide uppercase truncate ${
            disabled ? 'text-neutral-600' : isSelected ? 'text-amber-50' : 'text-neutral-300'
          }`}
        >
          {label}
        </span>
        {badge && (
          <span
            className={`shrink-0 font-mono text-[9px] px-1.5 py-0.5 border rounded-sm ${
              isSelected && !disabled
                ? 'border-amber-700/60 text-amber-400 bg-amber-950/40'
                : 'border-neutral-700 text-neutral-500'
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      {subtext && (
        <div
          className={`mt-0.5 pl-5 truncate text-[10px] font-mono ${
            isSelected && !disabled ? 'text-neutral-300' : 'text-neutral-600'
          }`}
          title={subtext}
        >
          {subtext}
        </div>
      )}
    </button>
  )
);
ActionButton.displayName = 'ActionButton';
