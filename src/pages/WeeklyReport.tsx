import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { api } from '../lib/api';
import type { StatHistory } from '../lib/api';
import { getStreak, MAX_DAILY_COMPLETIONS } from '../utils/xp';
import { sfx } from '../utils/sounds';

// ─── Grade System ───────────────────────────────────────────────────────────

interface WeekGrade {
  grade: string;
  label: string;
  color: string;
  bg: string;
  message: string;
}

function computeGrade(xpEarned: number, activeDays: number, questsCompleted: number): WeekGrade {
  // Score: XP (40%) + active days (30%) + quest count (30%)
  const xpScore = Math.min(xpEarned / 300, 1);       // 300 XP = full marks
  const dayScore = activeDays / 7;                     // 7/7 = full marks
  const questScore = Math.min(questsCompleted / 70, 1); // 70 quests = full marks
  const total = xpScore * 0.4 + dayScore * 0.3 + questScore * 0.3;

  if (total >= 0.9) return { grade: 'S', label: 'S-Rank Output',   color: 'text-yellow-400',  bg: 'from-yellow-500/20 to-amber-500/20', message: 'The System is impressed. Legendary performance this week, Hunter.' };
  if (total >= 0.75) return { grade: 'A', label: 'A-Rank Output',  color: 'text-gold',        bg: 'from-yellow-600/15 to-yellow-500/15', message: 'Outstanding discipline. You are among the elite hunters.' };
  if (total >= 0.55) return { grade: 'B', label: 'B-Rank Output',  color: 'text-purple-400',  bg: 'from-purple-500/15 to-blue-500/15',  message: 'Solid performance. The System acknowledges your effort.' };
  if (total >= 0.35) return { grade: 'C', label: 'C-Rank Output',  color: 'text-blue-400',    bg: 'from-blue-500/15 to-cyan-500/15',    message: 'Room for improvement. Push harder next week, Hunter.' };
  if (total >= 0.15) return { grade: 'D', label: 'D-Rank Output',  color: 'text-gray-400',    bg: 'from-gray-500/10 to-gray-600/10',     message: 'Below expectations. The System expects more from you.' };
  return { grade: 'E', label: 'E-Rank Output', color: 'text-red-400', bg: 'from-red-500/10 to-red-600/10', message: 'Critical: minimal activity detected. Re-engage immediately.' };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getWeekDates(offsetWeeks = 0): string[] {
  const dates: string[] = [];
  const now = new Date();
  // Start from Monday of the target week
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + offsetWeeks * 7);

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function getWeekLabel(dates: string[]): string {
  const start = new Date(dates[0] + 'T00:00:00');
  const end = new Date(dates[6] + 'T00:00:00');
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── Component ──────────────────────────────────────────────────────────────

export default function WeeklyReport() {
  const { profile, dailyQuests, freezeDates, unlockedAchievements, loadDashboard } = useGameStore();
  const reportRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [statHistory, setStatHistory] = useState<StatHistory[]>([]);

  // This week + last week
  const thisWeekDates = getWeekDates(0);
  const lastWeekDates = getWeekDates(-1);

  useEffect(() => {
    loadDashboard();
    api.getStatsHistory(14)
      .then(setStatHistory)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [loadDashboard]);

  // ── Compute this week's data ──

  const allCompletedDates = dailyQuests
    .filter(q => q.id.startsWith('DQ-'))
    .flatMap(q => q.completedDates);

  const thisWeekStats = thisWeekDates.map((date, i) => {
    const dayHistory = statHistory.find(h => h.completion_date === date);
    const questsCompleted = dailyQuests
      .filter(q => q.id.startsWith('DQ-'))
      .filter(q => q.completedDates.includes(date)).length;
    const xpEarned = dayHistory?.xp_gained ?? 0;
    const intensity = questsCompleted / MAX_DAILY_COMPLETIONS;
    return { date, dayName: DAY_NAMES[i], questsCompleted, xpEarned, intensity };
  });

  const lastWeekStats = lastWeekDates.map((date, i) => {
    const dayHistory = statHistory.find(h => h.completion_date === date);
    const questsCompleted = dailyQuests
      .filter(q => q.id.startsWith('DQ-'))
      .filter(q => q.completedDates.includes(date)).length;
    const xpEarned = dayHistory?.xp_gained ?? 0;
    return { date, dayName: DAY_NAMES[i], questsCompleted, xpEarned };
  });

  const thisWeekTotalXp = thisWeekStats.reduce((s, d) => s + d.xpEarned, 0);
  const lastWeekTotalXp = lastWeekStats.reduce((s, d) => s + d.xpEarned, 0);
  const thisWeekTotalQuests = thisWeekStats.reduce((s, d) => s + d.questsCompleted, 0);
  const lastWeekTotalQuests = lastWeekStats.reduce((s, d) => s + d.questsCompleted, 0);
  const thisWeekActiveDays = thisWeekStats.filter(d => d.questsCompleted > 0).length;
  const lastWeekActiveDays = lastWeekStats.filter(d => d.questsCompleted > 0).length;

  const bestDay = [...thisWeekStats].sort((a, b) => b.xpEarned - a.xpEarned)[0];
  const worstDay = [...thisWeekStats].filter(d => d.questsCompleted > 0).sort((a, b) => a.xpEarned - b.xpEarned)[0];

  const streak = getStreak(allCompletedDates, freezeDates);
  const grade = computeGrade(thisWeekTotalXp, thisWeekActiveDays, thisWeekTotalQuests);

  // Week-over-week deltas
  const xpDelta = thisWeekTotalXp - lastWeekTotalXp;
  const questDelta = thisWeekTotalQuests - lastWeekTotalQuests;
  const dayDelta = thisWeekActiveDays - lastWeekActiveDays;

  // ── Share as image ──

  const handleShare = useCallback(async () => {
    if (!reportRef.current) return;
    setSharing(true);
    sfx.click();

    try {
      const el = reportRef.current;
      // Use the native Clipboard API with a canvas render
      const canvas = document.createElement('canvas');
      const rect = el.getBoundingClientRect();
      const scale = 2; // retina
      canvas.width = rect.width * scale;
      canvas.height = rect.height * scale;

      // Use SVG-based approach for screenshot
      const svgData = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              background: #0a0e1a;
              color: white;
              padding: 24px;
              width: ${rect.width}px;
            ">
              ${el.innerHTML}
            </div>
          </foreignObject>
        </svg>
      `;

      // Fallback: try to use the Clipboard API to copy text
      const reportText = generateTextReport();
      await navigator.clipboard.writeText(reportText);
      sfx.complete();
    } catch {
      // If clipboard fails, just notify
    } finally {
      setSharing(false);
    }
  }, [thisWeekStats, thisWeekTotalXp, thisWeekTotalQuests, thisWeekActiveDays, streak, grade, profile]);

  const generateTextReport = (): string => {
    const lines = [
      `⚔️ WEEKLY HUNTER REPORT`,
      `${getWeekLabel(thisWeekDates)}`,
      ``,
      `📊 SUMMARY`,
      `  XP Earned: ${thisWeekTotalXp}`,
      `  Quests Completed: ${thisWeekTotalQuests}`,
      `  Active Days: ${thisWeekActiveDays}/7`,
      `  Current Streak: ${streak} days`,
      ``,
      `📈 SYSTEM GRADE: ${grade.grade} — ${grade.label}`,
      `  "${grade.message}"`,
      ``,
      `📅 DAY BREAKDOWN`,
      ...thisWeekStats.map(d => `  ${d.dayName}: ${d.questsCompleted} quests · ${d.xpEarned} XP`),
      ``,
      bestDay ? `  🏆 Best Day: ${bestDay.dayName} (${bestDay.xpEarned} XP)` : '',
      worstDay ? `  📉 Worst Day: ${worstDay.dayName} (${worstDay.xpEarned} XP)` : '',
      ``,
      `🔄 VS LAST WEEK`,
      `  XP: ${xpDelta >= 0 ? '+' : ''}${xpDelta} (${lastWeekTotalXp} → ${thisWeekTotalXp})`,
      `  Quests: ${questDelta >= 0 ? '+' : ''}${questDelta}`,
      `  Active Days: ${dayDelta >= 0 ? '+' : ''}${dayDelta}`,
      ``,
      `Generated by Freebuff 🤖`,
    ];
    return lines.filter(Boolean).join('\n');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <motion.span
            className="text-4xl block mb-3"
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            ⚔️
          </motion.span>
          <p className="text-gray-400 font-mono text-sm">Generating report...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-display text-white font-bold tracking-wider">
            WEEKLY REPORT
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">
            {getWeekLabel(thisWeekDates)}
          </p>
        </div>
        <button
          onClick={handleShare}
          disabled={sharing}
          className="px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 font-display text-sm font-bold hover:bg-purple-500/20 transition-all disabled:opacity-50"
        >
          {sharing ? '📋 COPYING...' : '📋 COPY REPORT'}
        </button>
      </motion.div>

      {/* ── Shareable report card ── */}
      <div ref={reportRef}>
        {/* System Grade - Hero */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className={`bg-gradient-to-br ${grade.bg} backdrop-blur-xl rounded-2xl border border-purple-500/20 p-8 text-center mb-6`}
        >
          <p className="text-[10px] font-mono text-gray-500 tracking-[0.3em] mb-2">THE SYSTEM GRADES YOUR PERFORMANCE</p>
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.3 }}
            className="inline-flex items-center justify-center w-28 h-28 rounded-full border-4 border-current mb-4"
            style={{ borderColor: grade.grade === 'S' ? '#facc15' : grade.grade === 'A' ? '#eab308' : grade.grade === 'B' ? '#a855f7' : grade.grade === 'C' ? '#3b82f6' : '#6b7280' }}
          >
            <span className={`text-6xl font-display font-bold ${grade.color}`}>{grade.grade}</span>
          </motion.div>
          <p className={`text-lg font-display font-bold ${grade.color}`}>{grade.label}</p>
          <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto italic">"{grade.message}"</p>
        </motion.div>

        {/* Summary Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'XP EARNED', value: thisWeekTotalXp.toLocaleString(), icon: '⚡', color: 'text-yellow-400', sub: xpDelta !== 0 ? `${xpDelta >= 0 ? '+' : ''}${xpDelta} vs last week` : undefined },
            { label: 'QUESTS DONE', value: thisWeekTotalQuests, icon: '✅', color: 'text-green-400', sub: questDelta !== 0 ? `${questDelta >= 0 ? '+' : ''}${questDelta} vs last week` : undefined },
            { label: 'ACTIVE DAYS', value: `${thisWeekActiveDays}/7`, icon: '📅', color: 'text-blue-400', sub: dayDelta !== 0 ? `${dayDelta >= 0 ? '+' : ''}${dayDelta} vs last week` : undefined },
            { label: 'STREAK', value: `${streak} days`, icon: '🔥', color: 'text-orange-400' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.05 }}
              className="bg-[#0d1117]/80 backdrop-blur-sm rounded-xl border border-purple-500/20 p-4"
            >
              <span className="text-xl">{stat.icon}</span>
              <p className={`text-2xl font-display font-bold ${stat.color} mt-1`}>{stat.value}</p>
              <p className="text-[10px] font-mono text-gray-500 tracking-wider">{stat.label}</p>
              {stat.sub && <p className="text-[10px] font-mono text-gray-600 mt-0.5">{stat.sub}</p>}
            </motion.div>
          ))}
        </div>

        {/* Day-by-Day Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#0d1117]/80 backdrop-blur-sm rounded-xl border border-purple-500/20 p-6 mb-6"
        >
          <h3 className="font-display text-white font-bold tracking-wider text-sm mb-4">DAY-BY-DAY BREAKDOWN</h3>
          <div className="space-y-2">
            {thisWeekStats.map((day, i) => {
              const maxXP = Math.max(...thisWeekStats.map(d => d.xpEarned), 1);
              const barWidth = (day.xpEarned / maxXP) * 100;
              const isBest = bestDay && day.date === bestDay.date;
              const isWorst = worstDay && day.date === worstDay.date && day.questsCompleted > 0;
              const isToday = day.date === new Date().toISOString().split('T')[0];

              return (
                <motion.div
                  key={day.date}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.05 }}
                  className={`flex items-center gap-3 p-2 rounded-lg ${isToday ? 'bg-purple-500/10 border border-purple-500/20' : 'hover:bg-white/3'}`}
                >
                  <span className={`w-10 text-xs font-mono ${isToday ? 'text-purple-400 font-bold' : 'text-gray-500'}`}>
                    {day.dayName}
                  </span>
                  <div className="flex-1 h-6 bg-gray-800/50 rounded-lg overflow-hidden relative">
                    <motion.div
                      className={`h-full rounded-lg ${
                        isBest ? 'bg-gradient-to-r from-yellow-500 to-amber-500' :
                        isWorst ? 'bg-gradient-to-r from-red-500/50 to-red-600/50' :
                        'bg-gradient-to-r from-purple-500/50 to-blue-500/50'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${barWidth}%` }}
                      transition={{ duration: 0.8, delay: 0.6 + i * 0.05 }}
                    />
                    <span className="absolute inset-y-0 left-2 flex items-center text-[10px] font-mono text-gray-300">
                      {day.questsCompleted > 0 ? `${day.questsCompleted} quests · ${day.xpEarned} XP` : '—'}
                    </span>
                  </div>
                  {isBest && <span className="text-[10px] font-mono text-yellow-400">🏆 BEST</span>}
                  {isWorst && <span className="text-[10px] font-mono text-red-400">📉 LOW</span>}
                </motion.div>
              );
            })}
          </div>

          {/* Best / Worst summary */}
          <div className="flex gap-4 mt-4 pt-4 border-t border-white/5">
            {bestDay && (
              <div className="flex-1 text-center">
                <p className="text-[10px] font-mono text-gray-500 tracking-wider">BEST DAY</p>
                <p className="text-sm font-display text-yellow-400 font-bold">{bestDay.dayName}</p>
                <p className="text-xs font-mono text-gray-400">{bestDay.xpEarned} XP · {bestDay.questsCompleted} quests</p>
              </div>
            )}
            {worstDay && (
              <div className="flex-1 text-center">
                <p className="text-[10px] font-mono text-gray-500 tracking-wider">WORST DAY</p>
                <p className="text-sm font-display text-red-400 font-bold">{worstDay.dayName}</p>
                <p className="text-xs font-mono text-gray-400">{worstDay.xpEarned} XP · {worstDay.questsCompleted} quests</p>
              </div>
            )}
            <div className="flex-1 text-center">
              <p className="text-[10px] font-mono text-gray-500 tracking-wider">AVERAGE / DAY</p>
              <p className="text-sm font-display text-purple-400 font-bold">{Math.round(thisWeekTotalXp / 7)}</p>
              <p className="text-xs font-mono text-gray-400">XP per day</p>
            </div>
          </div>
        </motion.div>

        {/* Week-over-Week Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-[#0d1117]/80 backdrop-blur-sm rounded-xl border border-purple-500/20 p-6 mb-6"
        >
          <h3 className="font-display text-white font-bold tracking-wider text-sm mb-4">VS LAST WEEK</h3>
          <div className="grid grid-cols-3 gap-6">
            {[
              { label: 'XP', thisWeek: thisWeekTotalXp, lastWeek: lastWeekTotalXp },
              { label: 'QUESTS', thisWeek: thisWeekTotalQuests, lastWeek: lastWeekTotalQuests },
              { label: 'ACTIVE DAYS', thisWeek: thisWeekActiveDays, lastWeek: lastWeekActiveDays },
            ].map((item) => {
              const delta = item.thisWeek - item.lastWeek;
              const pct = item.lastWeek > 0 ? ((delta / item.lastWeek) * 100) : (item.thisWeek > 0 ? 100 : 0);
              const improved = delta > 0;
              const same = delta === 0;

              return (
                <div key={item.label} className="text-center">
                  <p className="text-[10px] font-mono text-gray-500 tracking-wider mb-2">{item.label}</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-lg font-display font-bold text-gray-500">{item.lastWeek}</span>
                    <span className="text-gray-600">→</span>
                    <span className={`text-lg font-display font-bold ${improved ? 'text-green-400' : same ? 'text-gray-400' : 'text-red-400'}`}>
                      {item.thisWeek}
                    </span>
                  </div>
                  <p className={`text-xs font-mono mt-1 ${improved ? 'text-green-400' : same ? 'text-gray-500' : 'text-red-400'}`}>
                    {same ? '— same' : `${improved ? '↑' : '↓'} ${Math.abs(Math.round(pct))}%`}
                  </p>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Hunter Profile Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex items-center justify-between bg-[#0d1117]/60 rounded-xl border border-white/5 px-6 py-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
              <span className="text-lg font-display font-bold text-purple-400">{profile.rank}</span>
            </div>
            <div>
              <p className="text-sm font-display text-white font-bold">{profile.name}</p>
              <p className="text-[10px] font-mono text-gray-500">Level {profile.level} · {profile.xp.toLocaleString()} XP</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-mono text-gray-600">Generated by</p>
            <p className="text-xs font-display text-purple-400 font-bold">FREEBUFF ⚔️</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
