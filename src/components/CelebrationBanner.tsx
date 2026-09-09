import { useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import type { Celebration } from '../store/gameStore';
import { sfx } from '../utils/sounds';

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

const CONFETTI_COLORS = ['#F1C40F', '#8E2DE2', '#3b82f6', '#ffffff', '#a855f7', '#2ECC71'];

function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        left: `${(i * 47 + 11) % 100}%`,
        delay: `${(i % 11) * 0.12}s`,
        duration: `${1.1 + (i % 7) * 0.16}s`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 5 + (i % 4) * 2,
      })),
    [],
  );

  return (
    <div className="fixed inset-0 z-[70] pointer-events-none overflow-hidden" aria-hidden>
      {/* Screen flash */}
      <div className="absolute inset-0 bg-gradient-to-b from-gold/25 via-purple-500/10 to-transparent animate-flash-out" />
      {/* Falling confetti */}
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 rounded-sm animate-confetti-fall"
          style={{
            left: p.left,
            width: p.size,
            height: p.size * 0.5,
            backgroundColor: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
            boxShadow: `0 0 8px ${p.color}`,
          }}
        />
      ))}
    </div>
  );
}

/** Wrapper for a single confetti burst — motion child so AnimatePresence tracks its exit. */
function ConfettiBurstMotion({ index }: { index: number }) {
  return (
    <motion.div
      key={`confetti-${index}`}
      className="fixed inset-0 z-[70] pointer-events-none overflow-hidden"
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <ConfettiBurst />
    </motion.div>
  );
}

function BannerContent({ celebration, pending }: { celebration: Celebration; pending: number }) {
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
    <div className="relative">
      {/* Glow */}
      <div className="absolute -inset-1 rounded-2xl bg-gold/40 blur-lg animate-pulse" />
      <div className="absolute -inset-3 rounded-3xl bg-purple-500/30 blur-2xl animate-pulse" />

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
          <motion.p
            key={line}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="text-white font-mono text-sm sm:text-base mt-1.5"
          >
            {line}
          </motion.p>
        ))}
        <p className="text-gray-400 text-[10px] font-mono mt-2.5 tracking-widest">
          {pending > 0 ? `⏳ ${pending} MORE CELEBRATION${pending > 1 ? 'S' : ''} QUEUED • TAP TO DISMISS` : 'TAP TO DISMISS'}
        </p>
      </div>
    </div>
  );
}

/** Single banner — motion child of AnimatePresence so exits are tracked reliably. */
function Banner({ celebration, pending, onDismiss }: { celebration: Celebration; pending: number; onDismiss: () => void }) {
  return (
    <motion.div
      className="fixed top-16 sm:top-20 left-1/2 z-[60] pointer-events-none"
      style={{ x: '-50%' }}
      initial={{ opacity: 0, y: -60, scale: 0.7, rotate: -2 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, y: -40, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 18 }}
      onClick={onDismiss}
    >
      <div className="pointer-events-auto cursor-pointer relative">
        <BannerContent celebration={celebration} pending={pending} />
      </div>
    </motion.div>
  );
}

export default function CelebrationBanner() {
  const celebrations = useGameStore(s => s.celebrations);
  const dismissCelebration = useGameStore(s => s.dismissCelebration);
  const lastPlayed = useRef<Celebration | null>(null);
  const current = celebrations[0];
  const pending = Math.max(celebrations.length - 1, 0);

  // Play the fanfare once per celebration that reaches the front of the queue
  // (ref guards against StrictMode double-fire)
  useEffect(() => {
    if (!current) return;
    if (lastPlayed.current === current) return;
    lastPlayed.current = current;

    if (current.type === 'level') sfx.levelUp();
    else if (current.type === 'rank') sfx.rankUp();
    else sfx.doubleUp();
  }, [current]);

  // Auto-dismiss the front of the queue after 5 seconds
  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(dismissCelebration, 5000);
    return () => clearTimeout(timer);
  }, [current, dismissCelebration]);

  return (
    <>
      <AnimatePresence mode="wait">
        {current && <ConfettiBurstMotion index={current.newXp} />}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        {current && (
          <Banner
            key={`banner-${current.type}-${current.newXp}`}
            celebration={current}
            pending={pending}
            onDismiss={dismissCelebration}
          />
        )}
      </AnimatePresence>
    </>
  );
}