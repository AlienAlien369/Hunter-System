import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { RANK_THRESHOLDS } from '../utils/xp';

const RANK_STYLES: Record<string, { name: string; color: string; glow: string }> = {
  E: { name: 'E-Rank', color: '#8A92B2', glow: 'shadow-gray-500/20' },
  D: { name: 'D-Rank', color: '#3498DB', glow: 'shadow-blue-500/20' },
  C: { name: 'C-Rank', color: '#5D26C1', glow: 'shadow-purple-500/20' },
  B: { name: 'B-Rank', color: '#8E2DE2', glow: 'shadow-purple-400/20' },
  A: { name: 'A-Rank', color: '#F1C40F', glow: 'shadow-gold/20' },
  S: { name: 'S-Rank', color: '#F1C40F', glow: 'shadow-gold/40' },
};

const RANKS = RANK_THRESHOLDS.map(t => ({ rank: t.rank, minXP: t.minXP, ...RANK_STYLES[t.rank] }));

export default function Rank() {
  const { profile } = useGameStore();
  const currentRankIndex = RANKS.findIndex(r => profile.xp >= r.minXP && profile.xp < (RANKS[RANKS.indexOf(r) + 1]?.minXP || Infinity));
  const currentRank = RANKS[currentRankIndex] || RANKS[0];
  const nextRank = RANKS[currentRankIndex + 1];

  const progress = nextRank
    ? ((profile.xp - currentRank.minXP) / (nextRank.minXP - currentRank.minXP)) * 100
    : 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-display text-white font-bold tracking-wider">
          RANK PROGRESSION
        </h1>
        <p className="text-gray-400 mt-1 font-mono text-sm">
          Your journey to becoming an S-Rank Hunter — 25,000 XP, no shortcuts
        </p>
      </motion.div>

      {/* Current Rank Display */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
        className="flex justify-center"
      >
        <div
          className={`
            relative w-48 h-48 rounded-full flex items-center justify-center
            bg-gradient-to-br from-gray-900 to-gray-800 border-4
            ${currentRank.rank === 'S' ? 'border-gold shadow-2xl shadow-gold/30' : 'border-purple-500/30'}
          `}
        >
          {/* Glow Effect */}
          <div
            className="absolute inset-0 rounded-full opacity-20"
            style={{
              background: `radial-gradient(circle, ${currentRank.color} 0%, transparent 70%)`,
            }}
          />

          {/* Rank Letter */}
          <span
            className="text-7xl font-display font-bold"
            style={{ color: currentRank.color }}
          >
            {currentRank.rank}
          </span>

          {/* Rank Name */}
          <div className="absolute bottom-8 text-center">
            <p className="text-xs font-mono text-gray-400">{currentRank.name}</p>
          </div>
        </div>
      </motion.div>

      {/* XP Progress */}
      <div className="max-w-md mx-auto space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400 font-mono">
            {profile.xp.toLocaleString()} XP
          </span>
          <span className="text-gray-500 font-mono">
            {nextRank ? `→ ${nextRank.minXP.toLocaleString()} XP` : 'MAX'}
          </span>
        </div>
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
        {nextRank && (
          <p className="text-center text-xs text-gray-500 font-mono">
            {(nextRank.minXP - profile.xp).toLocaleString()} XP to next rank
          </p>
        )}
      </div>

      {/* Rank Progression Chart */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-[#0d1117]/80 backdrop-blur-sm rounded-xl border border-purple-500/20 p-6">
          <h2 className="font-display text-white font-bold mb-6 tracking-wider">RANK PROGRESSION PATH</h2>
          <div className="space-y-4">
            {RANKS.map((rank, index) => {
              const isCurrent = index === currentRankIndex;
              const isUnlocked = profile.xp >= rank.minXP;
              const isNext = index === currentRankIndex + 1;

              return (
                <motion.div
                  key={rank.rank}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`
                    flex items-center space-x-4 p-4 rounded-lg border
                    ${isCurrent
                      ? 'border-purple-500/50 bg-purple-500/10'
                      : isUnlocked
                        ? 'border-gray-700/50 bg-gray-800/30'
                        : 'border-gray-800/30 bg-gray-900/30 opacity-50'
                    }
                  `}
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center font-display font-bold text-xl"
                    style={{
                      backgroundColor: isUnlocked ? `${rank.color}20` : 'transparent',
                      borderColor: rank.color,
                      borderWidth: isUnlocked ? '2px' : '1px',
                      borderStyle: 'solid',
                      color: isUnlocked ? rank.color : '#4B5563',
                    }}
                  >
                    {rank.rank}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className={`font-display font-bold ${isCurrent ? 'text-white' : isUnlocked ? 'text-gray-300' : 'text-gray-600'}`}>
                        {rank.name}
                      </span>
                      {isCurrent && (
                        <span className="px-2 py-0.5 text-xs font-mono bg-purple-500/20 text-purple-400 rounded">
                          CURRENT
                        </span>
                      )}
                      {isUnlocked && !isCurrent && (
                        <span className="px-2 py-0.5 text-xs font-mono bg-green-500/20 text-green-400 rounded">
                          UNLOCKED
                        </span>
                      )}
                    </div>
                    <div className="mt-1">
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: isUnlocked ? '100%' : '0%',
                            backgroundColor: rank.color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono text-gray-400">{rank.minXP.toLocaleString()} XP</p>
                    {isNext && (
                      <p className="text-xs font-mono text-purple-400 mt-1">
                        {(rank.minXP - profile.xp).toLocaleString()} to go
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
