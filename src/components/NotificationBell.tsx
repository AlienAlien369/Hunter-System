import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { ActivityEntry } from '../lib/api';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { sfx } from '../utils/sounds';
import { todayKey } from '../data/hiddenQuests';

interface Notice {
  id: string;
  icon: string;
  title: string;
  detail: string;
  time: string;
  /** Route to jump to when the row is clicked. */
  to: string;
}

/** Which server activity events become notifications, how to describe them, and where they lead. */
const NOTICE_META: Record<string, { icon: string; title: string; to: (d: Record<string, unknown> | null, entity: string | null) => string; detail: (d: Record<string, unknown> | null) => string }> = {
  quest_complete: {
    icon: '✅',
    title: 'Quest completed',
    to: (_d, entity) => entity ? `/quests/${entity}` : '/quests',
    detail: d => `+${Number(d?.xp ?? 0)} XP · ${String(d?.title ?? 'Quest cleared')}`,
  },
  quest_undo: {
    icon: '↩️',
    title: 'Quest uncompleted',
    to: (_d, entity) => entity ? `/quests/${entity}` : '/quests',
    detail: d => `${String(d?.title ?? 'Quest')} reverted`,
  },
  penalty_applied: {
    icon: '💀',
    title: 'Penalty applied',
    to: () => '/',
    detail: d => `-${Number(d?.xp_lost ?? 0)} XP, -${Number(d?.hp_lost ?? 0)} HP after ${Number(d?.missed_days ?? 2)} missed days`,
  },
  penalty_recovered: {
    icon: '🎉',
    title: 'Streak recovered',
    to: () => '/',
    detail: d => `+${Number(d?.bonus_xp ?? 0)} XP bonus · ${Number(d?.streak ?? 0)}-day streak`,
  },
  dsa_redo: { icon: '🔄', title: 'DSA track reset', to: () => '/dsa-roadmap', detail: () => 'Progress cleared — XP kept' },
  saas_redo: { icon: '🔄', title: 'SaaS track reset', to: () => '/saas', detail: () => 'Progress cleared — XP kept' },
  arch_redo: { icon: '🔄', title: 'Architecture track reset', to: () => '/arch', detail: () => 'Progress cleared — XP kept' },
  nutrition_update: {
    icon: '🥗',
    title: 'Nutrition logged',
    to: () => '/diet',
    detail: d => `${Number(d?.items ?? 0)} item(s) recorded`,
  },
  register: {
    icon: '🆕',
    title: 'Hunter registered',
    to: () => '/',
    detail: () => 'Welcome to the System. Your training begins.',
  },
};

/** Routine bookkeeping the hunter doesn't need pings for. */
const NOISE_ACTIONS = new Set(['login', 'logout', 'stats_update']);

function toNotice(entry: ActivityEntry): Notice | null {
  const meta = NOISE_ACTIONS.has(entry.action) ? undefined : NOTICE_META[entry.action];
  if (!meta) return null;
  return {
    id: `a:${entry.id}`,
    icon: meta.icon,
    title: meta.title,
    detail: meta.detail(entry.details),
    time: entry.created_at,
    to: meta.to(entry.details, entry.entity),
  };
}

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function seenKey(username: string): string {
  return `hunter_notifications_seen_${username}`;
}

