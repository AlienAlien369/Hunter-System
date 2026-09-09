import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "../store/gameStore";
import {
  getStreak,
  getLongestStreak,
  getTotalActiveDays,
  getDayIntensity,
  MAX_DAILY_COMPLETIONS,
} from "../utils/xp";
import { sfx } from "../utils/sounds";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FREEZE_COST = 100; // XP per freeze

/** Colour梯度: 0 completions = empty → 15 = blazing gold. */
function getIntensityClass(count: number): string {
  if (count === 0) return "bg-gray-800/40 border-gray-700/30";
  const ratio = count / MAX_DAILY_COMPLETIONS;
  if (ratio <= 0.2) return "bg-orange-950/60 border-orange-800/40";
  if (ratio <= 0.4) return "bg-orange-900/60 border-orange-700/40";
  if (ratio <= 0.6) return "bg-orange-700/50 border-orange-600/50";
  if (ratio <= 0.8)
    return "bg-gradient-to-br from-orange-500 to-red-500 border-orange-400/50";
  return "bg-gradient-to-br from-yellow-400 to-orange-500 border-yellow-400/60 shadow-[0_0_8px_rgba(251,146,60,0.3)]";
}

export default function StreakCalendar() {
  const {
    dailyQuests,
    freezeCount,
    freezeDates,
    buyFreeze,
    useFreeze: freezeStreak,
    profile,
  } = useGameStore();
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [showFreezeConfirm, setShowFreezeConfirm] = useState(false);
  const [freezeTarget, setFreezeTarget] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  // Gather all completed dates from daily quests (DQ-* only)
  const allCompletedDates = dailyQuests
    .filter((q) => q.id.startsWith("DQ-"))
    .flatMap((q) => q.completedDates);

  const streak = getStreak(allCompletedDates, freezeDates);
  const longestStreak = getLongestStreak(allCompletedDates, freezeDates);
  const totalActiveDays = getTotalActiveDays(allCompletedDates);

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const navigateMonth = (dir: number) => {
    let m = viewMonth + dir;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y--;
    }
    if (m > 11) {
      m = 0;
      y++;
    }
    setViewMonth(m);
    setViewYear(y);
  };

  const handleFreezeClick = (dateStr: string) => {
    if (freezeCount <= 0 || freezeDates.includes(dateStr)) return;
    setFreezeTarget(dateStr);
    setShowFreezeConfirm(true);
  };

  const confirmFreeze = () => {
    if (!freezeTarget) return;
    freezeStreak(freezeTarget);
    sfx.complete();
    setShowFreezeConfirm(false);
    setFreezeTarget(null);
  };

  const canBuyFreeze = profile.xp >= FREEZE_COST;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0d1117]/90 backdrop-blur-xl rounded-xl border border-purple-500/30 overflow-hidden"
    >
      {/* Header with streak stats */}
      <div className="bg-gradient-to-r from-orange-900/30 via-red-900/20 to-orange-900/30 px-6 py-4 border-b border-orange-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Fire counter */}
            <div className="flex items-center gap-2">
              <motion.span
                className="text-3xl"
                animate={
                  streak > 0
                    ? { scale: [1, 1.15, 1], rotate: [0, -5, 5, 0] }
                    : {}
                }
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
              >
                🔥
              </motion.span>
              <div>
                <p className="text-2xl font-display font-bold text-orange-400">
                  {streak}
                </p>
                <p className="text-[10px] text-gray-500 font-mono tracking-wider">
                  STREAK
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="w-px h-8 bg-orange-500/20" />

            {/* Best streak */}
            <div className="text-center">
              <p className="text-lg font-display font-bold text-yellow-400">
                {longestStreak}
              </p>
              <p className="text-[10px] text-gray-500 font-mono tracking-wider">
                BEST
              </p>
            </div>

            {/* Divider */}
            <div className="w-px h-8 bg-orange-500/20" />

            {/* Total days */}
            <div className="text-center">
              <p className="text-lg font-display font-bold text-purple-400">
                {totalActiveDays}
              </p>
              <p className="text-[10px] text-gray-500 font-mono tracking-wider">
                TOTAL DAYS
              </p>
            </div>
          </div>

          {/* Streak freeze badge */}
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-xs font-mono text-gray-400">❄️ Freezes</p>
              <p className="text-lg font-display font-bold text-cyan-400">
                {freezeCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Month navigator */}
      <div className="px-6 pt-4 flex items-center justify-between">
        <button
          onClick={() => navigateMonth(-1)}
          className="p-2 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-white/5"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h3 className="font-display text-white font-bold tracking-wider text-sm">
          {MONTHS[viewMonth]} {viewYear}
        </h3>
        <button
          onClick={() => navigateMonth(1)}
          className="p-2 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-white/5"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* Calendar grid */}
      <div className="px-6 pb-4 pt-2">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1.5 mb-1">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="text-center text-[10px] font-mono text-gray-500 py-1"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((day, idx) => {
            if (day === null) return <div key={`empty-${idx}`} />;
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const intensity = getDayIntensity(dateStr, allCompletedDates);
            const isFrozen = freezeDates.includes(dateStr);
            const isToday = dateStr === today;
            const isFuture = new Date(dateStr) > new Date(today);

            return (
              <motion.button
                key={dateStr}
                whileHover={
                  !isFuture && freezeCount > 0 && !isFrozen && intensity === 0
                    ? { scale: 1.1 }
                    : {}
                }
                whileTap={!isFuture ? { scale: 0.95 } : {}}
                onClick={() => {
                  if (!isFuture && intensity === 0 && !isFrozen)
                    handleFreezeClick(dateStr);
                }}
                disabled={isFuture}
                className={`
                  relative aspect-square rounded-lg border flex flex-col items-center justify-center
                  transition-all duration-200
                  ${isFuture ? "opacity-30 cursor-default" : "cursor-pointer"}
                  ${
                    isFrozen
                      ? "bg-cyan-900/50 border-cyan-400/40"
                      : getIntensityClass(intensity)
                  }
                  ${isToday ? "ring-2 ring-purple-400/60" : ""}
                `}
                title={
                  isFrozen
                    ? `❄️ Frozen day — streak preserved`
                    : intensity > 0
                      ? `${intensity}/${MAX_DAILY_COMPLETIONS} quests completed`
                      : isFuture
                        ? ""
                        : freezeCount > 0 && !isFrozen
                          ? `Click to apply streak freeze ❄️`
                          : "No quests completed"
                }
              >
                <span
                  className={`text-xs font-mono ${isToday ? "text-purple-300 font-bold" : isFrozen ? "text-cyan-300" : intensity > 0 ? "text-white font-bold" : "text-gray-600"}`}
                >
                  {day}
                </span>
                {isFrozen && <span className="text-[8px]">❄️</span>}
                {intensity > 0 && !isFrozen && (
                  <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/60" />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Streak freeze shop */}
      <div className="px-6 py-4 border-t border-purple-500/10 bg-black/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg">❄️</span>
            <div>
              <p className="text-xs font-mono text-gray-400">Streak Freeze</p>
              <p className="text-[10px] text-gray-600 font-mono">
                Preserve a missed day
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (canBuyFreeze) {
                buyFreeze(FREEZE_COST);
                sfx.complete();
              }
            }}
            disabled={!canBuyFreeze}
            className={`
              px-4 py-1.5 rounded-lg font-display text-xs font-bold border transition-all
              ${
                canBuyFreeze
                  ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20 hover:border-cyan-400/50"
                  : "bg-gray-800/50 text-gray-600 border-gray-700/30 cursor-not-allowed"
              }
            `}
          >
            BUY ❄️ — {FREEZE_COST} XP
          </button>
        </div>
      </div>

      {/* Freeze confirm modal */}
      <AnimatePresence>
        {showFreezeConfirm && freezeTarget && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-[80]"
              onClick={() => setShowFreezeConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="fixed inset-0 z-[81] flex items-center justify-center p-4"
            >
              <div className="bg-[#0d1117] border border-cyan-500/30 rounded-xl p-6 max-w-sm w-full shadow-2xl shadow-cyan-500/10">
                <div className="text-center">
                  <span className="text-4xl block mb-3">❄️</span>
                  <h3 className="text-lg font-display text-white font-bold mb-2">
                    ACTIVATE STREAK FREEZE?
                  </h3>
                  <p className="text-sm text-gray-400 mb-1">
                    Freeze{" "}
                    <span className="text-cyan-400 font-mono">
                      {freezeTarget}
                    </span>{" "}
                    to preserve your streak.
                  </p>
                  <p className="text-xs text-gray-600 font-mono mb-4">
                    Remaining freezes: {freezeCount - 1}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowFreezeConfirm(false)}
                      className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-gray-400 font-display text-sm hover:bg-gray-800 transition-colors"
                    >
                      CANCEL
                    </button>
                    <button
                      onClick={confirmFreeze}
                      className="flex-1 px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-display text-sm font-bold hover:bg-cyan-500/30 transition-colors"
                    >
                      FREEZE ❄️
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
