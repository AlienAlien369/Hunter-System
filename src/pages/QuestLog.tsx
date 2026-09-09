import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import QuestCard from '../components/QuestCard';

export default function QuestLog() {
  const { dailyQuests, completeQuest, redoDSAQuest } = useGameStore();
  const today = new Date().toISOString().split('T')[0];

  const dailyQuestsList = dailyQuests
    .filter(q => !q.id.startsWith('LC-'))
    .map(quest => ({
      ...quest,
      completedToday: quest.completedDates.includes(today),
    }));

  const dsaQuests = dailyQuests
    .filter(q => q.id.startsWith('LC-'))
    .map(quest => ({
      ...quest,
      // DSA marks are permanent: done = any completion ever
      completedToday: quest.completedDates.length > 0,
    }));

  const todaysXP = dailyQuestsList.reduce((total, quest) =>
    total + (quest.completedToday ? quest.xpReward : 0), 0);

  const todaysCompleted = dailyQuestsList.filter(q => q.completedToday).length;
  const dailyProgress = dailyQuestsList.length > 0 ? (todaysCompleted / dailyQuestsList.length) * 100 : 0;

  const dsaCompleted = dsaQuests.filter(q => q.completedToday).length;
  const dsaProgress = dsaQuests.length > 0 ? (dsaCompleted / dsaQuests.length) * 100 : 0;
  const dsaAllDone = dsaQuests.length > 0 && dsaCompleted === dsaQuests.length;

  const handleRedoAll = () => {
    if (window.confirm('Reset ALL DSA problems to start from the beginning?\n\nYour XP and level will stay the same.')) {
      redoDSAQuest();
    }
  };

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

        {/* Stats Card (daily quests only) */}
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
            <p className="text-2xl font-display text-blue-400">{dailyQuestsList.length - todaysCompleted}</p>
            <p className="text-xs text-gray-500 font-mono">REMAINING</p>
          </div>
        </div>
      </motion.div>

      {/* Daily Quest Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display text-purple-400 font-bold tracking-wider">
            DAILY QUESTS
          </h2>
          <span className="text-xs text-gray-500 font-mono">RESETS EVERY DAY • {today}</span>
        </div>

        {/* Daily Progress Bar */}
        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
            initial={{ width: 0 }}
            animate={{ width: `${dailyProgress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>

        {/* Daily Quest Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {dailyQuestsList.map((quest, index) => (
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
      </motion.div>

      {/* DSA Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-display text-gold font-bold tracking-wider">
              DSA PROGRESS
            </h2>
            <span className="text-xs text-gray-500 font-mono">PERMANENT • MARKS STAY UNTIL YOU REDO</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-xl font-display text-gold">{dsaCompleted}/{dsaQuests.length}</p>
              <p className="text-xs text-gray-500 font-mono">PROBLEMS DONE</p>
            </div>
            {dsaAllDone && (
              <button
                onClick={handleRedoAll}
                className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-all font-display text-sm font-bold"
              >
                🔄 REDO ALL PROBLEMS
              </button>
            )}
          </div>
        </div>

        {/* DSA Progress Bar */}
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-gold to-yellow-500"
            initial={{ width: 0 }}
            animate={{ width: `${dsaProgress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
          <span className="sr-only">{dsaProgress.toFixed(0)}% complete</span>
        </div>

        {/* DSA Quest Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {dsaQuests.map((quest, index) => (
            <motion.div
              key={quest.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
            >
              <QuestCard
                quest={quest}
                onComplete={() => completeQuest(quest.id, today)}
              />
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}