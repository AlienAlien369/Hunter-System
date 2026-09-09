import { motion, useMotionValue, animate } from 'framer-motion';
import { useEffect, useState } from 'react';
import { getStreak } from '../utils/xp';

const QUEST_CATEGORIES = {
  discipline: { name: 'Discipline', color: 'text-red-danger', bg: 'bg-red-danger/10' },
  skill: { name: 'Skill', color: 'text-blue-info', bg: 'bg-blue-info/10' },
  physical: { name: 'Physical', color: 'text-green-success', bg: 'bg-green-success/10' },
  nutrition: { name: 'Nutrition', color: 'text-gold', bg: 'bg-gold/10' },
  saas: { name: 'SaaS', color: 'text-purple-glow', bg: 'bg-purple-glow/10' },
  mindset: { name: 'Mindset', color: 'text-purple-monarch', bg: 'bg-purple-monarch/10' },
  spiritual: { name: 'Spiritual', color: 'text-pink-400', bg: 'bg-pink-400/10' },
  health: { name: 'Health', color: 'text-teal-400', bg: 'bg-teal-400/10' },
} as const;

const DEFAULT_QUESTS = [
  { id: 'DQ-01', title: 'Wake Up at 4:45 AM', xpReward: 10, category: 'discipline', icon: '🌅' },
  { id: 'DQ-02', title: 'Meditation 10-15 min', xpReward: 10, category: 'mindset', icon: '🧘' },
  { id: 'DQ-03', title: 'Solve 1 DSA Problem', xpReward: 25, category: 'skill', icon: '💻' },
  { id: 'DQ-04', title: 'Attend MMA Class (Mon-Fri)', xpReward: 20, category: 'physical', icon: '🥋' },
  { id: 'DQ-05', title: 'Consume Fit Feast Pouch', xpReward: 5, category: 'nutrition', icon: '🥗' },
  { id: 'DQ-06', title: 'Drink 500ml Milk', xpReward: 5, category: 'nutrition', icon: '🥛' },
  { id: 'DQ-07', title: 'Eat 50g Oats', xpReward: 5, category: 'nutrition', icon: '🌾' },
  { id: 'DQ-08', title: 'Eat 150g Paneer', xpReward: 5, category: 'nutrition', icon: '🥩' },
  { id: 'DQ-09', title: 'Eat 30g Roasted Chana', xpReward: 5, category: 'nutrition', icon: '🥜' },
  { id: 'DQ-10', title: 'Eat 20g Peanuts', xpReward: 5, category: 'nutrition', icon: '🥜' },
  { id: 'DQ-11', title: 'SaaS Building Time', xpReward: 20, category: 'saas', icon: '🚀' },
  { id: 'DQ-12', title: 'System Design Practice', xpReward: 20, category: 'skill', icon: '📐' },
  { id: 'DQ-13', title: 'Satsang Attendance', xpReward: 20, category: 'spiritual', icon: '🕯️' },
  { id: 'DQ-14', title: 'Badminton/TT', xpReward: 25, category: 'physical', icon: '🏓' },
  { id: 'DQ-15', title: 'Sleep by 10:45 PM', xpReward: 10, category: 'health', icon: '🌙' },
];

