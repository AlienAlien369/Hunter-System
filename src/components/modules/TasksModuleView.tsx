import { useState } from 'react';
import type { CustomTaskInput, HunterModule, Quest } from '../../lib/api';
import { useT } from '../../i18n';
import { Panel } from '../hunter/ui';
import { TaskEditor, TaskRow } from '../hunter/tasks';

const SECTIONS = [
  { key: 'morning', title: 'tm.morning', icon: '☀️' },
  { key: 'evening', title: 'tm.night', icon: '🌙' },
  { key: 'anytime', title: 'tm.anytime', icon: '✨' },
] as const;

/** Generic task module (Skincare, Fitness, Reading, custom…): tasks grouped by part of day. */
export default function TasksModuleView({ module, tasks }: { module: HunterModule; tasks: Quest[] }) {
  const t = useT();
  const [editing, setEditing] = useState<{ quest?: Quest; defaults?: CustomTaskInput } | null>(null);
  const grouped = tasks.some(q => q.time_of_day);
  const sections = grouped ? SECTIONS : [{ key: 'anytime', title: 'tm.tasks', icon: module.icon }] as const;

  return (
    <>
      <div className={`grid grid-cols-1 ${grouped ? 'lg:grid-cols-2' : ''} gap-6`}>
        {sections.map(s => {
          const list = grouped ? tasks.filter(q => (q.time_of_day ?? 'anytime') === s.key) : tasks;
          if (grouped && !list.length && s.key === 'anytime') return null;
          return (
            <Panel key={s.key} title={`${s.icon} ${t(s.title)}`} right={
              <button type="button" className="text-xs font-mono text-purple-300 hover:text-white"
                onClick={() => setEditing({ defaults: { timeOfDay: s.key === 'anytime' ? null : s.key } })}>{t('tm.add')}</button>
            }>
              <div className="space-y-2">
                {list.length ? list.map(q => <TaskRow key={q.quest_id} quest={q} onEdit={() => setEditing({ quest: q })} />)
                  : <p className="text-sm text-gray-500 font-mono">{t('tm.none')}</p>}
              </div>
            </Panel>
          );
        })}
      </div>
      <TaskEditor open={!!editing} onClose={() => setEditing(null)} module={module.slug} quest={editing?.quest} defaults={editing?.defaults} />
    </>
  );
}
