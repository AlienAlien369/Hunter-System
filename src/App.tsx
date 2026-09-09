import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import './index.css';

// Auth Components
import AuthProvider from './components/auth/AuthProvider';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './pages/Login';

// Pages
import Dashboard from './pages/Dashboard';
import QuestLog from './pages/QuestLog';
import QuestDetail from './pages/QuestDetail';
import StatSheet from './pages/StatSheet';
import Rank from './pages/Rank';
import ProgressDashboard from './pages/ProgressDashboard';
import Timetable from './pages/Timetable';
import NutritionBudget from './pages/NutritionBudget';
import SaaSRoadmap from './pages/SaaSRoadmap';
import SystemDesign from './pages/SystemDesign';
import DSARoadmap from './pages/DSARoadmap';

// Layout Components
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';

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
];

function AppContent() {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'linear-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 246, 0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} />
      </div>

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
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className="p-4 sm:p-6"
              >
                <Routes>
                  <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/quests" element={<ProtectedRoute><QuestLog /></ProtectedRoute>} />
                  <Route path="/quests/:id" element={<ProtectedRoute><QuestDetail /></ProtectedRoute>} />
                  <Route path="/stats" element={<ProtectedRoute><StatSheet /></ProtectedRoute>} />
                  <Route path="/rank" element={<ProtectedRoute><Rank /></ProtectedRoute>} />
                  <Route path="/progress" element={<ProtectedRoute><ProgressDashboard /></ProtectedRoute>} />
                  <Route path="/time" element={<ProtectedRoute><Timetable /></ProtectedRoute>} />
                  <Route path="/diet" element={<ProtectedRoute><NutritionBudget /></ProtectedRoute>} />
                  <Route path="/saas" element={<ProtectedRoute><SaaSRoadmap /></ProtectedRoute>} />
                  <Route path="/arch" element={<ProtectedRoute><SystemDesign /></ProtectedRoute>} />
                  <Route path="/dsa-roadmap" element={<ProtectedRoute><DSARoadmap /></ProtectedRoute>} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}

function App() {
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
