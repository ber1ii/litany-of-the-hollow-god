import React from 'react';
import type { StatusEffect } from '../../types/GameTypes';

export interface CombatActionLog {
  id: string;
  actor: 'player' | 'enemy';
  message: string;
}

interface CombatLogPanelProps {
  playerEffects: StatusEffect[];
  enemyEffects: StatusEffect[];
  recentActions: CombatActionLog[];
}

export const CombatLogPanel: React.FC<CombatLogPanelProps> = ({
  playerEffects,
  enemyEffects,
  recentActions,
}) => {
  return (
    <div className="w-full bg-black/80 border border-gray-700 rounded-md p-4 flex flex-col gap-4 text-sm font-mono">
      {/* Status Effects Row */}
      <div className="flex justify-between gap-8 border-b border-gray-800 pb-4">
        {/* Player Effects */}
        <div className="flex-1">
          <h3 className="text-gray-400 mb-2 uppercase tracking-wider text-xs">Player Status</h3>
          <div className="flex flex-wrap gap-2">
            {playerEffects.length === 0 && <span className="text-gray-600">None</span>}
            {playerEffects.map((effect) => (
              <span
                key={effect.id}
                className={`px-2 py-1 rounded text-xs ${
                  effect.value > 0 ? 'bg-blue-900/50 text-blue-300' : 'bg-red-900/50 text-red-300'
                }`}
                title={`${effect.name} (${effect.duration} turns left)`}
              >
                {effect.name} {effect.duration > 1 ? `(${effect.duration})` : ''}
              </span>
            ))}
          </div>
        </div>

        {/* Enemy Effects */}
        <div className="flex-1 text-right">
          <h3 className="text-gray-400 mb-2 uppercase tracking-wider text-xs">Enemy Status</h3>
          <div className="flex flex-wrap justify-end gap-2">
            {enemyEffects.length === 0 && <span className="text-gray-600">None</span>}
            {enemyEffects.map((effect) => (
              <span
                key={effect.id}
                className={`px-2 py-1 rounded text-xs ${
                  effect.value > 0 ? 'bg-blue-900/50 text-blue-300' : 'bg-red-900/50 text-red-300'
                }`}
                title={`${effect.name} (${effect.duration} turns left)`}
              >
                {effect.name} {effect.duration > 1 ? `(${effect.duration})` : ''}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Combat History (Last 2 Actions) */}
      <div>
        <h3 className="text-gray-400 mb-2 uppercase tracking-wider text-xs">Combat Log</h3>
        <div className="flex flex-col gap-1 min-h-[40px]">
          {recentActions.length === 0 && (
            <span className="text-gray-600 italic">Combat initiated...</span>
          )}
          {recentActions.map((log) => (
            <div
              key={log.id}
              className={`animate-fade-in ${
                log.actor === 'player' ? 'text-gray-100' : 'text-red-400'
              }`}
            >
              <span className="opacity-50 mr-2">{log.actor === 'player' ? '▶' : '◁'}</span>
              {log.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
