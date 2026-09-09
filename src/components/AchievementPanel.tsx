import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { ACHIEVEMENTS, CATEGORY_CONFIG, type AchievementCategory } from '../data/achievements';
import { sfx } from '../utils/sounds';

const CATEGORIES: AchievementCategory[] = [
  'milestone', 'streak', 'rank', 'quest', 'track', 'stats',
  'hidden', 'inventory', 'title', 'daily', 'penalty', 'special',
];

function AchievementCard({ achievement, unlocked, isNew }: {
  achievement: typeof ACHIEVEMENTS[number];
  unlocked: boolean;
  isNew: boolean;
}) {
  const isSecret = achievement.hidden && !unlocked;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02, y: -2 }}
      className={`
        relative p-4 rounded-xl border transition-all overflow-hidden
        ${unlocked
          ? 'bg-gray-800/50 border-purple-500/30 shadow-lg shadow-purple-500/5'
          : isSecret
            ? 'bg-gray-900/30 border-gray-800/20 opacity-50'
            : 'bg-gray-900/40 border-gray-800/30 opacity-60'
        }
      `}
    >
      {/* New badge pulse */}
      {isNew && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.2, 1] }}
          className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-yellow-400"
          style={{ boxShadow: '0 0 8px rgba(250,204,21,0.6)' }}
        />
      )}

      {/* Unlock glow */}
      {unlocked && (
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />
      )}

      <div className="relative flex items-start gap-3">
        {/* Icon */}
        <div className={`
          w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0
          ${unlocked ? 'bg-purple-500/15' : 'bg-gray-800/50'}
          ${isSecret ? 'grayscale' : ''}
        `}>
          {isSecret ? '❓' : achievement.icon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className={`font-display font-bold text-sm leading-tight ${
            unlocked ? 'text-white' : isSecret ? 'text-gray-600' : 'text-gray-400'
          }`}>
            {isSecret ? '???' : achievement.title}
          </p>
          <p className={`text-[10px] font-mono mt-0.5 leading-snug ${
            unlocked ? 'text-gray-400' : isSecret ? 'text-gray-700' : 'text-gray-600'
          }`}>
            {isSecret ? 'Hidden achievement' : achievement.description}
          </p>
        </div>

        {/* Status */}
        <div className="shrink-0 pt-0.5">
          {unlocked ? (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            >
              <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </motion.div>
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-gray-700/50" />
          )}
        </div>
      </div>

      {/* XP reward (only shown when unlocked) */}
      {unlocked && (
        <div className="mt-2 flex items-center gap-1">
          <span className="text-[9px] font-mono text-yellow-400/60">+{achievement.xpReward} XP</span>
        </div>
      )}
    </motion.div>
  );
}

export default function AchievementPanel() {
  const { unlockedAchievements, newAchievements, dismissNewAchievements } = useGameStore();
  const [activeCategory, setActiveCategory] = useState<AchievementCategory | 'all'>('all');

  const unlockedSet = new Set(unlockedAchievements);
  const newSet = new Set(newAchievements);

  const filtered = activeCategory === 'all'
    ? ACHIEVEMENTS
    : ACHIEVEMENTS.filter(a => a.category === activeCategory);

  const totalUnlocked = unlockedAchievements.length;
  const totalAchievements = ACHIEVEMENTS.length;
  const progress = totalAchievements > 0 ? (totalUnlocked / totalAchievements) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-display text-white font-bold tracking-wider">
            ACHIEVEMENTS
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">
            {totalUnlocked} / {totalAchievements} unlocked
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-lg font-display font-bold text-yellow-400">{totalUnlocked}</p>
            <p className="text-[10px] font-mono text-gray-500">UNLOCKED</p>
          </div>
        </div>
      </motion.div>

      {/* Progress bar */}
      <div className="bg-[#0d1117]/80 backdrop-blur-sm rounded-xl border border-purple-500/20 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono text-gray-500">COLLECTION PROGRESS</span>
          <span className="text-xs font-mono text-purple-400">{progress.toFixed(0)}%</span>
        </div>
        <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 to-yellow-400"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
        {/* Milestone markers */}
        <div className="flex justify-between mt-1">
          {[25, 50, 75, 100].map(milestone => (
            <span
              key={milestone}
              className={`text-[9px] font-mono ${progress >= milestone ? 'text-yellow-400' : 'text-gray-700'}`}
            >
              {milestone}%
            </span>
          ))}
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
            activeCategory === 'all'
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              : 'text-gray-500 hover:text-gray-300 border border-transparent'
          }`}
        >
          All ({ACHIEVEMENTS.length})
        </button>
        {CATEGORIES.map(cat => {
          const count = ACHIEVEMENTS.filter(a => a.category === cat).length;
          const unlockedCount = ACHIEVEMENTS.filter(a => a.category === cat && unlockedSet.has(a.id)).length;
          if (count === 0) return null;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                activeCategory === cat
                  ? 'bg-gray-800/60 text-white border border-gray-700/50'
                  : 'text-gray-500 hover:text-gray-300 border border-transparent'
              }`}
            >
              {CATEGORY_CONFIG[cat].icon} {CATEGORY_CONFIG[cat].label} ({unlockedCount}/{count})
            </button>
          );
        })}
      </div>

      {/* Achievement grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <AnimatePresence mode="popLayout">
          {filtered.map(ach => (
            <AchievementCard
              key={ach.id}
              achievement={ach}
              unlocked={unlockedSet.has(ach.id)}
              isNew={newSet.has(ach.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* New achievement notification toast */}
      <AnimatePresence>
        {newAchievements.length > 0 && (
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[75]"
          >
            <div className="flex items-center gap-4 px-6 py-4 bg-[#0d1117]/95 backdrop-blur-xl border border-yellow-500/30 rounded-2xl shadow-2xl shadow-yellow-500/10">
              <motion.span
                className="text-3xl"
                animate={{ scale: [1, 1.2, 1], rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.6 }}
              >
                🏆
              </motion.span>
              <div>
                <p className="text-[10px] font-mono text-yellow-400/60 tracking-wider">ACHIEVEMENT UNLOCKED</p>
                {newAchievements.map(id => {
                  const ach = ACHIEVEMENTS.find(a => a.id === id);
                  if (!ach) return null;
                  return (
                    <p key={id} className="text-sm font-display font-bold text-white">
                      {ach.icon} {ach.title}
                    </p>
                  );
                })}
              </div>
              <button
                onClick={() => { dismissNewAchievements(); sfx.click(); }}
                className="px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-display text-xs font-bold hover:bg-yellow-500/20 transition-colors"
              >
                NICE
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
