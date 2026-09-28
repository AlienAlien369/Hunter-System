import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, type ActivityEntry, type HunterModule } from '../lib/api';
import { useModuleStore } from '../store/moduleStore';
import { moduleHref } from '../data/presets';
import { Btn, Panel, XpDelta } from '../components/hunter/ui';
import ModuleBuilder from '../components/modules/ModuleBuilder';
import { graceLabel, removeModule, toggleModulePause } from '../components/modules/moduleActions';

/** Modules hub: add (AI / template / blank), pause, replace and remove the hunter's modules. */
export default function Modules() {
  const navigate = useNavigate();
  const { modules, load } = useModuleStore();
  const [history, setHistory] = useState<ActivityEntry[]>([]);
  const [builder, setBuilder] = useState<{ replacing?: HunterModule } | null>(null);
  const [error, setError] = useState('');

  const loadHistory = () => api.getModuleHistory().then(setHistory).catch(() => {});
  useEffect(() => { load(); loadHistory(); }, [load]);

  const act = async (fn: () => Promise<boolean>) => {
    setError('');
    try { if (await fn()) loadHistory(); } catch (e) { setError((e as Error).message); }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display text-white font-bold tracking-wider">MODULES</h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">Your own Hunter modules — add, customize, pause or remove anything beyond the core pages.</p>
        </div>
        <Btn onClick={() => setBuilder({})}>+ NEW MODULE</Btn>
      </motion.div>
      {error && <p className="text-sm text-red-400 font-mono">{error}</p>}

      {modules.length === 0 ? (
        <Panel title="NO MODULES YET">
          <p className="text-sm text-gray-400 font-mono mb-3">Create Skincare, Fitness, Reading, Content Creation or anything else — with AI or from a template.</p>
          <Btn onClick={() => setBuilder({})}>CREATE MY FIRST MODULE</Btn>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {modules.map(m => (
            <div key={m.id} className={`bg-[#0d1117]/90 rounded-xl border border-purple-500/30 p-4 space-y-3 ${m.status === 'paused' ? 'opacity-60' : ''}`}>
              <Link to={moduleHref(m)} className="block">
                <p className="font-display text-white tracking-wider">{m.icon} {m.name}</p>
                <p className="text-[11px] font-mono text-gray-500">
                  {m.status === 'paused' ? 'Paused' : graceLabel(m)}{m.kind === 'tasks' || m.kind === 'content' ? ` · ${m.taskCount ?? 0} tasks` : ''}
                </p>
              </Link>
              <div className="flex flex-wrap gap-2">
                <Btn variant="ghost" onClick={() => navigate(moduleHref(m))}>OPEN</Btn>
                <Btn variant="ghost" onClick={() => act(() => toggleModulePause(m))}>{m.status === 'paused' ? 'RESUME' : 'PAUSE'}</Btn>
                <Btn variant="ghost" onClick={() => setBuilder({ replacing: m })}>REPLACE</Btn>
                <Btn variant="danger" onClick={() => act(() => removeModule(m))}>REMOVE</Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      <Panel title="MODULE HISTORY">
        {history.length ? (
          <ul className="space-y-2 font-mono text-sm">
            {history.map(h => (
              <li key={h.id} className="flex items-center justify-between gap-3">
                <span className="text-gray-500 text-xs w-16 flex-shrink-0">{new Date(h.created_at).toLocaleDateString([], { month: 'short', day: '2-digit' })}</span>
                <span className="flex-1 text-white">
                  {String(h.details?.label ?? h.entity)}
                  {h.details?.detail ? <span className="block text-xs text-gray-500">{String(h.details.detail)}</span> : null}
                </span>
                <XpDelta xp={Number(h.details?.xp ?? 0)} className="text-xs" />
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-gray-500 font-mono">No module changes yet.</p>}
      </Panel>

      <ModuleBuilder open={!!builder} onClose={() => setBuilder(null)} replacing={builder?.replacing}
        onSaved={s => { loadHistory(); navigate(`/m/${s}`); }} />
    </div>
  );
}
