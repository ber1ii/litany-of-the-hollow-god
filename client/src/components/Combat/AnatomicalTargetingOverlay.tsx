import React from 'react';
import { Html } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { useCombatStore } from '../../hooks/useCombatStore';
import type { BodyPart } from '../../types/GameTypes';

interface AnatomicalTargetingOverlayProps {
  enemyPosition: [number, number, number];
  selectedMove?: string;
}

// Anatomical spatial offsets (Screen Left = -X, Screen Right = +X)
const PART_OFFSETS: Record<string, [number, number, number]> = {
  head: [0, 2.2, 0],
  torso: [0, 1.3, 0],
  // Enemy's Left side -> Screen Right (+X)
  l_arm: [0.65, 1.5, 0],
  l_wing: [0.85, 1.8, -0.2],
  l_leg: [0.35, 0.6, 0],
  // Enemy's Right side -> Screen Left (-X)
  r_arm: [-0.65, 1.5, 0],
  r_wing: [-0.85, 1.8, -0.2],
  r_leg: [-0.35, 0.6, 0],
};

export const AnatomicalTargetingOverlay: React.FC<AnatomicalTargetingOverlayProps> = ({
  enemyPosition,
  selectedMove = 'slash',
}) => {
  const turnState = useCombatStore((state) => state.turnState);
  const enemyInstance = useCombatStore((state) => state.enemyInstance);
  const targetPartId = useCombatStore((state) => state.targetPartId);
  const setTargetPartId = useCombatStore((state) => state.setTargetPartId);
  const setRequestedAction = useCombatStore((state) => state.setRequestedAction);

  // Only render targeting nodes during the player's turn
  if (turnState !== 'player_turn' || !enemyInstance) return null;

  const handleTargetClick = (part: BodyPart) => {
    if (part.isSevered) return;
    setRequestedAction(`${selectedMove}|${part.id}`);
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

        return (
          <Html key={part.id} position={worldPos} center distanceFactor={10} zIndexRange={[100, 0]}>
            <div className="relative flex items-center justify-center pointer-events-auto group">
              {/* Target Node Button */}
              <button
                disabled={isSevered}
                onMouseEnter={() => !isSevered && setTargetPartId(part.id)}
                onMouseLeave={() => setTargetPartId(null)}
                onClick={() => handleTargetClick(part)}
                className={`relative flex items-center justify-center transition-transform duration-150 cursor-pointer
                  ${isSevered ? 'cursor-not-allowed opacity-30' : 'hover:scale-125'}`}
              >
                {/* SVG Crosshair Ring */}
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

                {/* Severed Indicator */}
                {isSevered && (
                  <span className="absolute font-mono text-[10px] font-bold text-red-600 tracking-tighter">
                    ✕
                  </span>
                )}
              </button>

              {/* Hover Tooltip Card */}
              <AnimatePresence>
                {isHovered && !isSevered && (
                  <motion.div
                    initial={{ opacity: 0, y: 5, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 3, scale: 0.95 }}
                    className="absolute bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-neutral-950/90 border border-amber-600/50 px-2.5 py-1 shadow-xl pointer-events-none"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-serif text-xs uppercase tracking-wider text-amber-200">
                        {part.name}
                      </span>
                      <span className="font-mono text-[10px] text-neutral-400">
                        {part.hp}/{part.maxHp} HP
                      </span>
                    </div>
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
