import { useState } from 'react';
import { api, isAiLimited, type RoutineItem } from '../../lib/api';
import { useGameStore } from '../../store/gameStore';
import { MODULE_TEMPLATES } from '../../data/presets';
import { useModuleStore } from '../../store/moduleStore';
import AiLimitNote from '../AiLimitNote';
import { Btn, Modal, inputCls } from '../hunter/ui';
import { useT } from '../../i18n';
import { RoutineEditor } from './RoutineEditor';
import { fmtTime, newSlot, slotsValid } from './routineUtils';

type Step = 'describe' | 'schedule' | 'modules' | 'review';

/**
 * Hunter Routine onboarding: describe your day → (optional AI suggestions)
 * → edit slots → optional starter modules → review + commitment warning → confirm.
 * AI output only pre-fills the editor; nothing is saved until the hunter confirms.
 */
export default function RoutineSetup({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [step, setStep] = useState<Step>('describe');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<RoutineItem[]>([]);
  const [tips, setTips] = useState<string[]>([]);
  const [seedSkincare, setSeedSkincare] = useState(false);
  const [seedChannels, setSeedChannels] = useState(false);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [aiLimited, setAiLimited] = useState(false);

  const suggest = async () => {
    setBusy(true); setError(''); setAiLimited(false);
    try {
      const s = await api.suggestRoutine(description);
      setItems(s.schedule.map(slot => newSlot(slot)));
      setTips(s.suggestions);
      setStep('schedule');
    } catch (e) {
      if (isAiLimited(e)) setAiLimited(true); else setError(`${(e as Error).message}`);
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
    <Modal open={open} onClose={onClose} title={t('rs.title')} wide>
      {step === 'describe' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400 font-mono">
            {t('rs.intro')}
          </p>
          <textarea className={`${inputCls} min-h-32`} maxLength={1500} value={description} onChange={e => setDescription(e.target.value)}
            placeholder={t('rs.placeholder')} />
          {aiLimited && <AiLimitNote />}
          {error && <p className="text-sm text-yellow-300/90 font-mono">{error}</p>}
          <div className="flex flex-wrap justify-between gap-2">
            <Btn variant="ghost" onClick={onClose}>{t('rs.later')}</Btn>
            <div className="flex gap-2">
              <Btn variant="ghost" onClick={manual}>{t('rs.manual')}</Btn>
              <Btn onClick={suggest} disabled={busy || description.trim().length < 10}>{busy ? t('rs.thinking') : t('rs.suggest')}</Btn>
            </div>
          </div>
        </div>
      )}

      {step === 'schedule' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400 font-mono">{t('rs.editable')}</p>
          {tips.length > 0 && (
            <ul className="text-xs font-mono text-purple-200/80 list-disc pl-5 space-y-0.5">{tips.map(tip => <li key={tip}>{tip}</li>)}</ul>
          )}
          <RoutineEditor items={items} onChange={setItems} />
          <div className="flex justify-between gap-2">
            <Btn variant="ghost" onClick={() => setStep('describe')}>{t('rs.back')}</Btn>
            <Btn onClick={() => setStep('modules')} disabled={!slotsValid(items)}>{t('rs.next')}</Btn>
          </div>
        </div>
      )}

      {step === 'modules' && (
        <div className="space-y-4 font-mono text-sm">
          <p className="text-gray-400">{t('rs.optional')}</p>
          <label className="flex items-start gap-3 p-3 rounded-lg border border-purple-500/20 cursor-pointer">
            <input type="checkbox" className="mt-1" checked={seedSkincare} onChange={e => setSeedSkincare(e.target.checked)} />
            <span><span className="text-white">{t('rs.skincare')}</span><span className="block text-xs text-gray-500">{t('rs.skincareDesc')}</span></span>
          </label>
          <label className="flex items-start gap-3 p-3 rounded-lg border border-purple-500/20 cursor-pointer">
            <input type="checkbox" className="mt-1" checked={seedChannels} onChange={e => setSeedChannels(e.target.checked)} />
            <span><span className="text-white">{t('rs.content')}</span><span className="block text-xs text-gray-500">{t('rs.contentDesc')}</span></span>
          </label>
          <div className="flex justify-between gap-2">
            <Btn variant="ghost" onClick={() => setStep('schedule')}>{t('rs.back')}</Btn>
            <Btn onClick={() => setStep('review')}>{t('rs.review')}</Btn>
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
                <span className="text-gray-500">{i.days.length === 7 ? t('rs.daily') : i.days.join(' ')}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">{t('rs.modules', { list: modules.join(', ') })}</p>

          <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 space-y-2">
            <p className="font-display text-yellow-200 tracking-[0.2em]">{t('rs.warnTitle')}</p>
            <p className="text-gray-200">{t('rs.warn1')}</p>
            <p className="text-gray-200">{t('rs.warn2')}</p>
            <ul className="list-disc pl-5 text-gray-300 space-y-0.5">
              <li>{t('rs.warn3')}</li>
              <li>{t('rs.warn4')}</li>
              <li>{t('rs.warn5')}</li>
              <li>{t('rs.warn6')}</li>
            </ul>
            {(seedSkincare || seedChannels) && (
              <p className="text-gray-200">{t('rs.warn7')}</p>
            )}
            <p className="text-gray-200">{t('rs.warn8')}</p>
            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />
              <span className="text-white">{t('rs.understand')}</span>
            </label>
          </div>
          {error && <p className="text-red-400">{error}</p>}
          <div className="flex justify-between gap-2">
            <Btn variant="ghost" onClick={() => setStep('modules')}>{t('rs.back')}</Btn>
            <Btn onClick={confirm} disabled={!ack || busy}>{busy ? t('rs.confirming') : t('rs.confirm')}</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}
