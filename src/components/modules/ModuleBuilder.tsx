import { useState } from 'react';
import { api, DAYS, type ChannelInput, type Day, type HunterModule, type ModuleKind, type ModuleTaskSpec } from '../../lib/api';
import { MODULE_TEMPLATES, type ModuleTemplate } from '../../data/presets';
import { useModuleStore, withXpConfirm } from '../../store/moduleStore';
import { useGameStore } from '../../store/gameStore';
import { Btn, Modal, inputCls } from '../hunter/ui';

type Step = 'source' | 'edit' | 'confirm';
const DIFF_LABEL = { 1: 'Easy', 2: 'Medium', 3: 'Hard' } as const;
const blankTask = (): ModuleTaskSpec => ({ title: '', difficulty: 1, scheduleTime: null, timeOfDay: null, recurrence: null, subtasks: [] });

interface Props {
  open: boolean;
  onClose: () => void;
  /** Edit an existing module (with its current tasks) instead of creating one. */
  module?: HunterModule | null;
  currentTasks?: ModuleTaskSpec[];
  /** Create a new module that replaces this one. */
  replacing?: HunterModule | null;
  onSaved?: (slug: string) => void;
}

/**
 * AI Module Builder + manual module editor. AI only drafts: the hunter
 * reviews and edits every field, and saving is ordinary validated CRUD.
 */
