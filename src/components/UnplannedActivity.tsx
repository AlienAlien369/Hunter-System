import { useState } from 'react';
import { api, UNPLANNED_CATEGORIES, type UnplannedDifficulty, type UnplannedEdits, type UnplannedOffer } from '../lib/api';
import { useT } from '../i18n';
import { en, type MessageKey } from '../i18n/messages/en';
import AiLimitNote from './AiLimitNote';
import { useGameStore } from '../store/gameStore';
import { sfx } from '../utils/sounds';
import { Btn, Modal, inputCls } from './hunter/ui';
import { todayKey } from './hunter/taskUtils';

type Step = 'describe' | 'manual' | 'review' | 'done';
const DIFFS: UnplannedDifficulty[] = ['easy', 'medium', 'hard', 'extreme'];

/** "+ I DID SOMETHING ELSE" — log unplanned work; Hunter's XP engine decides the reward. */
export default function UnplannedActivity() {
  const t = useT();
  const cat = (c: string) => (`unp.cat.${c}` in en ? t(`unp.cat.${c}` as MessageKey) : c);
  const diff = (d: string) => (`unp.diff.${d}` in en ? t(`unp.diff.${d}` as MessageKey) : d);
  const effort = (m: number) => (m >= 60 ? (m === 60 ? t('unp.hour') : t('unp.hours', { n: +(m / 60).toFixed(1) })) : t('unp.min', { n: m }));
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('describe');
  const [description, setDescription] = useState('');
  const [manual, setManual] = useState<Required<UnplannedEdits>>({ title: '', category: 'work', difficulty: 'medium', estimatedMinutes: 30 });
  const [offer, setOffer] = useState<UnplannedOffer | null>(null);
  const [edits, setEdits] = useState<Required<UnplannedEdits> | null>(null);
  const [notice, setNotice] = useState('');
  const [aiLimited, setAiLimited] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [gained, setGained] = useState(0);
  const [dirty, setDirty] = useState(false); // edited since the XP shown was calculated
  const edit = (patch: UnplannedEdits) => { setEdits(e => ({ ...e!, ...patch })); setDirty(true); };

  const reset = () => {
    setStep('describe'); setDescription(''); setOffer(null); setEdits(null); setDirty(false); setNotice(''); setError(''); setAiLimited(false);
  };
  const close = () => {
    if (offer && step === 'review') api.rejectActivity(offer.id).catch(() => {}); // closing = not accepting
    setOpen(false);
    reset();
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const analyze = () => run(async () => {
    const r = await api.analyzeActivity(description);
    if (r.status === 'manual') {
      setNotice(r.message);
      setAiLimited(r.aiLimited === true);
      setManual(m => ({ ...m, title: m.title || description.slice(0, 80) }));
      setStep('manual');
    } else {
      setOffer(r);
      setStep('review');
    }
  });

  const submitManual = () => run(async () => {
    setOffer(await api.manualActivity(description, manual));
    setStep('review');
  });

  const recalc = () => run(async () => {
    if (!offer || !edits) return;
    const p = await api.previewActivity(offer.id, edits);
    setOffer({ ...offer, ...p });
    setDirty(false);
  });

  const accept = () => run(async () => {
    if (!offer) return;
    const r = await api.acceptActivity(offer.id, edits ?? undefined);
    setGained(r.xpGained);
    useGameStore.getState().pushXpFloat(r.xpGained);
    sfx.complete();
    await useGameStore.getState().loadDashboard(); // existing level-up / rank-up celebrations fire here
    setOffer(null);
    setStep('done');
  });

  const reject = () => run(async () => {
    if (offer) await api.rejectActivity(offer.id);
    setOpen(false);
    reset();
  });

  const useExisting = () => run(async () => {
    if (!offer?.similarTask) return;
    await api.rejectActivity(offer.id);
    const { dailyQuests, completeQuest } = useGameStore.getState();
    const existing = dailyQuests.find(q => q.id === offer.similarTask!.questId);
    if (!existing?.completedDates.includes(todayKey())) await completeQuest(offer.similarTask.questId, todayKey());
    setOffer(null);
    setOpen(false);
    reset();
  });

  const a = offer?.analysis;
  const view = edits ?? a;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-unplanned-trigger
        className="px-4 py-2 rounded-lg border border-purple-400/50 bg-purple-600/20 hover:bg-purple-600/40 text-purple-100 font-display text-xs tracking-[0.2em] shadow-lg shadow-purple-500/20 transition-colors"
      >
        {t('unp.button')}
      </button>

      <Modal open={open} onClose={close} title={step === 'review' ? t('unp.titleReview') : step === 'done' ? t('unp.titleDone') : t('unp.titleLog')}>
        {step === 'describe' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400 font-mono">{t('unp.intro')}</p>
            <textarea className={`${inputCls} min-h-28`} maxLength={1000} value={description} onChange={e => setDescription(e.target.value)}
              placeholder={t('unp.placeholder')} autoFocus />
            {error && <p className="text-sm text-red-400 font-mono">{error}</p>}
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={close}>{t('unp.cancel')}</Btn>
              <Btn onClick={analyze} disabled={busy || description.trim().length < 5}>{busy ? t('unp.analyzing') : t('unp.analyze')}</Btn>
            </div>
          </div>
        )}

        {step === 'manual' && (
          <div className="space-y-4">
            {aiLimited ? <AiLimitNote /> : notice && <p className="text-sm text-yellow-300/90 font-mono">{notice}</p>}
            <label className="block text-xs font-mono text-gray-400 space-y-1">
              <span>{t('unp.activity')}</span>
              <input className={inputCls} maxLength={120} value={manual.title} onChange={e => setManual({ ...manual, title: e.target.value })} />
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="text-xs font-mono text-gray-400 space-y-1">
                <span>{t('unp.category')}</span>
                <select className={inputCls} value={manual.category} onChange={e => setManual({ ...manual, category: e.target.value })}>
                  {UNPLANNED_CATEGORIES.map(c => <option key={c} value={c}>{cat(c)}</option>)}
                </select>
              </label>
              <label className="text-xs font-mono text-gray-400 space-y-1">
                <span>{t('unp.difficulty')}</span>
                <select className={inputCls} value={manual.difficulty} onChange={e => setManual({ ...manual, difficulty: e.target.value as UnplannedDifficulty })}>
                  {DIFFS.map(d => <option key={d} value={d}>{diff(d)}</option>)}
                </select>
              </label>
              <label className="text-xs font-mono text-gray-400 space-y-1">
                <span>{t('unp.minutes')}</span>
                <input type="number" min={1} max={960} className={inputCls} value={manual.estimatedMinutes} onChange={e => setManual({ ...manual, estimatedMinutes: Number(e.target.value) })} />
              </label>
            </div>
            {error && <p className="text-sm text-red-400 font-mono">{error}</p>}
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setStep('describe')}>{t('unp.back')}</Btn>
              <Btn onClick={submitManual} disabled={busy || !manual.title.trim()}>{busy ? t('unp.calculating') : t('unp.calculate')}</Btn>
            </div>
          </div>
        )}

        {step === 'review' && offer && a && view && (
          <div className="space-y-4">
            {offer.similarTask && (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 space-y-2">
                <p className="text-sm text-yellow-200 font-mono">{t('unp.similar', { title: '\u0000', xp: offer.similarTask.xpReward }).split('\u0000').map((part, i, arr) => <span key={i}>{part}{i < arr.length - 1 && <b>{offer.similarTask!.title}</b>}</span>)}</p>
                <div className="flex gap-2">
                  <Btn onClick={useExisting} disabled={busy}>{t('unp.useExisting')}</Btn>
                  <Btn variant="ghost" onClick={() => setOffer({ ...offer, similarTask: null })}>{t('unp.continue')}</Btn>
                </div>
              </div>
            )}

            {edits ? (
              <div className="space-y-3">
                <input className={inputCls} maxLength={120} value={edits.title} onChange={e => edit({ title: e.target.value })} />
                <div className="grid grid-cols-3 gap-3">
                  <select className={inputCls} value={edits.category} onChange={e => edit({ category: e.target.value })} aria-label={t('unp.category')}>
                    {UNPLANNED_CATEGORIES.map(c => <option key={c} value={c}>{cat(c)}</option>)}
                  </select>
                  <select className={inputCls} value={edits.difficulty} onChange={e => edit({ difficulty: e.target.value as UnplannedDifficulty })} aria-label={t('unp.difficulty')}>
                    {DIFFS.map(d => <option key={d} value={d}>{diff(d)}</option>)}
                  </select>
                  <input type="number" min={1} max={960} className={inputCls} value={edits.estimatedMinutes} onChange={e => edit({ estimatedMinutes: Number(e.target.value) })} aria-label={t('unp.minutes')} />
                </div>
                <Btn variant="ghost" onClick={recalc} disabled={busy}>{t('unp.recalc')}</Btn>
              </div>
            ) : (
              <div className="space-y-2 font-mono text-sm">
                <p className="text-white text-base">{view.title}</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><p className="text-gray-500">{t('unp.difficulty')}</p><p className="text-white">{diff(view.difficulty)}</p></div>
                  <div><p className="text-gray-500">{t('unp.effort')}</p><p className="text-white">{effort(view.estimatedMinutes)}</p></div>
                  <div><p className="text-gray-500">{t('unp.category')}</p><p className="text-white">{cat(view.category)}</p></div>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-4 text-center">
              <p className="text-xs font-mono text-gray-400 tracking-widest">{t('unp.recommends')}</p>
              <p className="font-display text-3xl text-gold font-bold">+{offer.xp} XP</p>
              {offer.source === 'ai' && a.xpSuggestion > 0 && <p className="text-[11px] font-mono text-gray-500">{t('unp.aiEstimate', { n: a.xpSuggestion })}</p>}
            </div>

            <div className="text-xs font-mono text-gray-400 space-y-1">
              <p><span className="text-gray-500">{t('unp.why')}{' '}</span>{a.reason || t('unp.whyDefault')}</p>
              {a.trivial && <p className="text-yellow-300/80">{t('unp.trivial')}</p>}
              {offer.repeats > 0 && <p className="text-yellow-300/80">{t('unp.repeats', { n: offer.repeats })}</p>}
              {offer.source === 'manual' && <p>{t('unp.manualCap')}</p>}
              <p className="text-gray-500">{t('unp.left', { n: offer.dailyRemaining })}</p>
            </div>

            {error && <p className="text-sm text-red-400 font-mono">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <Btn variant="danger" onClick={reject} disabled={busy}>{t('unp.reject')}</Btn>
              {!edits && <Btn variant="ghost" onClick={() => setEdits({ title: a.title, category: a.category, difficulty: a.difficulty, estimatedMinutes: a.estimatedMinutes })}>{t('unp.edit')}</Btn>}
              <Btn onClick={accept} disabled={busy || dirty || offer.limitReached || offer.xp <= 0}>{offer.limitReached ? t('unp.limit') : dirty ? t('unp.recalcFirst') : t('unp.accept')}</Btn>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4 text-center">
            <p className="font-display text-4xl text-gold font-bold">+{gained} XP</p>
            <p className="text-sm text-gray-400 font-mono">{t('unp.added')}</p>
            <Btn onClick={close}>{t('unp.close')}</Btn>
          </div>
        )}
      </Modal>
    </>
  );
}
