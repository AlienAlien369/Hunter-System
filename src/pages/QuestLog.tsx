import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import QuestCard from '../components/QuestCard';

export default function QuestLog() {
  const { dailyQuests, completeQuest } = useGameStore();
  const today = new Date().toISOString().split('T')[0];

  const todaysQuests = dailyQuests.map(quest => ({
    ...quest,
    completedToday: quest.completedDates.includes(today),
  }));

  const todaysXP = todaysQuests.reduce((total, quest) =>
    total + (quest.completedToday ? quest.xpReward : 0), 0);

  const todaysCompleted = todaysQuests.filter(q => q.completedToday).length;
  const progress = todaysQuests.length > 0 ? (todaysCompleted / todaysQuests.length) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-display text-white font-bold tracking-wider">
            QUEST LOG
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">
            Daily challenges • {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Stats Card */}
        <div className="flex items-center space-x-4 bg-[#0d1117]/80 backdrop-blur-sm rounded-lg p-4 border border-purple-500/20">
          <div className="text-center">
            <p className="text-2xl font-display text-gold">{todaysCompleted}</p>
            <p className="text-xs text-gray-500 font-mono">COMPLETED</p>
          </div>
          <div className="w-px h-8 bg-purple-500/20" />
          <div className="text-center">
            <p className="text-2xl font-display text-purple-400">{todaysXP}</p>
            <p className="text-xs text-gray-500 font-mono">XP EARNED</p>
          </div>
          <div className="w-px h-8 bg-purple-500/20" />
          <div className="text-center">
            <p className="text-2xl font-display text-blue-400">{todaysQuests.length - todaysCompleted}</p>
            <p className="text-xs text-gray-500 font-mono">REMAINING</p>
          </div>
        </div>
      </motion.div>

      {/* Progress Bar */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        className="h-1 bg-gray-800 rounded-full overflow-hidden"
      >
        <motion.div
          className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </motion.div>

      {/* Quest Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {todaysQuests.map((quest, index) => (
          <motion.div
            key={quest.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <QuestCard
              quest={quest}
              onComplete={() => completeQuest(quest.id, today)}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
