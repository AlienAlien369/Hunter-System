import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, type ModuleSummary } from '../lib/api';
import { useGameStore } from '../store/gameStore';
import { useModuleStore } from '../store/moduleStore';
import { BUILTIN_ROUTES } from '../data/presets';
import { Btn, Stat } from '../components/hunter/ui';
import { isDoneToday, isScheduledToday, refresh } from '../components/hunter/taskUtils';
import ModuleBuilder from '../components/modules/ModuleBuilder';
import TasksModuleView from '../components/modules/TasksModuleView';
import ContentModuleView from '../components/modules/ContentModuleView';
import { graceLabel, removeModule, toTaskSpec, toggleModulePause } from '../components/modules/moduleActions';

/** One page for every dynamic module — no hard-coded page per module. */
export default function ModulePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { modules, loaded, load } = useModuleStore();
  const quests = useGameStore(s => s.quests);
  const xp = useGameStore(s => s.profile.xp);
  const [summary, setSummary] = useState<ModuleSummary | null>(null);
  const [builder, setBuilder] = useState<'edit' | 'replace' | null>(null);
  const [error, setError] = useState('');

  const module = modules.find(m => m.slug === slug);
  const tasks = quests.filter(q => q.quest_id.startsWith('CQ-') && q.category === slug)
    .sort((a, b) => (a.schedule_time ?? '99').localeCompare(b.schedule_time ?? '99'));
  const today = tasks.filter(isScheduledToday);

  useEffect(() => { if (!loaded) load(); refresh(); }, [loaded, load]);
  useEffect(() => { if (slug) api.getModuleSummary(slug).then(setSummary).catch(() => {}); }, [slug, xp, tasks.length]);

  if (!loaded) return <p className="text-gray-500 font-mono text-sm">Loading module…</p>;
  if (!module) {
    return (
      <div className="space-y-3 font-mono text-sm text-gray-400">
        <p>This module doesn't exist (it may have been removed).</p>
        <Link to="/modules" className="text-purple-300 hover:text-white">← Back to modules</Link>
      </div>
    );
  }
  if (BUILTIN_ROUTES[module.kind]) return <Navigate to={BUILTIN_ROUTES[module.kind]!} replace />;

  const act = async (fn: () => Promise<boolean>, after?: () => void) => {
    setError('');
    try { if (await fn()) after?.(); } catch (e) { setError((e as Error).message); }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-display text-white font-bold tracking-wider">{module.icon} {module.name.toUpperCase()}</h1>
          <p className={`mt-1 font-mono text-xs ${module.status === 'paused' ? 'text-gray-500' : module.established ? 'text-purple-300' : 'text-yellow-300'}`}>
            {module.status === 'paused' ? 'PAUSED' : graceLabel(module).toUpperCase()}
          </p>
          {module.goals.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {module.goals.map(g => <span key={g} className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-purple-500/30 text-purple-200">🎯 {g}</span>)}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => setBuilder('edit')}>EDIT MODULE</Btn>
          <Btn variant="ghost" onClick={() => act(() => toggleModulePause(module))}>{module.status === 'paused' ? 'RESUME' : 'PAUSE'}</Btn>
          <Btn variant="ghost" onClick={() => setBuilder('replace')}>REPLACE</Btn>
          <Btn variant="danger" onClick={() => act(() => removeModule(module), () => navigate('/modules'))}>REMOVE</Btn>
        </div>
      </motion.div>
      {error && <p className="text-sm text-red-400 font-mono">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Today" value={`${today.filter(isDoneToday).length}/${today.length}`} />
        <Stat label="Streak" value={`${summary?.streak ?? 0} 🔥`} />
        <Stat label="This week" value={summary?.completedThisWeek ?? 0} />
        <Stat label="XP earned" value={summary?.xpEarned ?? 0} />
      </div>

      {module.status === 'paused' ? (
        <p className="text-sm text-gray-400 font-mono">This module is paused — its tasks won't appear in your missions until you resume it.</p>
      ) : module.kind === 'content' ? (
        <ContentModuleView module={module} tasks={tasks} />
      ) : (
        <TasksModuleView module={module} tasks={tasks} />
      )}

      <ModuleBuilder open={builder === 'edit'} onClose={() => setBuilder(null)} module={module} currentTasks={tasks.map(toTaskSpec)} />
      <ModuleBuilder open={builder === 'replace'} onClose={() => setBuilder(null)} replacing={module} onSaved={s => navigate(`/m/${s}`)} />
    </div>
  );
}
