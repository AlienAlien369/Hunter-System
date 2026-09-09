import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { useEffect, useState } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api } from '../lib/api';
import type { ActivityEntry, ProgressPeriod, ProgressReport, TrackStats } from '../lib/api';
import { RANK_THRESHOLDS } from '../utils/xp';

const ACTIVITY_META: Record<string, { icon: string; label: string }> = {
  quest_complete: { icon: '✅', label: 'Quest completed' },
  quest_undo: { icon: '↩️', label: 'Quest uncompleted' },
  dsa_redo: { icon: '🔄', label: 'DSA reset (redo all)' },
  nutrition_update: { icon: '🥗', label: 'Nutrition marked' },
  stats_update: { icon: '📊', label: 'Stats updated' },
  login: { icon: '🔐', label: 'Logged in' },
  register: { icon: '🆕', label: 'Registered' },
};

const PERIODS: { id: ProgressPeriod; label: string }[] = [
  { id: 'week', label: 'WEEK' },
  { id: 'month', label: 'MONTH' },
  { id: 'quarter', label: 'QUARTER' },
  { id: 'year', label: 'YEAR' },
];

export default function ProgressDashboard() {
  const { profile, stats, apiConnected, loadDashboard } = useGameStore();
  const [period, setPeriod] = useState<ProgressPeriod>('month');
  const [progress, setProgress] = useState<ProgressReport | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [tracks, setTracks] = useState<TrackStats[]>([]);
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
    api.getActivity(30)
      .then(setActivity)
      .catch(err => console.error('Failed to load activity:', err));
  }, []);

  useEffect(() => {
    api.getTracks()
      .then(data => setTracks(data.tracks))
      .catch(err => console.error('Failed to load track stats:', err));
  }, []);

  const rankedTracks = [...tracks].sort((a, b) => b.xp_earned - a.xp_earned);
  const MEDALS = ['🥇', '🥈', '🥉'];
  const trackColors: Record<string, string> = {
    dsa: 'from-gold to-yellow-500',
    saas: 'from-purple-monarch to-purple-glow',
    arch: 'from-red-danger to-orange-400',
  };
  const maxTrackXp = Math.max(...rankedTracks.map(t => t.xp_earned), 1);

  useEffect(() => {
    api.getProgress(period)
      .then(setProgress)
      .catch(err => console.error('Failed to load progress:', err));
  }, [period]);

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
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-display text-white font-bold tracking-wider">
            PROGRESS DASHBOARD
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">
            Track your journey to S-Rank
          </p>
        </div>
        <div className="text-right">
          <p className="text-purple-400 font-mono text-sm">{new Date().toLocaleDateString()}</p>
          <p className="text-gray-500 font-mono text-xs mt-1">
            {apiConnected ? '🟢 ONLINE' : '🟡 LOCAL MODE'}
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

      {/* Period Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-[#161b22]/80 backdrop-blur-sm rounded-xl border border-purple-500/20 p-6"
      >
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <h3 className="font-display text-white font-bold tracking-wider">
            PERIOD PROGRESS
          </h3>

          {/* Period Tabs */}
          <div className="flex space-x-1 bg-gray-900/60 rounded-lg p-1">
            {PERIODS.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-4 py-1.5 rounded-md font-mono text-xs transition-all ${
                  period === p.id
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'text-gray-500 hover:text-gray-300 border border-transparent'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Period Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Quests Completed', value: progress?.totals.quests_completed ?? 0, color: 'text-purple-400' },
            { label: 'XP Earned', value: progress?.totals.xp_earned ?? 0, color: 'text-gold' },
            { label: 'Active Days', value: `${progress?.totals.active_days ?? 0}/${progress?.totals.days_elapsed ?? 1}`, color: 'text-blue-400' },
            { label: 'Completion Rate', value: `${progress?.totals.completion_rate ?? 0}%`, color: 'text-green-400' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="bg-gray-900/50 rounded-lg border border-gray-800 p-3"
            >
              <p className={`text-xl font-display font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-gray-500 font-mono mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="h-64">
          {progress && progress.buckets.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={progress.buckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                <XAxis dataKey="label" stroke="#8A92B2" fontSize={12} />
                <YAxis yAxisId="quests" stroke="#8A92B2" fontSize={12} />
                <YAxis yAxisId="xp" orientation="right" stroke="#8A92B2" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#161b22', border: '1px solid #5D26C1', borderRadius: '8px' }}
                  labelStyle={{ color: '#8E2DE2' }}
                />
                <Legend />
                <Bar yAxisId="quests" dataKey="quests" name="Quests" fill="#8E2DE2" radius={[4, 4, 0, 0]} />
                <Line
                  yAxisId="xp"
                  type="monotone"
                  dataKey="xp"
                  name="XP"
                  stroke="#F1C40F"
                  strokeWidth={3}
                  dot={{ fill: '#F1C40F', strokeWidth: 2, r: 3 }}
                  activeDot={{ r: 6, fill: '#8E2DE2' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 font-mono">
              No activity this {period}
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
          {RANK_THRESHOLDS.map((t, index) => {
            const rank = t.rank;
            const isCurrent = profile.rank === rank;
            const isCompleted = profile.xp >= t.minXP;

            const xpRequired = t.minXP;
            const prevMin = index > 0 ? RANK_THRESHOLDS[index - 1].minXP : 0;
            const nextMin = index + 1 < RANK_THRESHOLDS.length ? RANK_THRESHOLDS[index + 1].minXP : null;
            const band = (nextMin ?? prevMin) - prevMin;
            const progress = isCurrent
              ? ((profile.xp - prevMin) / (band || 1)) * 100
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
                    <span className="text-gray-500 font-mono text-xs">{xpRequired.toLocaleString()} XP</span>
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

      {/* Track Leaderboard */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-[#161b22]/80 backdrop-blur-sm rounded-xl border border-purple-500/20 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-white font-bold tracking-wider">
            TRACK LEADERBOARD
          </h3>
          <span className="text-gray-500 font-mono text-xs">
            LIFETIME • SURVIVES REDO ALL
          </span>
        </div>

        <div className="space-y-3">
          {rankedTracks.map((track, index) => {
            const progressPct = track.total_quests > 0 ? (track.quests_done / track.total_quests) * 100 : 0;
            return (
              <motion.div
                key={track.track}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08 }}
                className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-gray-800 bg-gray-900/40 ${
                  index === 0 ? 'border-gold/30 shadow-lg shadow-gold/5' : ''
                }`}
              >
                {/* Rank Medal */}
                <div className="w-8 sm:w-9 flex items-center justify-center text-xl flex-shrink-0">
                  {MEDALS[index] || <span className="text-gray-500 font-mono text-sm">{index + 1}</span>}
                </div>

                {/* Icon + Name */}
                <div className="flex items-center space-x-2 sm:space-x-3 w-28 sm:w-44 flex-shrink-0 min-w-0">
                  <span className="text-xl">{track.icon}</span>
                  <div className="min-w-0">
                    <p className="font-display text-sm text-white truncate">{track.label}</p>
                    <p className="text-xs text-gray-500 font-mono">
                      {track.quests_done}/{track.total_quests} • 🔄 {track.passes}x
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="flex-1 min-w-[3rem]">
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full bg-gradient-to-r ${trackColors[track.track] || 'from-purple-500 to-blue-500'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPct}%` }}
                      transition={{ duration: 1, delay: index * 0.1 }}
                    />
                  </div>
                </div>

                {/* XP Earned */}
                <div className="text-right flex-shrink-0">
                  <p className="text-gold font-display font-bold">+{track.xp_earned}</p>
                  <p className="text-[10px] text-gray-500 font-mono">XP EARNED</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Mini ranking bar */}
        <div className="mt-5 flex items-end justify-center gap-4 pt-4 border-t border-purple-500/10">
          {rankedTracks.map(track => (
            <div key={track.track} className="flex flex-col items-center gap-1">
              <span className="text-gold font-mono text-xs font-bold">+{track.xp_earned}</span>
              <div
                className={`w-8 sm:w-10 rounded-t bg-gradient-to-t ${trackColors[track.track] || 'from-purple-500 to-blue-500'} transition-all duration-700`}
                style={{ height: `${Math.max((track.xp_earned / maxTrackXp) * 56, 4)}px` }}
              />
              <span className="text-xs">{track.icon}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Recent Activity Log */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bg-[#161b22]/80 backdrop-blur-sm rounded-xl border border-purple-500/20 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-white font-bold tracking-wider">
            RECENT ACTIVITY
          </h3>
          <span className="text-gray-500 font-mono text-xs">
            LOGGED IN THE DATABASE — EVERYTHING YOU DO
          </span>
        </div>
        {activity.length > 0 ? (
          <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
            {activity.map(entry => {
              const meta = ACTIVITY_META[entry.action] || { icon: '📋', label: entry.action };
              const detail =
                entry.action === 'quest_complete' || entry.action === 'quest_undo'
                  ? String((entry.details as any)?.title || entry.entity || '')
                  : entry.action === 'nutrition_update'
                    ? `${new Date(entry.entity + 'T00:00:00').toLocaleDateString()} • ${(entry.details as any)?.items || 0} foods`
                    : entry.action === 'stats_update'
                      ? Object.keys((entry.details as any) || {}).join(', ')
                      : entry.action === 'dsa_redo'
                        ? `${(entry.details as any)?.reset || 0} problems reset`
                        : '';
              return (
                <div
                  key={entry.id}
                  className="flex items-center space-x-3 p-2.5 rounded-lg bg-gray-900/40 border border-gray-800"
                >
                  <span className="text-lg">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300 font-mono truncate">
                      {meta.label}{detail ? ` — ${detail}` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-gray-600 font-mono flex-shrink-0">
                    {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-gray-500 font-mono py-6">
            No activity yet — complete quests, mark nutrition, or edit stats
          </div>
        )}
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
