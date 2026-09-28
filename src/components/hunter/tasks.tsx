import { useState } from 'react';
import { api, DAYS, type ContentChannel, type ContentStage, type CustomTaskInput, type Day, type Quest } from '../../lib/api';
import { useGameStore } from '../../store/gameStore';
import { withXpConfirm } from '../../store/moduleStore';
import { Btn, Modal, inputCls } from './ui';
import { STAGES, isDoneToday, isScheduledToday, refresh, todayKey } from './taskUtils';

export function TaskRow({ quest, subtitle, onEdit }: { quest: Quest; subtitle?: string; onEdit?: () => void }) {
  const completeQuest = useGameStore(s => s.completeQuest);
  const done = isDoneToday(quest);
  const scheduled = isScheduledToday(quest);
  const meta = [quest.schedule_time, quest.recurrence?.length ? quest.recurrence.join(' ') : 'Daily', subtitle].filter(Boolean).join(' · ');
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${done ? 'bg-purple-500/10 border-purple-500/30' : 'bg-[#161b22]/80 border-purple-500/15'} ${scheduled ? '' : 'opacity-50'}`}>
      <button
        type="button"
        disabled={!scheduled}
        onClick={() => completeQuest(quest.quest_id, todayKey())}
        aria-label={done ? `Undo ${quest.title}` : `Complete ${quest.title}`}
        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 ${done ? 'border-purple-400 text-purple-300' : 'border-gray-600 hover:border-purple-400'} disabled:cursor-not-allowed`}
      >
        {done && '✓'}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`font-mono text-sm truncate ${done ? 'text-gray-500 line-through' : 'text-white'}`}>{quest.title}</p>
        <p className="text-[11px] font-mono text-gray-500 truncate">{scheduled ? meta : `Not scheduled today · ${meta}`}</p>
        {!!quest.metadata?.subtasks?.length && <p className="text-[11px] font-mono text-purple-300/70 truncate">↳ {quest.metadata.subtasks.join(' · ')}</p>}
      </div>
      <span className={`text-sm font-display font-bold ${done ? 'text-gray-500' : 'text-gold'}`}>+{quest.xp_reward}</span>
      {onEdit && (
        <button type="button" onClick={onEdit} className="text-gray-500 hover:text-purple-300 text-xs font-mono px-1" aria-label={`Edit ${quest.title}`}>
          EDIT
        </button>
      )}
    </div>
  );
}

interface EditorProps {
  open: boolean;
  onClose: () => void;
  module: string;
  quest?: Quest | null;
  defaults?: CustomTaskInput;
  channels?: ContentChannel[]; // content module: pick channel + stage
}

