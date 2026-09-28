import { useState } from 'react';
import type { CustomTaskInput, HunterModule, Quest } from '../../lib/api';
import { Panel } from '../hunter/ui';
import { TaskEditor, TaskRow } from '../hunter/tasks';

const SECTIONS = [
  { key: 'morning', title: 'MORNING', icon: '☀️' },
  { key: 'evening', title: 'NIGHT', icon: '🌙' },
  { key: 'anytime', title: 'ANYTIME', icon: '✨' },
] as const;

/** Generic task module (Skincare, Fitness, Reading, custom…): tasks grouped by part of day. */
export default function TasksModuleView({ module, tasks }: { module: HunterModule; tasks: Quest[] }) {
  const [editing, setEditing] = useState<{ quest?: Quest; defaults?: CustomTaskInput } | null>(null);
  const grouped = tasks.some(t => t.time_of_day);
  const sections = grouped ? SECTIONS : [{ key: 'anytime', title: 'TASKS', icon: module.icon }] as const;

  return (
    <>
      <div className={`grid grid-cols-1 ${grouped ? 'lg:grid-cols-2' : ''} gap-6`}>
        {sections.map(s => {
          const list = grouped ? tasks.filter(t => (t.time_of_day ?? 'anytime') === s.key) : tasks;
          if (grouped && !list.length && s.key === 'anytime') return null;
          return (
            <Panel key={s.key} title={`${s.icon} ${s.title}`} right={
              <button type="button" className="text-xs font-mono text-purple-300 hover:text-white"
                onClick={() => setEditing({ defaults: { timeOfDay: s.key === 'anytime' ? null : s.key } })}>+ ADD</button>
            }>
              <div className="space-y-2">
                {list.length ? list.map(q => <TaskRow key={q.quest_id} quest={q} onEdit={() => setEditing({ quest: q })} />)
                  : <p className="text-sm text-gray-500 font-mono">No tasks here yet.</p>}
              </div>
            </Panel>
          );
        })}
      </div>
      <TaskEditor open={!!editing} onClose={() => setEditing(null)} module={module.slug} quest={editing?.quest} defaults={editing?.defaults} />
    </>
  );
}
