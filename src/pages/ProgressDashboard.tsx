import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function ProgressDashboard() {
  const { profile, stats, rank, loadDashboard } = useGameStore();
  const [chartData, setChartData] = useState<any[]>([]);
  const [achievements] = useState([
    { id: 'ACH-01', title: 'First Steps', earned: true, icon: '👣' },
    { id: 'ACH-02', title: 'Disciplined Initiate', earned: true, icon: '⚔️' },
    { id: 'ACH-03', title: 'Skill Seeker', earned: false, icon: '📚' },
    { id: 'ACH-04', title: 'Physical Prowess', earned: false, icon: '💪' },
    { id: 'ACH-05', title: 'Nutrition Master', earned: false, icon: '🥗' },
    { id: 'ACH-06', title: 'SaaS Builder', earned: false, icon: '💻' },
    { id: 'ACH-07', title: 'Mindset Warrior', earned: false, icon: '🧘' },
    { id: 'ACH-08', title: 'Spiritual Sage', earned: false, icon: '🕊️' },
    { id: 'ACH-09', title: 'Health Guardian', earned: false, icon: '❤️' },
    { id: 'ACH-10', title: 'Elite Hunter', earned: profile.rank === 'B', icon: '🏆' },
    { id: 'ACH-11', title: 'A-Rank Agent', earned: profile.rank === 'A', icon: '🌟' },
    { id: 'ACH-12', title: 'S-Rank Legend', earned: profile.rank === 'S', icon: '👑' },
  ]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    // Generate mock chart data based on current progress
    const data = [];
    let cumulativeXP = 0;
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const dailyGain = Math.floor(Math.random() * 50) + 20;
      cumulativeXP += dailyGain;
      data.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        xp: cumulativeXP,
        quests: Math.floor(Math.random() * 5) + 3,
      });
    }
    // Update last entry with actual XP
    if (data.length > 0) {
      data[data.length - 1] = {
        ...data[data.length - 1],
        xp: profile.xp,
      };
    }
    setChartData(data);
  }, [profile.xp]);

  // Rank colors
  const rankColors: Record<string, string> = {
    E: '#8A92B2',
    D: '#3498DB',
    C: '#5D26C1',
    B: '#8E2DE2',
    A: '#F1C40F',
    S: '#F1C40F',
  };

  const currentRankColor = rankColors[profile.rank] || '#8A92B2';

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
            PROGRESS DASHBOARD
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">
            Track your journey to S-Rank
          </p>
        </div>
        <div className="text-right">
          <p className="text-purple-400 font-mono text-sm">{new Date().toLocaleDateString()}</p>
          <p className="text-gray-500 font-mono text-xs mt-1">
            {profile.apiConnected ? '🟢 ONLINE' : '🟡 LOCAL MODE'}
          </p>
        </div>
      </motion.div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total XP', value: profile.xp, color: 'text-purple-400' },
          { label: 'Level', value: profile.level, color: 'text-gold' },
          { label: 'Rank', value: profile.rank, color: currentRankColor },
          { label: 'Streak', value: stats?.streak || 0, color: 'text-orange-400' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-[#161b22]/80 backdrop-blur-sm rounded-xl border border-purple-500/20 p-4"
          >
            <p className="text-gray-500 font-mono text-xs uppercase">{stat.label}</p>
            <p className={`text-3xl font-display font-bold ${stat.color} mt-1`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* XP Growth Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-[#161b22]/80 backdrop-blur-sm rounded-xl border border-purple-500/20 p-6"
      >
        <h3 className="font-display text-white font-bold mb-4 tracking-wider">
          XP GROWTH (LAST 7 DAYS)
        </h3>
        <div className="h-64">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                <XAxis dataKey="date" stroke="#8A92B2" fontSize={12} />
                <YAxis stroke="#8A92B2" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#161b22', border: '1px solid #5D26C1', borderRadius: '8px' }}
                  labelStyle={{ color: '#8E2DE2' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="xp"
                  stroke="#8E2DE2"
                  strokeWidth={3}
                  dot={{ fill: '#8E2DE2', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#F1C40F' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 font-mono">
              No data available
            </div>
          )}
        </div>
      </motion.div>

      {/* Rank Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-[#161b22]/80 backdrop-blur-sm rounded-xl border border-purple-500/20 p-6"
      >
        <h3 className="font-display text-white font-bold mb-4 tracking-wider">
          RANK PROGRESSION
        </h3>
        <div className="space-y-3">
          {(['E', 'D', 'C', 'B', 'A', 'S'] as const).map((rank, index) => {
            const isCurrent = profile.rank === rank;
            const isCompleted = profile.rank === 'S' ||
              (rank === 'E' && profile.xp >= 0) ||
              (rank === 'D' && profile.xp >= 350) ||
              (rank === 'C' && profile.xp >= 700) ||
              (rank === 'B' && profile.xp >= 1050) ||
              (rank === 'A' && profile.xp >= 1400) ||
              (rank === 'S' && profile.xp >= 1750);

            const xpRequired = [0, 350, 700, 1050, 1400, 1750][index];
            const progress = isCurrent
              ? ((profile.xp - (index > 0 ? [0, 350, 700, 1050, 1400][index - 1] : 0)) / 350) * 100
              : isCompleted ? 100 : 0;

            return (
              <div key={rank} className="flex items-center space-x-4">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-lg
                    ${isCurrent ? 'ring-2 ring-purple-500' : ''}
                    ${isCompleted ? '' : 'opacity-50'}
                  `}
                  style={{
                    backgroundColor: isCompleted ? `${rankColors[rank]}20` : 'transparent',
                    color: isCompleted ? rankColors[rank] : '#4B5563',
                    borderColor: rankColors[rank],
                  }}
                >
                  {rank}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400 font-mono">{rank}-Rank</span>
                    <span className="text-gray-500 font-mono text-xs">{xpRequired} XP</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: rankColors[rank] }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(progress, 100)}%` }}
                      transition={{ duration: 1, delay: index * 0.1 }}
                    />
                  </div>
                </div>
                {isCurrent && (
                  <span className="text-purple-400 font-mono text-xs font-bold">CURRENT</span>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Achievements */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-[#161b22]/80 backdrop-blur-sm rounded-xl border border-purple-500/20 p-6"
      >
        <h3 className="font-display text-white font-bold mb-4 tracking-wider">
          ACHIEVEMENTS
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {achievements.map((ach, i) => (
            <motion.div
              key={ach.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className={`
                p-3 rounded-lg border text-center
                ${ach.earned
                  ? 'bg-purple-500/10 border-gold/30'
                  : 'bg-gray-900/30 border-gray-800 opacity-50'
                }
              `}
            >
              <div className="text-2xl mb-1">{ach.icon}</div>
              <p className={`text-xs font-mono ${ach.earned ? 'text-gold' : 'text-gray-500'}`}>
                {ach.title}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
