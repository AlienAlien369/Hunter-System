import { useState } from 'react';
import { api, type RoutineItem } from '../../lib/api';
import { useGameStore } from '../../store/gameStore';
import { MODULE_TEMPLATES } from '../../data/presets';
import { useModuleStore } from '../../store/moduleStore';
import { Btn, Modal, inputCls } from '../hunter/ui';
import { RoutineEditor } from './RoutineEditor';
import { fmtTime, newSlot, slotsValid } from './routineUtils';

type Step = 'describe' | 'schedule' | 'modules' | 'review';

/**
 * Hunter Routine onboarding: describe your day → (optional AI suggestions)
 * → edit slots → optional starter modules → review + commitment warning → confirm.
 * AI output only pre-fills the editor; nothing is saved until the hunter confirms.
 */
export default function RoutineSetup({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState<Step>('describe');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<RoutineItem[]>([]);
  const [tips, setTips] = useState<string[]>([]);
  const [seedSkincare, setSeedSkincare] = useState(false);
  const [seedChannels, setSeedChannels] = useState(false);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const suggest = async () => {
    setBusy(true); setError('');
    try {
      const s = await api.suggestRoutine(description);
      setItems(s.schedule.map(slot => newSlot(slot)));
      setTips(s.suggestions);
      setStep('schedule');
    } catch (e) {
      setError(`${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const manual = () => {
    setError('');
    if (!items.length) setItems([newSlot({ module: 'Wake', title: 'Wake up', time: '06:00', durationMin: 15 })]);
    setStep('schedule');
  };

  const confirm = async () => {
    setBusy(true); setError('');
    try {
      await api.saveRoutine({ items, acknowledged: true, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      // Starter modules are ordinary modules (acknowledged on the review screen).
      for (const key of [seedSkincare && 'skincare', seedChannels && 'content'].filter(Boolean)) {
        const tpl = MODULE_TEMPLATES.find(t => t.key === key)!;
        await api.createModule({ name: tpl.name, icon: tpl.icon, kind: tpl.kind, goals: tpl.goals, tasks: tpl.tasks, channels: tpl.channels, acknowledged: true });
      }
      await Promise.all([useGameStore.getState().loadDashboard(), useModuleStore.getState().load()]);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const modules = [...new Set(items.map(i => i.module))];

  return (
    <Modal open={open} onClose={onClose} title="YOUR HUNTER ROUTINE" wide>
      {step === 'describe' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400 font-mono">
            Tell Hunter about your day and goals — when you wake, work, train, learn, care for your skin, create content. Hunter can turn it into a schedule you can edit, or you can build it yourself.
          </p>
          <textarea className={`${inputCls} min-h-32`} maxLength={1500} value={description} onChange={e => setDescription(e.target.value)}
            placeholder="I wake up at 6, work 9 to 6, want to exercise, learn coding, maintain skincare and create badminton content." />
          {error && <p className="text-sm text-yellow-300/90 font-mono">{error}</p>}
          <div className="flex flex-wrap justify-between gap-2">
            <Btn variant="ghost" onClick={onClose}>SET UP LATER</Btn>
            <div className="flex gap-2">
              <Btn variant="ghost" onClick={manual}>BUILD MANUALLY</Btn>
              <Btn onClick={suggest} disabled={busy || description.trim().length < 10}>{busy ? 'THINKING…' : 'SUGGEST MY ROUTINE'}</Btn>
            </div>
          </div>
        </div>
      )}

      {step === 'schedule' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400 font-mono">Everything here is editable. Each slot belongs to a module (e.g. Skincare, Workout, Content Creation).</p>
          {tips.length > 0 && (
            <ul className="text-xs font-mono text-purple-200/80 list-disc pl-5 space-y-0.5">{tips.map(t => <li key={t}>{t}</li>)}</ul>
          )}
          <RoutineEditor items={items} onChange={setItems} />
          <div className="flex justify-between gap-2">
            <Btn variant="ghost" onClick={() => setStep('describe')}>BACK</Btn>
            <Btn onClick={() => setStep('modules')} disabled={!slotsValid(items)}>NEXT</Btn>
          </div>
        </div>
      )}

      {step === 'modules' && (
        <div className="space-y-4 font-mono text-sm">
          <p className="text-gray-400">Optional starting points — you can edit or delete everything later.</p>
          <label className="flex items-start gap-3 p-3 rounded-lg border border-purple-500/20 cursor-pointer">
            <input type="checkbox" className="mt-1" checked={seedSkincare} onChange={e => setSeedSkincare(e.target.checked)} />
            <span><span className="text-white">🧴 Skincare module</span><span className="block text-xs text-gray-500">Morning: cleanser, serum, moisturizer, sunscreen · Night: cleanser, treatment, moisturizer</span></span>
          </label>
          <label className="flex items-start gap-3 p-3 rounded-lg border border-purple-500/20 cursor-pointer">
            <input type="checkbox" className="mt-1" checked={seedChannels} onChange={e => setSeedChannels(e.target.checked)} />
            <span><span className="text-white">🎬 Content Creation module</span><span className="block text-xs text-gray-500">Badminton: 2 Instagram + 2 YouTube · Business/Tech: 1 Instagram + 1 YouTube</span></span>
          </label>
          <div className="flex justify-between gap-2">
            <Btn variant="ghost" onClick={() => setStep('schedule')}>BACK</Btn>
            <Btn onClick={() => setStep('review')}>REVIEW</Btn>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4 font-mono text-sm">
          <div className="rounded-lg border border-purple-500/20 divide-y divide-purple-500/10 max-h-56 overflow-y-auto custom-scrollbar">
            {[...items].sort((a, b) => a.time.localeCompare(b.time)).map(i => (
              <div key={i.id} className="flex justify-between gap-3 px-3 py-1.5 text-xs">
                <span className="text-purple-300 w-20">{fmtTime(i.time)}</span>
                <span className="flex-1 text-white truncate">{i.title}</span>
                <span className="text-gray-500">{i.days.length === 7 ? 'Daily' : i.days.join(' ')}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">Modules: {modules.join(', ')}</p>

          <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 space-y-2">
            <p className="font-display text-yellow-200 tracking-[0.2em]">⚠️ YOUR HUNTER ROUTINE</p>
            <p className="text-gray-200">Your first 2 days are your setup period. During this time you can fine-tune your routine freely.</p>
            <p className="text-gray-200">After the first 2 days:</p>
            <ul className="list-disc pl-5 text-gray-300 space-y-0.5">
              <li>Changing established modules may reduce XP.</li>
              <li>Major timetable changes may reduce XP.</li>
              <li>Removing an established commitment may reduce XP.</li>
              <li>Adding a new module may give a small XP reward.</li>
            </ul>
            {(seedSkincare || seedChannels) && (
              <p className="text-gray-200">⚠️ You have 2 days to customize each new module. After that, major changes or removing the module may reduce your XP.</p>
            )}
            <p className="text-gray-200">You'll always see the exact XP impact and confirm before any change is applied. Choose your routine carefully.</p>
            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />
              <span className="text-white">I understand</span>
            </label>
          </div>
          {error && <p className="text-red-400">{error}</p>}
          <div className="flex justify-between gap-2">
            <Btn variant="ghost" onClick={() => setStep('modules')}>BACK</Btn>
            <Btn onClick={confirm} disabled={!ack || busy}>{busy ? 'CONFIRMING…' : 'CONFIRM MY HUNTER ROUTINE'}</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}
