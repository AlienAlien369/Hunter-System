import { useGameStore } from '../store/gameStore';
import { motion } from 'framer-motion';
import { useEffect } from 'react';

export default function QuestBoard() {
  const { dailyQuests, completeQuest } = useGameStore();
  const today = new Date().toISOString().split('T')[0];

  // Filter today's quests (for simplicity, we'll show all quests with today's status)
  const todaysQuests = dailyQuests.map(quest => ({
    ...quest,
    completedToday: quest.completedDates.includes(today),
  }));

  // Calculate daily XP
  const [dailyXP, setDailyXP] = useState(0);

  useEffect(() => {
    const calculatedXP = todaysQuests.reduce((total, quest) =>
      total + (quest.completedToday ? quest.xpReward : 0), 0);
    setDailyXP(calculatedXP);
  }, [todaysQuests]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="bg-card/80 backdrop-blur-sm rounded-2xl border border-purple-monarch/20 p-6"
    >
      <h2 className="text-xl font-display text-purple-monarch mb-4">
        TODAY'S QUESTS
      </h2>

      <div className="space-y-3">
        {todaysQuests.map((quest) => (
          <motion.div
            key={quest.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 * todaysQuests.indexOf(quest) }}
            className="flex items-center space-x-3 hover:bg-dungeon/30 rounded-lg p-2 transition-colors cursor-pointer"
            onClick={() => completeQuest(quest.id, today)}
          >
            <div className="w-5 h-5 flex-shrink-0">
              {quest.completedToday ? (
                <svg className="text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 5h22M1 12h22M1 19h22" />
                </svg>
              )}
            </div>
            <span className="flex-1 text-sm">{quest.title}</span>
            <span className="w-8 text-sm text-muted text-center">
              +{quest.xpReward} XP
            </span>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-purple-monarch/10">
        <div className="flex justify-between text-sm text-muted">
          <span>Daily XP: {dailyXP}</span>
          <span>/ 150 Goal</span>
        </div>
        <div className="w-full bg-dungeon/50 rounded-full h-2 mt-1 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-success to-green-success/50 transition-all duration-500"
            style={{ width: `${Math.min((dailyXP / 150) * 100, 100)}%` }}
          ></div>
        </div>
      </div>
    </motion.div>
  );
}