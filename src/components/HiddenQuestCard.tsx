import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { todayKey } from '../data/hiddenQuests';

/** Milliseconds until the next UTC midnight — the app's daily reset boundary. */
function msUntilUtcMidnight(): number {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
  return Math.max(0, next - now.getTime());
}

/** Formats a millisecond duration as HH:MM:SS (or H:MM:SS under an hour stays padded). */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const TIER_COLORS: Record<number, string> = {
  1: 'text-green-400 border-green-400/30 bg-green-400/10',
  2: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
  3: 'text-purple-300 border-purple-400/30 bg-purple-400/10',
  4: 'text-gold border-gold/30 bg-gold/10',
  5: 'text-red-danger border-red-danger/40 bg-red-danger/10',
};

/**
 * Solo Leveling-style HIDDEN QUEST — a random daily challenge picked from the
 * server's 200+ tiered pool and scaled to the hunter's level. It must be
 * completed the same day. It appears as "???" until the hunter accepts it.
 */
export default function HiddenQuestCard() {
  const { hiddenQuest, revealHiddenQuest, completeQuest } = useGameStore();
  const today = todayKey();

  const hq = hiddenQuest && hiddenQuest.date === today ? hiddenQuest : null;
  const completed = !!hq?.completedToday;
  const revealed = hq ? hq.revealed : false;

  // Live countdown to midnight — ticks every second so the hunter always
  // knows how much time is left to clear the hidden quest.
  const [timeLeft, setTimeLeft] = useState(msUntilUtcMidnight);
  useEffect(() => {
    const id = window.setInterval(() => setTimeLeft(msUntilUtcMidnight()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const expiringSoon = timeLeft < 60 * 60 * 1000; // last hour

  if (!hq) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl border border-purple-500/20 p-5 sm:p-6 bg-[#0d1117]/90 backdrop-blur-xl"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-sm font-bold animate-pulse">!</span>
          <span className="font-display text-xs tracking-[0.3em] text-purple-300 uppercase">Hidden Quest</span>
        </div>
        <h3 className="font-display text-xl sm:text-2xl font-bold text-gray-500 tracking-widest">
          ??? — ???????
        </h3>
        <p className="text-gray-500 text-sm mt-1">
          The System is offline. Reconnect to reveal today&apos;s hidden challenge.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`
        relative overflow-hidden rounded-2xl border p-5 sm:p-6
        bg-gradient-to-r from-[#1a0b2e]/95 via-[#12121f]/95 to-[#0b1a3a]/95 backdrop-blur-xl
        ${completed
          ? 'border-gold/50 glow-gold'
          : revealed
            ? 'border-purple-500/40'
            : 'border-purple-500/50 animate-pulse-glow'}
      `}
    >
      {/* Scanline texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.06) 2px, rgba(255,255,255,0.06) 4px)',
        }}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${completed ? 'bg-gold/20 text-gold' : 'bg-purple-500/30 text-purple-300 animate-pulse'}`}>
              {completed ? '✓' : '!'}
            </span>
            <span className="font-display text-xs tracking-[0.3em] text-purple-300 uppercase">
              Hidden Quest
            </span>
            <span className="text-[10px] font-mono text-gray-500 border border-purple-500/20 rounded px-1.5 py-0.5 uppercase">
              Today only
            </span>
            <span className={`text-[10px] font-mono uppercase tracking-wider border rounded px-1.5 py-0.5 ${TIER_COLORS[hq.tierIndex] || TIER_COLORS[1]}`}>
              Tier {hq.tierIndex} · {hq.tierName}
            </span>
          </div>

          {!revealed && !completed ? (
            <>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-purple-200 tracking-widest">
                ??? — ??????
              </h3>
              <p className="text-gray-400 text-sm mt-1">
                The System has detected a {hq.tierName.toLowerCase()}-tier hidden challenge. Accept it to reveal today&apos;s secret quest.
              </p>
              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <button
                  onClick={revealHiddenQuest}
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-display font-bold text-sm tracking-wider transition-all shadow-lg shadow-purple-500/25"
                >
                  ACCEPT CHALLENGE
                </button>
                <span className="text-gold font-mono text-sm">+{hq.xpReward} XP</span>
                <span className="text-[10px] font-mono text-gray-500">×{hq.multiplier} level bonus</span>
              </div>
            </>
          ) : completed ? (
            <>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-gold tracking-widest">
                {hq.icon} HIDDEN QUEST COMPLETE
              </h3>
              <p className="text-gray-300 text-sm mt-1">
                {hq.title} — cleared. The System acknowledges your strength.
              </p>
              <div className="mt-3 inline-flex items-center gap-2 bg-gold/10 border border-gold/30 rounded-lg px-3 py-1.5">
                <span className="font-mono text-gold text-sm font-bold">+{hq.xpReward} XP</span>
                <span className="text-[10px] text-gold/70 font-mono uppercase">Reward claimed</span>
              </div>
            </>
          ) : (
            <>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-widest">
                {hq.icon} {hq.title}
              </h3>
              <p className="text-gray-300 text-sm mt-1 max-w-xl">
                {hq.description}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => completeQuest(hq.questId, today)}
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-display font-bold text-sm tracking-wider transition-all shadow-lg shadow-purple-500/25"
                >
                  COMPLETE QUEST
                </button>
                <span className="text-gold font-mono text-sm font-bold">+{hq.xpReward} XP</span>
                <span className="text-xs font-mono text-gray-500">
                  {'★'.repeat(hq.difficulty)}{'☆'.repeat(3 - hq.difficulty)} difficulty
                </span>
              </div>
            </>
          )}
        </div>

        {/* Live countdown to midnight */}
        <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
          <span
            className={`font-mono text-lg tabular-nums tracking-wider ${
              expiringSoon ? 'text-red-danger animate-pulse' : completed ? 'text-gold/80' : 'text-purple-300/90'
            }`}
            title="Time left to complete today's hidden quest"
          >
            ⏳ {formatCountdown(timeLeft)}
          </span>
          <span className={`text-[10px] font-mono uppercase tracking-wider ${expiringSoon ? 'text-red-danger/80' : 'text-gray-500'}`}>
            {expiringSoon ? 'Expires soon!' : 'Until reset'}
          </span>
          <span className="text-xl">{completed ? '🏆' : revealed ? hq.icon : '🔒'}</span>
        </div>
      </div>
    </motion.div>
  );
}