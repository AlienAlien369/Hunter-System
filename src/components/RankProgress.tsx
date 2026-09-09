import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { calculateRank } from '../utils/xp';

const RANKS = [
  { rank: 'E', minXP: 0, color: '#8A92B2', label: 'Novice' },
  { rank: 'D', minXP: 350, color: '#3498DB', label: 'Apprentice' },
  { rank: 'C', minXP: 700, color: '#5D26C1', label: 'Journeyman' },
  { rank: 'B', minXP: 1050, color: '#8E2DE2', label: 'Expert' },
  { rank: 'A', minXP: 1400, color: '#F1C40F', label: 'Master' },
  { rank: 'S', minXP: 1750, color: '#F1C40F', label: 'Legend' },
];

export default function RankProgress() {
  const { profile } = useGameStore();
  const currentRank = calculateRank(profile.xp);
  const currentRankIndex = RANKS.findIndex(r => r.rank === currentRank);
  const currentRankData = RANKS[currentRankIndex];
  const nextRankData = RANKS[currentRankIndex + 1];

  const progress = nextRankData
    ? ((profile.xp - currentRankData.minXP) / (nextRankData.minXP - currentRankData.minXP)) * 100
    : 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-[#0d1117]/90 backdrop-blur-xl rounded-xl border border-purple-500/30 p-6"
    >
      <h3 className="font-display text-white font-bold tracking-[0.3em] text-sm mb-4">
        RANK PROGRESSION
      </h3>

      {/* Current Rank Display */}
      <div className="flex items-center space-x-4 mb-6">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center border-4"
          style={{
            borderColor: currentRankData.color,
            boxShadow: `0 0 20px ${currentRankData.color}40`,
          }}
        >
          <span
            className="text-2xl font-display font-bold"
            style={{ color: currentRankData.color }}
          >
            {currentRank}
          </span>
        </div>
        <div>
          <p className="text-white font-display font-bold">{currentRankData.label}</p>
          <p className="text-gray-500 font-mono text-xs">
            {profile.xp} XP • Level {profile.level}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      {nextRankData && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-gray-500">Progress to {nextRankData.rank}</span>
            <span className="text-gray-400">{nextRankData.minXP - profile.xp} XP needed</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: currentRankData.color }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
        </div>
      )}

      {/* Rank Path */}
      <div className="mt-6 flex items-center justify-between">
        {RANKS.map((rank, index) => {
          const isCompleted = profile.xp >= rank.minXP;
          const isCurrent = rank.rank === currentRank;
          const isNext = index === currentRankIndex + 1;

          return (
            <div key={rank.rank} className="flex items-center">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-display font-bold
                  ${isCompleted ? 'border-2' : 'border border-gray-700 bg-gray-800/50'}
                `}
                style={isCompleted ? { borderColor: rank.color, color: rank.color } : {}}
              >
                {rank.rank}
              </div>
              {index < RANKS.length - 1 && (
                <div className="w-4 h-0.5 bg-gray-700" />
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
