import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import StatusWindow from '../components/StatusWindow';
import ActiveQuests from '../components/ActiveQuests';
import QuickStats from '../components/QuickStats';
import RankProgress from '../components/RankProgress';

export default function Dashboard() {
  const { profile, loadDashboard } = useGameStore();

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-display text-white font-bold tracking-wider">
            DASHBOARD
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm truncate">
            Welcome back, {profile.name}
          </p>
        </div>
        <div className="text-right">
          <p className="text-purple-400 font-mono text-xs sm:text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p className="text-gray-500 font-mono text-xs mt-1">SYSTEM STATUS: ONLINE</p>
        </div>
      </motion.div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Status Window */}
        <div className="lg:col-span-1">
          <StatusWindow />
        </div>

        {/* Middle Column - Active Quests */}
        <div className="lg:col-span-2">
          <ActiveQuests />
        </div>
      </div>

      {/* Bottom Row - Quick Stats & Rank */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <QuickStats />
        <RankProgress />
      </div>
    </div>
  );
}
