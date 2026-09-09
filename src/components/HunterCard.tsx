import { useGameStore } from '../store/gameStore';
import { motion, useTransform } from 'framer-motion';

interface HunterCardProps {
  level: number;
  xp: number;
  rank: 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
  stats: { str: number; agi: number; vit: number; int: number; sen: number };
  levelProgress: number;
  xpAnimation: boolean;
}

export default function HunterCard({
  level,
  xp,
  rank,
  stats,
  levelProgress,
  xpAnimation,
}: HunterCardProps) {
  const rankColors: Record<'E' | 'D' | 'C' | 'B' | 'A' | 'S', string> = {
    E: 'text-muted',
    D: 'text-blue-info',
    C: 'text-purple-monarch',
    B: 'text-purple-glow',
    A: 'text-gold',
    S: 'text-gold animate-pulse',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="bg-card/80 backdrop-blur-sm rounded-2xl border border-purple-monarch/20 p-6 mb-6"
    >
      {/* Rank Badge */}
      <div className="flex items-center space-x-4 mb-6">
        <div
          className={`w-12 h-12 rounded-full bg-purple-monarch/20 flex items-center justify-center ${rankColors[rank]} font-display text-2xl`}
        >
          {rank}
        </div>
        <div>
          <h2 className="text-xl font-display">{'Hunter'}</h2>
          <p className="text-sm text-muted">Level {level}</p>
        </div>
      </div>

      {/* Stats Panel */}
      <div className="space-y-4">
        <h3 className="text-lg font-display text-purple-monarch mb-4">
          STATS
        </h3>
        <div className="space-y-3">
          {[['STR', stats.str], ['AGI', stats.agi], ['VIT', stats.vit], ['INT', stats.int], ['SEN', stats.sen]].map(
            ([label, value]) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.1 * ['STR', 'AGI', 'VIT', 'INT', 'SEN'].indexOf(label) }}
                className="flex items-center space-x-3"
              >
                <span className="w-10 text-muted font-mono">{label}:</span>
                <span className="flex-1 bg-dungeon/50 rounded-full h-10 flex items-center pl-3">
                  <span className="block h-2 bg-purple-monarch" style={{ width: `${Math.min(value, 20) * 5}%` }}></span>
                  <span className="text-sm text-white font-mono ml-2">{value}</span>
                </span>
              </motion.div>
            )
          )}
        </div>
      </div>

      {/* Level Progress Bar */}
      <div className="mt-6">
        <h3 className="text-lg font-display text-purple-monarch mb-3">
          PROGRESS TO NEXT LEVEL
        </h3>
        <div className="w-full bg-dungeon/50 rounded-full h-4 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-monarch to-purple-glow transition-all duration-1000"
            style={{ width: `${levelProgress * 100}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-sm text-muted mt-1">
          <span>{Math.floor((level - 1) * 1000)} / {level * 1000} XP</span>
          <span>{Math.floor(levelProgress * 100)}%</span>
        </div>
      </div>

      {/* XP Gain Animation Trigger */}
      {xpAnimation && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0.5, 1.2, 1], opacity: [0, 1, 0] }}
          transition={{ duration: 1.2 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div className="text-gold font-display text-5xl">+{Math.floor(
            (levelProgress - 0.01) * 1000
          )} XP</div>
        </motion.div>
      )}
    </motion.div>
  );
}