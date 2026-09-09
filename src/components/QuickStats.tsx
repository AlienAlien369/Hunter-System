import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { getStreak } from '../utils/xp';

export default function QuickStats() {
  const { dailyQuests } = useGameStore();
  const today = new Date().toISOString().split('T')[0];

  const todayQuests = dailyQuests.map(q => ({
    ...q,
    completedToday: q.completedDates.includes(today),
  }));

  const completedToday = todayQuests.filter(q => q.completedToday).length;
  const totalToday = todayQuests.length;
  const streak = getStreak(todayQuests[0]?.completedDates || []);

  const stats = [
    { label: 'Quests Today', value: `${completedToday}/${totalToday}`, icon: '✅', color: 'from-green-500 to-emerald-500' },
    { label: 'Daily Streak', value: `${streak} days`, icon: '🔥', color: 'from-orange-500 to-red-500' },
    { label: 'XP Earned', value: todayQuests.filter(q => q.completedToday).reduce((s, q) => s + q.xpReward, 0), icon: '⚡', color: 'from-purple-500 to-blue-500' },
    { label: 'Completion Rate', value: totalToday > 0 ? `${Math.round((completedToday / totalToday) * 100)}%` : '0%', icon: '📊', color: 'from-blue-500 to-cyan-500' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0d1117]/90 backdrop-blur-xl rounded-xl border border-purple-500/30 p-6"
    >
      <h3 className="font-display text-white font-bold tracking-[0.3em] text-sm mb-4">
        QUICK STATS
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="bg-gray-900/50 rounded-lg p-4 border border-gray-800"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{stat.icon}</span>
            </div>
            <p className={`text-2xl font-display font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
              {stat.value}
            </p>
            <p className="text-xs text-gray-500 font-mono mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
