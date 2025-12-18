import React from 'react';
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
  return (
    <div className="absolute inset-0 pointer-events-none font-pixel select-none z-50">
      {/* 1. FLOATING ENEMY UI (Top Center) - Unchanged */}
      <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[200px] flex flex-col items-center">
        <h2 className="text-white font-bold text-2xl mb-1 text-shadow-md whitespace-nowrap bg-black/50 px-2">
          {enemyName.toUpperCase()}
        </h2>
        <div className="w-full h-3 bg-black border-2 border-white relative">
          <motion.div
            className="h-full bg-red-600"
            initial={{ width: '100%' }}
            animate={{ width: `${(enemyHp / enemyMaxHp) * 100}%` }}
            transition={{ duration: 0.2 }}
          />
        </div>
      </div>

      {/* 2. BOTTOM HUD */}
      <div className="w-full h-full relative">
        {/* CHANGES:
            - right-0: Anchors to right edge
            - md:w-[45vw]: Takes 45% of screen width on desktop (guarantees center is clear)
            - max-w-2xl: Stops it from getting too huge on Ultrawide
            - rounded-tl-3xl: Adds a nice curve to the top-left corner
        */}
        <div className="pointer-events-auto absolute bottom-0 right-0 w-full md:w-[45vw] max-w-2xl h-[250px] bg-[#111] border-t-4 border-l-4 border-r-0 border-b-0 border-gray-600 flex text-white shadow-2xl rounded-tl-3xl">
          {/* LEFT: COMMANDS */}
          <div className="w-[180px] border-r-4 border-gray-600 p-6 flex flex-col bg-[#1a1a1a] rounded-tl-[20px]">
            {combatState === 'player_turn' ? (
              <div className="flex flex-col gap-3 text-2xl">
                {menuState === 'main' ? (
                  <>
                    <button
                      onClick={() => setMenuState('attack_select')}
                      className="text-left hover:text-yellow-400 hover:bg-white/10 px-2 py-1 rounded transition-colors"
                    >
                      Attack
                    </button>
                    <button className="text-left text-gray-500 cursor-not-allowed px-2 py-1">
                      Skills
                    </button>
                    <button className="text-left hover:text-yellow-400 hover:bg-white/10 px-2 py-1 transition-colors rounded">
                      Inventory
                    </button>
                    <button className="text-left text-gray-500 cursor-not-allowed px-2 py-1">
                      Run
                    </button>
                  </>
                ) : (
                  <>
                    {menuState === 'attack_select' && (
                      <div className="flex flex-col gap-2 text-2xl">
                        {['slash', 'heavy', 'pray'].map((skillId) => {
                          const skill = SKILL_DATABASE[skillId];
                          return (
                            <button
                              key={skillId}
                              onClick={() => onAction(skillId)}
                              className={`text-left text-white hover:${skill.color.replace('text-', '')} hover:bg-white/10 px-2 py-1 rounded`}
                            >
                              ➢ {skill.name}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => setMenuState('main')}
                          className="text-left text-gray-400 mt-2 hover:text-white px-2 py-1"
                        >
                          ➢ BACK
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-center text-gray-500 animate-pulse text-2xl">
                {combatState === 'victory'
                  ? 'VICTORY'
                  : combatState === 'defeat'
                    ? 'DEFEAT'
                    : 'WAIT'}
              </div>
            )}
          </div>

          {/* RIGHT: STATS */}
          <div className="flex-1 p-6 bg-[#111] flex flex-col relative">
            <div className="flex w-full text-gray-500 text-lg mb-2 pb-2 border-b border-gray-700 uppercase tracking-widest">
              <div className="w-1/3">Name</div>
              <div className="w-1/3">Body</div>
              <div className="w-1/3">Mind</div>
            </div>

            {/* Player Row */}
            <div className="flex w-full items-center text-2xl relative group mt-4">
              <div className="w-1/3 flex items-center gap-3 overflow-hidden">
                {combatState === 'player_turn' && (
                  <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse shadow-[0_0_8px_yellow] flex-shrink-0"></div>
                )}
                <span className="group-hover:text-yellow-200 transition-colors">Knight</span>
              </div>

              {/* HP Bar */}
              <div className="w-1/3 pr-8">
                <div className="w-full h-6 bg-black border border-gray-600 relative shadow-inner">
                  <motion.div
                    className="h-full bg-red-600"
                    animate={{ width: `${(playerStats.hp / playerStats.maxHp) * 100}%` }}
                  />
                </div>
                <div className="text-right text-lg mt-1 text-gray-400">
                  {Math.floor(playerStats.hp)}/{playerStats.maxHp}
                </div>
              </div>

              {/* Mind Bar */}
              <div className="w-1/3 pr-8">
                <div className="w-full h-6 bg-black border border-gray-600 relative shadow-inner">
                  <div className="h-full w-[80%] bg-blue-600"></div>
                </div>
                <div className="text-right text-lg mt-1 text-gray-400">80/100</div>
              </div>
            </div>

            {/* END BUTTONS */}
            {(combatState === 'victory' || combatState === 'defeat') && (
              <div className="absolute bottom-6 right-6 z-50">
                {combatState === 'victory' && (
                  <button
                    onClick={() => onLeave(true)}
                    className="bg-yellow-700 text-white px-6 py-3 text-xl border-2 border-yellow-500 hover:bg-yellow-600 shadow-lg font-bold uppercase transition-transform hover:scale-105"
                  >
                    Leave Area ➢
                  </button>
                )}
                {combatState === 'defeat' && (
                  <button
                    onClick={() => onLeave(false)}
                    className="bg-gray-800 text-white px-6 py-3 text-xl border-2 border-gray-500 hover:bg-gray-700 shadow-lg uppercase transition-transform hover:scale-105"
                  >
                    Accept Fate ➢
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
