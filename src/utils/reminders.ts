import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { todaysBoard } from './dailyBoard';
import { localDateKey } from './date';

// Timetable reminders: a notification when each of today's timetable quests
// is due. Scheduled in the browser while Hunter is open (or installed and
// running in the background); shown through the service worker when available
// so tapping it opens the Quest Log.

const KEY = 'hunter.reminders';

export const remindersSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export function remindersEnabled(): boolean {
  try {
    return remindersSupported() && localStorage.getItem(KEY) === 'on' && Notification.permission === 'granted';
  } catch {
    return false;
  }
}

/** Ask for permission and remember the choice. Returns whether reminders are now on. */
export async function enableReminders(): Promise<boolean> {
  if (!remindersSupported()) return false;
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  try { localStorage.setItem(KEY, permission === 'granted' ? 'on' : 'off'); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event('hunter-reminders'));
  return permission === 'granted';
}

export function disableReminders() {
  try { localStorage.setItem(KEY, 'off'); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event('hunter-reminders'));
}

export async function notify(title: string, body: string, url = '/quests') {
  const options = { body, icon: '/icon-192.png', badge: '/icon-192.png', tag: `${title}-${new Date().toDateString()}`, data: { url } };
  const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
  if (reg) return reg.showNotification(title, options);
  new Notification(title, options);
}

/** Milliseconds from `now` until HH:MM today (negative if already past). */
export function msUntil(time: string, now = new Date()): number {
  const [h, m] = time.split(':').map(Number);
  const at = new Date(now);
  at.setHours(h, m, 0, 0);
  return at.getTime() - now.getTime();
}

/** Schedules today's remaining timetable reminders; reschedules when quests or the setting change. */
export function useTimetableReminders() {
  const dailyQuests = useGameStore(s => s.dailyQuests);
  useEffect(() => {
    let timers: number[] = [];
    const schedule = () => {
      timers.forEach(clearTimeout);
      timers = [];
      if (!remindersEnabled()) return;
      const today = localDateKey();
      for (const q of todaysBoard(dailyQuests)) {
        if (!q.time || q.completedDates.includes(today)) continue;
        const ms = msUntil(q.time);
        if (ms <= 0 || ms > 24 * 3600_000) continue;
        timers.push(window.setTimeout(() => {
          notify(`⏰ ${q.title}`, `It's ${q.time} — time for this quest (+${q.xpReward} XP).`).catch(() => {});
        }, ms));
      }
    };
    schedule();
    window.addEventListener('hunter-reminders', schedule);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('hunter-reminders', schedule);
    };
  }, [dailyQuests]);
}
