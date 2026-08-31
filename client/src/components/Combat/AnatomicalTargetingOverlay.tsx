import React from 'react';
import { Html } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { useCombatStore } from '../../hooks/useCombatStore';
import { usePlayerStore } from '../../hooks/usePlayerStore';
import { SKILL_DATABASE } from '../../data/Skills';
import { WEAPON_ATTACKS, WEAPON_TYPES } from '../../data/WeaponRegistry';
import type { BodyPart } from '../../types/GameTypes';

interface AnatomicalTargetingOverlayProps {
  enemyPosition: [number, number, number];
  selectedMove?: string;
}

const PART_OFFSETS: Record<string, [number, number, number]> = {
  head: [0, 2.2, 0],
  torso: [0, 1.3, 0],
  l_arm: [0.65, 1.5, 0],
  l_wing: [0.85, 1.8, -0.2],
  l_leg: [0.35, 0.6, 0],
  r_arm: [-0.65, 1.5, 0],
  r_wing: [-0.85, 1.8, -0.2],
  r_leg: [-0.35, 0.6, 0],
};

const getAccuracyMod = (skillId: string, equippedWeaponId: string): number => {
  const skillDef = SKILL_DATABASE[skillId];
  if (skillDef?.scalesWithWeapon) {
    const moveId = WEAPON_TYPES[equippedWeaponId]?.[skillDef.scalesWithWeapon];
    const weaponAttack = moveId ? WEAPON_ATTACKS[moveId] : undefined;
    return (weaponAttack?.accuracyMod ?? 0) + (skillDef.accuracyMod ?? 0);
  }
  const weaponAttack = WEAPON_ATTACKS[skillId];
  if (weaponAttack) return weaponAttack.accuracyMod;
  return 0;
};

export const AnatomicalTargetingOverlay: React.FC<AnatomicalTargetingOverlayProps> = ({
  enemyPosition,
  selectedMove = 'quick_attack',
}) => {
  const turnState = useCombatStore((state) => state.turnState);
  const enemyInstance = useCombatStore((state) => state.enemyInstance);
  const targetPartId = useCombatStore((state) => state.targetPartId);
  const setTargetPartId = useCombatStore((state) => state.setTargetPartId);
  const setRequestedAction = useCombatStore((state) => state.setRequestedAction);
  const activeSkillId = useCombatStore((state) => state.activeSkillId);
  const setActiveSkillId = useCombatStore((state) => state.setActiveSkillId);
  const equippedWeaponId = usePlayerStore((state) => state.equippedWeaponId);

  if (turnState !== 'player_turn' || !enemyInstance) return null;

  const currentSkillId = activeSkillId || selectedMove;
  const accMod = getAccuracyMod(currentSkillId, equippedWeaponId);

  const handleTargetClick = (part: BodyPart) => {
    if (part.isSevered) return;

    setRequestedAction(`skill:${currentSkillId}|${part.id}`);
    if (activeSkillId) {
      setActiveSkillId(null);
    }
  };

  return (
    <group name="anatomical-targeting-overlay">
      {enemyInstance.parts.map((part) => {
        const offset = PART_OFFSETS[part.id] || [0, 1.2, 0];
        const worldPos: [number, number, number] = [
          enemyPosition[0] + offset[0],
          enemyPosition[1] + offset[1],
          enemyPosition[2] + offset[2],
        ];

        const isHovered = targetPartId === part.id;
        const isSevered = part.isSevered;
        const hitChance = Math.min(100, Math.max(0, 90 + part.hitChanceMod + accMod));

        return (
          <Html key={part.id} position={worldPos} center distanceFactor={10} zIndexRange={[100, 0]}>
            <div className="relative flex items-center justify-center pointer-events-auto group">
              <button
                disabled={isSevered}
                onMouseEnter={() => !isSevered && setTargetPartId(part.id)}
                onMouseLeave={() => setTargetPartId(null)}
                onClick={() => handleTargetClick(part)}
                className={`relative flex items-center justify-center transition-transform duration-150 cursor-pointer
                  ${isSevered ? 'cursor-not-allowed opacity-30' : 'hover:scale-125'}`}
              >
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 36 36"
                  className={`transition-colors duration-150 ${
                    isSevered
                      ? 'stroke-neutral-600 fill-none'
                      : isHovered
                        ? 'stroke-amber-400 fill-amber-500/20 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                        : 'stroke-red-500/70 fill-red-950/30 hover:stroke-amber-400'
                  }`}
                >
                  <circle
                    cx="18"
                    cy="18"
                    r="10"
                    strokeWidth="1.5"
                    strokeDasharray={isHovered ? 'none' : '3 2'}
                  />
                  <line x1="18" y1="2" x2="18" y2="8" strokeWidth="2" />
                  <line x1="18" y1="28" x2="18" y2="34" strokeWidth="2" />
                  <line x1="2" y1="18" x2="8" y2="18" strokeWidth="2" />
                  <line x1="28" y1="18" x2="34" y2="18" strokeWidth="2" />
                  {isHovered && <circle cx="18" cy="18" r="3" className="fill-amber-400" />}
                </svg>

                {isSevered && (
                  <span className="absolute font-mono text-[10px] font-bold text-red-600 tracking-tighter">
                    ✕
                  </span>
                )}
              </button>

              <AnimatePresence>
                {isHovered && !isSevered && (
                  <motion.div
                    initial={{ opacity: 0, y: 5, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 3, scale: 0.95 }}
                    className="absolute bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-neutral-950/90 border border-amber-600/50 px-2.5 py-1 shadow-xl pointer-events-none flex flex-col items-center gap-0.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-serif text-xs uppercase tracking-wider text-amber-200">
                        {part.name}
                      </span>
                      <span className="font-mono text-[10px] text-neutral-400">
                        {part.hasHp === false
                          ? 'VITAL — SEVER ONLY'
                          : `${part.hp}/${part.maxHp} HP`}
                      </span>
                    </div>
                    <span
                      className={`font-mono text-[9px] ${hitChance < 70 ? 'text-red-400' : 'text-green-400'}`}
                    >
                      {hitChance}% HIT CHANCE
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Html>
        );
      })}
    </group>
  );
};
