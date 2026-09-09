import { motion } from 'framer-motion';

interface DailyQuest {
  id: string;
  title: string;
  xpReward: number;
  category: 'discipline' | 'skill' | 'physical' | 'nutrition' | 'saas' | 'mindset' | 'spiritual' | 'health' | 'architecture';
  completedDates: string[];
}

interface QuestCardProps {
  quest: DailyQuest & { completedToday: boolean };
  onComplete: () => void;
  showXP?: boolean;
}

const CATEGORY_CONFIG = {
  discipline: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: '⚡' },
  skill: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: '💻' },
  physical: { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', icon: '💪' },
  nutrition: { color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/20', icon: '🥗' },
  saas: { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: '🚀' },
  architecture: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: '📐' },
  mindset: { color: 'text-blue-300', bg: 'bg-blue-300/10', border: 'border-blue-300/20', icon: '🧘' },
  spiritual: { color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20', icon: '🕯️' },
  health: { color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20', icon: '❤️' },
};

export default function QuestCard({ quest, onComplete, showXP = true }: QuestCardProps) {
  const config = CATEGORY_CONFIG[quest.category as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.discipline;

  return (
    <motion.button
      onClick={onComplete}
      type="button"
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
      className={`
        w-full text-left p-4 rounded-xl border-2 transition-colors duration-200 cursor-pointer
        hover:shadow-lg
        ${quest.completedToday
          ? `${config.bg} ${config.border} opacity-80 shadow-[0_0_18px_rgba(139,92,246,0.15)]`
          : 'bg-[#161b22]/80 border-purple-500/20 hover:border-purple-500/50 hover:bg-[#1a2332] hover:shadow-purple-500/10'
        }
      `}
    >
      <div className="flex items-center space-x-3">
        {/* Checkbox */}
        <div className={`
          w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all flex-shrink-0
          ${quest.completedToday
            ? `${config.bg} ${config.border}`
            : 'border-gray-600 hover:border-purple-400 bg-transparent'
          }
        `}>
          {quest.completedToday && (
            <motion.svg
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 600, damping: 15 }}
              className={`w-4 h-4 ${config.color}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </motion.svg>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <span className="text-xl">{config.icon}</span>
            <p className={`
              font-mono text-sm font-medium truncate
              ${quest.completedToday ? 'text-gray-500 line-through' : 'text-white'}
            `}>
              {quest.title}
            </p>
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <span className={`
              text-xs px-2 py-0.5 rounded-full font-mono border
              ${config.bg} ${config.color} ${config.border}
            `}>
              {quest.category.toUpperCase()}
            </span>
          </div>
        </div>

        {/* XP Reward */}
        {showXP && (
          <div className="text-right flex-shrink-0">
            <motion.span
              key={quest.completedToday ? 'done' : 'open'}
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              className={`
                text-sm font-display font-bold
                ${quest.completedToday ? 'text-gray-500' : 'text-gold'}
              `}
            >
              {quest.completedToday ? '✓' : '+'}{quest.xpReward}
            </motion.span>
            <p className="text-xs text-gray-500 font-mono">XP</p>
          </div>
        )}
      </div>
    </motion.button>
  );
}
