import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';

export default function StatSheet() {
  const { profile, updateProfile } = useGameStore();
  const { str, agi, vit, int, sen } = profile.stats;

  const stats = [
    { key: 'str' as const, label: 'Strength', value: str, icon: '💪', color: 'from-red-500 to-orange-500' },
    { key: 'agi' as const, label: 'Agility', value: agi, icon: '⚡', color: 'from-yellow-500 to-green-500' },
    { key: 'vit' as const, label: 'Vitality', value: vit, icon: '❤️', color: 'from-green-500 to-teal-500' },
    { key: 'int' as const, label: 'Intelligence', value: int, icon: '🧠', color: 'from-blue-500 to-purple-500' },
    { key: 'sen' as const, label: 'Sense', value: sen, icon: '👁️', color: 'from-purple-500 to-pink-500' },
  ];

  const handleStatChange = (key: keyof typeof profile.stats, delta: number) => {
    const newValue = Math.max(1, Math.min(100, profile.stats[key] + delta));
    updateProfile({ stats: { ...profile.stats, [key]: newValue } });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-display text-white font-bold tracking-wider">
          STAT SHEET
        </h1>
        <p className="text-gray-400 mt-1 font-mono text-sm">
          Character Attributes • Level {profile.level}
        </p>
      </motion.div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.key}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-[#0d1117]/80 backdrop-blur-sm rounded-xl border border-purple-500/20 p-6"
          >
            {/* Stat Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{stat.icon}</span>
                <div>
                  <h3 className="font-display text-white font-bold">{stat.label}</h3>
                  <p className="text-xs text-gray-500 font-mono">{stat.key.toUpperCase()}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-display text-white font-bold">{stat.value}</p>
                <p className="text-xs text-gray-500 font-mono">POINTS</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full bg-gradient-to-r ${stat.color}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${(stat.value / 100) * 100}%` }}
                  transition={{ duration: 0.8, delay: index * 0.1 }}
                />
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => handleStatChange(stat.key, -1)}
                className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              >
                -
              </button>
              <span className="text-gray-500 font-mono text-sm">Click to adjust</span>
              <button
                onClick={() => handleStatChange(stat.key, 1)}
                className="w-8 h-8 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 hover:text-purple-300 transition-colors"
              >
                +
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* HP & MP Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-[#0d1117]/80 backdrop-blur-sm rounded-xl border border-red-500/20 p-6"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-display text-red-400 font-bold">HP</span>
            <span className="font-mono text-red-400">{profile.hp}/100</span>
          </div>
          <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-red-600 to-red-400"
              initial={{ width: 0 }}
              animate={{ width: `${profile.hp}%` }}
              transition={{ duration: 1 }}
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-[#0d1117]/80 backdrop-blur-sm rounded-xl border border-blue-500/20 p-6"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-display text-blue-400 font-bold">MP</span>
            <span className="font-mono text-blue-400">{profile.mp}/100</span>
          </div>
          <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-600 to-blue-400"
              initial={{ width: 0 }}
              animate={{ width: `${profile.mp}%` }}
              transition={{ duration: 1 }}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
