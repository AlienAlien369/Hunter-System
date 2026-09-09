import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { sfx } from '../utils/sounds';
import { todayKey } from '../data/hiddenQuests';
import { getActiveBuffs } from '../utils/xp';

/**
 * Solo Leveling-style System notice banner. Shows:
 *  - a green recovery reward when a rebuilt streak pays back a penalty,
 *  - an amber danger warning when 1 daily-quest day was skipped,
 *  - a red penalty notice when 2+ consecutive days were missed.
 * Fresh penalties / recoveries play their sound exactly once.
 */
export default function PenaltyBanner() {
  const { penalty, recovery, dailyQuests, profile } = useGameStore();
  const [dismissed, setDismissed] = useState(false);
  const lastSound = useRef<string | null>(null);

  // One-time sounds for freshly applied penalties and recovery bonuses.
  useEffect(() => {
    if (penalty?.applied && lastSound.current !== `p:${penalty.message}`) {
      lastSound.current = `p:${penalty.message}`;
      sfx.penalty();
    }
    if (recovery?.applied && lastSound.current !== `r:${recovery.message}`) {
      lastSound.current = `r:${recovery.message}`;
      sfx.recovery();
    }
  }, [penalty, recovery]);

  if (dismissed || (!penalty && !recovery)) return null;

  const today = todayKey();
  const todayDone = dailyQuests
    .filter(q => q.id.startsWith('DQ-'))
    .some(q => q.completedDates.includes(today));

  // Recovery reward — shown first, it's a win. `applied: false` just means
  // the bonus was granted earlier and is being surfaced again this session.
  if (recovery) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className="relative overflow-hidden rounded-xl border border-green-success/50 bg-green-success/10 px-4 py-3 backdrop-blur-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="text-2xl shrink-0">🎉</span>
            <div className="min-w-0">
              <p className="font-display text-sm font-bold tracking-widest uppercase text-green-success">
                Streak recovered
              </p>
              <p className="text-gray-300 text-sm mt-0.5">
                {recovery.message}
              </p>
              <p className="text-gray-500 font-mono text-xs mt-1">
                +{recovery.bonus_xp} XP BONUS · {recovery.streak}-DAY STREAK · KEEP GOING HUNTER
              </p>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 p-1 text-gray-500 hover:text-white transition-colors"
            aria-label="Dismiss recovery notice"
          >
            ✕
          </button>
        </div>
      </motion.div>
    );
  }

  // Penalty notices below (recovering hunters on a fresh penalty still see it).
  if (todayDone && !penalty!.applied) return null;

  const isWarning = !penalty!.applied && penalty!.missed_days === 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className={`relative overflow-hidden rounded-xl border px-4 py-3 backdrop-blur-xl ${
        isWarning
          ? 'border-gold-amber/40 bg-gold-amber/10'
          : 'border-red-danger/50 bg-red-danger/10'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className={`text-2xl shrink-0 ${isWarning ? '' : 'animate-pulse'}`}>
            {isWarning ? '⚠️' : '💀'}
          </span>
          <div className="min-w-0">
            <p className={`font-display text-sm font-bold tracking-widest uppercase ${
              isWarning ? 'text-gold-amber' : 'text-red-danger'
            }`}>
              {isWarning ? 'Danger — penalty imminent' : penalty!.applied ? 'Penalty applied' : 'Penalty active'}
            </p>
            <p className="text-gray-300 text-sm mt-0.5">
              {penalty!.message}
            </p>
            {!isWarning && (
              <p className="text-gray-500 font-mono text-xs mt-1">
                {(() => {
                  const { penaltyReduction } = getActiveBuffs(profile.stats);
                  const reducedXp = Math.round(penalty!.xp_lost * (1 - penaltyReduction));
                  const reducedHp = Math.round(penalty!.hp_lost * (1 - penaltyReduction));
                  const showReduction = penaltyReduction > 0;
                  return (
                    <>MISSED {penalty!.missed_days} DAY{penalty!.missed_days > 1 ? 'S' : ''} · -{reducedXp} XP · -{reducedHp} HP{showReduction && (
                      <span className="text-green-400 ml-1">(🛡️ VIT reduced from -{penalty!.xp_lost} XP)</span>
                    )} · COMPLETE TODAY&apos;S QUESTS TO RECOVER</>
                  );
                })()}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 p-1 text-gray-500 hover:text-white transition-colors"
          aria-label="Dismiss penalty notice"
        >
          ✕
        </button>
      </div>

      {/* Pulsing scanline on the penalty states */}
      {!isWarning && (
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,0,0,0.35) 2px, rgba(255,0,0,0.35) 4px)',
          }}
        />
      )}
    </motion.div>
  );
}