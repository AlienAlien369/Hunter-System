import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { calculateLevel, calculateRank, getNextLevelXP } from '../utils/xp';

const RANK_COLORS: Record<string, string> = {
  E: '#8A92B2',
  D: '#3498DB',
  C: '#5D26C1',
  B: '#8E2DE2',
  A: '#F1C40F',
  S: '#F1C40F',
};

export default function StatusWindow() {
  const { profile } = useGameStore();
  const { level, xp, rank, name, stats, hp, mp } = profile;
  const nextLevelXP = getNextLevelXP(level);
  const currentLevelXP = (level - 1) * 1000;
  const progressToNext = ((xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-[#0d1117]/90 backdrop-blur-xl rounded-xl border border-purple-500/30 overflow-hidden"
    >
      {/* Status Window Header */}
      <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 px-6 py-4 border-b border-purple-500/20">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-white font-bold tracking-[0.3em] text-sm">
            STATUS
          </h2>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-green-400 font-mono">ONLINE</span>
          </div>
        </div>
      </div>

      {/* Hunter Info */}
      <div className="p-6">
        {/* Rank Badge */}
        <div className="flex items-center space-x-4 mb-6">
          <motion.div
            className="w-20 h-20 rounded-full flex items-center justify-center border-4 relative"
            style={{
              borderColor: RANK_COLORS[rank],
              boxShadow: `0 0 30px ${RANK_COLORS[rank]}40`,
            }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          >
            <span
              className="text-3xl font-display font-bold"
              style={{ color: RANK_COLORS[rank] }}
            >
              {rank}
            </span>
            {/* Glow effect */}
            <div
              className="absolute inset-0 rounded-full opacity-20"
              style={{
                background: `radial-gradient(circle, ${RANK_COLORS[rank]} 0%, transparent 70%)`,
              }}
            />
          </motion.div>

          <div className="flex-1">
            <h3 className="font-display text-white font-bold text-lg">{name}</h3>
            <p className="text-gray-400 font-mono text-sm">Level {level} Hunter</p>
            <div className="mt-2">
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-gray-500">XP</span>
                <span className="text-purple-400">{xp} / {nextLevelXP}</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressToNext}%` }}
                  transition={{ duration: 1, delay: 0.3 }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* HP & MP Bars */}
        <div className="space-y-3 mb-6">
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-red-400">HP</span>
              <span className="text-red-300">{hp}/100</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-red-600 to-red-400"
                initial={{ width: `${hp}%` }}
                animate={{ width: `${hp}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-blue-400">MP</span>
              <span className="text-blue-300">{mp}/100</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-600 to-blue-400"
                initial={{ width: `${mp}%` }}
                animate={{ width: `${mp}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stats Panel */}
        <div className="space-y-2">
          <h4 className="font-mono text-xs text-gray-500 uppercase tracking-wider mb-3">
            Attributes
          </h4>
          {([
            { label: 'STR', value: stats.str, color: 'text-red-400' },
            { label: 'AGI', value: stats.agi, color: 'text-green-400' },
            { label: 'VIT', value: stats.vit, color: 'text-yellow-400' },
            { label: 'INT', value: stats.int, color: 'text-blue-400' },
            { label: 'SEN', value: stats.sen, color: 'text-purple-400' },
          ] as const).map((stat) => (
            <div key={stat.label} className="flex items-center space-x-3">
              <span className={`font-mono text-xs w-8 ${stat.color}`}>{stat.label}</span>
              <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-current"
                  style={{ color: stat.color.replace('text-', '') }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(stat.value / 100) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.1 }}
                />
              </div>
              <span className="font-mono text-xs text-gray-400 w-6 text-right">{stat.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scanline Effect */}
      <div
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
        }}
      />
    </motion.div>
  );
}
