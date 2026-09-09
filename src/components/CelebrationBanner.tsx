import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import type { Celebration } from '../store/gameStore';

const RANK_NAMES: Record<string, string> = {
  E: 'Novice',
  D: 'Apprentice',
  C: 'Journeyman',
  B: 'Expert',
  A: 'Master',
  S: 'Legend',
};

const RANK_ICONS: Record<string, string> = {
  E: '🛡️',
  D: '🗡️',
  C: '⚔️',
  B: '🪓',
  A: '🌟',
  S: '👑',
};

function Banner({ celebration, onDismiss }: { celebration: Celebration; onDismiss: () => void }) {
  const isLevel = celebration.type !== 'rank';
  const isRank = celebration.type !== 'level';
  const title =
    celebration.type === 'both'
      ? '⚡ DOUBLE UP! ⚡'
      : celebration.type === 'level'
        ? '⚡ LEVEL UP!'
        : `🏆 RANK UP! ${RANK_ICONS[celebration.rank] || '🏆'}`;

  const lines: string[] = [];
  if (isLevel) lines.push(`You reached Level ${celebration.level}`);
  if (isRank) lines.push(`${celebration.rank}-Rank unlocked — ${RANK_NAMES[celebration.rank] || celebration.rank}`);

  return (
    <motion.div
      key="celebration"
      className="fixed top-16 sm:top-20 left-1/2 z-[60] pointer-events-none"
      style={{ transform: 'translateX(-50%)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: -60, scale: 0.7 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -40, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        onClick={onDismiss}
        className="pointer-events-auto cursor-pointer relative"
      >
        {/* Glow */}
        <div className="absolute -inset-1 rounded-2xl bg-gold/40 blur-lg animate-pulse" />

        {/* Banner */}
        <div className="relative bg-gradient-to-r from-purple-900 via-[#1b1140] to-purple-900 border-2 border-gold/70 rounded-2xl px-6 sm:px-12 py-4 sm:py-5 text-center shadow-2xl w-[92vw] max-w-md">
          {/* Sparkle particles */}
          {[0, 1, 2, 3, 4].map(i => (
            <motion.span
              key={i}
              initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              animate={{ opacity: 0, x: (i % 2 === 0 ? -1 : 1) * (60 + i * 15), y: -40 - i * 12, scale: 0.4 }}
              transition={{ duration: 1.4, delay: 0.15 * i, ease: 'easeOut' }}
              className="absolute text-gold text-lg"
              style={{ left: `${15 + i * 18}%`, top: '-10px' }}
            >
              ✦
            </motion.span>
          ))}

          <p className="text-gold font-display text-xl sm:text-2xl font-bold tracking-wider drop-shadow-[0_0_12px_rgba(241,196,15,0.6)]">
            {title}
          </p>
          {lines.map(line => (
            <p key={line} className="text-white font-mono text-sm sm:text-base mt-1.5">
              {line}
            </p>
          ))}
          <p className="text-gray-400 text-[10px] font-mono mt-2.5 tracking-widest">
            TAP TO DISMISS
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function CelebrationBanner() {
  const celebration = useGameStore(s => s.celebration);
  const dismissCelebration = useGameStore(s => s.dismissCelebration);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (!celebration) return;
    const timer = setTimeout(dismissCelebration, 5000);
    return () => clearTimeout(timer);
  }, [celebration, dismissCelebration]);

  return (
    <AnimatePresence>
      {celebration && <Banner celebration={celebration} onDismiss={dismissCelebration} />}
    </AnimatePresence>
  );
}