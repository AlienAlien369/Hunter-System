import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import StatusWindow from '../components/StatusWindow';
import ActiveQuests from '../components/ActiveQuests';
import QuickStats from '../components/QuickStats';
import RankProgress from '../components/RankProgress';
import StreakCalendar from '../components/StreakCalendar';
import HiddenQuestCard from '../components/HiddenQuestCard';
import PenaltyBanner from '../components/PenaltyBanner';
import UnplannedActivity from '../components/UnplannedActivity';
import ShareCardButton from '../components/ShareCardButton';
import { useModuleStore } from '../store/moduleStore';
import { Panel } from '../components/hunter/ui';
import { TaskRow } from '../components/hunter/tasks';
import { isDoneToday, isScheduledToday } from '../components/hunter/taskUtils';

export default function Dashboard() {
  const { profile, loadDashboard, quests } = useGameStore();
  const modules = useModuleStore(s => s.modules);
  const active = new Map(modules.filter(m => m.status === 'active').map(m => [m.slug, m]));
  const missions = quests.filter(q => q.quest_id.startsWith('CQ-') && active.has(q.category) && isScheduledToday(q))
    .sort((a, b) => (a.schedule_time ?? '99').localeCompare(b.schedule_time ?? '99'));

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <div className="space-y-6">
      {/* Hidden quest + missed-quest penalty notices */}
      <PenaltyBanner />
      <HiddenQuestCard />

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
        <div className="flex flex-wrap items-center gap-2">
          <ShareCardButton />
          <UnplannedActivity />
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

      {/* Today's tasks from the hunter's own modules (skincare, content, …) */}
      {missions.length > 0 && (
        <Panel title="MODULE MISSIONS" right={<span className="text-xs font-mono text-purple-300">{missions.filter(isDoneToday).length}/{missions.length} done</span>}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {missions.map(q => <TaskRow key={q.quest_id} quest={q} subtitle={`${active.get(q.category)!.icon} ${active.get(q.category)!.name}`} />)}
          </div>
        </Panel>
      )}

      {/* Streak Calendar */}
      <StreakCalendar />

      {/* Bottom Row - Quick Stats & Rank */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <QuickStats />
        <RankProgress />
      </div>
    </div>
  );
}
