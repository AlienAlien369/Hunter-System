import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Suspense, lazy, useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import { useGameStore } from './store/gameStore';
import { useSoundStore } from './store/soundStore';
import { useThemeStore, applyTheme } from './store/themeStore';
import { sfx } from './utils/sounds';
import './index.css';

// Auth Components
import AuthProvider from './components/auth/AuthProvider';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './pages/Login';

/**
 * Lazy page with deploy safety: if a new deploy replaced the chunk this tab
 * expects (404 on the old hash), reload once to pick up the new build.
 * Rate-limited via sessionStorage so a genuinely broken chunk can't loop.
 */
function lazyPage<T extends React.ComponentType>(load: () => Promise<{ default: T }>) {
  return lazy(() => load().catch(err => {
    const KEY = 'hunter.chunkReloadAt';
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last > 30_000) {
      sessionStorage.setItem(KEY, String(Date.now()));
      window.location.reload();
    }
    throw err;
  }));
}

// Pages — Login and Dashboard load immediately; every other page is
// code-split and downloaded on first visit (smaller initial bundle on mobile).
import Dashboard from './pages/Dashboard';
const QuestLog = lazyPage(() => import('./pages/QuestLog'));
const PublicProfile = lazyPage(() => import('./pages/PublicProfile'));
const QuestDetail = lazyPage(() => import('./pages/QuestDetail'));
const SkillTree = lazyPage(() => import('./components/SkillTree'));
const Rank = lazyPage(() => import('./pages/Rank'));
const ProgressDashboard = lazyPage(() => import('./pages/ProgressDashboard'));
const Timetable = lazyPage(() => import('./pages/Timetable'));
const NutritionBudget = lazyPage(() => import('./pages/NutritionBudget'));
const SaaSRoadmap = lazyPage(() => import('./pages/SaaSRoadmap'));
const SystemDesign = lazyPage(() => import('./pages/SystemDesign'));
const DSARoadmap = lazyPage(() => import('./pages/DSARoadmap'));
const Inventory = lazyPage(() => import('./pages/Inventory'));
const AchievementPanel = lazyPage(() => import('./components/AchievementPanel'));
const WeeklyReport = lazyPage(() => import('./pages/WeeklyReport'));
const Settings = lazyPage(() => import('./pages/Settings'));
const Modules = lazyPage(() => import('./pages/Modules'));
const ModulePage = lazyPage(() => import('./pages/ModulePage'));
import XpConfirmHost from './components/hunter/XpConfirmHost';
import PerfectDayBanner from './components/PerfectDayBanner';
import ErrorBoundary from './components/ErrorBoundary';
import { useModuleStore } from './store/moduleStore';
import { moduleHref } from './data/presets';
import { useTimetableReminders } from './utils/reminders';
import RoutineSetup from './components/routine/RoutineSetup';
import { api } from './lib/api';

// Layout Components
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import CelebrationBanner from './components/CelebrationBanner';
import XpFloat from './components/XpFloat';
import LootDrop from './components/LootDrop';
import BackgroundFX from './components/BackgroundFX';
import HunterNameEntry from './components/HunterNameEntry';

// Fixed core pages every hunter has. Everything else is a user module
// (see /modules), listed dynamically after the core pages.
const CORE_NAV = [
  { path: '/', label: 'Dashboard', icon: '⚔' },
  { path: '/quests', label: 'Quests', icon: '✅' },
  { path: '/stats', label: 'Stats', icon: '📊' },
  { path: '/rank', label: 'Rank', icon: '🏆' },
  { path: '/progress', label: 'Progress', icon: '📈' },
  { path: '/time', label: 'Timetable', icon: '📅' },
  { path: '/inventory', label: 'Inventory', icon: '🎒' },
  { path: '/achievements', label: 'Achievements', icon: '🏆' },
  { path: '/weekly', label: 'Weekly Report', icon: '📊' },
];
const SETTINGS_NAV = { path: '/settings', label: 'Settings', icon: '⚙' };

