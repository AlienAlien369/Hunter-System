import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';

export default function QuestDetail() {
  const { id } = useParams<{ id: string }>();
  const { dailyQuests, completeQuest } = useGameStore();
  const today = new Date().toISOString().split('T')[0];

  const quest = dailyQuests.find(q => q.id === id);

  if (!quest) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 font-mono">Quest not found</p>
      </div>
    );
  }

  const isCompleted = quest.completedDates.includes(today);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back Button */}
      <Link to="/quests" className="inline-flex items-center text-gray-400 hover:text-white transition-colors">
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Quest Log
      </Link>

      {/* Quest Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`
          bg-[#0d1117]/90 backdrop-blur-xl rounded-xl border p-8
          ${isCompleted
            ? 'border-gold/30 shadow-lg shadow-gold/10'
            : 'border-purple-500/20'
          }
        `}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className={`
                px-3 py-1 rounded-full text-xs font-mono uppercase tracking-wider
                ${quest.category === 'discipline' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                  quest.category === 'skill' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                  quest.category === 'physical' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                  quest.category === 'nutrition' ? 'bg-gold/10 text-gold border border-gold/20' :
                  quest.category === 'saas' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                  'bg-gray-500/10 text-gray-400 border border-gray-500/20'}
              `}>
                {quest.category}
              </span>
              <span className="text-gray-500 font-mono text-sm">ID: {quest.id}</span>
            </div>
            <h1 className="text-2xl font-display text-white font-bold">{quest.title}</h1>
          </div>

          {/* XP Badge */}
          <div className={`
            w-16 h-16 rounded-full flex items-center justify-center border-2
            ${isCompleted ? 'border-gold bg-gold/10' : 'border-purple-500/30 bg-purple-500/5'}
          `}>
            <span className={`text-xl font-display font-bold ${isCompleted ? 'text-gold' : 'text-purple-400'}`}>
              {isCompleted ? '✓' : `+${quest.xpReward}`}
            </span>
          </div>
        </div>

        {/* Description */}
        <div className="mb-6">
          <p className="text-gray-400 font-mono text-sm leading-relaxed">
            Complete this quest to earn XP and progress on your path to becoming an S-Rank Hunter.
            Consistency is key to unlocking your full potential.
          </p>
        </div>

        {/* Completion History */}
        <div className="mb-6">
          <h3 className="text-sm font-mono text-gray-500 uppercase tracking-wider mb-3">
            Completion History (Last 30 Days)
          </h3>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 30 }).map((_, i) => {
              const date = new Date();
              date.setDate(date.getDate() - (29 - i));
              const dateStr = date.toISOString().split('T')[0];
              const completed = quest.completedDates.includes(dateStr);
              const isToday = dateStr === today;

              return (
                <div
                  key={dateStr}
                  className={`
                    aspect-square rounded flex items-center justify-center text-xs font-mono
                    ${completed ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-800/50 text-gray-600'}
                    ${isToday ? 'ring-2 ring-purple-500' : ''}
                  `}
                  title={dateStr}
                >
                  {completed ? '✓' : date.getDate()}
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => completeQuest(quest.id, today)}
          className={`
            w-full py-4 rounded-lg font-display text-lg tracking-wider transition-all duration-300
            ${isCompleted
              ? 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:shadow-lg hover:shadow-purple-500/30'
            }
          `}
          disabled={isCompleted}
        >
          {isCompleted ? '✓ QUEST COMPLETED' : 'COMPLETE QUEST'}
        </button>
      </motion.div>
    </div>
  );
}