export default function DailyQuests() {
  const { dailyQuests, completeQuest } = useGameStore();
  const [streak, setStreak] = useState(0);
  const [completedToday, setCompletedToday] = useState<Set<string>>(new Set());
  const [xpFlying, setXpFlying] = useState<{ x: number; y: number; amount: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'today' | 'weekly'>('today');

  useEffect(() => {
    if (dailyQuests.length === 0) return;
    const firstQuest = dailyQuests[0];
    if (firstQuest) {
      const calculatedStreak = getStreak(firstQuest.completedDates);
      setStreak(calculatedStreak);
    }

    const today = new Date().toISOString().split('T')[0];
    const completed = new Set<string>();
    dailyQuests.forEach(quest => {
      if (quest.completedDates.includes(today)) {
        completed.add(quest.id);
      }
    });
    setCompletedToday(completed);
  }, [dailyQuests]);

  const today = new Date().toISOString().split('T')[0];

  const todayXP = DEFAULT_QUESTS.filter(q => completedToday.has(q.id))
    .reduce((sum, q) => sum + q.xpReward, 0);

  const todayTotalXP = DEFAULT_QUESTS.reduce((sum, q) => sum + q.xpReward, 0);
  const todayProgress = Math.min((todayXP / todayTotalXP) * 100, 100);

  const handleQuestClick = (questId: string) => {
    const dateStr = today;
    if (completedToday.has(questId)) {
      setXpFlying(null);
    } else {
      setXpFlying({ x: window.innerWidth / 2, y: window.innerHeight / 2, amount: DEFAULT_QUESTS.find(q => q.id === questId)?.xpReward || 10 });
      setTimeout(() => setXpFlying(null), 800);
    }
    completeQuest(questId, dateStr);
  };

  const handleDailyComplete = () => {
    const xpGained = todayXP;
    if (xpGained > 0) {
      setXpFlying({ x: window.innerWidth / 2, y: window.innerHeight / 2, amount: xpGained });
      setTimeout(() => setXpFlying(null), 800);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-[calc(100vh-64px)] p-6"
    >
      {/* XP Flying Animation */}
      {xpFlying && (
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 0, y: -50 }}
          transition={{ duration: 0.8 }}
          className="fixed pointer-events-none text-gold font-bold text-xl z-50"
          style={{ left: xpFlying.x, top: xpFlying.y, transform: 'translate(-50%, -50%)' }}
        >
          +{xpFlying.amount} XP
        </motion.div>
      )}

      {/* Header with Stats */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h1 className="text-3xl font-display text-gold mb-2 flex items-center">
              <span className="mr-3">⚔️</span>
              QUEST BOARD
            </h1>
            <div className="text-muted text-sm">Your daily challenges await</div>
          </div>

          <div className="flex space-x-4 mt-4 md:mt-0">
            {/* Streak Badge */}
            <div className="flex items-center space-x-2 bg-card/50 backdrop-blur-sm rounded-lg border border-purple-monarch/20 px-4 py-2">
              <span className="text-2xl">🔥</span>
              <div>
                <div className="text-xs text-muted uppercase tracking-wider">Streak</div>
                <div className="text-lg font-display text-gold">{streak} DAYS</div>
              </div>
            </div>

            {/* Today's XP */}
            <div className="flex items-center space-x-2 bg-card/50 backdrop-blur-sm rounded-lg border border-purple-monarch/20 px-4 py-2">
              <span className="text-2xl">⚡</span>
              <div>
                <div className="text-xs text-muted uppercase tracking-wider">Daily XP</div>
                <div className="text-lg font-display text-purple-glow">{todayXP}/{todayTotalXP}</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="flex items-center space-x-2 bg-card/50 backdrop-blur-sm rounded-lg border border-purple-monarch/20 px-4 py-2 w-32">
              <div className="flex-1 bg-dungeon/50 rounded-full h-2 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-monarch to-purple-glow"
                  initial={{ width: 0 }}
                  animate={{ width: `${todayProgress}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
              <span className="text-xs text-muted font-mono w-12 text-right">{todayProgress.toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-dungeon/50 rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab('today')}
            className={`px-6 py-2 rounded-md font-display text-sm transition-all ${
              activeTab === 'today'
                ? 'bg-purple-monarch/20 text-purple-glow glow-purple'
                : 'text-muted hover:text-white'
            }`}
          >
            TODAY
          </button>
          <button
            onClick={() => setActiveTab('weekly')}
            className={`px-6 py-2 rounded-md font-display text-sm transition-all ${
              activeTab === 'weekly'
                ? 'bg-purple-monarch/20 text-purple-glow glow-purple'
                : 'text-muted hover:text-white'
            }`}
          >
            WEEKLY VIEW
          </button>
        </div>
      </motion.div>

      {/* Today View - Card Grid */}
      {activeTab === 'today' && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-display text-muted uppercase tracking-wider">
              Available Quests
            </h2>
            <button
              onClick={handleDailyComplete}
              className="px-4 py-2 bg-purple-monarch/20 text-purple-glow rounded-lg hover:bg-purple-monarch/30 transition-all font-display text-sm"
            >
              COMPLETE ALL
            </button>
          </div>

          {/* Quest Grid */}
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {DEFAULT_QUESTS.map((quest, index) => {
              const isCompleted = completedToday.has(quest.id);
              return (
                <motion.div
                  key={quest.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  onClick={() => handleQuestClick(quest.id)}
                  className={`
                    bg-card/50 backdrop-blur-sm rounded-xl border p-5 cursor-pointer transition-all
                    hover:border-purple-glow/30 hover:bg-card/80
                    ${isCompleted ? 'border-gold/30 glow-gold' : 'border-purple-monarch/20'}
                    ${!isCompleted ? 'hover:shadow-[0_0_20px_rgba(93,38,193,0.1)]' : ''}
                  `}
                >
                  {/* Quest Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className={`text-3xl ${QUEST_CATEGORIES[quest.category].color}`}>
                      {quest.icon}
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isCompleted
                        ? 'bg-gold/20 text-gold'
                        : 'bg-dungeon/50 text-muted'
                    }`}>
                      {isCompleted ? '✓' : '○'}
                    </div>
                  </div>

                  {/* Quest Info */}
                  <div className="space-y-2">
                    <h3 className={`font-display text-sm ${isCompleted ? 'text-gold line-through' : 'text-white'}`}>
                      {quest.title}
                    </h3>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-2 py-1 rounded-full font-mono ${QUEST_CATEGORIES[quest.category].bg} ${QUEST_CATEGORIES[quest.category].color}`}>
                        {QUEST_CATEGORIES[quest.category].name}
                      </span>
                      <span className="text-gold font-mono text-sm">+{quest.xpReward} XP</span>
                    </div>
                  </div>

                  {/* XP Bar */}
                  <div className="mt-4 h-1.5 bg-dungeon/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-gold to-gold/50 transition-all duration-500"
                      style={{
                        width: isCompleted ? '100%' : '0%',
                      }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Category Progress Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mt-8"
          >
            <h2 className="text-lg font-display text-muted uppercase tracking-wider mb-4">
              Category Progress
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(QUEST_CATEGORIES).map(([key, category]) => {
                const categoryQuests = DEFAULT_QUESTS.filter(q => q.category === key);
                const completed = categoryQuests.filter(q => completedToday.has(q.id)).length;
                const progress = Math.round((completed / categoryQuests.length) * 100);
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-card/50 backdrop-blur-sm rounded-xl border border-purple-monarch/10 p-4 text-center"
                  >
                    <div className="text-2xl mb-2">{category.icon || '⚔️'}</div>
                    <div className="font-display text-sm text-muted uppercase">{category.name}</div>
                    <div className="text-2xl font-display text-gold mt-1">{completed}/{categoryQuests.length}</div>
                    <div className="mt-2 h-1.5 bg-dungeon/50 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-purple-monarch to-purple-glow"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 1 }}
                      />
                    </div>
                    <div className="text-xs text-muted mt-1 font-mono">{progress}%</div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </>
      )}

      {/* Weekly View - Visual Calendar */}
      {activeTab === 'weekly' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <h2 className="text-lg font-display text-muted uppercase tracking-wider">
            Weekly Progress Overview
          </h2>

          {/* Weekly XP Chart - SVG based for game feel */}
          <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-purple-monarch/10 p-6">
            <h3 className="font-display text-purple-monarch mb-4">
              XP ACCUMULATION - LAST 7 DAYS
            </h3>
            <WeeklyXPChart dailyQuests={dailyQuests} />
          </div>

          {/* Completion Heatmap */}
          <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-purple-monarch/10 p-6">
            <h3 className="font-display text-purple-monarch mb-4">
              QUEST COMPLETION MAP
            </h3>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 7 }).map((_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - (6 - i));
                const dateStr = date.toISOString().split('T')[0];
                const weekDay = date.toLocaleDateString('en-US', { weekday: 'short' });

                const questsCompleted = dailyQuests.filter(q =>
                  q.completedDates.includes(dateStr)
                ).length;

                const intensity = questsCompleted / DEFAULT_QUESTS.length;
                const colors = [
                  'bg-dungeon/30',
                  'bg-purple-monarch/30',
                  'bg-purple-monarch/60',
                  'bg-purple-monarch',
                  'bg-purple-glow',
                ];

                return (
                  <motion.div
                    key={dateStr}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className={`
                      aspect-square rounded-lg border border-purple-monarch/20
                      ${intensity > 0.8 ? 'bg-gradient-to-br from-purple-monarch to-purple-glow' : intensity > 0.6 ? 'bg-purple-monarch' : intensity > 0.3 ? 'bg-purple-monarch/50' : 'bg-dungeon/30'}
                      flex items-center justify-center cursor-pointer
                      hover:scale-110 transition-transform
                      ${intensity > 0 ? '' : 'opacity-30'}
                    `}
                    title={`${weekDay}: ${questsCompleted}/${DEFAULT_QUESTS.length} quests`}
                  >
                    <span className="text-xs font-mono text-white font-bold">
                      {questsCompleted > 0 ? questsCompleted : ''}
                    </span>
                  </motion.div>
                );
              })}
            </div>
            <div className="flex justify-between mt-3 text-xs text-muted">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-purple-monarch/10 p-6">
            <h3 className="font-display text-purple-monarch mb-4">
              WEEKLY COMPLETION BY CATEGORY
            </h3>
            <div className="space-y-4">
              {Object.entries(QUEST_CATEGORIES).map(([key, category]) => {
                const categoryQuests = DEFAULT_QUESTS.filter(q => q.category === key);
                const totalCompleted = categoryQuests.reduce((sum, q) => {
                  const weekDays = Array.from({ length: 7 }).map((_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() - (6 - i));
                    return date.toISOString().split('T')[0];
                  });
                  return sum + categoryQuests.filter(q =>
                    q.completedDates.some(d => weekDays.includes(d))
                  ).length;
                }, 0);
                const progress = Math.round((totalCompleted / (categoryQuests.length * 7)) * 100);

                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-mono">{category.name}</span>
                      <span className="text-gold text-sm font-mono">{totalCompleted}/{categoryQuests.length * 7}</span>
                    </div>
                    <div className="h-2 bg-dungeon/50 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-purple-monarch to-purple-glow"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 1 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// SVG Weekly XP Chart Component
function WeeklyXPChart({ dailyQuests }: { dailyQuests: any[] }) {
  const today = new Date().toISOString().split('T')[0];

  // Generate mock data for the last 7 days
  const days = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toISOString().split('T')[0];
  });

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Calculate cumulative XP
  let cumulativeXP = 0;
  const data = days.map((date, index) => {
    const completed = dailyQuests.filter(q =>
      q.completedDates.includes(date)
    ).reduce((sum, q) => sum + q.xpReward, 0);
    cumulativeXP += completed;
    return { date, xp: cumulativeXP, dailyXP: completed };
  });

  const maxXP = Math.max(...data.map(d => d.xp), 1);
  const maxDailyXP = Math.max(...data.map(d => d.dailyXP), 1);

  return (
    <div className="relative h-64">
      {/* Grid lines */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="xpGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#8E2DE2" />
            <stop offset="100%" stopColor="#5D26C1" />
          </linearGradient>
          <linearGradient id="xpGradientGlow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#8E2DE2" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#5D26C1" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Y-axis labels */}
        {[0, 25, 50, 75, 100].map((percent, i) => (
          <g key={i}>
            <line
              x1="40"
              y1={`${percent}%`}
              x2="100%"
              y2={`${percent}%`}
              stroke="#1A1A2E"
              strokeWidth="1"
            />
            <text
              x="35"
              y={`${percent}%`}
              textAnchor="end"
              fill="#8A92B2"
              fontSize="10"
              dy=".3em"
            >
              {Math.round(maxXP * (percent / 100))}
            </text>
          </g>
        ))}

        {/* Data line */}
        <path
          d={data.map((point, index) => {
            const x = 40 + (index / (data.length - 1)) * 600;
            const y = 100 - (point.xp / maxXP) * 80;
            return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
          }).join(' ')}
          fill="none"
          stroke="url(#xpGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Fill area */}
        <path
          d={[
            ...data.map((point, index) => {
              const x = 40 + (index / (data.length - 1)) * 600;
              const y = 100 - (point.xp / maxXP) * 80;
              return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
            }).join(' '),
            `L ${40 + 600} 100`,
            `L 40 100 Z`,
          ].join(' ')}
          fill="url(#xpGradientGlow)"
        />

        {/* Data points */}
        {data.map((point, index) => {
          const x = 40 + (index / (data.length - 1)) * 600;
          const y = 100 - (point.xp / maxXP) * 80;
          return (
            <g key={point.date}>
              <circle
                cx={x}
                cy={y}
                r={index === data.length - 1 ? 6 : 3}
                fill={index === data.length - 1 ? '#F1C40F' : '#8E2DE2'}
                stroke="#1A1A2E"
                strokeWidth="2"
              />
              {/* Tooltip */}
              <rect
                x={x - 20}
                y={y - 30}
                width={40}
                height={20}
                rx={4}
                fill="#1A1A2E"
                opacity={0.9}
              />
              <text
                x={x}
                y={y - 15}
                textAnchor="middle"
                fill="#F1C40F"
                fontSize="10"
                fontWeight="bold"
              >
                {point.dailyXP > 0 ? `+${point.dailyXP}` : ''}
              </text>
            </g>
          );
        })}
      </svg>

      {/* X-axis labels */}
      <div className="flex justify-between mt-[-20px] px-4">
        {dayLabels.map((label, i) => (
          <text key={label} fill="#8A92B2" fontSize="10" textAnchor="middle">
            {label}
          </text>
        ))}
      </div>
    </div>
  );
}