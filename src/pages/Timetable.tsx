import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const TIME_SLOTS = [
  { time: '04:45 AM', activities: { MON: '☀ Wake Up', TUE: '☀ Wake Up', WED: '☀ Wake Up', THU: '☀ Wake Up', FRI: '☀ Wake Up', SAT: '☀ Wake Up', SUN: '☀ Wake Up' } },
  { time: '05:15 AM', activities: { MON: '💻 DSA Practice', TUE: '💻 DSA Practice', WED: '💻 DSA Practice', THU: '💻 DSA Practice', FRI: '💻 DSA Practice', SAT: '⛓️‍💥 SaaS Dev', SUN: '⛓️‍💥 SaaS Dev' } },
  { time: '06:00 AM', activities: { MON: '🥊 MMA Class', TUE: '🥊 MMA Class', WED: '🥊 MMA Class', THU: '🥊 MMA Class', FRI: '🥊 MMA Class', SAT: '📖 System Design', SUN: '📖 System Design' } },
  { time: '07:00 AM', activities: { MON: '🥗 Nutrition Prep', TUE: '🥗 Nutrition Prep', WED: '🥗 Nutrition Prep', THU: '🥗 Nutrition Prep', FRI: '🥗 Nutrition Prep', SAT: '🧘 Meditation', SUN: '🧘 Meditation' } },
  { time: '08:00 AM', activities: { MON: '💼 Work', TUE: '💼 Work', WED: '💼 Work', THU: '💼 Work', FRI: '💼 Work', SAT: '📚 Learning', SUN: '📚 Learning' } },
  { time: '12:00 PM', activities: { MON: '🥗 Meal', TUE: '🥗 Meal', WED: '🥗 Meal', THU: '🥗 Meal', FRI: '🥗 Meal', SAT: '🍽️ Feast', SUN: '🍽️ Feast' } },
  { time: '01:00 PM', activities: { MON: '💼 Work', TUE: '💼 Work', WED: '💼 Work', THU: '💼 Work', FRI: '💼 Work', SAT: '🎮 Gaming', SUN: '🎮 Gaming' } },
  { time: '05:00 PM', activities: { MON: '💼 Work', TUE: '💼 Work', WED: '💼 Work', THU: '💼 Work', FRI: '💼 Work', SAT: '👥 Social', SUN: '👥 Social' } },
  { time: '06:00 PM', activities: { MON: '💪 Workout', TUE: '💪 Workout', WED: '💪 Workout', THU: '💪 Workout', FRI: '💪 Workout', SAT: '🌳 Outdoors', SUN: '🌳 Outdoors' } },
  { time: '07:00 PM', activities: { MON: '📖 Study', TUE: '📖 Study', WED: '📖 Study', THU: '📖 Study', FRI: '📖 Study', SAT: '📺 Entertainment', SUN: '📺 Entertainment' } },
  { time: '08:00 PM', activities: { MON: '🧘 Wind Down', TUE: '🧘 Wind Down', WED: '🧘 Wind Down', THU: '🧘 Wind Down', FRI: '🧘 Wind Down', SAT: '🪐 Stargazing', SUN: '🪐 Stargazing' } },
  { time: '09:00 PM', activities: { MON: '📝 Journal', TUE: '📝 Journal', WED: '📝 Journal', THU: '📝 Journal', FRI: '📝 Journal', SAT: '🌙 Night Routine', SUN: '🌙 Night Routine' } },
  { time: '09:30 PM', activities: { MON: '😴 Sleep Prep', TUE: '😴 Sleep Prep', WED: '😴 Sleep Prep', THU: '😴 Sleep Prep', FRI: '😴 Sleep Prep', SAT: '😴 Sleep Prep', SUN: '😴 Sleep Prep' } },
  { time: '10:45 PM', activities: { MON: '😴 Sleep', TUE: '😴 Sleep', WED: '😴 Sleep', THU: '😴 Sleep', FRI: '😴 Sleep', SAT: '😴 Sleep', SUN: '😴 Sleep' } },
];

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function Timetable() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [expandedSlot, setExpandedSlot] = useState<number | null>(null);

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const hours = currentTime.getHours();
  const minutes = currentTime.getMinutes();
  const dayIndex = currentTime.getDay();
  const todayIndex = (dayIndex + 6) % 7;

  const currentSlotIndex = TIME_SLOTS.findIndex(slot => {
    const [slotHours, slotMinutes] = slot.time.split(':');
    const slotTimeHours = parseInt(slotHours);
    const slotTimeMinutes = parseInt(slotMinutes.replace(' AM', '').replace(' PM', ''));
    const isPM = slot.time.includes('PM') && slotTimeHours !== 12;
    const adjustedHours = isPM ? slotTimeHours + 12 : (slotTimeHours === 12 && !slot.time.includes('PM')) ? 0 : slotTimeHours;
    return hours > adjustedHours ||
           (hours === adjustedHours && minutes >= slotTimeMinutes);
  }) || -1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-[calc(100vh-64px)] p-4 sm:p-6"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-display text-purple-monarch flex items-center space-x-3">
          TIMETABLE
        </h1>
        <div className="mt-3 text-sm text-muted">
          Current time: {currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-card/50 backdrop-blur-sm rounded-xl border border-purple-monarch/10">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-mono text-muted uppercase tracking-wider w-20">Time</th>
              {DAYS.map((_, index) => (
                <th
                  key={index}
                  className={`px-4 py-3 text-center text-xs font-mono text-muted uppercase tracking-wider ${index === todayIndex ? 'text-purple-glow' : ''}`}
                >
                  {DAY_NAMES[index]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map((slot, slotIndex) => {
              const isCurrent = slotIndex === currentSlotIndex;
              const isExpanded = expandedSlot === slotIndex;
              return (
                <motion.tr
                  key={slot.time}
                  initial={{ opacity: 0, y: isExpanded ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.05 * slotIndex }}
                  className={`border-b border-purple-monarch/5 ${isCurrent ? 'border-l-2 border-purple-glow' : ''} hover:bg-dungeon/30 transition-colors cursor-pointer`}
                  onClick={() => setExpandedSlot(expandedSlot === slotIndex ? null : slotIndex)}
                >
                  <td className={`px-4 py-3 text-sm font-mono whitespace-nowrap font-medium ${isCurrent ? 'text-purple-glow' : ''}`}>
                    {slot.time}
                  </td>
                  {DAYS.map(day => {
                    const activity = slot.activities[day as keyof typeof slot.activities] || '-';
                    return (
                      <td
                        key={day}
                        className={`px-4 py-3 text-center text-sm ${isCurrent ? 'font-medium text-purple-glow' : ''}`}
                      >
                        {activity}
                      </td>
                    );
                  })}
                  {isExpanded && (
                    <td colSpan={7} className="px-4 py-3">
                      <div className="mt-3 space-y-2">
                        <h3 className="font-display text-lg text-purple-monarch">
                          Details for {slot.time}
                        </h3>
                        <div className="text-sm text-muted">
                          {slot.activities[DAYS[todayIndex] as keyof typeof slot.activities] || 'No activity scheduled'}
                        </div>
                      </div>
                    </td>
                  )}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}