export function TaskEditor({ open, onClose, module, quest, defaults, channels }: EditorProps) {
  const init = (): CustomTaskInput => quest
    ? {
        title: quest.title,
        difficulty: quest.difficulty as 1 | 2 | 3,
        scheduleTime: quest.schedule_time ?? null,
        timeOfDay: quest.time_of_day ?? null,
        recurrence: quest.recurrence ?? null,
        metadata: quest.metadata ?? null,
        subtasks: quest.metadata?.subtasks ?? [],
      }
    : { title: '', difficulty: 1, scheduleTime: null, timeOfDay: null, recurrence: null, metadata: null, ...defaults };
  const [form, setForm] = useState<CustomTaskInput>(init);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = `${open}-${quest?.quest_id ?? 'new'}`;
  if (key !== lastKey) { // reset the form whenever the dialog (re)opens
    setLastKey(key);
    setForm(init());
    setError('');
  }

  const set = (patch: Partial<CustomTaskInput>) => setForm(f => ({ ...f, ...patch }));
  const days = form.recurrence ?? DAYS;
  const toggleDay = (d: Day) => {
    const next = days.includes(d) ? days.filter(x => x !== d) : DAYS.filter(x => x === d || days.includes(x));
    set({ recurrence: next.length === 7 ? null : next });
  };
  const stage = form.metadata?.stage;

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      if (quest) {
        // Established tasks: the server asks us to confirm any XP impact first.
        if ((await withXpConfirm(exp => api.updateTask(quest.quest_id, form, exp))) === null) return;
      } else await api.createTask({ ...form, module });
      await refresh();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!quest || !confirm(`Delete "${quest.title}"? Past completions and XP are kept.`)) return;
    try {
      if ((await withXpConfirm(exp => api.deleteTask(quest.quest_id, exp))) === null) return;
      await refresh();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={quest ? 'EDIT TASK' : 'NEW TASK'}>
      <div className="space-y-4">
        {channels && (
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-mono text-gray-400 space-y-1">
              <span>Channel</span>
              <select className={inputCls} value={form.metadata?.channelId ?? ''} onChange={e => set({ metadata: { ...form.metadata, channelId: e.target.value ? Number(e.target.value) : undefined } })}>
                <option value="">— none —</option>
                {channels.map(c => <option key={c.id} value={c.id}>{c.name} ({c.platform})</option>)}
              </select>
            </label>
            <label className="text-xs font-mono text-gray-400 space-y-1">
              <span>Stage</span>
              <select className={inputCls} value={stage ?? ''} onChange={e => set({ metadata: { ...form.metadata, stage: (e.target.value || undefined) as ContentStage } })}>
                <option value="">— none —</option>
                {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
          </div>
        )}
        <label className="block text-xs font-mono text-gray-400 space-y-1">
          <span>Task</span>
          <input className={inputCls} list="task-examples" value={form.title ?? ''} maxLength={120} onChange={e => set({ title: e.target.value })} placeholder="e.g. Sunscreen" autoFocus />
          {channels && (
            <datalist id="task-examples">
              {(STAGES.find(s => s.id === stage)?.examples ?? STAGES.flatMap(s => s.examples)).map(x => <option key={x} value={x} />)}
            </datalist>
          )}
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="text-xs font-mono text-gray-400 space-y-1">
            <span>Difficulty</span>
            <select className={inputCls} value={form.difficulty} onChange={e => set({ difficulty: Number(e.target.value) as 1 | 2 | 3 })}>
              <option value={1}>Easy</option>
              <option value={2}>Medium</option>
              <option value={3}>Hard</option>
            </select>
          </label>
          <label className="text-xs font-mono text-gray-400 space-y-1">
            <span>Time</span>
            <input type="time" className={inputCls} value={form.scheduleTime ?? ''} onChange={e => set({ scheduleTime: e.target.value || null })} />
          </label>
          <label className="text-xs font-mono text-gray-400 space-y-1">
            <span>Part of day</span>
            <select className={inputCls} value={form.timeOfDay ?? ''} onChange={e => set({ timeOfDay: (e.target.value || null) as CustomTaskInput['timeOfDay'] })}>
              <option value="">Any</option>
              <option value="morning">Morning</option>
              <option value="evening">Evening / Night</option>
            </select>
          </label>
        </div>
        <div className="space-y-1">
          <span className="text-xs font-mono text-gray-400">Repeats</span>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map(d => (
              <button key={d} type="button" onClick={() => toggleDay(d)} aria-pressed={days.includes(d)}
                className={`px-2 py-1 rounded-md text-[11px] font-mono border ${days.includes(d) ? 'bg-purple-500/20 border-purple-400/50 text-purple-200' : 'border-gray-700 text-gray-500'}`}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <label className="block text-xs font-mono text-gray-400 space-y-1">
          <span>Subtasks (optional, comma separated)</span>
          <input className={inputCls} value={(form.subtasks ?? []).join(', ')}
            onChange={e => set({ subtasks: e.target.value.split(',').map(x => x.trimStart()).filter((x, n, a) => x || n === a.length - 1) })} />
        </label>
        <p className="text-[11px] font-mono text-gray-500">XP is set by difficulty (Easy/Medium/Hard) using Hunter's standard task rewards.</p>
        {error && <p className="text-sm text-red-400 font-mono">{error}</p>}
        <div className="flex justify-between gap-2">
          {quest ? <Btn variant="danger" onClick={remove}>DELETE</Btn> : <span />}
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={onClose}>CANCEL</Btn>
            <Btn onClick={save} disabled={busy || !form.title?.trim() || days.length === 0}>{busy ? 'SAVING…' : 'SAVE'}</Btn>
          </div>
        </div>
      </div>
    </Modal>
  );
}
