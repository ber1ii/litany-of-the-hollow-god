import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

interface DeathScreenProps {
  onRespawn: () => void;
}

export const DeathScreen: React.FC<DeathScreenProps> = ({ onRespawn }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        onRespawn();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onRespawn]);

  return (
    <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black pointer-events-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 3, ease: 'easeOut' }}
        className="flex flex-col items-center"
      >
        <h1
          className="text-8xl font-serif tracking-widest text-red-700 select-none"
          style={{ textShadow: '0 0 20px rgba(185, 28, 28, 0.5)' }}
        >
          YOU DIED
        </h1>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3, duration: 1.5 }}
        className="mt-12"
      >
        <button
          onClick={onRespawn}
          className="px-6 py-2 text-gray-400 font-serif text-xl border-b border-transparent hover:border-gray-400 hover:text-white transition-all duration-300"
        >
          Press Enter to awaken at the last Bonfire
        </button>
      </motion.div>
    </div>
  );
};