function PageLoading() {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-label="Loading">
      <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const BOOT_EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const;

/**
 * Starts the Solo Leveling-style theme music and plays the system-window
 * opening chime on the first user interaction (browsers block audio until
 * a gesture, so we boot the audio engine lazily on that first click).
 */
function useScreenOpenAudio() {
  useEffect(() => {
    let booted = false;
    const boot = () => {
      if (booted) return;
      booted = true;
      const { themeMusic } = useSoundStore.getState();
      if (themeMusic) sfx.startTheme();
      sfx.systemWindow();
      BOOT_EVENTS.forEach(e => window.removeEventListener(e, boot));
    };
    BOOT_EVENTS.forEach(e => window.addEventListener(e, boot, { passive: true }));
    return () => BOOT_EVENTS.forEach(e => window.removeEventListener(e, boot));
  }, []);
}

function AppContent() {
  const location = useLocation();
  const { user, logout, setHunterName } = useAuthStore();
  const theme = useThemeStore(s => s.theme);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Apply theme on mount
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Check if hunter name needs to be set
  const needsNameEntry = user && !user.name_set;

  // Onboarding step 2: hunters without a confirmed routine are offered the
  // routine setup once per session (they can always do it later from Timetable).
  // Notifications when today's timetable quests are due (opt-in in Settings)
  useTimetableReminders();

  // Dynamic user modules → sidebar entries after the core pages
  const modules = useModuleStore(s => s.modules);
  useEffect(() => { if (user?.id) useModuleStore.getState().load(); }, [user?.id]);
  // Game data for every page — deep links (/quests from a push nudge, refreshes)
  // must not wait for a visit to the Dashboard.
  useEffect(() => { if (user?.id) useGameStore.getState().loadDashboard(); }, [user?.id]);
  const navItems = [
    ...CORE_NAV,
    ...modules.map(m => ({ path: moduleHref(m), label: m.status === 'paused' ? `${m.name} (paused)` : m.name, icon: m.icon })),
    { path: '/modules', label: 'Modules', icon: '🧩' },
    SETTINGS_NAV,
  ];

  const [routineSetup, setRoutineSetup] = useState(false);
  // Any "Create my timetable" button (Quest Log, Dashboard) opens the setup.
  useEffect(() => {
    const open = () => setRoutineSetup(true);
    window.addEventListener('hunter-open-routine-setup', open);
    return () => window.removeEventListener('hunter-open-routine-setup', open);
  }, []);
  useEffect(() => {
    if (!user?.name_set) return;
    const key = `routineSetupOffered:${user.id}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch { /* storage unavailable */ }
    api.getRoutine().then(r => { if (!r.routine) setRoutineSetup(true); }).catch(() => {});
  }, [user?.id, user?.name_set]);

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen text-white overflow-hidden" style={{ background: 'var(--bg-base)', transition: 'background 0.8s ease' }}>
      {/* Animated system background */}
      <BackgroundFX />

      <div className="relative flex h-screen">
        {/* Sidebar */}
        <Sidebar
          items={navItems}
          currentPath={location.pathname}
          userName={user?.name || user?.username || 'Hunter'}
          onLogout={() => logout()}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar onMenuToggle={() => setSidebarOpen(v => !v)} />

          <main className="flex-1 overflow-y-auto custom-scrollbar">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 24, scale: 0.985, filter: 'blur(5px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -24, scale: 0.985, filter: 'blur(5px)' }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                className="p-4 sm:p-6"
              >
                {/* Per-route boundary: navigating away from a broken page recovers. */}
                <ErrorBoundary key={location.pathname}>
                <Suspense fallback={<PageLoading />}>
                <Routes>
                  <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/quests" element={<ProtectedRoute><QuestLog /></ProtectedRoute>} />
                  <Route path="/quests/:id" element={<ProtectedRoute><QuestDetail /></ProtectedRoute>} />
                  <Route path="/stats" element={<ProtectedRoute><SkillTree /></ProtectedRoute>} />
                  <Route path="/rank" element={<ProtectedRoute><Rank /></ProtectedRoute>} />
                  <Route path="/progress" element={<ProtectedRoute><ProgressDashboard /></ProtectedRoute>} />
                  <Route path="/time" element={<ProtectedRoute><Timetable /></ProtectedRoute>} />
                  <Route path="/diet" element={<ProtectedRoute><NutritionBudget /></ProtectedRoute>} />
                  <Route path="/modules" element={<ProtectedRoute><Modules /></ProtectedRoute>} />
                  <Route path="/m/:slug" element={<ProtectedRoute><ModulePage /></ProtectedRoute>} />
                  <Route path="/saas" element={<ProtectedRoute><SaaSRoadmap /></ProtectedRoute>} />
                  <Route path="/arch" element={<ProtectedRoute><SystemDesign /></ProtectedRoute>} />
                  <Route path="/dsa-roadmap" element={<ProtectedRoute><DSARoadmap /></ProtectedRoute>} />
                  <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
                  <Route path="/achievements" element={<ProtectedRoute><AchievementPanel /></ProtectedRoute>} />
                  <Route path="/weekly" element={<ProtectedRoute><WeeklyReport /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                </Suspense>
                </ErrorBoundary>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Hunter Name Entry (one-time) */}
      {needsNameEntry && (
        <HunterNameEntry
          onComplete={(name) => {
            setHunterName(name);
            // Refresh game store so dashboard shows the new name
            useGameStore.getState().loadDashboard();
            sfx.levelUp();
          }}
        />
      )}

      <XpConfirmHost />
      <PerfectDayBanner />
      <RoutineSetup open={routineSetup && !needsNameEntry} onClose={() => setRoutineSetup(false)} onDone={() => setRoutineSetup(false)} />

      {/* Level-up / rank-up celebration + floating XP toasts */}
      <CelebrationBanner />
      <XpFloat />
      <LootDrop />
    </div>
  );
}

function App() {
  useScreenOpenAudio();
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/h/:name" element={<Suspense fallback={null}><PublicProfile /></Suspense>} />
        <Route path="*" element={<AppContent />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
