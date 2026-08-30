import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import type { InventoryItem } from '../../types/GameTypes';
import { SKILL_DATABASE } from '../../data/Skills';
import { WEAPON_TYPES, WEAPON_ATTACKS } from '../../data/WeaponRegistry';
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

// Skills always available regardless of what's equipped from the tree —
// these are the starting-loadout basic/heavy attacks, shown alongside
// whatever the player has equipped from SKILL_TREE.
const BASE_SKILL_IDS = ['quick_attack', 'heavy_attack'];

const getEquippedWeaponId = (inventory: InventoryItem[]) => {
  const weapon = inventory.find((i: InventoryItem) => i.type === 'weapon');
  return weapon ? weapon.id : 'rusty_sword';
};

export const CombatHud: React.FC<CombatHudProps> = ({ onLeave, inventory: propInventory }) => {
  const storeInventory = usePlayerStore((state) => state.inventory);
  const inventory: InventoryItem[] = propInventory || storeInventory;

  const turnState = useCombatStore((state) => state.turnState);
  const playerStats = useCombatStore((state) => state.playerStats);
  const enemyInstance = useCombatStore((state) => state.enemyInstance);
  const setRequestedAction = useCombatStore((state) => state.setRequestedAction);
  const setTargetPartId = useCombatStore((state) => state.setTargetPartId);
  const skillCooldowns = useCombatStore((state) => state.skillCooldowns);

  const [menuState, setMenuState] = useState<
    | 'main'
    | 'attack_select'
    | 'items'
    | 'move_select'
    | 'skill_select'
    | 'skill_target_select'
    | 'item_select'
  >('main');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [prevCombatState, setPrevCombatState] = useState(turnState);
  const activeSkillId = useCombatStore((state) => state.activeSkillId);
  const setActiveSkillId = useCombatStore((state) => state.setActiveSkillId);
  const setActiveWeaponAttackId = useCombatStore((state) => state.setActiveWeaponAttackId);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const weaponId = useMemo(() => getEquippedWeaponId(inventory), [inventory]);
  const availableAttacks = useMemo(
    () => WEAPON_TYPES[weaponId] || WEAPON_TYPES['rusty_sword'],
    [weaponId]
  );

  const [selectedMove, setSelectedMove] = useState<string>(availableAttacks[0]);

  if (turnState !== prevCombatState) {
    setPrevCombatState(turnState);
    setSelectedIndex(0);
    if (turnState === 'player_turn') {
      setMenuState('main');
      setActiveSkillId(null); // add
      setActiveWeaponAttackId(null); // add
    }
  }

  // Live-preview the hovered limb for both the weapon-attack targeting
  // flow and the skill targeting flow — they share the same UI below.
  useEffect(() => {
    const isTargeting = menuState === 'attack_select' || menuState === 'skill_target_select';
    if (isTargeting && enemyInstance?.parts) {
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
          {
            label: 'Items',
            action: () => {
              setMenuState('item_select');
              setSelectedIndex(0);
            },
            disabled: !hasUsableItems,
          },
          { label: 'Flee', action: () => {}, disabled: true },
        ];
      }

      if (menuState === 'move_select') {
        const attackOptions = availableAttacks
          .map((attackId) => {
            const def = WEAPON_ATTACKS[attackId];
            if (!def) return null;

            return {
              label: def.name,
              subtext: def.description,
              action: () => {
                setSelectedMove(attackId);
                setActiveWeaponAttackId(attackId);
                setMenuState('attack_select');
                setSelectedIndex(0);
              },
              disabled: false,
            };
          })
          .filter(Boolean) as CombatMenuOption[];

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
      }

      if (menuState === 'attack_select' && enemyInstance) {
        const attackDef = WEAPON_ATTACKS[selectedMove];
        const severedCount = enemyInstance.parts.filter((p) => p.isSevered).length;

        const limbOptions = enemyInstance.parts.map((part) => {
          const hitChance = Math.min(
            100,
            Math.max(0, 90 + part.hitChanceMod + (attackDef?.accuracyMod || 0))
          );
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
            action: () => setRequestedAction(`${selectedMove}|${part.id}`),
            disabled: isDead,
            subtext,
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
      }

      if (menuState === 'skill_select' && playerStats) {
        const equipped = playerStats.equippedSkills || [];
        // Base loadout skills always show up first, then whatever's
        // equipped from the tree (deduped against the base ids).
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

            const costLabel = [
              def.cost ? `${def.cost} MP` : '',
              def.hpCostPercent ? `${def.hpCostPercent}% HP` : '',
            ]
              .filter(Boolean)
              .join(' • ');

            return {
              label: def.name,
              subtext: onCooldown ? `Recovering — ${def.description}` : def.description,
              badge: onCooldown ? `CD ${cooldownLeft}` : costLabel || undefined,
              action: () => {
                if (def.damageScale) {
                  setActiveSkillId(skillId); // was setSelectedSkill(skillId)
                  setMenuState('skill_target_select');
                  setSelectedIndex(0);
                } else {
                  setRequestedAction(`skill:${skillId}`);
                }
              },
              disabled: !mpOk || !hpOk || onCooldown,
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

      if (menuState === 'skill_target_select' && enemyInstance && activeSkillId) {
        const severedCount = enemyInstance.parts.filter((p) => p.isSevered).length;

        const limbOptions = enemyInstance.parts.map((part) => {
          const hitChance = Math.min(100, Math.max(0, 90 + part.hitChanceMod));
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
            color: part.hitChanceMod < 0 ? 'text-red-400' : 'text-green-400',
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
    selectedMove,
    playerStats,
    availableAttacks,
    onLeave,
    setRequestedAction,
    setMenuState,
    setSelectedIndex,
    setSelectedMove,
    inventory,
    skillCooldowns,
    activeSkillId,
    setActiveSkillId,
    setActiveWeaponAttackId,
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
            if (menuState === 'attack_select') {
              setMenuState('move_select');
              setSelectedIndex(0);
            } else if (menuState === 'skill_target_select') {
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

  // Previously, longer menus (e.g. skill_select with 5+ entries) could
  // push the currently-selected row out of the visible list area with no
  // indication it had happened — the only way to see it was to manually
  // scroll. Now the selected row is kept in view automatically, whether
  // selection changes via mouse hover or arrow keys.
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

  const isTargetingLimb =
    (menuState === 'attack_select' || menuState === 'skill_target_select') &&
    turnState === 'player_turn';
  const hoveredLimb =
    isTargetingLimb && enemyInstance?.parts ? enemyInstance.parts[selectedIndex] : null;
  const activeAccuracyMod =
    menuState === 'attack_select' ? WEAPON_ATTACKS[selectedMove]?.accuracyMod || 0 : 0;
  const hoveredLimbHitChance = hoveredLimb
    ? Math.min(100, Math.max(0, 90 + hoveredLimb.hitChanceMod + activeAccuracyMod))
    : 0;
  const hoveredLimbSeverChance =
    hoveredLimb && hoveredLimb.severChance
      ? Math.min(
          100,
          hoveredLimb.severChance +
            getSeverEscalationBonus(enemyInstance?.parts.filter((p) => p.isSevered).length || 0)
        )
      : 0;

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
                className={`text-[10px] font-mono ${hoveredLimb.hitChanceMod < 0 ? 'text-red-400' : 'text-green-400'}`}
              >
                {hoveredLimbHitChance}% HIT
              </span>
            </div>

            {hoveredLimb.hasHp === false ? (
              <div className="w-full flex justify-between items-center">
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                  Vital — Sever Only
                </span>
                <span className="text-[10px] font-mono text-red-400">
                  {hoveredLimbSeverChance}% SEVER
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

      <div className="pointer-events-auto absolute bottom-0 right-0 w-full md:w-[54vw] max-w-[min(90vw,64rem)] h-[clamp(270px,22vh,380px)] flex">
        <style>{`
          .combat-menu-scroll::-webkit-scrollbar { width: 5px; }
          .combat-menu-scroll::-webkit-scrollbar-thumb { background: #57534e; border-radius: 2px; }
          .combat-menu-scroll::-webkit-scrollbar-thumb:hover { background: #78716c; }
          .combat-menu-scroll::-webkit-scrollbar-track { background: transparent; }
        `}</style>
        <div className="w-[42%] bg-neutral-900/95 border-t-4 border-l-4 border-double border-neutral-700 p-4 flex flex-col shadow-2xl">
          <div className="mb-2 border-b border-neutral-800 pb-1.5 flex justify-between items-end">
            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
              {menuState === 'attack_select'
                ? 'Target Limb'
                : menuState === 'skill_target_select'
                  ? 'Target Limb'
                  : menuState === 'move_select'
                    ? 'Select Style'
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
            <div className="w-2/3 pr-6">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[8px] font-mono text-neutral-600 uppercase tracking-widest w-5">
                  Hp
                </span>
                <div className="flex-1 h-2 bg-neutral-900 border border-neutral-700">
                  <motion.div
                    className="h-full bg-red-800"
                    animate={{ width: `${(playerHp / playerMaxHp) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[8px] font-mono text-neutral-600 uppercase tracking-widest w-5">
                  Mp
                </span>
                <div className="flex-1 h-1.5 bg-neutral-900 border border-neutral-700">
                  <motion.div
                    className="h-full bg-blue-900/60"
                    animate={{ width: `${(playerMp / playerMaxMp) * 100}%` }}
                  />
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