export default function ModuleBuilder({ open, onClose, module, currentTasks, replacing, onSaved }: Props) {
  const modules = useModuleStore(s => s.modules);
  const editing = !!module;
  const [step, setStep] = useState<Step>('source');
  const [prompt, setPrompt] = useState('');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('✨');
  const [kind, setKind] = useState<ModuleKind>('tasks');
  const [goals, setGoals] = useState('');
  const [tasks, setTasks] = useState<ModuleTaskSpec[]>([]);
  const [channels, setChannels] = useState<ChannelInput[]>([]);
  const [tips, setTips] = useState<string[]>([]);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);

  const key = open ? `${module?.id ?? 'new'}-${replacing?.id ?? ''}` : null;
  if (key !== openKey) { // reset whenever the builder (re)opens
    setOpenKey(key);
    setStep(editing ? 'edit' : 'source');
    setPrompt(''); setTips([]); setAck(false); setError(''); setChannels([]);
    setName(module?.name ?? ''); setIcon(module?.icon ?? '✨'); setKind(module?.kind ?? 'tasks');
    setGoals((module?.goals ?? []).join('\n'));
    setTasks(currentTasks?.map(t => ({ ...t })) ?? []);
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const fromTemplate = (tpl: ModuleTemplate) => {
    setName(tpl.name); setIcon(tpl.icon); setKind(tpl.kind); setGoals(tpl.goals.join('\n'));
    setTasks(tpl.tasks.map(t => ({ ...t }))); setChannels(tpl.channels?.map(c => ({ ...c })) ?? []);
    setStep(tpl.kind === 'tasks' || tpl.kind === 'content' ? 'edit' : 'confirm');
  };

  const draft = () => run(async () => {
    const d = await api.draftModule(prompt, module?.id);
    if (!editing) { setName(d.name); setIcon(d.icon); }
    setGoals(d.goals.join('\n'));
    setTasks(d.tasks);
    setTips(d.suggestions);
    setStep('edit');
  });

  const goalList = () => goals.split('\n').map(g => g.trim()).filter(Boolean);
  const valid = name.trim() && tasks.every(t => t.title.trim() && (t.recurrence === null || t.recurrence.length));

  const save = () => run(async () => {
    if (editing && module) {
      await api.updateModule(module.id, { name, icon, goals: goalList() });
      const res = await withXpConfirm(exp => api.saveModuleTasks(module.id, tasks, exp));
      if (res === null) return; // cancelled at the XP confirmation
      await finish(module.slug);
    } else {
      const input = { name, icon, kind, goals: goalList(), tasks, channels: kind === 'content' ? channels : undefined, acknowledged: true as const, replaceModuleId: replacing?.id };
      const res = await withXpConfirm(exp => api.createModule(input, exp));
      if (res === null) return;
      await finish(res.module.slug);
    }
  });

  const finish = async (slug: string) => {
    await Promise.all([useModuleStore.getState().load(), useGameStore.getState().loadDashboard()]);
    onSaved?.(slug);
    onClose();
  };

  const setTask = (i: number, patch: Partial<ModuleTaskSpec>) => setTasks(ts => ts.map((t, n) => (n === i ? { ...t, ...patch } : t)));
  const toggleDay = (i: number, d: Day) => {
    const days = tasks[i].recurrence ?? DAYS;
    const next = days.includes(d) ? days.filter(x => x !== d) : DAYS.filter(x => x === d || days.includes(x));
    setTask(i, { recurrence: next.length === 7 ? null : next });
  };
  const taken = new Set(modules.filter(m => m.id !== replacing?.id).map(m => m.kind));
  const templates = MODULE_TEMPLATES.filter(t => t.kind === 'tasks' || !taken.has(t.kind));

  const title = editing ? `EDIT ${module!.name.toUpperCase()}` : replacing ? `REPLACE ${replacing.name.toUpperCase()}` : 'NEW MODULE';

  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      {step === 'source' && (
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm text-gray-400 font-mono">Describe the module you want — Hunter drafts it and you review every detail before saving.</p>
            <textarea className={`${inputCls} min-h-20`} maxLength={1500} value={prompt} onChange={e => setPrompt(e.target.value)}
              placeholder="Create a skincare module for my morning and night routine." />
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => { setTasks([blankTask()]); setStep('edit'); }}>START BLANK</Btn>
              <Btn onClick={draft} disabled={busy || prompt.trim().length < 5}>{busy ? 'DRAFTING…' : 'DRAFT WITH AI'}</Btn>
            </div>
            {error && <p className="text-sm text-yellow-300/90 font-mono">{error}</p>}
          </div>
          <div>
            <p className="text-xs font-mono text-purple-300 uppercase tracking-[0.2em] mb-2">Or start from a template</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {templates.map(tpl => (
                <button key={tpl.key} type="button" onClick={() => fromTemplate(tpl)}
                  className="text-left p-3 rounded-lg border border-purple-500/20 hover:border-purple-400/60 bg-[#161b22]/80 transition-colors">
                  <p className="text-sm text-white font-mono">{tpl.icon} {tpl.name}</p>
                  <p className="text-[11px] text-gray-500 font-mono">{tpl.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 'edit' && (
        <div className="space-y-4">
          {editing && (
            <div className="flex gap-2">
              <input className={inputCls} maxLength={1500} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Ask AI to change this module, e.g. add a weekly exfoliation step" />
              <Btn onClick={draft} disabled={busy || prompt.trim().length < 5}>{busy ? '…' : 'AI EDIT'}</Btn>
            </div>
          )}
          {tips.length > 0 && <ul className="text-xs font-mono text-purple-200/80 list-disc pl-5">{tips.map(t => <li key={t}>{t}</li>)}</ul>}
          <div className="grid grid-cols-6 gap-2">
            <input aria-label="Icon" className={`${inputCls} col-span-1 text-center`} value={icon} onChange={e => setIcon(e.target.value)} />
            <input aria-label="Module name" className={`${inputCls} col-span-5`} maxLength={60} value={name} onChange={e => setName(e.target.value)} placeholder="Module name" />
          </div>
          <textarea aria-label="Goals" className={`${inputCls} min-h-14`} value={goals} onChange={e => setGoals(e.target.value)} placeholder="Goals (one per line)" />

          <div className="space-y-2">
            <p className="text-xs font-mono text-purple-300 uppercase tracking-[0.2em]">Tasks</p>
            {tasks.map((t, i) => (
              <div key={t.id ?? `new-${i}`} className="rounded-lg border border-purple-500/15 bg-[#161b22]/60 p-2 space-y-2">
                <div className="grid grid-cols-12 gap-2">
                  <input aria-label="Task title" className={`${inputCls} col-span-12 sm:col-span-5`} maxLength={120} value={t.title} onChange={e => setTask(i, { title: e.target.value })} placeholder="Task" />
                  <select aria-label="Difficulty" className={`${inputCls} col-span-4 sm:col-span-2`} value={t.difficulty} onChange={e => setTask(i, { difficulty: Number(e.target.value) as 1 | 2 | 3 })}>
                    {([1, 2, 3] as const).map(d => <option key={d} value={d}>{DIFF_LABEL[d]}</option>)}
                  </select>
                  <input aria-label="Time" type="time" className={`${inputCls} col-span-4 sm:col-span-2`} value={t.scheduleTime ?? ''} onChange={e => setTask(i, { scheduleTime: e.target.value || null })} />
                  <select aria-label="Part of day" className={`${inputCls} col-span-3 sm:col-span-2`} value={t.timeOfDay ?? ''} onChange={e => setTask(i, { timeOfDay: (e.target.value || null) as ModuleTaskSpec['timeOfDay'] })}>
                    <option value="">Any</option><option value="morning">Morning</option><option value="evening">Night</option>
                  </select>
                  <button type="button" aria-label={`Remove ${t.title || 'task'}`} className="col-span-1 text-gray-500 hover:text-red-400" onClick={() => setTasks(ts => ts.filter((_, n) => n !== i))}>✕</button>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {DAYS.map(d => (
                    <button key={d} type="button" aria-pressed={(t.recurrence ?? DAYS).includes(d)} onClick={() => toggleDay(i, d)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${(t.recurrence ?? DAYS).includes(d) ? 'bg-purple-500/20 border-purple-400/50 text-purple-200' : 'border-gray-700 text-gray-600'}`}>{d}</button>
                  ))}
                  {t.xp !== undefined && <span className="ml-auto text-xs font-display text-gold">+{t.xp} XP</span>}
                </div>
                <input aria-label="Subtasks" className={`${inputCls} text-xs`} value={(t.subtasks ?? []).join(', ')}
                  onChange={e => setTask(i, { subtasks: e.target.value.split(',').map(s => s.trimStart()).filter((s, n, a) => s || n === a.length - 1) })}
                  placeholder="Optional subtasks, comma separated" />
              </div>
            ))}
            <Btn variant="ghost" onClick={() => setTasks(ts => [...ts, blankTask()])}>+ ADD TASK</Btn>
          </div>

          {kind === 'content' && !editing && (
            <div className="space-y-2">
              <p className="text-xs font-mono text-purple-300 uppercase tracking-[0.2em]">Channels (editable later)</p>
              {channels.map((c, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <input aria-label="Channel name" className={`${inputCls} col-span-6`} value={c.name ?? ''} onChange={e => setChannels(cs => cs.map((x, n) => (n === i ? { ...x, name: e.target.value } : x)))} />
                  <input aria-label="Platform" className={`${inputCls} col-span-3`} value={c.platform ?? ''} onChange={e => setChannels(cs => cs.map((x, n) => (n === i ? { ...x, platform: e.target.value } : x)))} />
                  <input aria-label="Posts per week" type="number" min={0} max={50} className={`${inputCls} col-span-2`} value={c.targetPerWeek ?? 1} onChange={e => setChannels(cs => cs.map((x, n) => (n === i ? { ...x, targetPerWeek: Number(e.target.value) } : x)))} />
                  <button type="button" aria-label="Remove channel" className="col-span-1 text-gray-500 hover:text-red-400" onClick={() => setChannels(cs => cs.filter((_, n) => n !== i))}>✕</button>
                </div>
              ))}
              <Btn variant="ghost" onClick={() => setChannels(cs => [...cs, { name: '', platform: 'instagram', targetPerWeek: 1 }])}>+ ADD CHANNEL</Btn>
            </div>
          )}

          <p className="text-[11px] font-mono text-gray-500">XP per task is set by difficulty using Hunter's standard task rewards.</p>
          {error && <p className="text-sm text-red-400 font-mono">{error}</p>}
          <div className="flex justify-between gap-2">
            {editing ? <span /> : <Btn variant="ghost" onClick={() => setStep('source')}>BACK</Btn>}
            {editing
              ? <Btn onClick={save} disabled={busy || !valid}>{busy ? 'SAVING…' : 'SAVE MODULE'}</Btn>
              : <Btn onClick={() => setStep('confirm')} disabled={!valid}>REVIEW</Btn>}
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-4 font-mono text-sm">
          <div className="rounded-lg border border-purple-500/20 p-3">
            <p className="text-white text-base">{icon} {name}</p>
            {goalList().length > 0 && <p className="text-xs text-gray-400 mt-1">Goals: {goalList().join(' · ')}</p>}
            <p className="text-xs text-gray-500 mt-1">{tasks.length} task{tasks.length === 1 ? '' : 's'}{kind === 'content' ? ` · ${channels.length} channels` : ''}</p>
          </div>
          <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 space-y-2">
            <p className="text-yellow-200">⚠️ You have 2 days to customize this module. After that, major changes or removing the module may reduce your XP.</p>
            <p className="text-gray-300 text-xs">
              {replacing
                ? `Replacing ${replacing.name} counts as changing an established commitment — you'll see the exact XP impact before it's applied.`
                : 'Adding a module gives a small XP reward. You will always see the exact XP impact and confirm before any penalty is applied.'}
            </p>
            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />
              <span className="text-white">I understand</span>
            </label>
          </div>
          {error && <p className="text-red-400">{error}</p>}
          <div className="flex justify-between gap-2">
            <Btn variant="ghost" onClick={() => setStep(kind === 'tasks' || kind === 'content' ? 'edit' : 'source')}>BACK</Btn>
            <Btn onClick={save} disabled={!ack || busy}>{busy ? 'ACTIVATING…' : 'ACTIVATE MODULE'}</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}
