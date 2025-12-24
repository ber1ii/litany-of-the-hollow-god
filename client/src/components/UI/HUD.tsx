import React, { useMemo } from 'react';
import type { PlayerStats } from '../../types/GameTypes';

interface HUDProps {
  stats: PlayerStats;
  notifications: string[];
}

export const HUD: React.FC<HUDProps> = ({ stats, notifications }) => {
  const madness = Math.max(0, Math.min(1, 1 - stats.sanity / stats.maxSanity));

  const jitterStyle = useMemo(() => {
    if (madness < 0.3) return {};
    const speed = Math.max(0.1, 0.5 - madness * 0.4);
    return {
      animation: `jitter ${speed}s infinite alternate, flicker 0.1s infinite`,
    };
  }, [madness]);

  const glitchTextStyle = useMemo(() => {
    if (madness < 0.5) return {};
    const offset = Math.floor(madness * 4) + 'px';
    return {
      textShadow: `${offset} 0 red, -${offset} 0 blue`,
      transform: `skewX(${madness * 10}deg)`,
    };
  }, [madness]);

  const containerStyle = useMemo(() => {
    const base = {
      background: `linear-gradient(90deg, rgba(0,0,0,${0.8 + madness * 0.15}) 0%, rgba(0,0,0,${0.4 + madness * 0.2}) 60%, transparent 100%)`,
    };
    if (madness > 0.6) {
      return {
        ...base,
        clipPath: 'polygon(0 0, 100% 5%, 95% 90%, 0% 100%)',
        borderLeft: '0.4vmin solid #4a0404',
      };
    }
    return {
      ...base,
      borderLeft: '0.2vmin solid rgba(255,255,255,0.3)',
    };
  }, [madness]);

  return (
    <>
      <style>{`
        @keyframes jitter {
          0% { transform: translate(0, 0); }
          25% { transform: translate(2px, 1px); }
          50% { transform: translate(-1px, 0); }
          75% { transform: translate(0, -2px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes flicker {
          0% { opacity: 1; }
          50% { opacity: 0.8; }
          100% { opacity: 0.95; }
        }
      `}</style>

      {/* --- STATS PANEL --- */}
      {/* Use vmin for positioning and padding so it scales with screen size */}
      <div
        className="absolute z-10 transition-all duration-700 backdrop-blur-[2px]"
        style={{
          top: '4vmin',
          left: '4vmin',
          padding: '2vmin 5vmin 2vmin 2vmin',
          ...containerStyle,
          ...(madness > 0.6 ? jitterStyle : {}),
        }}
      >
        <div className="flex items-center justify-between mb-[2vmin] gap-[4vmin]">
          <h1
            className="font-mono tracking-[0.3em] text-neutral-400 uppercase drop-shadow-md"
            style={{ fontSize: '2.5vmin' }}
          >
            Penitent
          </h1>
          <div className="flex flex-col items-end">
            <span
              className="font-bold tracking-widest uppercase transition-colors duration-500"
              style={{ fontSize: '1.2vmin', color: madness > 0.5 ? '#ef4444' : '#10b981' }}
            >
              Mental State
            </span>
            <span className="text-neutral-500 font-mono" style={{ fontSize: '1.4vmin' }}>
              {madness > 0.8 ? 'FRACTURED' : madness > 0.4 ? 'ERODING' : 'LUCID'}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-[1vmin] min-w-[25vmin]" style={glitchTextStyle}>
          <StatRow
            label="VIT"
            current={stats.hp}
            max={stats.maxHp}
            color={madness > 0.7 ? '#5c4d4d' : '#991b1b'}
          />
          <StatRow
            label="EXP"
            current={stats.xp}
            max={1000}
            color={madness > 0.7 ? '#374151' : '#1e3a8a'}
          />

          <div className="grid grid-cols-2 gap-[2vmin] mt-[1vmin] pt-[1.5vmin] border-t border-white/10">
            <div>
              <p
                className="text-neutral-600 tracking-widest uppercase"
                style={{ fontSize: '1vmin' }}
              >
                Wealth
              </p>
              <p className="font-mono text-neutral-300 leading-none" style={{ fontSize: '2vmin' }}>
                {stats.gold}
              </p>
            </div>
            <div className="text-right">
              <p
                className="text-neutral-600 tracking-widest uppercase"
                style={{ fontSize: '1vmin' }}
              >
                Level
              </p>
              <p className="font-mono text-neutral-300 leading-none" style={{ fontSize: '2vmin' }}>
                {stats.level}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* --- NOTIFICATIONS --- */}
      <div
        className="absolute z-10 text-right pointer-events-none flex flex-col items-end gap-[0.5vmin]"
        style={{ bottom: '4vmin', right: '4vmin' }}
      >
        {notifications.map((msg, i) => (
          <div
            key={i}
            className="border-r border-white/20 font-mono tracking-wide animate-in slide-in-from-right fade-in duration-500"
            style={{
              padding: '0.5vmin 1.5vmin',
              fontSize: '1.4vmin',
              background: 'linear-gradient(270deg, rgba(0,0,0,0.8) 0%, transparent 100%)',
              color: '#d4d4d4',
              borderColor: madness > 0.6 ? '#4a0404' : 'rgba(255,255,255,0.3)',
              ...glitchTextStyle,
            }}
          >
            {msg}
          </div>
        ))}
      </div>
    </>
  );
};

const StatRow = ({
  label,
  current,
  max,
  color,
}: {
  label: string;
  current: number;
  max: number;
  color: string;
}) => {
  const pct = Math.min(100, (current / max) * 100);
  return (
    <div className="flex items-center gap-[1.5vmin]">
      <span
        className="font-bold text-neutral-600 tracking-wider"
        style={{ width: '3vmin', fontSize: '1.2vmin' }}
      >
        {label}
      </span>
      <div
        className="flex-1 bg-neutral-900/50 relative overflow-hidden group"
        style={{ height: '0.8vmin' }}
      >
        <div className="absolute inset-0 bg-white/5" />
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span
        className="text-right text-neutral-500 font-mono"
        style={{ width: '4vmin', fontSize: '1.2vmin' }}
      >
        {current}
      </span>
    </div>
  );
};