function loadSeen(username: string): Set<string> {
  try {
    const raw = localStorage.getItem(seenKey(username));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveSeen(username: string, seen: Set<string>) {
  try {
    localStorage.setItem(seenKey(username), JSON.stringify([...seen].slice(-100)));
  } catch {
    /* storage full/unavailable — ignore */
  }
}

function dismissedKey(username: string): string {
  return `hunter_notifications_dismissed_${username}`;
}

function loadDismissed(username: string): Set<string> {
  try {
    const raw = localStorage.getItem(dismissedKey(username));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(username: string, dismissed: Set<string>) {
  try {
    localStorage.setItem(dismissedKey(username), JSON.stringify([...dismissed].slice(-100)));
  } catch {
    /* storage full/unavailable — ignore */
  }
}

/**
 * Notification bell — polls the server activity log for notification-worthy
 * events (quest completions, penalties, streak recoveries, track resets,
 * nutrition, hidden quests) and shows an unread badge + dropdown panel.
 * Read state is tracked per user in localStorage.
 */
export default function NotificationBell() {
  const username = useAuthStore(s => s.user?.username);
  const hiddenQuest = useGameStore(s => s.hiddenQuest);
  const questsVersion = useGameStore(s => s.quests);
  const navigate = useNavigate();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<{ notice: Notice; wasUnread: boolean } | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const dismissedRef = useRef<Set<string>>(new Set());
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openRef = useRef(false);
  const firstLoadRef = useRef(true);
  const bellRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!username) return;
    seenRef.current = loadSeen(username);
    dismissedRef.current = loadDismissed(username);
    firstLoadRef.current = true;
    let cancelled = false;

    const refresh = async (withSound: boolean) => {
      try {
        const entries = await api.getActivity(40);
        if (cancelled) return;
        const items = entries.map(toNotice).filter((n): n is Notice => n !== null);

        // Daily nudge: a fresh hidden quest is waiting to be revealed.
        if (hiddenQuest && hiddenQuest.date === todayKey() && !hiddenQuest.revealed) {
          items.unshift({
            id: `hq:${hiddenQuest.date}`,
            icon: '❓',
            title: 'Hidden quest available',
            detail: 'The System detected a hidden challenge. Complete it today!',
            time: new Date().toISOString(),
            to: '/',
          });
        }

        setNotices(items.filter(n => !dismissedRef.current.has(n.id)));
        const fresh = items.filter(n => !seenRef.current.has(n.id)).length;
        setUnread(fresh);
        if (withSound && fresh > 0 && !firstLoadRef.current && !openRef.current) {
          sfx.notification();
        }
        firstLoadRef.current = false;
      } catch {
        /* server offline — stay quiet */
      }
    };

    refresh(false); // silent initial load
    const id = window.setInterval(() => refresh(true), 20000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [username, hiddenQuest, questsVersion]);

  const dismissId = (id: string) => {
    if (!username) return;
    // If there's already a pending undo, commit it immediately.
    if (undoTimerRef.current && toast) {
      commitDismiss(toast.notice.id);
    }
    const notice = notices.find(n => n.id === id);
    if (!notice) return;
    const wasUnread = !seenRef.current.has(id);
    // Immediately remove from visible list and mark as seen.
    seenRef.current = new Set([...seenRef.current, id]);
    saveSeen(username, seenRef.current);
    setNotices(prev => prev.filter(n => n.id !== id));
    setUnread(prev => Math.max(0, prev - (wasUnread ? 1 : 0)));
    sfx.click();
    // Show undo toast — defer the actual localStorage commit.
    setToast({ notice, wasUnread });
    undoTimerRef.current = setTimeout(() => {
      commitDismiss(id);
      setToast(null);
      undoTimerRef.current = null;
    }, 5000);
  };

  /** Persist the dismissal to localStorage and clear the undo window. */
  const commitDismiss = (id: string) => {
    if (!username) return;
    dismissedRef.current = new Set([...dismissedRef.current, id]);
    saveDismissed(username, dismissedRef.current);
  };

  /** Restore a just-dismissed notification. */
  const undoDismiss = () => {
    if (!username || !toast) return;
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    // Remove from seen so it counts as unread again.
    seenRef.current = new Set([...seenRef.current].filter(id => id !== toast.notice.id));
    saveSeen(username, seenRef.current);
    // Re-add to visible list and restore unread count.
    setNotices(prev => [toast.notice, ...prev].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()));
    setUnread(prev => prev + (toast.wasUnread ? 1 : 0));
    setToast(null);
    sfx.click();
  };

  // Clean up pending undo timer on unmount.
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  const markAllRead = () => {
    if (!username) return;
    seenRef.current = new Set([...seenRef.current, ...notices.map(n => n.id)]);
    saveSeen(username, seenRef.current);
    setUnread(0);
    sfx.click();
  };

  const handleToggle = () => {
    if (!open && username) {
      // Opening the panel acknowledges everything currently visible.
      seenRef.current = new Set([...seenRef.current, ...notices.map(n => n.id)]);
      saveSeen(username, seenRef.current);
      setUnread(0);
    }
    setOpen(v => !v);
  };

  // Anchor the portal so the dropdown hangs under the bell. The header's
  // backdrop-blur makes it a containing block for fixed children, so the
  // panel + click-outside backdrop are portaled to <body> instead.
  const rect = bellRef.current?.getBoundingClientRect();
  const panelTop = (rect?.bottom ?? 0) + 8;
  const panelRight = Math.max(8, window.innerWidth - (rect?.right ?? window.innerWidth));

  return (
    <div className="relative flex-shrink-0">
      <motion.button
        ref={bellRef}
        onClick={() => {
          sfx.click();
          handleToggle();
        }}
        whileTap={{ scale: 0.8 }}
        className={`relative p-2 text-gray-400 hover:text-white transition-colors${unread > 0 ? ' rounded-full' : ''}`}
        style={unread > 0 ? { animation: 'pulse-glow 2s ease-in-out infinite' } : undefined}
        title="Notifications"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key={unread}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-danger text-white text-[10px] font-bold flex items-center justify-center"
            >
              {unread > 99 ? '99+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.15 }}
              className="fixed z-[61] w-80 max-w-[calc(100vw-2rem)] bg-[#0d1117]/95 backdrop-blur-xl border border-purple-500/20 rounded-xl shadow-2xl shadow-purple-500/10 overflow-hidden"
              style={{ top: panelTop, right: panelRight }}
            >
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <p className="text-[10px] text-gray-500 font-mono tracking-widest">NOTIFICATIONS</p>
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[10px] text-purple-400 hover:text-purple-300 font-mono transition-colors"
                  >
                    MARK ALL READ
                  </button>
                )}
                {unread === 0 && notices.length > 0 && (
                  <span className="text-[10px] text-gray-600 font-mono">ALL READ</span>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto custom-scrollbar">
                {notices.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <div className="text-3xl mb-2">🛡️</div>
                    <p className="text-sm text-gray-400">No notifications yet</p>
                    <p className="text-xs text-gray-600 mt-1">Complete quests or hit milestones to see them here.</p>
                  </div>
                ) : (
                  notices.slice(0, 25).map(n => (
                    <div
                      key={n.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        sfx.click();
                        setOpen(false);
                        navigate(n.to);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          sfx.click();
                          setOpen(false);
                          navigate(n.to);
                        }
                      }}
                      className="group flex items-start gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors cursor-pointer text-left"
                    >
                      <span className="text-xl shrink-0">{n.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white font-medium leading-snug">{n.title}</p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{n.detail}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-gray-600 font-mono pt-0.5">{timeAgo(n.time)}</span>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            dismissId(n.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all p-0.5 -mr-1"
                          title="Dismiss"
                          aria-label="Dismiss notification"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>,
          document.body
        )}

      {/* Undo dismiss toast */}
      {createPortal(
        <AnimatePresence>
          {toast && (
            <motion.div
              key="undo-toast"
              initial={{ y: 20, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 px-4 py-2.5 bg-[#161b22]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/40"
            >
              <span className="text-sm text-gray-300">Notification dismissed</span>
              <button
                onClick={undoDismiss}
                className="text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors"
              >
                Undo
              </button>
              {/* Progress bar counting down the 5s window */}
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 5, ease: 'linear' }}
                className="absolute inset-x-0 bottom-0 h-0.5 bg-purple-500/40 rounded-b-xl origin-left"
              />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}