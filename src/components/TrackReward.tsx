import { LEVEL_XP, calculateLevel, calculateRank } from '../utils/xp';

interface TrackRewardProps {
  /** Every quest in the track, with its XP and whether it's done. */
  quests: { xpReward: number; done: boolean }[];
  /** Current total XP of the player (used to project level/rank). */
  currentXp: number;
  accentClass?: string;
  chipClass?: string;
  label?: string;
}

/**
 * Reward preview for a track section — shows the total XP on offer, how much
 * is still unearned, and which level/rank completing the rest would reach.
 */
export default function TrackReward({
  quests,
  currentXp,
  accentClass = 'text-gold',
  chipClass = 'border-gold/20 bg-gold/5',
  label,
}: TrackRewardProps) {
  if (quests.length === 0) return null;

  const totalXp = quests.reduce((sum, q) => sum + q.xpReward, 0);
  const earnedXp = quests.filter(q => q.done).reduce((sum, q) => sum + q.xpReward, 0);
  const remainingXp = totalXp - earnedXp;

  if (remainingXp <= 0) {
    return (
      <div className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-xs px-3 py-2 rounded-lg border ${chipClass}`}>
        <span className={`font-bold ${accentClass}`}>{label ?? `⚡ ${totalXp} XP TOTAL`}</span>
        <span className="text-gray-500">·</span>
        <span className="text-green-400">ALL XP EARNED ✓</span>
      </div>
    );
  }

  const projectedXp = currentXp + remainingXp;
  const projectedLevel = calculateLevel(projectedXp);
  const projectedRank = calculateRank(projectedXp);
  const levelGain = calculateLevel(projectedXp) - calculateLevel(currentXp);
  const gainLabel = levelGain > 0
    ? `+${levelGain} LVL${levelGain > 1 ? 'S' : ''}`
    : `+${(remainingXp / LEVEL_XP).toFixed(1)} LVL`;

  return (
    <div className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-xs px-3 py-2 rounded-lg border ${chipClass}`}>
      <span className={`font-bold ${accentClass}`}>{label ?? `⚡ ${totalXp} XP TOTAL`}</span>
      <span className="text-gray-500">·</span>
      <span className="text-gray-400">{remainingXp} XP REMAINING</span>
      <span className="text-gray-500">·</span>
      <span className="text-gray-400">
        LEVEL <span className={`font-bold ${accentClass}`}>{projectedLevel}</span>{' '}
        <span className="text-green-400">{gainLabel}</span>
      </span>
      <span className="text-gray-500">·</span>
      <span className={`font-bold ${accentClass}`}>{projectedRank}-RANK</span>
    </div>
  );
}