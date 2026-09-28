import { useEffect, useState } from 'react';
import { api, type ChannelInput, type ContentChannel, type HunterModule, type Quest } from '../../lib/api';
import { useGameStore } from '../../store/gameStore';
import { Btn, Modal, Panel, inputCls } from '../hunter/ui';
import { TaskEditor, TaskRow } from '../hunter/tasks';
import { STAGES, isDoneToday, isScheduledToday, refresh } from '../hunter/taskUtils';
import { MODULE_TEMPLATES } from '../../data/presets';

const STARTER_CHANNELS = MODULE_TEMPLATES.find(t => t.kind === 'content')?.channels ?? [];

const PLATFORMS = ['instagram', 'youtube', 'linkedin', 'tiktok', 'x', 'facebook', 'other'];
const PLATFORM_ICON: Record<string, string> = { instagram: '📸', youtube: '▶️', linkedin: '💼', tiktok: '🎵', x: '𝕏', facebook: '📘' };

type Progress = Record<number, { published: number; target: number }>;

/** Content Creation module: user-defined channels, today's missions and the content pipeline. */
export default function ContentModuleView({ module, tasks }: { module: HunterModule; tasks: Quest[] }) {
  const xp = useGameStore(s => s.profile.xp);
  const [channels, setChannels] = useState<ContentChannel[]>([]);
  const [progress, setProgress] = useState<Progress>({});
  const [channelForm, setChannelForm] = useState<{ channel?: ContentChannel } | null>(null);
  const [taskForm, setTaskForm] = useState<{ quest?: Quest; channelId?: number } | null>(null);
  const [seeding, setSeeding] = useState(false);

  const missions = tasks.filter(isScheduledToday);
  const channelName = (id?: number) => channels.find(c => c.id === id)?.name;

  const loadChannels = () => api.getChannels().then(setChannels).catch(() => {});
  useEffect(() => { loadChannels(); }, []);
  useEffect(() => {
    api.getContentProgress()
      .then(rows => setProgress(Object.fromEntries(rows.map(r => [r.id, { published: r.published, target: r.target_per_week }]))))
      .catch(() => {});
  }, [xp, tasks.length, channels.length]);

  const seed = async () => {
    setSeeding(true);
    try {
      for (const c of STARTER_CHANNELS) await api.createChannel(c);
      await loadChannels();
    } finally {
      setSeeding(false);
    }
  };

  const byPlatform = channels.reduce<Record<string, ContentChannel[]>>((acc, c) => ({ ...acc, [c.platform]: [...(acc[c.platform] ?? []), c] }), {});
  const target = channels.filter(c => c.status === 'active').reduce((s, c) => s + c.target_per_week, 0);
  const published = Object.values(progress).reduce((s, p) => s + p.published, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-mono text-gray-400">Weekly target: <span className="text-white">{published}/{target} posts</span></p>
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={() => setChannelForm({})}>+ CHANNEL</Btn>
          <Btn onClick={() => setTaskForm({})}>+ CONTENT TASK</Btn>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Panel title="CHANNELS" className="lg:col-span-2">
          {channels.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-400 font-mono">No channels yet. Add your own, or start with your badminton and business/tech channels (2 Instagram + 2 YouTube for badminton, 1 + 1 for business/tech) — all editable.</p>
              <div className="flex gap-2">
                <Btn onClick={seed} disabled={seeding}>{seeding ? 'ADDING…' : 'USE STARTER CHANNELS'}</Btn>
                <Btn variant="ghost" onClick={() => setChannelForm({})}>ADD CHANNEL</Btn>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {Object.entries(byPlatform).map(([platform, list]) => (
                <div key={platform}>
                  <p className="text-xs font-mono text-purple-300 uppercase tracking-[0.2em] mb-2">{PLATFORM_ICON[platform] ?? '🌐'} {platform}</p>
                  <div className="space-y-2">
                    {list.map(c => {
                      const p = progress[c.id];
                      const pct = c.target_per_week ? Math.min(100, ((p?.published ?? 0) / c.target_per_week) * 100) : 0;
                      return (
                        <div key={c.id} className={`p-3 rounded-lg bg-[#161b22]/80 border border-purple-500/15 ${c.status !== 'active' ? 'opacity-50' : ''}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-mono text-sm text-white truncate">{c.name}</p>
                              <p className="text-[11px] font-mono text-gray-500 truncate">{[c.category, c.posting_frequency, c.status !== 'active' && c.status].filter(Boolean).join(' · ')}</p>
                            </div>
                            <div className="flex gap-2 text-xs font-mono flex-shrink-0">
                              <button type="button" className="text-purple-300 hover:text-white" onClick={() => setTaskForm({ channelId: c.id })}>+TASK</button>
                              <button type="button" className="text-gray-500 hover:text-white" onClick={() => setChannelForm({ channel: c })}>EDIT</button>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[10px] font-mono text-gray-500">{p?.published ?? 0}/{c.target_per_week} this week</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <div className="lg:col-span-3 space-y-6">
          <Panel title="TODAY'S MISSIONS" right={<span className="text-xs font-mono text-purple-300">{missions.filter(isDoneToday).length}/{missions.length} done</span>}>
            <div className="space-y-2">
              {missions.length ? missions.map(q => (
                <TaskRow key={q.quest_id} quest={q} subtitle={[channelName(q.metadata?.channelId), q.metadata?.stage].filter(Boolean).join(' · ')} onEdit={() => setTaskForm({ quest: q })} />
              )) : <p className="text-sm text-gray-500 font-mono">No content missions today. Add a task to a channel to get started.</p>}
            </div>
          </Panel>

          <Panel title="PIPELINE">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {STAGES.map(s => {
                const list = tasks.filter(t => t.metadata?.stage === s.id);
                return (
                  <div key={s.id} className="rounded-lg border border-purple-500/15 p-3">
                    <p className="text-xs font-mono text-purple-300 uppercase tracking-wider mb-2">{s.label} · {list.length}</p>
                    <ul className="space-y-1">
                      {list.slice(0, 6).map(t => (
                        <li key={t.quest_id}>
                          <button type="button" className="text-left text-xs font-mono text-gray-300 hover:text-white truncate w-full" onClick={() => setTaskForm({ quest: t })}>
                            {isDoneToday(t) ? '✓ ' : '• '}{t.title}{channelName(t.metadata?.channelId) ? ` — ${channelName(t.metadata?.channelId)}` : ''}
                          </button>
                        </li>
                      ))}
                      {!list.length && <li className="text-xs font-mono text-gray-600">{s.examples.slice(0, 2).join(', ')}…</li>}
                    </ul>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>

      <ChannelEditor state={channelForm} onClose={() => setChannelForm(null)} onSaved={loadChannels} />
      <TaskEditor
        open={!!taskForm}
        onClose={() => setTaskForm(null)}
        module={module.slug}
        quest={taskForm?.quest}
        defaults={{ difficulty: 2, metadata: taskForm?.channelId ? { channelId: taskForm.channelId, stage: 'research' } : { stage: 'research' } }}
        channels={channels}
      />
    </div>
  );
}

function ChannelEditor({ state, onClose, onSaved }: { state: { channel?: ContentChannel } | null; onClose: () => void; onSaved: () => void }) {
  const c = state?.channel;
  const [form, setForm] = useState<ChannelInput>({});
  const [error, setError] = useState('');
  const [last, setLast] = useState<unknown>(undefined);
  if (state !== last) { // reset when (re)opened
    setLast(state);
    setForm(c ? { name: c.name, platform: c.platform, category: c.category, postingFrequency: c.posting_frequency ?? '', targetPerWeek: c.target_per_week, status: c.status }
      : { name: '', platform: 'instagram', category: '', postingFrequency: '', targetPerWeek: 3, status: 'active' });
    setError('');
  }
  const set = (p: Partial<ChannelInput>) => setForm(f => ({ ...f, ...p }));
  const custom = !PLATFORMS.includes(form.platform ?? '');

  const save = async () => {
    try {
      if (c) await api.updateChannel(c.id, form);
      else await api.createChannel(form);
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const remove = async () => {
    if (!c || !confirm(`Delete "${c.name}"? Its content tasks are archived; earned XP is kept.`)) return;
    await api.deleteChannel(c.id);
    onSaved();
    refresh();
    onClose();
  };

  return (
    <Modal open={!!state} onClose={onClose} title={c ? 'EDIT CHANNEL' : 'ADD CHANNEL'}>
      <div className="space-y-4">
        <label className="block text-xs font-mono text-gray-400 space-y-1">
          <span>Channel name</span>
          <input className={inputCls} value={form.name ?? ''} onChange={e => set({ name: e.target.value })} placeholder="Badminton Instagram #1" autoFocus />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-mono text-gray-400 space-y-1">
            <span>Platform</span>
            <select className={inputCls} value={custom ? 'other' : form.platform} onChange={e => set({ platform: e.target.value })}>
              {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="text-xs font-mono text-gray-400 space-y-1">
            <span>Category</span>
            <input className={inputCls} value={form.category ?? ''} onChange={e => set({ category: e.target.value })} placeholder="Badminton" />
          </label>
        </div>
        {(custom || form.platform === 'other') && (
          <label className="block text-xs font-mono text-gray-400 space-y-1">
            <span>Platform name (optional)</span>
            <input className={inputCls} value={form.platform === 'other' ? '' : form.platform} onChange={e => set({ platform: e.target.value.toLowerCase() || 'other' })} placeholder="threads, pinterest…" />
          </label>
        )}
        <div className="grid grid-cols-3 gap-3">
          <label className="text-xs font-mono text-gray-400 space-y-1 col-span-1">
            <span>Posts / week</span>
            <input type="number" min={0} max={50} className={inputCls} value={form.targetPerWeek ?? 0} onChange={e => set({ targetPerWeek: Number(e.target.value) })} />
          </label>
          <label className="text-xs font-mono text-gray-400 space-y-1 col-span-1">
            <span>Frequency</span>
            <input className={inputCls} value={form.postingFrequency ?? ''} onChange={e => set({ postingFrequency: e.target.value })} placeholder="Mon/Wed/Fri" />
          </label>
          <label className="text-xs font-mono text-gray-400 space-y-1 col-span-1">
            <span>Status</span>
            <select className={inputCls} value={form.status} onChange={e => set({ status: e.target.value as ContentChannel['status'] })}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>
        {error && <p className="text-sm text-red-400 font-mono">{error}</p>}
        <div className="flex justify-between gap-2">
          {c ? <Btn variant="danger" onClick={remove}>DELETE</Btn> : <span />}
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={onClose}>CANCEL</Btn>
            <Btn onClick={save} disabled={!form.name?.trim()}>SAVE</Btn>
          </div>
        </div>
      </div>
    </Modal>
  );
}
