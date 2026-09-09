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

const RANK_COLORS: Record<string, string> = {
  E: '#8A92B2',
  D: '#3498DB',
  C: '#5D26C1',
  B: '#8E2DE2',
  A: '#F1C40F',
  S: '#F1C40F',
};

const CONFETTI_COLORS = ['#F1C40F', '#8E2DE2', '#3b82f6', '#ffffff', '#a855f7', '#2ECC71'];

function ConfettiBurst({ heavy = false }: { heavy?: boolean }) {
  const count = heavy ? 64 : 22;
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: `${(i * 47 + 11) % 100}%`,
        delay: `${(i % 11) * (heavy ? 0.07 : 0.12)}s`,
        duration: `${1.1 + (i % 7) * (heavy ? 0.22 : 0.16)}s`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: heavy ? 6 + (i % 5) * 3 : 5 + (i % 4) * 2,
      })),
    [count, heavy],
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
function ConfettiBurstMotion({ index, heavy }: { index: number; heavy?: boolean }) {
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
      <ConfettiBurst heavy={heavy} />
    </motion.div>
  );
}

function celebrationTitle(celebration: Celebration): string {
  if (celebration.type === 'both') return '⚡ DOUBLE UP! ⚡';
  if (celebration.type === 'level') return '⚡ LEVEL UP!';
  return `🏆 RANK UP! ${RANK_ICONS[celebration.rank] || '🏆'}`;
}

function celebrationLines(celebration: Celebration): string[] {
  const lines: string[] = [];
  if (celebration.type !== 'rank') lines.push(`You reached Level ${celebration.level}`);
  if (celebration.type !== 'level') {
    lines.push(`${celebration.rank}-Rank unlocked — ${RANK_NAMES[celebration.rank] || celebration.rank}`);
  }
  return lines;
}

function pendingLabel(pending: number, action = 'TAP TO DISMISS'): string {
  return pending > 0
    ? `⏳ ${pending} MORE CELEBRATION${pending > 1 ? 'S' : ''} QUEUED • ${action}`
    : action;
}

/* ---------------- Compact banner (small milestones) ---------------- */

function BannerContent({ celebration, pending }: { celebration: Celebration; pending: number }) {
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
          {celebrationTitle(celebration)}
        </p>
        {celebrationLines(celebration).map(line => (
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
          {pendingLabel(pending)}
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

/* ---------------- Full-screen overlay (big milestones) ---------------- */

/** Radial burst flying out from the center of the screen. */
function RadialBurst({ color }: { color: string }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const angle = (i / 14) * Math.PI * 2;
        const dist = 40 + (i % 5) * 14;
        return {
          angle,
          dist,
          delay: `${(i % 7) * 0.05}s`,
        };
      }),
    [],
  );

  return (
    <div className="absolute left-1/2 top-1/2" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute w-3 h-3 rounded-full animate-burst-out"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}`,
            animationDelay: p.delay,
            ['--bx' as string]: `${Math.cos(p.angle) * p.dist}vh`,
            ['--by' as string]: `${Math.sin(p.angle) * p.dist}vh`,
          }}
        />
      ))}
    </div>
  );
}

function BigCelebrationOverlay({ celebration, pending, onDismiss }: { celebration: Celebration; pending: number; onDismiss: () => void }) {
  const isRank = celebration.type !== 'level';
  const rankColor = RANK_COLORS[celebration.rank] || '#F1C40F';
  const emblem = isRank ? celebration.rank : String(celebration.level);

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center cursor-pointer overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onDismiss}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />

      {/* Golden flash */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(241,196,15,0.35),_transparent_60%)] animate-flash-out" />

      {/* Rotating god-rays */}
      <div
        className="absolute inset-[-35%] opacity-30 animate-spin-slow"
        style={{
          background:
            'conic-gradient(from 0deg, transparent 0deg, rgba(241,196,15,0.55) 16deg, transparent 38deg, transparent 68deg, rgba(142,45,226,0.55) 92deg, transparent 118deg, transparent 148deg, rgba(59,130,246,0.45) 172deg, transparent 198deg, transparent 228deg, rgba(241,196,15,0.45) 252deg, transparent 278deg, transparent 308deg, rgba(142,45,226,0.45) 332deg, transparent 360deg)',
        }}
      />

      {/* Radial burst from center */}
      <RadialBurst color={rankColor} />

      {/* Center content */}
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.15, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 170, damping: 15 }}
        className="relative text-center px-6"
      >
        {/* Emblem */}
        <motion.div
          className="relative mx-auto w-44 h-44 sm:w-60 sm:h-60 rounded-full flex items-center justify-center bg-black/40"
          style={{
            border: `4px solid ${rankColor}`,
            boxShadow: `0 0 70px ${rankColor}66, inset 0 0 50px ${rankColor}33`,
          }}
          animate={{ scale: [1, 1.07, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span
            className="font-display font-bold text-8xl sm:text-9xl"
            style={{ color: rankColor, textShadow: `0 0 40px ${rankColor}` }}
          >
            {emblem}
          </span>
        </motion.div>

        <h1
          className="mt-7 font-display text-4xl sm:text-6xl font-bold tracking-wider text-gold"
          style={{ textShadow: '0 0 24px rgba(241,196,15,0.8)' }}
        >
          {celebrationTitle(celebration)}
        </h1>

        {celebrationLines(celebration).map(line => (
          <motion.p
            key={line}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-white font-mono text-base sm:text-xl mt-3"
          >
            {line}
          </motion.p>
        ))}

        <p className="mt-6 text-gray-400 text-xs font-mono tracking-widest">
          {pendingLabel(pending, 'TAP TO CONTINUE')}
        </p>
      </motion.div>
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
        {current && <ConfettiBurstMotion index={current.newXp} heavy={current.big} />}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        {current &&
          (current.big ? (
            <BigCelebrationOverlay
              key={`big-${current.type}-${current.newXp}`}
              celebration={current}
              pending={pending}
              onDismiss={dismissCelebration}
            />
          ) : (
            <Banner
              key={`banner-${current.type}-${current.newXp}`}
              celebration={current}
              pending={pending}
              onDismiss={dismissCelebration}
            />
          ))}
      </AnimatePresence>
    </>
  );
}