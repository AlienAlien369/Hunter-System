import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import { useSoundStore } from './store/soundStore';
import { useThemeStore, applyTheme } from './store/themeStore';
import { sfx } from './utils/sounds';
import './index.css';

// Auth Components
import AuthProvider from './components/auth/AuthProvider';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './pages/Login';

// Pages
import Dashboard from './pages/Dashboard';
import QuestLog from './pages/QuestLog';
import QuestDetail from './pages/QuestDetail';
import SkillTree from './components/SkillTree';
import Rank from './pages/Rank';
import ProgressDashboard from './pages/ProgressDashboard';
import Timetable from './pages/Timetable';
import NutritionBudget from './pages/NutritionBudget';
import SaaSRoadmap from './pages/SaaSRoadmap';
import SystemDesign from './pages/SystemDesign';
import DSARoadmap from './pages/DSARoadmap';
import Inventory from './pages/Inventory';
import AchievementPanel from './components/AchievementPanel';
import WeeklyReport from './pages/WeeklyReport';
import Settings from './pages/Settings';

// Layout Components
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import CelebrationBanner from './components/CelebrationBanner';
import XpFloat from './components/XpFloat';
import LootDrop from './components/LootDrop';
import BackgroundFX from './components/BackgroundFX';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '⚔' },
  { path: '/quests', label: 'Quests', icon: '✅' },
  { path: '/stats', label: 'Stats', icon: '📊' },
  { path: '/rank', label: 'Rank', icon: '🏆' },
  { path: '/progress', label: 'Progress', icon: '📈' },
  { path: '/time', label: 'Timetable', icon: '📅' },
  { path: '/diet', label: 'Diet', icon: '🥗' },
  { path: '/saas', label: 'SaaS', icon: '🚀' },
  { path: '/arch', label: 'Arch', icon: '🧠' },
  { path: '/dsa-roadmap', label: 'DSA Roadmap', icon: '📚' },
  { path: '/inventory', label: 'Inventory', icon: '🎒' },
  { path: '/achievements', label: 'Achievements', icon: '🏆' },
  { path: '/weekly', label: 'Weekly Report', icon: '📊' },
  { path: '/settings', label: 'Settings', icon: '⚙' },
];

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
  const { user, logout } = useAuthStore();
  const theme = useThemeStore(s => s.theme);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Apply theme on mount
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white overflow-hidden">
      {/* Animated system background */}
      <BackgroundFX />

      <div className="relative flex h-screen">
        {/* Sidebar */}
        <Sidebar
          items={NAV_ITEMS}
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
                <Routes>
                  <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/quests" element={<ProtectedRoute><QuestLog /></ProtectedRoute>} />
                  <Route path="/quests/:id" element={<ProtectedRoute><QuestDetail /></ProtectedRoute>} />
                  <Route path="/stats" element={<ProtectedRoute><SkillTree /></ProtectedRoute>} />
                  <Route path="/rank" element={<ProtectedRoute><Rank /></ProtectedRoute>} />
                  <Route path="/progress" element={<ProtectedRoute><ProgressDashboard /></ProtectedRoute>} />
                  <Route path="/time" element={<ProtectedRoute><Timetable /></ProtectedRoute>} />
                  <Route path="/diet" element={<ProtectedRoute><NutritionBudget /></ProtectedRoute>} />
                  <Route path="/saas" element={<ProtectedRoute><SaaSRoadmap /></ProtectedRoute>} />
                  <Route path="/arch" element={<ProtectedRoute><SystemDesign /></ProtectedRoute>} />
                  <Route path="/dsa-roadmap" element={<ProtectedRoute><DSARoadmap /></ProtectedRoute>} />
                  <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
                  <Route path="/achievements" element={<ProtectedRoute><AchievementPanel /></ProtectedRoute>} />
                  <Route path="/weekly" element={<ProtectedRoute><WeeklyReport /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

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
        <Route path="*" element={<AppContent />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
