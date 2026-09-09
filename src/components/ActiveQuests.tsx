import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import QuestCard from './QuestCard';

export default function ActiveQuests() {
  const { dailyQuests, completeQuest } = useGameStore();
  const today = new Date().toISOString().split('T')[0];

  const todaysQuests = dailyQuests
    .filter(quest => quest.id.startsWith('DQ-')) // permanent tracks (LC/SS/AR) are not daily quests
    .map(quest => ({
      ...quest,
      completedToday: quest.completedDates.includes(today),
    }));

  const completedCount = todaysQuests.filter(q => q.completedToday).length;
  const pendingCount = todaysQuests.length - completedCount;
  const totalXP = todaysQuests.reduce((sum, q) => sum + q.xpReward, 0);
  const earnedXP = todaysQuests.filter(q => q.completedToday).reduce((sum, q) => sum + q.xpReward, 0);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-[#0d1117]/90 backdrop-blur-xl rounded-xl border border-purple-500/30"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 px-6 py-4 border-b border-purple-500/20">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-white font-bold tracking-[0.3em] text-sm">
            ACTIVE QUESTS
          </h2>
          <div className="flex items-center space-x-4 text-xs font-mono">
            <span className="text-green-400">{completedCount} ✓</span>
            <span className="text-gray-500">|</span>
            <span className="text-yellow-400">{pendingCount} pending</span>
            <span className="text-gray-500">|</span>
            <span className="text-purple-400">{earnedXP}/{totalXP} XP</span>
          </div>
        </div>
      </div>

      {/* Quest List */}
      <div className="p-4 space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
        {todaysQuests.map((quest, index) => (
          <motion.div
            key={quest.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <QuestCard
              quest={quest}
              onComplete={() => completeQuest(quest.id, today)}
              showXP={false}
            />
          </motion.div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-purple-500/10">
        <div className="flex items-center justify-between text-xs font-mono text-gray-500">
          <span>Daily Quest Board</span>
          <span>{Math.round((completedCount / todaysQuests.length) * 100)}% Complete</span>
        </div>
        <div className="mt-2 h-1 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
            initial={{ width: 0 }}
            animate={{ width: `${(completedCount / todaysQuests.length) * 100}%` }}
            transition={{ duration: 0.8 }}
          />
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
